// Create context menu items when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'compressImage',
    title: 'Compress Image to Clipboard',
    contexts: ['image']
  });

  // Set default settings if not already set
  chrome.storage.sync.get({
    quality: 100,
    maxWidth: 4000,
    minWidth: 400,
    maxFileSize: 1048576 // 1MB in bytes
  }, (items) => {
    chrome.storage.sync.set(items);
  });
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});

// Inject content script and wait for it to be ready
async function injectContentScript(tabId) {
  try {
    // Check if we can access the tab
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url.startsWith('http')) {
      throw new Error('Cannot inject script into this type of page');
    }

    // First try to ping existing content script
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      console.log('Content script already present');
      return true; // Content script is already there and responding
    } catch (error) {
      console.log('Content script not found, injecting...');
      // Content script not found or not responding, inject it
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['contentScript.js']
      });

      // Wait for content script to initialize (up to 3 seconds)
      for (let i = 0; i < 30; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await chrome.tabs.sendMessage(tabId, { type: 'ping' });
          console.log('Content script successfully injected and responding');
          return true; // Content script is now ready
        } catch (error) {
          if (i === 29) {
            console.error('Content script injection timeout after 3 seconds');
            throw new Error('Content script failed to initialize after injection');
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to inject content script:', error);
    throw new Error(`Failed to inject content script: ${error.message}`);
  }
}

// Helper function to send messages to tabs
async function sendMessageToTab(tabId, message) {
  try {
    console.log('Sending message to tab:', { tabId, message });

    // Ensure content script is injected
    await injectContentScript(tabId);

    // Send the message and wait for response with a timeout
    const response = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout: No response from content script after 10 seconds'));
      }, 10000); // 10 second timeout

      chrome.tabs.sendMessage(tabId, message, (result) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(result);
        }
      });
    });

    console.log('Received response from tab:', response);

    if (!response) {
      throw new Error('Empty response from content script');
    }
    if (response.error) {
      throw new Error(`Content script error: ${response.error}`);
    }
    return response;
  } catch (error) {
    console.error('Failed to send message to tab:', error);
    throw error;
  }
}

// Handle image compression
async function compressImage(imageData, settings) {
  // Create a canvas element
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d');

  // Create an image element
  const img = await createImageBitmap(imageData);

  // Start with original dimensions
  let width = img.width;
  let height = img.height;
  let quality = settings.quality / 100;
  let currentSize = Infinity;
  let attempts = 0;
  const maxAttempts = 5;

  // Binary search for the right size/quality
  while (currentSize > settings.maxFileSize && attempts < maxAttempts) {
    // Calculate new dimensions maintaining aspect ratio
    if (width > settings.maxWidth) {
      height = (settings.maxWidth / width) * height;
      width = settings.maxWidth;
    }

    // Set canvas size and draw image
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    // Compress the image
    const blob = await canvas.convertToBlob({
      type: `image/${settings.format}`,
      quality: quality
    });

    currentSize = blob.size;

    if (currentSize > settings.maxFileSize) {
      // If still too large, reduce dimensions or quality
      if (width > settings.minWidth) {
        // Reduce size by 20% each time
        width = Math.max(Math.floor(width * 0.8), settings.minWidth);
        height = Math.floor((width / img.width) * img.height);
      } else {
        // If we can't reduce size further, reduce quality
        quality = Math.max(quality * 0.8, 0.5);
      }
    }

    attempts++;
  }

  // Final compression with best found settings
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const finalBlob = await canvas.convertToBlob({
    type: `image/${settings.format}`,
    quality: quality
  });

  return finalBlob;
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'compressImage') {
    try {
      console.log('Context menu clicked:', { info, tab });

      // Validate required info
      if (!info.srcUrl) {
        throw new Error('No image URL provided');
      }
      if (!tab || !tab.id) {
        throw new Error('Invalid tab context');
      }

      // Get settings
      const settings = await chrome.storage.sync.get({
        quality: 100,
        maxWidth: 400,
        minWidth: 400,
        maxFileSize: 1048576 // 1MB in bytes
      });

      console.log('Sending compression request:', {
        url: info.srcUrl,
        settings: settings
      });

      // Send message to content script to fetch and process the image
      const response = await sendMessageToTab(tab.id, {
        type: 'fetchAndCompress',
        imageUrl: info.srcUrl,
        settings: settings
      });

      console.log('Compression response:', response);

    } catch (error) {
      console.error('Compression failed:', error);
      // Show error using notifications API
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ClipCompress Error',
        message: error.message || 'Failed to compress image'
      });
    }
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    chrome.action.openPopup();
  }
});
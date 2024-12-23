// Check if extension context is valid
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' &&
           typeof chrome.runtime !== 'undefined' &&
           chrome.runtime?.id !== undefined;
  } catch (e) {
    return false;
  }
}

// Wrapper for chrome.runtime.sendMessage that checks context
async function sendRuntimeMessage(message) {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);

  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid');
    return false;
  }

  if (message.type === 'ping') {
    console.log('Responding to ping');
    sendResponse({ status: 'ok' });
    return false;
  }

  if (message.type === 'fetchAndCompress') {
    console.log('Processing fetchAndCompress request:', message);

    // Validate required parameters
    if (!message.imageUrl) {
      const error = 'No image URL provided';
      console.error('Missing imageUrl in message:', message);
      showNotification(`Failed to process image: ${error}`, 'error');
      sendResponse({
        success: false,
        error: error,
        details: { message: 'imageUrl is required' }
      });
      return true;
    }

    if (!message.settings) {
      const error = 'Missing compression settings';
      console.error('Missing settings in message:', message);
      showNotification(`Failed to process image: ${error}`, 'error');
      sendResponse({
        success: false,
        error: error,
        details: { message: 'settings are required' }
      });
      return true;
    }

    handleFetchAndCompress(message)
      .then((result) => {
        console.log('Compression successful:', result);
        if (isExtensionContextValid()) {
          sendResponse({ success: true, result });
        }
      })
      .catch(error => {
        // Improve error logging
        const errorDetails = {
          message: error.message || 'Unknown error',
          name: error.name,
          stack: error.stack,
          toString: error.toString(),
          url: message.imageUrl // Include the URL that failed
        };

        // Create a user-friendly error message
        let userMessage = 'Failed to process image: ';
        if (error.message?.includes('Failed to fetch')) {
          userMessage += 'Could not download the image. Please check your internet connection.';
        } else if (error.message?.includes('HTTP error')) {
          userMessage += 'The image server returned an error. Please try again later.';
        } else if (error.message?.includes('not an image')) {
          userMessage += 'The URL does not point to a valid image file.';
        } else {
          userMessage += (error.message || 'Unknown error occurred');
        }

        console.error('Compression failed:', errorDetails);
        showNotification(userMessage, 'error');

        if (isExtensionContextValid()) {
          sendResponse({
            success: false,
            error: userMessage,
            details: errorDetails
          });
        }
      });
    return true;
  }

  return false;
});

// Convert any image format to PNG
async function convertToPNG(imageData) {
  try {
    const img = await createImageBitmap(await fetch(imageData).then(r => r.blob()));
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
  } catch (error) {
    console.error('Failed to convert image to PNG:', error);
    throw new Error('Failed to convert image format');
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Write to clipboard with fallback
async function writeToClipboard(blob) {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }

  // Show warning for large images
  if (blob.size > 10 * 1024 * 1024) { // 10MB
    console.log('Large image detected:', formatFileSize(blob.size));
    showNotification('Processing large image, this may take a moment...', 'info');
  }

  try {
    // Try to focus the document first
    if (document.hasFocus()) {
      // Try modern Clipboard API first if document is focused
      const clipboardItem = new ClipboardItem({
        'image/png': blob
      });
      await navigator.clipboard.write([clipboardItem]);
      return true;
    } else {
      throw new Error('Document not focused');
    }
  } catch (error) {
    console.warn('Modern clipboard API failed:', error.message);

    // Create a temporary canvas for the fallback method
    const canvas = document.createElement('canvas');
    const img = await createImageBitmap(blob);
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    try {
      // Create a contenteditable div to handle the copy
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(div);

      // Add the image as a data URL to the div
      const dataUrl = canvas.toDataURL('image/png');
      const tempImg = document.createElement('img');
      tempImg.src = dataUrl;
      div.appendChild(tempImg);

      // Focus and select the div
      div.focus();
      const range = document.createRange();
      range.selectNode(div);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // Execute copy command
      const success = document.execCommand('copy');

      // Cleanup
      document.body.removeChild(div);

      if (!success) {
        throw new Error('execCommand copy failed');
      }

      return true;
    } catch (fallbackError) {
      console.error('All clipboard methods failed:', fallbackError);
      throw new Error('Could not copy image to clipboard. Please try again.');
    }
  }
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  try {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 4px;
      color: white;
      font-family: system-ui, sans-serif;
      z-index: 9999;
      transition: opacity 0.3s ease-in-out;
      background-color: ${type === 'error' ? '#f44336' : '#4caf50'};
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// Handle fetch and compress operation
async function handleFetchAndCompress(message) {
  try {
    if (!message.settings) {
      console.error('Missing settings in message:', message);
      throw new Error('Missing compression settings');
    }

    if (!message.imageUrl) {
      console.error('Missing imageUrl in message:', message);
      throw new Error('Missing image URL');
    }

    let imageData = null;
    let processedUrl = message.imageUrl;

    // Special handling for Wikimedia URLs
    if (processedUrl.includes('wikimedia.org') || processedUrl.includes('wikipedia.org')) {
      console.log('Detected Wikimedia URL:', processedUrl);
      processedUrl = processedUrl.replace(/\/thumb\//, '/');
      processedUrl = processedUrl.replace(/\/\d+px-[^\/]+$/, '');
      console.log('Processed Wikimedia URL:', processedUrl);
    }

    // Log initial request details
    console.log('Processing request:', {
      originalUrl: message.imageUrl,
      processedUrl: processedUrl,
      settings: message.settings
    });

    // Try to fetch the image using fetch API with retry
    let response = null;
    let blob = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1} to fetch image from URL:`, processedUrl);

        // Show progress notification for large images
        const controller = new AbortController();
        const signal = controller.signal;

        response = await fetch(processedUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          signal,
          headers: {
            'Origin': window.location.origin,
            'Accept': 'image/*',
            'User-Agent': 'ClipCompress Extension'
          }
        });

        // Check content length
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) { // 20MB
          showNotification('Downloading large image, this may take a moment...', 'info');
        }

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        blob = await response.blob();
        console.log('Fetch response received:', {
          type: blob.type,
          size: blob.size
        });

        if (!blob.type.startsWith('image/')) {
          throw new Error(`Response is not an image (type: ${blob.type})`);
        }

        break; // Success, exit retry loop
      } catch (fetchError) {
        console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
        retryCount++;

        if (retryCount === maxRetries) {
          throw new Error(`Failed to fetch image after ${maxRetries} attempts: ${fetchError.message}`);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Create an image from the blob
    if (blob.size > 5 * 1024 * 1024) { // 5MB
      showNotification('Creating image preview...', 'info');
    }
    const img = await createImageBitmap(blob);

    // Calculate dimensions while maintaining aspect ratio
    let targetWidth = img.width;
    let targetHeight = img.height;
    const minWidth = message.settings.minWidth;
    const maxWidth = message.settings.maxWidth || 1920;

    if (targetWidth > maxWidth) {
      const ratio = maxWidth / targetWidth;
      targetWidth = maxWidth;
      targetHeight = Math.round(targetHeight * ratio);
    }

    if (targetWidth < minWidth) {
      const ratio = minWidth / targetWidth;
      targetWidth = minWidth;
      targetHeight = Math.round(targetHeight * ratio);
    }

    // Create canvas and draw image
    if (blob.size > 5 * 1024 * 1024) { // 5MB
      showNotification('Preparing image for compression...', 'info');
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Compress the image
    if (blob.size > 5 * 1024 * 1024) { // 5MB
      showNotification('Compressing image...', 'info');
    }
    const quality = message.settings.quality / 100;
    const compressedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('Failed to create compressed blob'));
        },
        'image/png',
        quality
      );
    });

    if (!compressedBlob) {
      throw new Error('Failed to create compressed image');
    }

    // Write to clipboard
    await writeToClipboard(compressedBlob);

    // Show success notification
    const ratio = ((blob.size - compressedBlob.size) / blob.size * 100).toFixed(1);
    showNotification(
      `Image compressed and copied! (${formatFileSize(blob.size)} → ${formatFileSize(compressedBlob.size)}, ${ratio}% smaller)`,
      'success'
    );

    return {
      success: true,
      originalSize: blob.size,
      compressedSize: compressedBlob.size,
      ratio: ratio
    };

  } catch (error) {
    // Improve error logging
    const errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name,
      stack: error.stack,
      toString: error.toString(),
      url: message.imageUrl // Include the URL that failed
    };

    // Create a more descriptive error message
    let errorMessage = 'Failed to process image: ';
    if (error.message?.includes('Failed to fetch')) {
      errorMessage += 'Could not download the image. Please check your internet connection.';
    } else if (error.message?.includes('HTTP error')) {
      errorMessage += 'The image server returned an error. Please try again later.';
    } else if (error.message?.includes('not an image')) {
      errorMessage += 'The URL does not point to a valid image file.';
    } else {
      errorMessage += error.message;
    }

    console.error('Failed to fetch and compress:', errorDetails);
    showNotification(errorMessage, 'error');
    throw error;
  }
}

// Handle clipboard operations
document.addEventListener('paste', async (e) => {
  console.log('Paste event detected');

  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid during paste');
    return;
  }

  // Get clipboard items
  const items = e.clipboardData?.items;
  if (!items) {
    console.warn('No clipboard data available');
    return;
  }

  // Look for image items
  for (const item of items) {
    console.log('Processing clipboard item:', item.type);

    if (item.type.startsWith('image/')) {
      e.preventDefault(); // Prevent default paste

      try {
        // Get the image as a blob
        const blob = item.getAsFile();
        if (!blob) {
          throw new Error('Failed to get image file from clipboard');
        }

        // Get current compression settings
        const settings = await chrome.storage.sync.get({
          format: 'jpeg',
          quality: 100,
          maxWidth: 400,
          minWidth: 400,
          maxFileSize: 1048576 // 1MB in bytes
        });

        console.log('Processing pasted image:', {
          type: blob.type,
          size: blob.size,
          settings: settings
        });

        // Create an image from the blob
        const img = await createImageBitmap(blob);

        // Calculate dimensions while maintaining aspect ratio
        let targetWidth = img.width;
        let targetHeight = img.height;
        const minWidth = settings.minWidth;
        const maxWidth = settings.maxWidth;

        if (targetWidth > maxWidth) {
          const ratio = maxWidth / targetWidth;
          targetWidth = maxWidth;
          targetHeight = Math.round(targetHeight * ratio);
        }

        if (targetWidth < minWidth) {
          const ratio = minWidth / targetWidth;
          targetWidth = minWidth;
          targetHeight = Math.round(targetHeight * ratio);
        }

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Compress the image
        const quality = settings.quality / 100;
        const compressedBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error('Failed to create compressed blob'));
            },
            'image/png',
            quality
          );
        });

        // Write to clipboard
        await writeToClipboard(compressedBlob);

        // Show success notification
        const ratio = ((blob.size - compressedBlob.size) / blob.size * 100).toFixed(1);
        showNotification(
          `Image compressed and copied! (${formatFileSize(blob.size)} → ${formatFileSize(compressedBlob.size)}, ${ratio}% smaller)`,
          'success'
        );

      } catch (error) {
        console.error('Failed to handle paste:', error);
        showNotification(
          `Failed to process pasted image: ${error.message || 'Unknown error'}`,
          'error'
        );
      }
      return;
    }
  }
});

// Handle drag and drop
document.addEventListener('dragover', (e) => {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid during dragover');
    return;
  }

  // Check if any of the dragged items are images
  const hasImage = Array.from(e.dataTransfer.items).some(item =>
    item.type.startsWith('image/')
  );

  if (hasImage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});

document.addEventListener('drop', async (e) => {
  console.log('Drop event detected');

  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid during drop');
    return;
  }

  // Get dropped items
  const items = e.dataTransfer?.items;
  if (!items) {
    console.warn('No drop data available');
    return;
  }

  // Look for image items
  for (const item of items) {
    console.log('Processing dropped item:', item.type);

    if (item.type.startsWith('image/')) {
      e.preventDefault();

      try {
        // Get the image as a blob
        const blob = item.getAsFile();
        if (!blob) {
          throw new Error('Failed to get image file from drop');
        }

        // Get current compression settings
        const settings = await chrome.storage.sync.get({
          format: 'jpeg',
          quality: 100,
          maxWidth: 400,
          minWidth: 400,
          maxFileSize: 1048576 // 1MB in bytes
        });

        console.log('Processing dropped image:', {
          type: blob.type,
          size: blob.size,
          settings: settings
        });

        // Create an image from the blob
        if (blob.size > 5 * 1024 * 1024) { // 5MB
          showNotification('Creating image preview...', 'info');
        }
        const img = await createImageBitmap(blob);

        // Calculate dimensions while maintaining aspect ratio
        let targetWidth = img.width;
        let targetHeight = img.height;
        const minWidth = settings.minWidth;
        const maxWidth = settings.maxWidth || 1920;

        if (targetWidth > maxWidth) {
          const ratio = maxWidth / targetWidth;
          targetWidth = maxWidth;
          targetHeight = Math.round(targetHeight * ratio);
        }

        if (targetWidth < minWidth) {
          const ratio = minWidth / targetWidth;
          targetWidth = minWidth;
          targetHeight = Math.round(targetHeight * ratio);
        }

        // Create canvas and draw image
        if (blob.size > 5 * 1024 * 1024) { // 5MB
          showNotification('Preparing image for compression...', 'info');
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Compress the image
        if (blob.size > 5 * 1024 * 1024) { // 5MB
          showNotification('Compressing image...', 'info');
        }
        const quality = settings.quality / 100;
        const compressedBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error('Failed to create compressed blob'));
            },
            'image/png',
            quality
          );
        });

        // Write to clipboard
        await writeToClipboard(compressedBlob);

        // Show success notification
        const ratio = ((blob.size - compressedBlob.size) / blob.size * 100).toFixed(1);
        showNotification(
          `Image compressed and copied! (${formatFileSize(blob.size)} → ${formatFileSize(compressedBlob.size)}, ${ratio}% smaller)`,
          'success'
        );

      } catch (error) {
        console.error('Failed to handle drop:', error);
        showNotification(
          `Failed to process dropped image: ${error.message || 'Unknown error'}`,
          'error'
        );
      }
      return;
    }
  }
});
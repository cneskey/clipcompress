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

  console.log('Writing to clipboard:', {
    type: blob.type,
    size: formatFileSize(blob.size)
  });

  // Try modern clipboard API first
  if (document.hasFocus()) {
    try {
      // Request clipboard permission
      const permission = await navigator.permissions.query({ name: 'clipboard-write' });
      if (permission.state === 'granted' || permission.state === 'prompt') {
        // Create a ClipboardItem directly from the compressed blob
        const clipboardItem = new ClipboardItem({
          'image/png': blob
        });
        await navigator.clipboard.write([clipboardItem]);
        console.log('Successfully wrote to clipboard using modern API');
        return true;
      } else {
        throw new Error('Clipboard permission denied');
      }
    } catch (clipboardError) {
      console.log('Modern clipboard API failed:', clipboardError);
      // Fall through to fallback method
    }
  }

  // Fallback to execCommand
  try {
    console.log('Trying fallback clipboard method');

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

    // Create an image element from the blob
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    div.appendChild(img);

    // Focus and select the div
    div.focus();
    const range = document.createRange();
    range.selectNode(div);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Execute copy command
    const success = document.execCommand('copy');
    console.log('Fallback clipboard result:', success);

    // Cleanup
    URL.revokeObjectURL(img.src);
    document.body.removeChild(div);

    if (success) {
      return true;
    }

    throw new Error('Fallback clipboard method failed');
  } catch (error) {
    console.error('All clipboard methods failed:', error);
    throw new Error(`Could not copy image to clipboard: ${error.message}`);
  }
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  try {
    // Create or get the console container
    let consoleContainer = document.querySelector('.clipcompress-console');
    if (!consoleContainer) {
      consoleContainer = document.createElement('div');
      consoleContainer.className = 'clipcompress-console';
      consoleContainer.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 350px;
        max-height: 100vh;
        padding: 8px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        line-height: 1.1;
        z-index: 9999;
        overflow-y: auto;
        background: rgba(0, 12, 24, 0.75);
        backdrop-filter: blur(8px);
        border-left: 1px solid rgba(64, 232, 255, 0.3);
        box-shadow: -2px 0 20px rgba(64, 232, 255, 0.1);
        color: rgba(64, 232, 255, 0.9);
        scrollbar-width: thin;
        scrollbar-color: rgba(64, 232, 255, 0.3) transparent;
        text-align: right;
      `;

      // Add custom scrollbar styles
      const style = document.createElement('style');
      style.textContent = `
        .clipcompress-console::-webkit-scrollbar {
          width: 3px;
        }
        .clipcompress-console::-webkit-scrollbar-track {
          background: rgba(0, 12, 24, 0.3);
        }
        .clipcompress-console::-webkit-scrollbar-thumb {
          background: rgba(64, 232, 255, 0.3);
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(consoleContainer);
    }

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      padding: 1px 4px;
      color: ${type === 'error' ? '#ff4757' : type === 'success' ? '#7bed9f' : 'rgba(64, 232, 255, 0.9)'};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    // Add message without timestamp
    messageElement.textContent = message;

    // Add to console
    consoleContainer.appendChild(messageElement);

    // Scroll to bottom
    consoleContainer.scrollTop = consoleContainer.scrollHeight;

    // Remove old messages if there are too many
    while (consoleContainer.children.length > 50) {
      consoleContainer.removeChild(consoleContainer.firstChild);
    }

    // Auto-remove the console after 10 seconds of inactivity
    clearTimeout(consoleContainer.dataset.timeout);
    consoleContainer.dataset.timeout = setTimeout(() => {
      consoleContainer.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(consoleContainer)) {
          consoleContainer.remove();
        }
      }, 500);
    }, 10000);

    // Reset opacity if it was fading
    consoleContainer.style.opacity = '1';
    consoleContainer.style.transition = 'opacity 0.5s ease-in-out';

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

        response = await fetch(processedUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'Origin': window.location.origin,
            'Accept': 'image/*',
            'User-Agent': 'ClipCompress Extension'
          }
        });

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

        break;
      } catch (fetchError) {
        console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
        retryCount++;

        if (retryCount === maxRetries) {
          throw new Error(`Failed to fetch image after ${maxRetries} attempts: ${fetchError.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    const img = await createImageBitmap(blob);
    const outputFormat = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'jpeg' : 'png';

    // Function to compress with specific settings
    async function compressWithSettings(width, height, quality) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      return new Promise((resolve) => {
        canvas.toBlob(
          (result) => resolve(result),
          'image/png',
          quality
        );
      });
    }

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

    // Create canvas for compression
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Try compression with progressively more aggressive settings
    let compressedBlob = null;
    let quality = Math.min(0.9, message.settings.quality / 100);
    let scaleFactor = 1;
    let attempts = [];

    showNotification('Starting image compression...', 'info');

    while (!compressedBlob || compressedBlob.size > message.settings.maxFileSize) {
      const currentWidth = Math.max(Math.round(targetWidth * scaleFactor), minWidth);
      const currentHeight = Math.round(targetHeight * (currentWidth / targetWidth));

      // Update canvas dimensions if they changed
      if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
        canvas.width = currentWidth;
        canvas.height = currentHeight;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
      }

      // Always use PNG format
      compressedBlob = await new Promise((resolve) => {
        canvas.toBlob(
          (result) => resolve(result),
          'image/png',
          quality
        );
      });

      // Store attempt info
      attempts.push({
        dimensions: `${currentWidth}x${currentHeight}`,
        quality: Math.round(quality * 100),
        size: formatFileSize(compressedBlob.size)
      });

      // Show progress notification
      showNotification(
        `Trying ${currentWidth}x${currentHeight} @ ${Math.round(quality * 100)}% quality (${formatFileSize(compressedBlob.size)})`,
        'info'
      );

      if (compressedBlob.size <= message.settings.maxFileSize) {
        showNotification('Found optimal compression settings!', 'success');
        break;
      }

      // Adjust settings for next attempt
      if (quality > 0.2) {
        // First try reducing quality
        quality = Math.max(0.1, quality - 0.1);
      } else if (scaleFactor > 0.3) {
        // Then try reducing size
        scaleFactor = Math.max(0.2, scaleFactor - 0.2);
        quality = Math.min(0.5, quality + 0.1); // Increase quality a bit when reducing size
      } else {
        // If we still can't meet the size, use minimum dimensions and quality
        const finalWidth = minWidth;
        const finalHeight = Math.round(targetHeight * (finalWidth / targetWidth));
        compressedBlob = await new Promise((resolve) => {
          canvas.toBlob(
            (result) => resolve(result),
            'image/png',
            0.1
          );
        });
        attempts.push({
          dimensions: `${finalWidth}x${finalHeight}`,
          quality: 10,
          size: formatFileSize(compressedBlob.size)
        });
        break;
      }
    }

    // Show compression summary
    console.log('Compression attempts summary:');
    console.table(attempts);

    // Show a user-friendly notification with the summary
    const summaryText = attempts.length > 1 ?
      `Tried ${attempts.length} combinations:\n` +
      `• Started with: ${attempts[0].dimensions} @ ${attempts[0].quality}% (${attempts[0].size})\n` +
      `• Ended with: ${attempts[attempts.length-1].dimensions} @ ${attempts[attempts.length-1].quality}% (${attempts[attempts.length-1].size})`
      : 'Compressed in one attempt';

    showNotification(summaryText, 'info');

    // Write to clipboard
    try {
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
    } catch (clipboardError) {
      console.error('Failed to write to clipboard:', clipboardError);
      showNotification(
        `Image compressed but clipboard operation failed: ${clipboardError.message}`,
        'error'
      );
      throw clipboardError;
    }

  } catch (error) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name,
      stack: error.stack,
      toString: error.toString(),
      url: message.imageUrl
    };

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
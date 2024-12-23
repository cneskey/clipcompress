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
  if (!isExtensionContextValid()) {
    return false;
  }

  if (message.type === 'ping') {
    sendResponse({ status: 'ok' });
    return false;
  }

  if (message.type === 'fetchAndCompress') {
    handleFetchAndCompress(message)
      .then(() => {
        if (isExtensionContextValid()) {
          sendResponse({ success: true });
        }
      })
      .catch(error => {
        console.error('Failed to fetch and compress:', error);
        showNotification('Failed to process image. Please try again.', 'error');
        if (isExtensionContextValid()) {
          sendResponse({ success: false, error: error.message });
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

  try {
    // Try modern Clipboard API first
    const clipboardItem = new ClipboardItem({
      [blob.type]: blob
    });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (error) {
    console.warn('Modern clipboard API failed, trying fallback:', error);

    try {
      // Fallback to execCommand
      const img = document.createElement('img');
      const url = URL.createObjectURL(blob);
      img.src = url;
      document.body.appendChild(img);

      const range = document.createRange();
      range.selectNode(img);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      const success = document.execCommand('copy');
      window.getSelection().removeAllRanges();
      document.body.removeChild(img);
      URL.revokeObjectURL(url);

      if (!success) throw new Error('execCommand copy failed');
      return true;
    } catch (fallbackError) {
      console.error('Clipboard fallback failed:', fallbackError);
      throw new Error('Failed to copy to clipboard: ' + error.message);
    }
  }
}

// Handle clipboard write operation
async function handleClipboardWrite(message) {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }

  try {
    // Convert to PNG for better clipboard compatibility
    const pngBlob = await convertToPNG(message.imageData);

    // Try to write to clipboard
    await writeToClipboard(pngBlob);

    // Calculate compression ratio
    const ratio = ((message.originalSize - message.compressedSize) / message.originalSize * 100).toFixed(1);

    // Show success notification with size info
    showNotification(
      `Image compressed and copied! (${formatFileSize(message.originalSize)} → ${formatFileSize(message.compressedSize)}, ${ratio}% smaller)`,
      'success'
    );
  } catch (error) {
    console.error('Failed to write to clipboard:', error);
    showNotification('Failed to copy to clipboard. Please try again.', 'error');
    throw error;
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

// Helper function to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Handle clipboard operations
document.addEventListener('paste', async (e) => {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid during paste');
    return;
  }

  // Only handle paste events in editable elements
  if (!e.target.isContentEditable &&
      e.target.tagName !== 'INPUT' &&
      e.target.tagName !== 'TEXTAREA') {
    return;
  }

  const items = e.clipboardData?.items;
  if (!items) {
    console.warn('No clipboard data available');
    return;
  }

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      try {
        const blob = item.getAsFile();
        if (!blob) {
          throw new Error('Failed to get image file from clipboard');
        }

        const base64Data = await blobToBase64(blob);
        if (!base64Data) {
          throw new Error('Failed to convert image to base64');
        }

        const response = await sendRuntimeMessage({
          type: 'compressClipboardImage',
          imageData: base64Data
        });

        if (!response || response.error) {
          throw new Error(response?.error || 'Failed to compress image');
        }

      } catch (error) {
        console.error('Failed to handle paste:', error.message || error);
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

  const hasImage = Array.from(e.dataTransfer.items).some(item =>
    item.type.startsWith('image/')
  );
  if (hasImage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});

document.addEventListener('drop', async (e) => {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid during drop');
    return;
  }

  const items = e.dataTransfer?.items;
  if (!items) {
    console.warn('No drop data available');
    return;
  }

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      try {
        const blob = item.getAsFile();
        if (!blob) {
          throw new Error('Failed to get image file from drop');
        }

        const base64Data = await blobToBase64(blob);
        if (!base64Data) {
          throw new Error('Failed to convert image to base64');
        }

        const response = await sendRuntimeMessage({
          type: 'compressClipboardImage',
          imageData: base64Data
        });

        if (!response || response.error) {
          throw new Error(response?.error || 'Failed to compress image');
        }

      } catch (error) {
        console.error('Failed to handle drop:', error.message || error);
        showNotification(
          `Failed to process dropped image: ${error.message || 'Unknown error'}`,
          'error'
        );
      }
      return;
    }
  }
});

// Handle fetch and compress operation
async function handleFetchAndCompress(message) {
  try {
    // Get the image element from the page
    const imgElement = document.querySelector(`img[src="${message.imageUrl}"]`);
    if (!imgElement) {
      throw new Error('Image element not found');
    }

    // Create a canvas to get the image data
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);

    // Get the image data as blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, `image/${message.settings.format}`, message.settings.quality / 100);
    });

    if (!blob) {
      throw new Error('Failed to convert image to blob');
    }

    // Convert blob to base64
    const base64data = await blobToBase64(blob);

    // Write to clipboard
    await writeToClipboard(blob);

    // Calculate compression ratio
    const originalSize = canvas.width * canvas.height * 4; // Rough estimate of original size
    const ratio = ((originalSize - blob.size) / originalSize * 100).toFixed(1);

    // Show success notification
    showNotification(
      `Image compressed and copied! (${formatFileSize(originalSize)} → ${formatFileSize(blob.size)}, ${ratio}% smaller)`,
      'success'
    );
  } catch (error) {
    console.error('Failed to fetch and compress:', error);
    showNotification('Failed to process image. Please try again.', 'error');
    throw error;
  }
}
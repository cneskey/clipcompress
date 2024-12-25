// Watch for system theme changes
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
darkModeMediaQuery.addEventListener('change', (e) => {
  updateTheme(e.matches);
});

// Update theme based on system preference
function updateTheme(isDark) {
  document.documentElement.style.setProperty('--bg-color', isDark ? '#1e1e1e' : '#ffffff');
  document.documentElement.style.setProperty('--text-color', isDark ? '#ffffff' : '#000000');
  document.documentElement.style.setProperty('--input-bg', isDark ? '#2d2d2d' : '#f0f0f0');
  document.documentElement.style.setProperty('--border-color', isDark ? '#3d3d3d' : '#e0e0e0');
  document.documentElement.style.setProperty('--hover-color', isDark ? '#3d3d3d' : '#e5e5e5');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme
  updateTheme(darkModeMediaQuery.matches);

  // Get DOM elements
  const maxWidthInput = document.getElementById('maxWidth');
  const maxWidthNumber = document.getElementById('maxWidth-number');
  const maxFileSizeInput = document.getElementById('maxFileSize');
  const maxFileSizeNumber = document.getElementById('maxFileSize-number');
  const fileSizeShortcuts = document.querySelectorAll('.file-size-shortcuts button');
  const copyBtn = document.getElementById('copyBtn');
  const status = document.getElementById('status');
  const previewPlaceholder = document.querySelector('.preview-placeholder');
  const originalImage = document.querySelector('.preview-image.original');
  const compressedImage = document.querySelector('.preview-image.compressed');
  const originalInfo = document.querySelector('.image-info.original');
  const compressedInfo = document.querySelector('.image-info.compressed');

  // Store the original image blob for recompression
  let originalImageBlob = null;
  let lastCompressedResult = null;
  let lastOriginalSize = null;

  // Load saved settings
  const settings = await chrome.storage.sync.get({
    maxWidth: 4000,
    maxFileSize: 1.0
  });

  // Initialize form values
  maxWidthInput.value = settings.maxWidth;
  maxWidthNumber.value = settings.maxWidth;
  maxFileSizeInput.value = settings.maxFileSize;
  maxFileSizeNumber.value = settings.maxFileSize;

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Save settings when changed (debounced)
  const saveSettings = debounce(() => {
    chrome.storage.sync.set({
      maxWidth: parseInt(maxWidthInput.value),
      maxFileSize: parseFloat(maxFileSizeInput.value)
    });
  }, 500); // Wait 500ms after last change before saving

  // Function to estimate file size based on dimensions (assuming PNG)
  function estimateFileSize(width, height) {
    // Rough estimation for PNG size (assuming moderate complexity)
    // This is a simplified model and may need adjustment
    const bitsPerPixel = 3 * 8; // RGB, 8 bits per channel
    const compressionRatio = 0.5; // Assumed PNG compression ratio
    return Math.round((width * height * bitsPerPixel / 8) * compressionRatio);
  }

  // Function to adjust settings based on constraints
  function adjustSettings(changedSetting) {
    if (!originalImageBlob) return;

    const originalImage = document.querySelector('.preview-image.original');
    const originalWidth = originalImage.naturalWidth;
    const originalHeight = originalImage.naturalHeight;
    const aspectRatio = originalWidth / originalHeight;

    const currentMaxWidth = parseInt(maxWidthInput.value);
    const currentMaxFileSize = parseFloat(maxFileSizeInput.value) * 1024 * 1024; // Convert to bytes

    if (changedSetting === 'width') {
      // If width was changed, adjust file size if necessary
      const estimatedSize = estimateFileSize(currentMaxWidth, Math.round(currentMaxWidth / aspectRatio));
      if (estimatedSize > currentMaxFileSize) {
        // Calculate new file size needed
        const newFileSizeMB = Math.ceil((estimatedSize / (1024 * 1024)) * 10) / 10;
        maxFileSizeInput.value = Math.min(newFileSizeMB, 10);
        maxFileSizeNumber.value = maxFileSizeInput.value;
        saveSettings();
      }
    } else if (changedSetting === 'fileSize') {
      // If file size was changed, adjust width if necessary
      const maxPossibleWidth = Math.sqrt((currentMaxFileSize * 8) / (3 * 0.5 * aspectRatio));
      if (currentMaxWidth > maxPossibleWidth) {
        // Round down to nearest 100px
        const newWidth = Math.floor(maxPossibleWidth / 100) * 100;
        maxWidthInput.value = Math.max(newWidth, 100);
        maxWidthNumber.value = maxWidthInput.value;
        saveSettings();
      }
    }
  }

  // Sync number input with range input
  function syncInputs(rangeInput, numberInput, settingType) {
    // Update number when range changes
    rangeInput.addEventListener('input', () => {
      numberInput.value = rangeInput.value;
      adjustSettings(settingType);
      saveSettings();
      // Update preview when settings change
      updateCompressedPreview();
    });

    // Handle number input changes
    numberInput.addEventListener('input', () => {
      const value = numberInput.value;

      // Allow empty or partial input while typing
      if (value === '' || value === '-' || value === '.') {
        return;
      }

      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        rangeInput.value = numValue;
        adjustSettings(settingType);
        saveSettings();
      }
    });

    // Handle Enter key
    numberInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        numberInput.blur();
      }
    });

    // Validate and clamp on blur
    numberInput.addEventListener('blur', () => {
      let value = parseFloat(numberInput.value);

      if (isNaN(value)) {
        value = parseFloat(rangeInput.value);
      }

      // Clamp value to min/max
      const min = parseFloat(numberInput.min);
      const max = parseFloat(numberInput.max);
      const step = parseFloat(numberInput.step) || 1;

      value = Math.min(max, Math.max(min, value));
      // Round to nearest step
      value = Math.round(value / step) * step;

      // Update both inputs with final value
      numberInput.value = value;
      rangeInput.value = value;
      adjustSettings(settingType);
      saveSettings();
      // Update preview when settings are finalized
      updateCompressedPreview();
    });
  }

  // Setup input synchronization with setting types
  syncInputs(maxWidthInput, maxWidthNumber, 'width');
  syncInputs(maxFileSizeInput, maxFileSizeNumber, 'fileSize');

  // Add file size shortcut listeners
  fileSizeShortcuts.forEach(button => {
    button.addEventListener('click', () => {
      const size = parseFloat(button.dataset.size);
      maxFileSizeInput.value = size;
      maxFileSizeNumber.value = size;
      adjustSettings('fileSize');
      saveSettings();
      // Update preview when shortcut is clicked
      updateCompressedPreview();
    });
  });

  // Function to setup zoom functionality for both previews
  function setupLinkedZoom() {
    const originalHalf = document.querySelector('.preview-half.original');
    const compressedHalf = document.querySelector('.preview-half.compressed');
    const originalWrapper = originalHalf.querySelector('.preview-wrapper');
    const compressedWrapper = compressedHalf.querySelector('.preview-wrapper');
    const originalImg = originalHalf.querySelector('.preview-image');
    const compressedImg = compressedHalf.querySelector('.preview-image');
    const originalLens = originalHalf.querySelector('.zoom-lens');
    const compressedLens = compressedHalf.querySelector('.zoom-lens');
    const originalZoomImg = document.querySelector('.zoom-image.original');
    const compressedZoomImg = document.querySelector('.zoom-image.compressed');
    const originalZoomView = document.querySelector('.zoom-view:first-child');
    const compressedZoomView = document.querySelector('.zoom-view:last-child');
    const originalZoomInfo = originalZoomView.querySelector('.zoom-info');
    const compressedZoomInfo = compressedZoomView.querySelector('.zoom-info');

    let ZOOM_LEVEL = 8;
    const MIN_ZOOM = 2;
    const MAX_ZOOM = 16;
    const BASE_LENS_SIZE = 30;
    const ZOOM_SPEED = 0.5; // Smaller increments for smoother zoom
    let lastWheelTime = 0;
    let animationFrameId = null;

    // Handle mousewheel zoom with smooth transitions
    [originalZoomView, compressedZoomView, originalWrapper, compressedWrapper].forEach(view => {
      view.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!originalImg.src || originalImg.style.display === 'none') return;

        const now = Date.now();
        if (now - lastWheelTime < 16) return; // ~60fps throttle
        lastWheelTime = now;

        // Determine zoom direction and amount
        const delta = -Math.sign(e.deltaY) * ZOOM_SPEED;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, ZOOM_LEVEL + delta));

        if (newZoom !== ZOOM_LEVEL) {
          ZOOM_LEVEL = newZoom;

          // Cancel any pending animation frame
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }

          // Schedule update on next animation frame
          animationFrameId = requestAnimationFrame(() => {
            // Update zoom info
            originalZoomInfo.textContent = `${Math.round(ZOOM_LEVEL)}x zoom`;
            compressedZoomInfo.textContent = `${Math.round(ZOOM_LEVEL)}x zoom`;

            // Update lens size based on zoom level
            const newSize = Math.round(BASE_LENS_SIZE * (MIN_ZOOM / ZOOM_LEVEL));
            originalLens.style.width = originalLens.style.height = `${newSize}px`;
            compressedLens.style.width = compressedLens.style.height = `${newSize}px`;

            updateZoomViews(
              parseFloat(originalLens.style.left),
              parseFloat(originalLens.style.top)
            );

            animationFrameId = null;
          });
        }
      }, { passive: false });

      // Allow dragging the zoom preview to move the lens
      let isZoomDragging = false;
      let zoomStartX, zoomStartY;
      let zoomStartScrollX, zoomStartScrollY;

      view.addEventListener('mousedown', (e) => {
        if (!originalImg.src || originalImg.style.display === 'none') return;
        isZoomDragging = true;
        zoomStartX = e.clientX;
        zoomStartY = e.clientY;

        // Calculate current scroll position from transform
        const transform = view.querySelector('.zoom-image').style.transform;
        const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        if (match) {
          zoomStartScrollX = parseFloat(match[1]);
          zoomStartScrollY = parseFloat(match[2]);
        }

        e.preventDefault();

        // Add window-level mousemove and mouseup listeners
        const handleMouseMove = (e) => {
          if (!isZoomDragging) return;

          // Increase movement sensitivity with a multiplier
          const sensitivity = 2.5;
          const dx = (e.clientX - zoomStartX) * (sensitivity / ZOOM_LEVEL);
          const dy = (e.clientY - zoomStartY) * (sensitivity / ZOOM_LEVEL);

          // Calculate new lens position
          const originalRect = originalWrapper.getBoundingClientRect();
          const originalImgRect = originalImg.getBoundingClientRect();

          const newLensX = originalLens.offsetLeft - dx;
          const newLensY = originalLens.offsetTop - dy;

          // Keep lens within image bounds
          const minX = originalImgRect.left - originalRect.left;
          const maxX = originalImgRect.right - originalRect.left - originalLens.offsetWidth;
          const minY = originalImgRect.top - originalRect.top;
          const maxY = originalImgRect.bottom - originalRect.top - originalLens.offsetHeight;

          const boundedX = Math.max(minX, Math.min(newLensX, maxX));
          const boundedY = Math.max(minY, Math.min(newLensY, maxY));

          // Update zoom views which will also update lens positions
          updateZoomViews(boundedX, boundedY);

          // Update start position for next movement
          zoomStartX = e.clientX;
          zoomStartY = e.clientY;
        };

        const handleMouseUp = () => {
          isZoomDragging = false;
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      });

      // Remove the old mousemove and mouseleave handlers
      // view.addEventListener('mousemove', (e) => { ... });
      // view.addEventListener('mouseup', () => { ... });
      // view.addEventListener('mouseleave', () => { ... });
    });

    let isDragging = false;
    let startX, startY;
    let originalLensStartX, originalLensStartY;
    let compressedLensStartX, compressedLensStartY;
    // Store relative positions for lens persistence
    let lastRelativeX = 0.5;
    let lastRelativeY = 0.5;

    // Update zoom image sources when preview images change
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const target = mutation.target;
          if (target === originalImg) {
            originalZoomImg.src = target.src;
            // Restore lens position using relative coordinates
            if (originalImg.style.display !== 'none') {
              restoreLensPosition();
            }
          } else if (target === compressedImg) {
            compressedZoomImg.src = target.src;
          }
        }
      });
    });

    observer.observe(originalImg, { attributes: true });
    observer.observe(compressedImg, { attributes: true });

    function centerLenses() {
      if (!originalImg.src || originalImg.style.display === 'none') return;
      lastRelativeX = 0.5;
      lastRelativeY = 0.5;
      restoreLensPosition();
    }

    function restoreLensPosition() {
      if (!originalImg.src || originalImg.style.display === 'none') return;

      const originalRect = originalWrapper.getBoundingClientRect();
      const compressedRect = compressedWrapper.getBoundingClientRect();
      const originalImgRect = originalImg.getBoundingClientRect();
      const compressedImgRect = compressedImg.getBoundingClientRect();

      // Calculate positions based on stored relative coordinates
      const originalX = (originalImgRect.left - originalRect.left) + (originalImgRect.width * lastRelativeX) - (originalLens.offsetWidth / 2);
      const originalY = (originalImgRect.top - originalRect.top) + (originalImgRect.height * lastRelativeY) - (originalLens.offsetHeight / 2);

      // Keep lens within image bounds
      const minX = originalImgRect.left - originalRect.left;
      const maxX = originalImgRect.right - originalRect.left - originalLens.offsetWidth;
      const minY = originalImgRect.top - originalRect.top;
      const maxY = originalImgRect.bottom - originalRect.top - originalLens.offsetHeight;

      const boundedX = Math.max(minX, Math.min(originalX, maxX));
      const boundedY = Math.max(minY, Math.min(originalY, maxY));

      // Update both zoom views using the bounded position
      updateZoomViews(boundedX, boundedY);
    }

    function updateZoomViews(originalX, originalY) {
      const originalRect = originalWrapper.getBoundingClientRect();
      const compressedRect = compressedWrapper.getBoundingClientRect();
      const originalImgRect = originalImg.getBoundingClientRect();
      const compressedImgRect = compressedImg.getBoundingClientRect();

      // Calculate relative positions (0-1 range)
      lastRelativeX = (originalX - (originalImgRect.left - originalRect.left)) / originalImgRect.width + (originalLens.offsetWidth / 2 / originalImgRect.width);
      lastRelativeY = (originalY - (originalImgRect.top - originalRect.top)) / originalImgRect.height + (originalLens.offsetHeight / 2 / originalImgRect.height);

      // Use the same relative position for both images
      const newCompressedX = (compressedImgRect.left - compressedRect.left) + (lastRelativeX * compressedImgRect.width) - (originalLens.offsetWidth / 2);
      const newCompressedY = (compressedImgRect.top - compressedRect.top) + (lastRelativeY * compressedImgRect.height) - (originalLens.offsetHeight / 2);

      // Update lens positions
      originalLens.style.left = `${originalX}px`;
      originalLens.style.top = `${originalY}px`;
      compressedLens.style.left = `${newCompressedX}px`;
      compressedLens.style.top = `${newCompressedY}px`;

      // Calculate the portion of the image that should be visible in the zoom view
      const lensWidth = originalLens.offsetWidth;
      const lensHeight = originalLens.offsetHeight;

      // Set zoom images to be ZOOM_LEVEL times larger than the lens size
      originalZoomImg.style.width = `${originalImgRect.width * ZOOM_LEVEL}px`;
      originalZoomImg.style.height = `${originalImgRect.height * ZOOM_LEVEL}px`;
      compressedZoomImg.style.width = `${compressedImgRect.width * ZOOM_LEVEL}px`;
      compressedZoomImg.style.height = `${compressedImgRect.height * ZOOM_LEVEL}px`;

      // Calculate the offset for the zoomed image
      // This moves the image so that the part under the lens is centered in the zoom view
      const originalZoomX = -(originalX - (originalImgRect.left - originalRect.left)) * ZOOM_LEVEL + (lensWidth / 2);
      const originalZoomY = -(originalY - (originalImgRect.top - originalRect.top)) * ZOOM_LEVEL + (lensHeight / 2);
      const compressedZoomX = -(newCompressedX - (compressedImgRect.left - compressedRect.left)) * ZOOM_LEVEL + (lensWidth / 2);
      const compressedZoomY = -(newCompressedY - (compressedImgRect.top - compressedRect.top)) * ZOOM_LEVEL + (lensHeight / 2);

      // Update zoom transforms
      originalZoomImg.style.transform = `translate(${originalZoomX}px, ${originalZoomY}px)`;
      compressedZoomImg.style.transform = `translate(${compressedZoomX}px, ${compressedZoomY}px)`;
    }

    // Start dragging from either lens
    [originalLens, compressedLens].forEach(lens => {
      lens.addEventListener('mousedown', (e) => {
        if (!originalImg.src || originalImg.style.display === 'none') return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        originalLensStartX = originalLens.offsetLeft;
        originalLensStartY = originalLens.offsetTop;
        compressedLensStartX = compressedLens.offsetLeft;
        compressedLensStartY = compressedLens.offsetTop;

        originalLens.style.cursor = 'grabbing';
        compressedLens.style.cursor = 'grabbing';
        e.preventDefault();
      });
    });

    // End dragging
    window.addEventListener('mouseup', () => {
      isDragging = false;
      originalLens.style.cursor = 'grab';
      compressedLens.style.cursor = 'grab';
    });

    // Handle dragging
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const originalRect = originalWrapper.getBoundingClientRect();
      const compressedRect = compressedWrapper.getBoundingClientRect();
      const originalImgRect = originalImg.getBoundingClientRect();
      const compressedImgRect = compressedImg.getBoundingClientRect();

      // Calculate new position for original lens
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newOriginalX = originalLensStartX + dx;
      let newOriginalY = originalLensStartY + dy;

      // Keep lens within original image bounds
      const originalMinX = originalImgRect.left - originalRect.left;
      const originalMaxX = originalImgRect.right - originalRect.left - originalLens.offsetWidth;
      const originalMinY = originalImgRect.top - originalRect.top;
      const originalMaxY = originalImgRect.bottom - originalRect.top - originalLens.offsetHeight;

      newOriginalX = Math.max(originalMinX, Math.min(newOriginalX, originalMaxX));
      newOriginalY = Math.max(originalMinY, Math.min(newOriginalY, originalMaxY));

      // Update both zoom views using the relative position
      updateZoomViews(newOriginalX, newOriginalY);
    });

    // Show zoom elements and center lenses when images are loaded
    [originalImg, compressedImg].forEach(img => {
      let initialLoadDone = false;
      img.addEventListener('load', () => {
        if (img.style.display !== 'none') {
          originalLens.style.display = 'block';
          compressedLens.style.display = 'block';
          if (!initialLoadDone) {
            centerLenses();
            initialLoadDone = true;
          }
        }
      });
    });

    // Center lenses initially if images are already loaded
    if (originalImg.complete && originalImg.src && originalImg.style.display !== 'none' && !originalLens.style.display) {
      originalLens.style.display = 'block';
      compressedLens.style.display = 'block';
      centerLenses();
    }
  }

  // Setup linked zoom
  setupLinkedZoom();

  // Function to update preview
  async function updatePreview() {
    try {
      const clipboardItems = await navigator.clipboard.read();
      let imageBlob = null;

      for (const item of clipboardItems) {
        if (item.types.includes('image/png') ||
            item.types.includes('image/jpeg') ||
            item.types.includes('image/webp')) {
          imageBlob = await item.getType(item.types.find(type => type.startsWith('image/')));
          break;
        }
      }

      if (imageBlob) {
        originalImageBlob = imageBlob;
        lastOriginalSize = imageBlob.size;
        const url = URL.createObjectURL(imageBlob);
        const img = await createImageBitmap(imageBlob);

        // Update original preview and zoom
        originalImage.src = url;
        originalImage.style.display = 'block';
        originalInfo.style.display = 'block';
        originalInfo.textContent = `${img.width}×${img.height}px • ${formatFileSize(imageBlob.size)}`;
        document.querySelector('.zoom-image.original').src = url;

        // Hide placeholder and show compressed side
        previewPlaceholder.style.display = 'none';
        compressedImage.style.display = 'block';
        compressedInfo.style.display = 'block';
        compressedInfo.textContent = 'Adjusting preview...';

        // Update effective limits
        updateEffectiveLimits();

        // Update the compressed preview
        updateCompressedPreview();
        copyBtn.disabled = false;
      } else {
        // Reset all preview elements
        resetPreview('Copy an image to preview');
      }
    } catch (error) {
      // Handle specific clipboard errors
      let message = 'Copy an image to preview';

      if (error.name === 'NotAllowedError') {
        message = 'Please allow clipboard access';
      } else if (error.name === 'DataError' || error.name === 'InvalidStateError') {
        message = 'No image in clipboard';
      }

      resetPreview(message);
    }
  }

  // Update preview on load and when window gains focus
  updatePreview();
  window.addEventListener('focus', updatePreview);

  // Helper function to reset preview state
  function resetPreview(message) {
    originalImageBlob = null;
    lastCompressedResult = null;
    lastOriginalSize = null;
    originalImage.style.display = 'none';
    compressedImage.style.display = 'none';
    originalInfo.style.display = 'none';
    compressedInfo.style.display = 'none';
    previewPlaceholder.style.display = 'flex';
    previewPlaceholder.textContent = message;
    copyBtn.disabled = true;
    status.style.display = 'none';

    // Hide effective limit markers
    const widthMarker = document.getElementById('maxWidth-limit');
    const sizeMarker = document.getElementById('maxFileSize-limit');
    if (widthMarker) widthMarker.style.display = 'none';
    if (sizeMarker) sizeMarker.style.display = 'none';
  }

  // Function to update compressed preview
  async function updateCompressedPreview() {
    if (!originalImageBlob) return;

    try {
      status.textContent = 'Updating preview...';
      status.className = 'status';
      status.style.display = 'block';

      // Create settings object
      const settings = {
        maxWidth: parseInt(maxWidthInput.value),
        maxFileSize: parseFloat(maxFileSizeInput.value) * 1024 * 1024 // Convert MB to bytes
      };

      // Process the image
      lastCompressedResult = await processImage(originalImageBlob, settings);

      // Update compressed preview and zoom
      const url = URL.createObjectURL(lastCompressedResult.blob);
      compressedImage.src = url;
      compressedImage.style.display = 'block';
      compressedInfo.textContent = `${lastCompressedResult.width}×${lastCompressedResult.height}px • ${formatFileSize(lastCompressedResult.compressedSize)}`;
      document.querySelector('.zoom-image.compressed').src = url;

      // Update effective limits after compression
      updateEffectiveLimits();

      // Show preview message with stats
      status.className = 'status success';
      status.textContent = `Preview: ${formatFileSize(lastCompressedResult.originalSize)} → ${formatFileSize(lastCompressedResult.compressedSize)} (${lastCompressedResult.width}×${lastCompressedResult.height}px)`;
    } catch (error) {
      console.error('Preview update failed:', error);
      status.className = 'status error';
      status.textContent = error.message || 'Failed to update preview';

      // Clear compressed preview on error
      compressedImage.style.display = 'none';
      compressedInfo.textContent = 'Preview failed';
      lastCompressedResult = null;
    }
  }

  // Handle copy button click
  copyBtn.addEventListener('click', async () => {
    if (!lastCompressedResult) return;

    try {
      status.textContent = 'Copying to clipboard...';
      status.className = 'status';
      status.style.display = 'block';

      // Write to clipboard
      const clipboardItem = new ClipboardItem({
        'image/png': lastCompressedResult.blob
      });
      await navigator.clipboard.write([clipboardItem]);

      // Show success message
      status.className = 'status success';
      status.textContent = 'Copied compressed image to clipboard!';
    } catch (error) {
      console.error('Copy failed:', error);
      status.className = 'status error';
      status.textContent = 'Failed to copy to clipboard';
    }
  });

  // Function to update effective limits
  function updateEffectiveLimits() {
    const originalImage = document.querySelector('.preview-image.original');
    if (!originalImage || !originalImage.src || !lastOriginalSize) return;

    const originalWidth = originalImage.naturalWidth;
    const maxWidth = parseInt(maxWidthInput.value);
    const maxFileSize = parseFloat(maxFileSizeInput.value);

    // Update width limit marker
    const widthMarker = document.getElementById('maxWidth-limit');
    if (originalWidth < maxWidth) {
      widthMarker.style.display = 'block';
      const percent = (originalWidth / 8000) * 100;
      widthMarker.style.left = `calc(${percent}% + 8px)`;
    } else {
      widthMarker.style.display = 'none';
    }

    // Update file size limit marker
    const sizeMarker = document.getElementById('maxFileSize-limit');
    if (lastOriginalSize < maxFileSize * 1024 * 1024) {
      sizeMarker.style.display = 'block';
      const sizeMB = lastOriginalSize / (1024 * 1024);
      const percent = (sizeMB / 10) * 100;
      sizeMarker.style.left = `calc(${percent}% + 8px)`;
    } else {
      sizeMarker.style.display = 'none';
    }
  }

  // Add event listeners for settings changes to update markers
  maxWidthInput.addEventListener('input', updateEffectiveLimits);
  maxFileSizeInput.addEventListener('input', updateEffectiveLimits);
  maxWidthNumber.addEventListener('change', updateEffectiveLimits);
  maxFileSizeNumber.addEventListener('change', updateEffectiveLimits);
});

// Process image function
async function processImage(blob, settings) {
  // Create bitmap from blob
  const img = await createImageBitmap(blob);

  // Calculate dimensions
  let width = img.width;
  let height = img.height;
  let attempts = 0;
  const maxAttempts = 5;

  // If width exceeds max, scale down proportionally
  if (width > settings.maxWidth) {
    height = Math.round((settings.maxWidth / width) * height);
    width = settings.maxWidth;
  }

  // Create canvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Try compression with a safety margin
  const targetSize = settings.maxFileSize * 0.98; // Add 2% safety margin

  // Try compression
  while (attempts < maxAttempts) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const compressedBlob = await canvas.convertToBlob({
      type: 'image/png'
    });

    if (compressedBlob.size <= targetSize) {
      return {
        blob: compressedBlob,
        originalSize: blob.size,
        compressedSize: compressedBlob.size,
        width,
        height
      };
    }

    // Calculate how much we need to reduce dimensions
    const sizeRatio = targetSize / compressedBlob.size;
    const reductionFactor = Math.sqrt(sizeRatio) * 0.9; // More aggressive reduction

    // Reduce dimensions
    width = Math.max(Math.floor(width * reductionFactor), 100);
    height = Math.floor(height * reductionFactor);

    // Update canvas size
    canvas.width = width;
    canvas.height = height;

    attempts++;
  }

  // Final attempt with minimum dimensions
  width = Math.min(width, 800);
  height = Math.min(height, Math.floor((800 / width) * height));
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  let finalBlob = await canvas.convertToBlob({
    type: 'image/png'
  });

  // If still too big, make one final reduction attempt
  if (finalBlob.size > targetSize) {
    width = Math.floor(width * 0.9);
    height = Math.floor(height * 0.9);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    finalBlob = await canvas.convertToBlob({
      type: 'image/png'
    });
  }

  // If even this is too big, throw an error
  if (finalBlob.size > settings.maxFileSize) {
    throw new Error(`Unable to compress image below ${formatFileSize(settings.maxFileSize)}`);
  }

  return {
    blob: finalBlob,
    originalSize: blob.size,
    compressedSize: finalBlob.size,
    width: canvas.width,
    height: canvas.height
  };
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
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
  const qualityInput = document.getElementById('quality');
  const qualityValue = qualityInput.parentElement.querySelector('.range-value');
  const maxWidthInput = document.getElementById('maxWidth');
  const maxWidthValue = maxWidthInput.parentElement.querySelector('.range-value');
  const maxFileSizeInput = document.getElementById('maxFileSize');
  const maxFileSizeValue = maxFileSizeInput.parentElement.querySelector('.range-value');
  const fileSizeShortcuts = document.querySelectorAll('.file-size-shortcuts button');

  // Load saved settings
  const settings = await chrome.storage.sync.get({
    quality: 100,
    maxWidth: 4000,
    maxFileSize: 1048576 // 1MB in bytes
  });

  // Initialize form values
  qualityInput.value = settings.quality;
  qualityValue.textContent = settings.quality + '%';
  maxWidthInput.value = settings.maxWidth;
  maxWidthValue.textContent = settings.maxWidth + 'px';
  maxFileSizeInput.value = (settings.maxFileSize / 1048576).toFixed(1);
  maxFileSizeValue.textContent = (settings.maxFileSize / 1048576).toFixed(1) + ' MB';

  // Save settings when changed
  function saveSettings() {
    chrome.storage.sync.set({
      quality: parseInt(qualityInput.value),
      maxWidth: parseInt(maxWidthInput.value),
      maxFileSize: parseFloat(maxFileSizeInput.value) * 1048576 // Convert MB to bytes
    });
  }

  // Update range value display
  function updateRangeValue(input, valueSpan, unit) {
    valueSpan.textContent = input.value + unit;
  }

  // Add input listeners
  qualityInput.addEventListener('input', () => {
    updateRangeValue(qualityInput, qualityValue, '%');
    saveSettings();
  });

  maxWidthInput.addEventListener('input', () => {
    updateRangeValue(maxWidthInput, maxWidthValue, 'px');
    saveSettings();
  });

  maxFileSizeInput.addEventListener('input', () => {
    updateRangeValue(maxFileSizeInput, maxFileSizeValue, ' MB');
    saveSettings();
  });

  // Add file size shortcut listeners
  fileSizeShortcuts.forEach(button => {
    button.addEventListener('click', () => {
      const size = parseFloat(button.dataset.size);
      maxFileSizeInput.value = size;
      updateRangeValue(maxFileSizeInput, maxFileSizeValue, ' MB');
      saveSettings();
    });
  });

  // Validate max file size input
  maxFileSizeInput.addEventListener('change', () => {
    const value = parseFloat(maxFileSizeInput.value);
    if (value < 0.1) maxFileSizeInput.value = 0.1;
    if (value > 50) maxFileSizeInput.value = 50;
    updateRangeValue(maxFileSizeInput, maxFileSizeValue, ' MB');
    saveSettings();
  });
});
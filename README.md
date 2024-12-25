# ClipCompress

A Chrome extension that compresses clipboard images with live preview. Perfect for quickly reducing image sizes while maintaining quality.

## Features

- **Automatic Compression**: Compresses clipboard images as soon as you open the popup
- **Live Preview**: See both original and compressed images side by side
- **Interactive Zoom**: Compare image quality with synchronized magnifying glasses
  - Drag to move zoom lens
  - Mouse wheel to adjust zoom level (2x-16x)
  - Click and drag zoom preview to move lens
- **Smart Compression**: Automatically adjusts dimensions to meet size constraints
- **Flexible Controls**:
  - Maximum width limit (100-8000px)
  - Maximum file size (0.1-10MB)
  - Quick file size presets (1MB, 2MB, 5MB, 10MB)
  - Visual indicators show when settings exceed original image limits
- **Dark/Light Mode**: Automatically matches your system theme
- **Detailed Information**: Shows dimensions and file sizes for both original and compressed images

## Usage

1. Copy an image to your clipboard (Cmd/Ctrl+C)
2. Click the ClipCompress extension icon
3. Adjust compression settings if desired
4. Use the magnifying glasses to inspect and compare image quality
   - Drag lens directly or click and drag in zoom preview
   - Scroll to adjust zoom level
5. Click "Copy Compressed to Clipboard" when satisfied
6. Paste your compressed image wherever needed

## Installation

1. Download the extension from the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Grant clipboard permissions when prompted

## Settings

- **Max Width**: Limits the maximum width of the output image (default: 4000px)
- **Max Size**: Sets the target maximum file size (default: 1.0MB)
- Settings are automatically saved between sessions

## Technical Details

- Supports PNG, JPEG, and WebP input formats
- Outputs optimized PNG format
- Uses browser-native OffscreenCanvas for compression
- No external server dependencies - all processing happens locally
- Preserves aspect ratio during resizing
- Automatically adjusts settings to maintain feasible compression targets

## Privacy

ClipCompress processes all images locally in your browser. No data is ever sent to external servers. The extension only accesses clipboard data when the popup is open and only saves your compression settings.

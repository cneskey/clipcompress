# ClipCompress

A Chrome extension that compresses clipboard images with a single click. Perfect for quickly reducing image sizes while maintaining quality.

## Features

- **Live Preview**: See both original and compressed images side by side
- **Interactive Zoom**: Compare image quality with synchronized 8x zoom magnifying glasses
- **Smart Compression**: Automatically adjusts dimensions and quality to meet size constraints
- **Flexible Controls**:
  - Maximum width limit (100-8000px)
  - Maximum file size (0.1-10MB)
  - Quick file size presets (1MB, 2MB, 5MB, 10MB)
- **Dark/Light Mode**: Automatically matches your system theme
- **Detailed Information**: Shows dimensions and file sizes for both original and compressed images

## Usage

1. Copy an image to your clipboard (Cmd/Ctrl+C)
2. Click the ClipCompress extension icon
3. Adjust compression settings if desired
4. Click "Compress Clipboard Image"
5. The compressed image is automatically copied to your clipboard
6. Use the magnifying glasses to inspect image quality (drag to move)

## Installation

1. Download the extension from the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Grant clipboard permissions when prompted

## Settings

- **Max Width**: Limits the maximum width of the output image (default: 4000px)
- **Max Size**: Sets the target maximum file size (default: 1.0MB)

## Technical Details

- Supports PNG, JPEG, and WebP input formats
- Outputs optimized PNG format
- Uses browser-native compression algorithms
- No external server dependencies - all processing happens locally
- Preserves aspect ratio during resizing

## Privacy

ClipCompress processes all images locally in your browser. No data is ever sent to external servers.

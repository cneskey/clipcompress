# ClipCompress

A Chrome extension that compresses images in your clipboard with customizable settings.

## Features

- Compress images directly from web pages to your clipboard
- Outputs compressed images in PNG format
- Smart compression algorithm that balances quality and file size
- Right-click menu integration for web images
- Drag and drop support for local images
- Progress notifications with compression details

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

### Right-Click Menu

1. Right-click on any image on a webpage
2. Select "Compress Image to Clipboard"
3. The compressed image will be copied to your clipboard

### Drag and Drop

1. Drag any image file from your computer
2. Drop it onto any webpage
3. The compressed image will be copied to your clipboard

### Settings

- **Quality**: Set compression quality (1-100%)
- **Maximum Width**: Set maximum image width (100-8000px, maintains aspect ratio)
- **Maximum File Size**: Set target maximum file size (0.1-50 MB)

The extension uses a smart compression algorithm that:

- Maintains aspect ratio while resizing
- Progressively adjusts quality and dimensions to meet size targets
- Shows detailed progress notifications
- Provides compression statistics after completion

### Keyboard Shortcuts

- Use `Ctrl+Shift+C` (Windows) or `Cmd+Shift+C` (Mac) to open the settings popup

## License

MIT License - feel free to use and modify as needed.

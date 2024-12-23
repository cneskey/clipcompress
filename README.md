# ClipCompress

A Chrome extension that compresses images in your clipboard with customizable settings.

## Features

- Compress images directly from web pages to your clipboard
- Support for multiple image formats (JPEG, PNG)
- Customizable compression settings
- Save and load compression presets
- Right-click menu integration
- Keyboard shortcut support (Ctrl+Shift+C / Cmd+Shift+C)
- Drag and drop support
- Paste event handling

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

### Settings

- **Format**: Choose between JPEG and PNG
- **Quality**: Set compression quality (1-100)
- **Max Width**: Set maximum image width (maintains aspect ratio)
- **Max File Size**: Set maximum file size for compressed images (in MB)

### Presets

1. Configure your desired settings
2. Click "Save Current as Preset"
3. Enter a name for the preset
4. Load presets from the dropdown menu
5. Delete unwanted presets with the "Delete Selected Preset" button

## Development

The extension consists of the following components:

- `manifest.json`: Extension configuration
- `popup.html/js`: Settings UI and preset management
- `background.js`: Core compression functionality
- `contentScript.js`: Page interaction handling

## License

MIT License - feel free to use and modify as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

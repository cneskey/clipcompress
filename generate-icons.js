const sharp = require('sharp');
const fs = require('fs');

// Create icons directory if it doesn't exist
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

// Sizes we need
const sizes = [16, 48, 128];

// Generate each size
sizes.forEach(size => {
  sharp('icon.svg')
    .resize(size, size)
    .toFile(`icons/icon${size}.png`)
    .catch(err => console.error(`Error generating ${size}px icon:`, err));
});
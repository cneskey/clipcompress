# Contributing to ClipCompress

First off, thank you for considering contributing to ClipCompress! It's people like you that make ClipCompress such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct: be respectful, constructive, and professional.

## Development Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory
4. Make your changes and reload the extension to test

## How Can I Contribute?

### Reporting Bugs

- Before submitting a bug report, please check existing issues
- Use the bug report template when creating a new issue
- Include as many details as possible:
  - Chrome version
  - Extension version
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Screenshots if applicable
  - Console errors (if any)

### Suggesting Enhancements

- Use the feature request template
- Explain the problem you're trying to solve
- Be as specific as possible about your suggested solution
- Consider the impact on existing users
- Consider Chrome extension limitations and guidelines

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly in Chrome
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Guidelines

### Chrome Extension Best Practices

- Follow [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/best_practices/)
- Use Manifest V3 standards
- Minimize permissions to only what's necessary
- Handle errors gracefully
- Test across different Chrome versions

### Code Style

- Follow existing code style
- Use meaningful variable and function names
- Comment your code when necessary
- Keep functions focused and concise
- Use TypeScript when possible for better type safety

### Testing

- Test your changes in both development and production modes
- Verify changes work in incognito mode if applicable
- Test with different Chrome themes (light/dark)
- Ensure performance isn't degraded

Thank you for contributing!

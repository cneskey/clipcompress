# Security Policy

## Supported Versions

Currently, we support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Chrome Extension Security Model

ClipCompress follows Chrome's security best practices:

- Uses Manifest V3 for enhanced security
- Minimal permissions model:
  - `storage`: Only saves user compression settings
  - `clipboardRead`: Only accessed when popup is open
  - `clipboardWrite`: Only used when user clicks copy button
- No external dependencies or remote code
- All processing done locally in the browser
- No data collection or transmission

## Data Handling

1. **Clipboard Data**

   - Only accessed when popup is open
   - Images processed entirely in memory using OffscreenCanvas
   - No persistent storage of image data
   - Cleared when popup closes

2. **User Settings**

   - Only stores compression preferences:
     - Maximum width (number)
     - Maximum file size (number)
   - Saved using Chrome's sync storage
   - No sensitive data stored

3. **Processing Security**
   - All compression done locally
   - No eval() or remote code execution
   - Input validation on all settings
   - Secure DOM manipulation

## Common Security Considerations

1. **Clipboard Security**

   - Clipboard access is restricted to when popup is active
   - Only processes image/\* MIME types
   - Validates image data before processing
   - Clears sensitive data when popup closes
   - No automatic clipboard monitoring

2. **Storage Security**

   - Only numeric settings stored (maxWidth, maxFileSize)
   - Uses Chrome's secure sync storage
   - No storage of image data
   - Settings validated before storage
   - No sensitive or personal data stored

3. **Processing Security**

   - All image processing done in isolated context
   - Uses OffscreenCanvas for secure rendering
   - Input validation on all user controls
   - Bounded compression attempts (max 5 tries)
   - Memory cleared after processing

4. **UI Security**

   - No external resource loading
   - CSS isolation via shadow DOM
   - Safe DOM manipulation patterns
   - Input sanitization on number fields
   - Bounded min/max values on controls

5. **Extension Isolation**

   - No content script injection
   - No web accessible resources
   - No external communications
   - No cross-origin requests
   - Minimal permission scope

6. **Data Flow Security**
   - One-way clipboard to preview flow
   - Explicit user action for compression
   - Manual trigger for clipboard write
   - Clear data flow boundaries
   - No data persistence between sessions

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do Not** disclose the vulnerability publicly
2. Send details to [cneskey@duck.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Chrome version affected
   - Extension version affected

You can expect:

- Acknowledgment within 48 hours
- Regular updates on progress
- Credit for discovery (unless anonymity preferred)

## Response Timeline

- Initial response: Within 48 hours
- Fix timeline: Based on severity
  - Critical: Within 24 hours
  - High: Within 72 hours
  - Medium: Within 1 week
  - Low: Next version release

Thank you for helping keep ClipCompress secure!

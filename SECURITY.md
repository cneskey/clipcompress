# Security Policy

## Supported Versions

Currently, we support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Chrome Extension Security Guidelines

We follow Chrome's security best practices:

- Use Manifest V3
- Implement Content Security Policy (CSP)
- Follow the principle of least privilege for permissions
- Sanitize all user inputs
- Secure storage of sensitive data

## Reporting a Vulnerability

We take the security of ClipCompress seriously. If you discover a security vulnerability, please follow these steps:

1. **Do Not** disclose the vulnerability publicly
2. Send details of the vulnerability to [cneskey@duck.com]
3. Include the following in your report:
   - Description of the vulnerability
   - Steps to reproduce
   - Chrome version affected
   - Extension version affected
   - Potential impact
   - Suggested fix (if any)
   - Any proof-of-concept code (if applicable)

You can expect:

- Acknowledgment of your report within 48 hours
- Regular updates on our progress
- Credit for your discovery (unless you prefer to remain anonymous)

## Common Security Considerations

1. **Data Privacy**

   - What data is collected
   - How data is stored
   - How data is transmitted
   - Data retention policy

2. **Permission Usage**

   - Justification for each permission
   - Scope limitations
   - Data access patterns

3. **Content Script Security**
   - XSS prevention
   - Safe DOM manipulation
   - Message passing security

## Response Timeline

- Initial response: Within 48 hours
- Update frequency: Every 5 days
- Fix timeline: Depends on severity and complexity
- Emergency patches: Within 24 hours for critical vulnerabilities

Thank you for helping keep ClipCompress secure!

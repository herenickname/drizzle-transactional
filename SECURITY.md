# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

The Drizzle Transactional team takes security issues seriously. We appreciate your efforts to responsibly disclose any security vulnerabilities you find.

### How to Report a Vulnerability

If you believe you've found a security vulnerability in Drizzle Transactional, please follow these steps:

1. **Do not** disclose the vulnerability publicly.
2. **Do not** create a public GitHub issue for the vulnerability.
3. Send an email to the project maintainers describing the issue. Please include:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce the vulnerability
   - Any proof of concept code if available
   - Suggestions for mitigating the vulnerability (if you have any)

### What to Expect

After you report a vulnerability:

1. We will do our best to acknowledge receipt of your report within 7-10 business days.
2. We will work to verify the vulnerability and assess its severity as time permits.
3. We will develop and test a fix for the vulnerability based on its severity and our availability.
4. We will notify you when the fix is implemented.
5. We will publicly disclose the vulnerability after it has been addressed, giving credit to you for the discovery (unless you request otherwise).

## Security Best Practices for Using Drizzle Transactional

When using Drizzle Transactional in your applications, please consider these security best practices:

1. Keep the library updated to the latest version to benefit from security patches.
2. Be careful about transaction isolation levels - use the highest level necessary for your use case.
3. Be mindful of exposing transaction errors in production applications, as they might reveal sensitive information.
4. Ensure your database has appropriate access controls and is not exposed to unauthorized users.

---

Thank you for helping keep Drizzle Transactional and its users safe!

This security policy was created with assistance from Claude AI.

# Security Policy for Development

## Security principles

- tenant isolation;
- least privilege;
- no plaintext secrets;
- signed artifacts;
- auditable privileged actions;
- bounded network access;
- safe defaults.

## Security-sensitive code

Changes involving auth, billing, Docker socket, agent credentials, backups, webhook verification, AI keys or tenant boundaries require explicit security review.

## Reporting

Do not publish credentials, production URLs with secrets, tokens, customer data or exploit payloads in public issues.

Use the project's private operational channel for sensitive disclosures.

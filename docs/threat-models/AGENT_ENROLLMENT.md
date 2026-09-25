# Threat Model — Agent Enrollment

## Threats
- stolen enrollment token
- token replay
- agent impersonation
- credential exfiltration
- tenant binding manipulation

## Controls
- short-lived one-time token
- tenant derived server-side
- durable credential rotation
- revoke
- TLS
- rate limits
- audit

# Threat Model — WaBackup

## Threats
- DB credential exposure
- backup theft
- destructive retention bug
- corrupted successful backup
- storage destination hijack

## Controls
- secret refs
- encryption
- checksums
- verification
- restore tests
- retention dry-run/guardrails
- audit

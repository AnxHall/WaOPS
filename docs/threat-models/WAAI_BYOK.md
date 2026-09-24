# Threat Model — WaAI BYOK

## Threats
- provider key exposure
- cross-tenant retrieval
- prompt injection
- excessive data disclosure
- tool/action misuse

## Controls
- encrypted secret storage
- permission-aware retrieval
- tenant filters
- redaction
- provider isolation
- phase 1 read-only
- audit for sensitive retrieval

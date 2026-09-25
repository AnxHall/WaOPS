# Threat Model — Wantry Ingestion

## Threats
- oversized payload
- event flood
- malicious stacktrace/content
- PII leakage
- forged project events

## Controls
- project credential
- rate limit
- payload max
- PII scrub
- schema validation
- safe rendering
- sampling/quota

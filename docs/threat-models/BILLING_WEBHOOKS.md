# Threat Model — Billing Webhooks

## Threats
- forged payment
- replay
- duplicate processing
- event reordering

## Controls
- provider signature verification
- event/provider reference dedup
- idempotent state transition
- reconciliation
- audit
- never trust client browser payment state

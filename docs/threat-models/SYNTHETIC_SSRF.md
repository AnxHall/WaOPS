# Threat Model — Synthetic Monitoring SSRF

## Threats
- loopback access
- private network probing
- cloud metadata endpoints
- DNS rebinding
- redirect to blocked destination

## Cloud probe controls
- scheme allowlist
- DNS resolution validation
- blocked IP ranges
- redirect re-validation
- timeout
- body size limit

Agent-side private probes are different because private access may be intended and must be explicitly scoped.

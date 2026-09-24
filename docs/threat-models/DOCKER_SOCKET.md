# Threat Model — Docker Socket

## Threat
Docker socket may effectively grant host-level control.

## Controls
- read-only WaAgent behavior
- API allowlist/proxy preferred
- never expose socket remotely through WaOPS
- document customer-side risk
- collector only uses required endpoints
- no arbitrary Docker API passthrough

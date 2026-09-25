# Security

## Requisitos
Tenant isolation, TLS, encryption at rest para secrets, Argon2id ou equivalente atual para senha, session expiration/revocation, API key hashing quando possível, backend RBAC, audit trail, rate limiting, input validation, SSRF protection, PII scrubbing, signed agent releases, SBOM, vulnerability scanning e dependency pinning.

## Superfícies críticas
Auth, tenant context, agent enrollment, Docker socket, monitor URLs, webhook callbacks, billing webhooks, backup credentials e AI provider keys.

Threat model obrigatório ao modificar qualquer uma dessas áreas.

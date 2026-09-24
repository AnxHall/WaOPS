# Security Architecture

## Obrigatório
- TLS
- backend RBAC
- tenant isolation
- secrets encryption
- secure password hashing
- session expiration/revocation
- rate limiting
- input validation
- SSRF protection
- signed agent releases
- SBOM
- vuln scanning
- dependency pinning

## Threat model triggers
- auth
- tenancy
- RBAC
- secrets
- agent enrollment/update
- Docker access
- billing
- webhook ingestion
- backup
- AI

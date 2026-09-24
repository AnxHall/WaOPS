# Environment Matrix

| Capability | Local | Test | Staging | Production |
|---|---|---|---|---|
| Docker | yes | yes | yes | yes |
| Traefik | optional/profile | optional | yes | yes |
| PostgreSQL/Timescale | container | container | isolated | production |
| Redis | container | container | isolated | production |
| Object Storage | MinIO | MinIO | isolated | production |
| Mail | Mailpit | Mailpit/test provider | staging provider | real provider |
| Billing | sandbox/mock | sandbox | sandbox | production |
| WAHA | test session | test | staging | production |
| AI | mock/BYOK dev | test key | staging | production/BYOK |

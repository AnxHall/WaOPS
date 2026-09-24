# Test Matrix

| Area | Unit | Integration | E2E | Security |
|---|---:|---:|---:|---:|
| Auth | yes | yes | yes | yes |
| Tenant isolation | yes | yes | yes | mandatory |
| RBAC | yes | yes | yes | mandatory |
| Billing | yes | yes | yes | webhook replay |
| Agent protocol | yes | yes | contract | auth/version |
| Metrics ingest | yes | yes | yes | quota/rate |
| Incidents | yes | yes | yes | tenant scope |
| Support | yes | yes | yes | visibility |
| Backup | yes | yes | selective | secret/storage |
| AI | yes | yes | selective | retrieval scope |

## Cross-tenant mandatory scenario
Create Tenant A and Tenant B with same-looking resource IDs/names and verify no API/job/cache/realtime leakage.

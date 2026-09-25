# Permission Matrix v1

Legenda:
- ✓ padrão
- C configurável
- — não conceder por padrão

| Capability | Root | Owner | Tenant Admin | Tech Admin | Operator | Support | Customer | Viewer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Tenant settings | ✓ | ✓ | C | — | — | — | — | — |
| Users/roles | ✓ | ✓ | ✓ | — | — | — | — | — |
| Billing | ✓ | ✓ | C | — | — | — | — | — |
| View hosts | ✓ | ✓ | ✓ | ✓ | ✓ | — | C | ✓ |
| Manage agents | ✓ | ✓ | ✓ | ✓ | C | — | — | — |
| Manage monitors | ✓ | ✓ | ✓ | ✓ | C | — | — | — |
| View incidents | ✓ | ✓ | ✓ | ✓ | ✓ | C | C | ✓ |
| Ack/resolve incident | ✓ | ✓ | ✓ | ✓ | ✓ | C | — | — |
| Create ticket | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Assign/resolve ticket | ✓ | ✓ | ✓ | C | C | ✓ | — | — |
| Publish knowledge | ✓ | ✓ | ✓ | C | — | C | — | — |
| Configure database | ✓ | ✓ | ✓ | ✓ | C | — | — | — |
| Configure backup | ✓ | ✓ | ✓ | ✓ | C | — | — | — |
| Configure integrations | ✓ | ✓ | ✓ | C | — | — | — | — |
| Use WaAI | ✓ | ✓ | C | C | C | C | C | C |
| Configure WaAI/BYOK | ✓ | ✓ | ✓ | — | — | — | — | — |

Perfis são defaults. Tenant pode criar roles customizadas.

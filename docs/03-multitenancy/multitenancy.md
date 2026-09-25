# Multi-tenancy

## Hierarquia

```text
Platform Root
└── Tenant
    ├── Teams
    ├── Memberships
    ├── Resources
    ├── Entitlements
    └── Organizations/Subtenants [MSP]
```

## Regras

- tenant_id obrigatório ou derivável
- nunca aceitar tenant_id livre do cliente sem validar contexto
- todas as queries de domínio são tenant-scoped
- realtime, cache, object storage e jobs também são tenant-scoped

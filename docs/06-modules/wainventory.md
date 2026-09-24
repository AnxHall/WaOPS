# WaInventory

Parte do Core.

## Recursos
- host
- agent
- network interface
- filesystem
- container
- service/application
- endpoint
- database
- repository
- backup job
- monitor
- notification channel

## Dependências

```text
Host
├── Docker
│   ├── app
│   ├── redis
│   └── postgres
└── Service
    ├── depends_on -> Redis
    └── depends_on -> PostgreSQL
```

Esse grafo alimenta incident correlation e WaAI.

# RBAC

## Perfis padrão

- Platform Root
- Tenant Owner
- Tenant Admin
- Technical Admin
- Operator
- Support Agent
- Customer User
- Viewer

## Custom roles

Tenant Admin pode criar perfis customizados.

## Permission namespaces

- tenants.*
- users.*
- roles.*
- billing.*
- agents.*
- hosts.*
- monitors.*
- incidents.*
- tickets.*
- knowledge.*
- backups.*
- databases.*
- notifications.*
- integrations.*
- secrets.*
- ai.*

## Exemplo

```text
incidents.read
incidents.ack
incidents.resolve
tickets.create
tickets.assign
tickets.resolve
```

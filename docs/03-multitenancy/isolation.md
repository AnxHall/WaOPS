# Multi-tenancy and Isolation

## Regras

1. Toda entidade do cliente deve ser tenant-scoped direta ou indiretamente.
2. Query layer exige tenant context.
3. Cache keys incluem tenant.
4. Jobs incluem tenant + actor/system context.
5. Storage usa prefixos/paths isolados.
6. Realtime topics incluem tenant.
7. Audit registra tenant e actor.
8. Teste cross-tenant é obrigatório.

## Roles padrão

Platform Root, Tenant Owner, Tenant Admin, Technical Admin, Operator, Support Agent, Customer User, Viewer.

Tenant Admin pode criar roles customizadas.

## Permissions de exemplo

`hosts.read`, `hosts.manage`, `agents.read`, `agents.enroll`, `monitors.read`, `monitors.manage`, `incidents.read`, `incidents.ack`, `incidents.resolve`, `tickets.read`, `tickets.create`, `tickets.assign`, `tickets.resolve`, `knowledge.read`, `knowledge.publish`, `billing.read`, `billing.manage`, `users.manage`, `roles.manage`, `integrations.manage`, `secrets.manage`.

## MSP

Subtenants são add-on comercial. Subtenant não é automaticamente tenant completo. Deve suportar customer users, tickets, docs publicadas e recursos visíveis por organização.

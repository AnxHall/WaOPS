# Backend Project Structure

## Estrutura recomendada

```text
apps/
  api/
  worker/
  collector-gateway/
  web/

packages/
  domain/
  contracts/
  auth/
  tenancy/
  rbac/
  entitlements/
  events/
  observability/
  config/
  testing/

services/
  notifications/
  ai/
```

## Organização por domínio

Dentro da API:

```text
src/
  modules/
    identity/
    tenancy/
    billing/
    resources/
    monitors/
    incidents/
    support/
    database/
    backup/
    knowledge/
    releases/
    notifications/
    ai/
```

Cada domínio deve conter:

```text
domain/
application/
infrastructure/
http/
tests/
```

## Dependency rules

- `domain` não importa NestJS/Prisma/HTTP.
- `application` orquestra casos de uso.
- `infrastructure` implementa DB, queue, storage, provider adapters.
- `http` apenas traduz request/response.
- imports cruzados entre domínios devem ocorrer via contratos públicos.

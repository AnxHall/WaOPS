# Backend Architecture

## Stack recomendada

- Node.js 22+
- NestJS
- TypeScript
- Prisma para control plane
- PostgreSQL
- Redis
- BullMQ

## Bounded domains

- identity
- tenancy
- rbac
- billing
- entitlements
- resources
- monitors
- events
- incidents
- support
- knowledge
- backup
- notifications
- releases
- ai

## Regras

- DTO/schema validation nas bordas
- domain services sem dependência direta de HTTP
- queries tenant-scoped
- structured errors
- correlation ID
- idempotency keys em operações críticas
- outbox para publicação confiável

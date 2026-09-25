# System Architecture

## 1. Áreas principais

```mermaid
flowchart TB
  UI[Web App] --> API[Control Plane API]
  API --> PG[(PostgreSQL)]
  API --> R[(Redis)]
  API --> S3[(Object Storage)]

  AG[WaAgent] --> GW[Collector Gateway]
  PR[External Probes] --> GW
  SDK[Wantry SDK/API] --> GW

  GW --> Q[Ingestion Queue]
  Q --> TP[Telemetry Processor]
  Q --> EP[Event Processor]

  TP --> TS[(Time-Series)]
  EP --> IE[Incident Engine]
  IE --> BUS[Module Event Bus]
```

## 2. Control Plane

Responsável por:
- auth
- tenancy
- users/memberships
- RBAC
- entitlements
- plans/billing
- resource catalog
- monitor definitions
- incident state
- support
- docs
- integrations

## 3. Collector Gateway

Responsável por:
- autenticar agente/probe/SDK
- derivar tenant da credencial
- validar schema/version
- aplicar rate limit
- limitar payload
- normalizar envelope
- publicar para fila

Não deve concentrar lógica pesada de negócio.

## 4. Event Bus

Primeira implementação pode usar Redis/BullMQ + outbox.
Contratos devem permitir futura migração para broker dedicado.

## 5. Storage

- PostgreSQL: control plane
- TimescaleDB/PostgreSQL: métricas
- Redis: cache/queues
- S3-compatible: anexos, artefatos, backups
- ClickHouse: futuro, por necessidade

## 6. Realtime

- WebSocket ou SSE
- tenant-scoped channels
- pub/sub adapter para escala horizontal
- sem sticky session como requisito de negócio

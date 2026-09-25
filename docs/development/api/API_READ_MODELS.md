# API Read Models — Alpha (AS-BUILT)

> O que o frontend consegue consultar HOJE, por superfície. Base: `API_ENDPOINT_MATRIX.md`,
> schema Prisma (`packages/db`) e testes. Legenda: `AVAILABLE` · `PARTIAL` · `MISSING READ MODEL`.
> Dados persistidos/coletados sem read-model ⇒ ver `READ_MODEL_GAPS.md`.

## Dashboard

| Bloco de dado | Estado | Fonte real |
|---|---|---|
| Incidentes abertos (contagem) | AVAILABLE | `GET /incidents` (filtro client-side) |
| Hosts online / total | AVAILABLE | `GET /hosts` (filtro client-side por `status`) |
| Disponibilidade (online %) | AVAILABLE | derivado de `GET /hosts` |
| Agentes conectados (contagem) | **MISSING READ MODEL** | não existe `GET /agents`; KPI exibe `—` |
| Séries temporais (24h) | **MISSING READ MODEL** | não existe endpoint de métricas |
| Stacked status bars / mapa | **MISSING READ MODEL** | dependem de séries/agregados |

## Agents

| Bloco | Estado | Fonte real |
|---|---|---|
| Lista de agentes (nome/versão/status/heartbeat) | **MISSING READ MODEL** | não existe `GET /agents` (UI atual exibe lista vazia por limitação declarada) |
| Criar enrollment token via UI | **MISSING READ MODEL** | não existe endpoint admin de tokens (fluxo atual: CLI/SQL) |
| Revogar agente | **MISSING READ MODEL** | permission `agents.revoke` existe no contrato; sem rota |

## Hosts (lista)

| Bloco | Estado | Fonte real |
|---|---|---|
| Identity (nome, OS, ambiente) | AVAILABLE | `GET /hosts` |
| Status (badge) | AVAILABLE | `GET /hosts` (`status`) |
| Criar host | AVAILABLE | `POST /hosts` (`hosts.manage`) |
| Link para detalhe | AVAILABLE | `GET /hosts/:id` |

## Host Detail (`/monitor/hosts/:id`)

| Bloco | Estado | Fonte real |
|---|---|---|
| Identity (nome, OS/arch/version, ambiente, criado em) | AVAILABLE | `GET /hosts/:id` |
| Agent state (status, last seen) | PARTIAL | via `Agent` relation se consultável; sem rota dedicada de agente |
| CPU (série/gauge) | **MISSING READ MODEL** | `metric_samples` persiste `host.cpu.usage_percent` (coletado pelo agente), mas **não existe endpoint** |
| Memory | **MISSING READ MODEL** | ídem (`host.memory.used_bytes`) |
| Load | **MISSING READ MODEL** | ídem (`host.load.1/5/15`) |
| Filesystem (usage por mount) | **MISSING READ MODEL** | agente coleta `host.filesystem.*`; storage `metric_samples` existe; sem read-model; tabela `Filesystem` (inventário) existe **sem writer** |
| Network | **MISSING READ MODEL** | `host.network.*_bytes_total` coletado; sem read-model; `NetworkInterface` sem writer |
| Containers (state/image/health) | **MISSING READ MODEL** | tabela `Container` existe **sem writer**; métricas `container.*` coletadas; sem read-model |
| Container metrics (CPU/mem/restarts) | **MISSING READ MODEL** | coletado, persistido, sem endpoint |
| Uptime | **MISSING READ MODEL** | `host.uptime_seconds` coletado; sem read-model |

## Incidents (lista)

| Bloco | Estado | Fonte real |
|---|---|---|
| Lista com severity/status/timestamps | AVAILABLE | `GET /incidents` |
| Ações ack/resolve (conforme permissão) | AVAILABLE | `POST /:id/acknowledge` · `/:id/resolve` |
| Link para detalhe | AVAILABLE | `GET /incidents/:id` |

## Incident Detail (`/incidents/:id`)

| Bloco | Estado | Fonte real |
|---|---|---|
| Cabeçalho (title, severity, status, timestamps) | AVAILABLE | `GET /incidents/:id` |
| Affected resource (nome do host) | PARTIAL | `primary_resource_id` é referência opaca; sem endpoint de resolução resource→nome |
| Timeline ordenada | AVAILABLE | `GET /incidents/:id/timeline` |
| Event/context attributes | PARTIAL | evento ligado existe (`incident_events`), mas attributes só via timeline payloads |
| Acknowledge / Resolve com confirmação | AVAILABLE | `POST /:id/acknowledge` · `/:id/resolve` (409 em estado inválido) |
| Reopen | AVAILABLE | `POST /:id/reopen` |
| Métrica relacionada (chart do fingerprint) | **MISSING READ MODEL** | sem endpoint de séries |

## Resumo (alimenta FRONTEND_CAPABILITY_MATRIX)

- **AVAILABLE pleno:** incidents list/detail (com ações), hosts list, auth/me, health.
- **PARTIAL:** host detail (identidade real; telemetria ausente), incident detail (recurso
  referenciado sem resolução de nome), agents (vazio por gap de read-model).
- **Toda a telemetria coletada está persistida em `metric_samples` mas sem read-model HTTP** —
  é o principal conjunto de gaps da HARD MISSION 03.

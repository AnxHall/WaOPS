# Read Model Gaps — Alpha (REGISTRY)

> Registro canônico de dados **coletados/persistidos mas sem read-model HTTP** no Alpha.
> Cada gap tem identidade persistente (`GAP-RM-*`); a FRONTEND_CAPABILITY_MATRIX referencia estes IDs.
> Regra da 02.5: **não criar endpoint temporário para fechar gap** — o frontend exibe estado
> indisponível/parcial. Alvo padrão: **HARD MISSION 03 — WaMonitor**.

---

## GAP-RM-001 — Filesystem utilization

- **Surface:** Host Detail
- **Data:** `host.filesystem.used_bytes` / `host.filesystem.available_bytes` por mount
- **Collector:** Available (WaAgent linux collector)
- **Storage:** Available (`metric_samples`, dimensions `mount`; tabela inventário `Filesystem` existe, sem writer)
- **Current API/read-model:** Missing
- **Frontend behavior:** bloco "Filesystem" com estado indisponível/partial (designer.md §7)
- **Required future work:** query tenant-scoped de séries por host+metric com dimension mount
- **Target mission:** HARD MISSION 03 — WaMonitor

## GAP-RM-002 — Network throughput

- **Surface:** Host Detail
- **Data:** `host.network.rx_bytes_total` / `host.network.tx_bytes_total` (counters por interface)
- **Collector:** Available
- **Storage:** Available (`metric_samples`; `NetworkInterface` sem writer)
- **Current API/read-model:** Missing (counters exigem derivada de taxa — read-model de rollup)
- **Frontend behavior:** bloco "Network" indisponível
- **Required future work:** read-model de deltas/rollups para counters
- **Target mission:** HARD MISSION 03 — WaMonitor

## GAP-RM-003 — Container inventory + metrics

- **Surface:** Host Detail
- **Data:** inventário `Container` (name/image/state/health) + `container.cpu.usage_percent`,
  `container.memory.used_bytes/limit_bytes`, restarts
- **Collector:** Available (docker collector)
- **Storage:** Partial — métricas em `metric_samples`; **tabela `Container` existe sem writer**
  (nenhum código persiste o inventário recebido via `/agents/events` attributes)
- **Current API/read-model:** Missing
- **Frontend behavior:** bloco "Containers" indisponível
- **Required future work:** writer de inventário de containers + read-model tenant-scoped
- **Target mission:** HARD MISSION 03 — WaMonitor

## GAP-RM-004 — Historical charts (séries temporais)

- **Surface:** Dashboard, Host Detail, Incident Detail
- **Data:** qualquer série (`metric_samples` por host/metric/período)
- **Collector:** Available
- **Storage:** Available (hypertable Timescale, retention configurável)
- **Current API/read-model:** Missing (nenhum `GET .../metrics`)
- **Frontend behavior:** cards de gráfico com estado de dados ausentes (não mock)
- **Required future work:** endpoint de séries (ex.: `GET /hosts/:id/metrics?metric=...&from=...`)
  com agregação/rollups e limites de cardinalidade
- **Target mission:** HARD MISSION 03 — WaMonitor

## GAP-RM-005 — Agents list read-model

- **Surface:** Agents
- **Data:** agentes do tenant (name/version/status/last_seen/capabilities)
- **Collector:** N/A (entidade de control-plane)
- **Storage:** Available (tabela `agents`)
- **Current API/read-model:** Missing (`GET /agents` não existe; UI exibe lista vazia declarada)
- **Frontend behavior:** tela Agents com EmptyState honesto + aviso de gap
- **Required future work:** `GET /api/v1/agents` (`agents.read`) + `POST /agents/enrollment-tokens`
  + revoke (`agents.revoke`)
- **Target mission:** HARD MISSION 03 — WaMonitor (surface admin de agents)

## GAP-RM-006 — Agent connected count (dashboard)

- **Surface:** Dashboard
- **Data:** contagem de agentes online
- **Collector:** N/A
- **Storage:** Available (`agents.status/last_seen_at`)
- **Current API/read-model:** Missing (depende de GAP-RM-005)
- **Frontend behavior:** KPI exibe `—`
- **Required future work:** contagem agregada em read-model de agents
- **Target mission:** HARD MISSION 03 — WaMonitor

## GAP-RM-007 — Resource name resolution para incidentes

- **Surface:** Incident Detail
- **Data:** nome/identidade do `primary_resource_id` (referência opaca)
- **Collector:** N/A
- **Storage:** Available (hosts; `primary_resource_id` no incident)
- **Current API/read-model:** Partial — incidente expõe o ID; sem resolução para nome legível
- **Frontend behavior:** exibir identificador curto truncado (mono) em vez de inventar nome
- **Required future work:** incluir resource summary no payload do incidente ou endpoint de lookup
- **Target mission:** HARD MISSION 03 — WaMonitor

## GAP-RM-008 — Related metric chart do incidente

- **Surface:** Incident Detail
- **Data:** série do fingerprint/métrica que disparou o incidente
- **Collector:** Available
- **Storage:** Available (`metric_samples` + `fingerprint` no incident/event)
- **Current API/read-model:** Missing (depende de GAP-RM-004)
- **Frontend behavior:** seção "Métrica relacionada" indisponível
- **Required future work:** read-model de séries filtrável por fingerprint/resource
- **Target mission:** HARD MISSION 03 — WaMonitor

---

**Não criar endpoints temporários para estes gaps na 02.5.** O frontend exibe estados
honestos (designer.md §7: partial/degraded) e a matrix referencia os GAP-RM-* acima.

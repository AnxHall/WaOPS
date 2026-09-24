# Modules Overview

| Módulo | Tipo | Função |
|---|---|---|
| Core | obrigatório | identidade, tenancy, RBAC, entitlements, events, incidents, audit |
| WaInventory | core | catálogo de recursos e dependências |
| WaMonitor | add-on | host, Docker, serviços, uptime, synthetic checks |
| WaSupport | add-on | tickets, SLA, Kanban, portal |
| Wantry | add-on | erros, exceptions, issues |
| WaDatabase | add-on | observabilidade PostgreSQL/MySQL/MariaDB |
| WaBackup | add-on | backup, retenção, verificação, restore test |
| WaKnowledge | add-on | docs, runbooks, SOPs, change management |
| WaNotify | add-on | roteamento de alertas |
| WaRelease | add-on | releases/tags |
| WaAI | add-on | assistente contextual BYOK |

## Interações

- WaMonitor + WaSupport: incidente pode virar ticket.
- Wantry + WaSupport: issue pode virar ticket.
- WaDatabase + Incident Engine: contexto de DB enriquece incidente.
- WaRelease + Incident Engine: release recente aparece como contexto.
- WaKnowledge + WaSupport: artigos/runbooks associados.
- WaNotify: roteador transversal.
- WaAI: consome contexto autorizado de todos os módulos.

# ADR-002 — Integração orientada a eventos

## Status
Accepted.

Módulos opcionais não devem ser acoplados por chamadas síncronas como padrão.

WaMonitor gera evento/incidente.
WaSupport reage se habilitado.
WaNotify reage por policy.
WaAI consome contexto autorizado.

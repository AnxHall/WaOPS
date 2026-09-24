# ADR-010 — Realtime com SSE tenant-scoped (decisão para fases iniciais)

## Status
Accepted (foundation: canais/reserva; implementação completa no frontend de monitoramento).

## Contexto
`system-architecture.md` define realtime com WebSocket ou SSE, canais tenant-scoped, sem sticky sessions. A fundação não tem dashboard de streaming ainda, mas os **nomes de canal** e o padrão de escopo precisam existir antes.

## Decisão
- **SSE** (Server-Sent Events) como transporte inicial: unidirecional server→client, compatível com HTTP/1.1 e proxies, reconexão nativa.
- **Canais**: `tenant:{tenant_id}:incidents` e `tenant:{tenant_id}:agents`. `tenant_id` do canal vem do token autenticado (nunca do query param).
- Auth do stream: mesma validaçção de access token (header/query final-URL assinado de curta duração quando necessário).
- Publicação: worker publica no canal após abrir/atualizar incidente (via publisher abstraction; adapter SSE usa Redis pub/sub quando escalar horizontalmente).

## Consequências
- Sem canal wildcard entre tenants por construção; teste cross-tenant de realtime valida que `tenant:A` não recebe eventos de `tenant:B`.
- WebSocket bi-direcional (se necessário para acks/typing) exige novo ADR.

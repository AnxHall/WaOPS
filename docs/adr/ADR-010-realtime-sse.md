# ADR-010 — Realtime com SSE tenant-scoped (decisão para fases iniciais)

## Status

IMPLEMENTED — HARD MISSION 05 (`feature/hard-mission-05-wasupport-realtime-supply`).

As-built (além da decisão):

- Stream `GET /api/v1/realtime/stream?channels=incidents,agents` (default ambos; ≤2), auth **exclusivamente por Bearer JWT** (nunca query param); sem token → **401** antes do broker.
- Fan-out horizontal via Redis pub/sub (`waops:realtime`); seq numérica monotônica per-tenant via `INCR sse:seq:{tenant}` (ids compatíveis com cursor `Last-Event-ID`);
- Replay: ring buffer retido por canal (`sse:retained:<ch>`, LPUSH/LTRIM 200, EXPIRE 3600s) — produtores API, worker e collector-gateway unificados; cursor malformado é ignorado (sem 500).
- Heartbeat comment `: ping` a cada 15s mantém proxies vivos; wire format `id:`/`event:`/`data:` com CRLF.
- Client web (`apps/web/src/lib/sse.ts`): fetch+ReadableStream (Bearer header — não EventSource), reconexão exponencial cap 15s + full jitter, dedup por id (janela 64), status `connecting/open/reconnecting/closed/unauthorized`; 401/403 → unauthorized sem retry storm. Dashboard consome eventos (`incident.*`, `agent.*`) com debounce 400ms + poll de segurança 30s (badge live/reconectando).
- Testes: unit parser/client (9), E2E fan-out/replay/isolamento cross-tenant (HM05).

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

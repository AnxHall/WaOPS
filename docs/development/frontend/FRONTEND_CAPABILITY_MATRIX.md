# Frontend Capability Matrix — Alpha (AS-BUILT)

> Visão objetiva do frontend. Atualizada em `feature/hard-mission-05-wasupport-realtime-supply` (HARD MISSION 05).
> Atualizações HM04: agentes no dashboard reais (GAP-RM-006 fechado).
> Atualizações HM05: dashboard com **realtime SSE** (ADR-010) — client `lib/sse.ts` + hook `use-realtime.ts`;
> HM05 follow-up: tela de Tickets (lista + detalhe + transições) com realtime;
> Evidências: testes nomeados (`apps/web/test/*` incl. `sse.test.ts`), `API_ENDPOINT_MATRIX.md`,
> Evidências: testes nomeados (`apps/web/test/*`), `API_ENDPOINT_MATRIX.md`,
> `API_READ_MODELS.md`, `READ_MODEL_GAPS.md`. Coluna "API real": ✅ todos os dados
> essenciais com read-model real · **Partial** parte disponível · ❌ ausente —
> todo Partial/❌ aponta GAP-RM-*.

| Tela            | API real | Loading | Empty | Error | Offline/Stale | RBAC | Responsive | A11y |
|-----------------|----------|---------|-------|-------|---------------|------|------------|------|
| Login           | ✅       | ✅¹     | N/A   | ✅    | —             | —    | ✅         | ✅   |
| Dashboard       | ✅ (agentes ✅ desde HM04; GAP-RM-004 fechado na HM03; **realtime SSE desde HM05**) | ✅ | ✅ | ✅ | ✅⁵ | ✅ | ✅ | ✅ |
| Hosts           | ✅       | ✅      | ✅    | ✅    | —³            | ✅   | ✅         | ✅   |
| Host Detail     | ✅ (charts/filesystems/containers reais desde HM03) | ✅ | N/A (404 tratado) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Incidents       | ✅       | ✅      | ✅    | ✅    | —²            | ✅   | ✅         | ✅   |
| Incident Detail | ✅ (recurso + chart CPU desde HM03/HM04) | ✅ | N/A (404 tratado) | ✅ | —⁴ (dashboard cobre updates via SSE) | ✅ | ✅ | ✅ |
| Agents          | ✅ (list/token/revoke reais desde HM03) | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Tickets         | ✅ (WaSupport foundation HM05 + UI lista/detalhe/transições) | ✅ | ✅ | ✅ | —⁶ | ✅ | ✅ | ✅ |

## Evidências por coluna

- **API real:** `API_ENDPOINT_MATRIX.md` (rota a rota) + `API_READ_MODELS.md` (bloco a bloco).
- **Loading:** skeletons em todas as telas (designer.md §7 — nunca spinner central); testes
  `status.test.ts` (helpers), páginas com `loading` state + `<Skeleton>`.
- **Empty:** `EmptyState` canônico com ícone/título/CTA (dashboard, hosts, incidents);
  Agents usa EmptyState **declarando o gap** (GAP-RM-005) em vez de fingir lista.
- **Error:** `ErrorState` com "Tentar novamente" em todas as telas; 404 diferenciado de erro de
  rede e de permission denied (Host/Incident detail); `role="alert"`; detalhe técnico em `<details>`.
- **Offline/Stale:** `StaleBanner` + lógica `isStale()` (testes em `status.test.ts`);
  Host Detail exibe banner quando agente não está `online`. **HM05:** dashboard com badge de
  conexão realtime (`live` / `reconectando` / `sessão expirada` / `offline`) e refresh automático
  via eventos SSE (`incident.created/updated`, `agent.heartbeat/revoked`) com debounce 400ms;
  `lib/sse.ts` reconecta com backoff exponencial (cap 15s) + full jitter e dedup por id;
  poll de segurança 30s cobre eventos perdidos (at-least-once).
- **RBAC:** `SessionProvider`/`useSession().can()` (evidência: `permission-rendering.test.tsx`,
  dois perfis); ações ack/resolve gated por `incidents.ack`/`incidents.resolve`; detail de host
  trata 401/403 como `PermissionDeniedState`. Backend continua a authorization boundary.
- **Responsive:** breakpoints 640/1024/1280/1600 no `globals.css` (sidebar colapsa 1280, drawer
  horizontal 1024, tabelas viram cards com `data-label` 640) — designer.md §8.
- **A11y:** `:focus-visible` global, `prefers-reduced-motion`, `nav aria-label`,
  `aria-current`, labels em inputs do login, `role="alert"` em erros, badges com texto
  (nunca cor sozinha — `toneGlyph` + label), `data-label` nas células empilhadas.

## Notas

1. Login não tem loading de lista; tem estado de submit (`disabled` + "Aguarde…").
2. Dashboard/Incidents list não exibem banner de stale no Alpha (dados são fetch-on-load);
   a lógica e o componente existem e são testados.
3. Hosts list não consulta métricas (nada a ficar stale) — stale aplica-se ao detail.
4. Incident detail é fetch-on-load; timeline Append-only (designer.md §4.10).
5. **HM05:** dashboard atualiza em realtime via SSE (`/api/v1/realtime/stream`); quando o stream
   cai, o badge muda para "reconectando" e o client refaz o fetch com backoff — dados nunca
   ficam stale silenciosamente; 401/403 do stream → estado "sessão expirada" sem retry storm.
6. **HM05 follow-up:** Tickets (WaSupport) com lista + detalhe + transições (máquina do API
   espelhada em `lib/tickets.ts`, backend é a autoridade), criação/comentários com
   double-submit guard, 409 → re-lê estado do servidor, RBAC `tickets.read/create/resolve/assign`.
   Lista com badge realtime + poll de segurança 30s (eventos `ticket.created/transitioned`);
   detail é fetch-on-load. Nav: WaSupport saiu dos módulos travados.

# Frontend Capability Matrix — Alpha (AS-BUILT)

> Visão objetiva do frontend no momento do congelamento (HARD MISSION 02.5).
> Evidências: testes nomeados (`apps/web/test/*`), `API_ENDPOINT_MATRIX.md`,
> `API_READ_MODELS.md`, `READ_MODEL_GAPS.md`. Coluna "API real": ✅ todos os dados
> essenciais com read-model real · **Partial** parte disponível · ❌ ausente —
> todo Partial/❌ aponta GAP-RM-*.

| Tela            | API real | Loading | Empty | Error | Offline/Stale | RBAC | Responsive | A11y |
|-----------------|----------|---------|-------|-------|---------------|------|------------|------|
| Login           | ✅       | ✅¹     | N/A   | ✅    | —             | —    | ✅         | ✅   |
| Dashboard       | Partial (GAP-RM-004, GAP-RM-006) | ✅ | ✅ | ✅ | —² | ✅ | ✅ | ✅ |
| Hosts           | ✅       | ✅      | ✅    | ✅    | —³            | ✅   | ✅         | ✅   |
| Host Detail     | Partial (GAP-RM-001/002/003/004/007) | ✅ | N/A (404 tratado) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Incidents       | ✅       | ✅      | ✅    | ✅    | —²            | ✅   | ✅         | ✅   |
| Incident Detail | Partial (GAP-RM-007, GAP-RM-008) | ✅ | N/A (404 tratado) | ✅ | —⁴ | ✅ | ✅ | ✅ |
| Agents          | ❌ (GAP-RM-005) | ✅ | ✅ (honesto) | ✅ | — | ✅ | ✅ | ✅ |

## Evidências por coluna

- **API real:** `API_ENDPOINT_MATRIX.md` (rota a rota) + `API_READ_MODELS.md` (bloco a bloco).
- **Loading:** skeletons em todas as telas (designer.md §7 — nunca spinner central); testes
  `status.test.ts` (helpers), páginas com `loading` state + `<Skeleton>`.
- **Empty:** `EmptyState` canônico com ícone/título/CTA (dashboard, hosts, incidents);
  Agents usa EmptyState **declarando o gap** (GAP-RM-005) em vez de fingir lista.
- **Error:** `ErrorState` com "Tentar novamente" em todas as telas; 404 diferenciado de erro de
  rede e de permission denied (Host/Incident detail); `role="alert"`; detalhe técnico em `<details>`.
- **Offline/Stale:** `StaleBanner` + lógica `isStale()` (testes em `status.test.ts`);
  Host Detail exibe banner quando agente não está `online`.
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

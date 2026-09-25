# designer.md — Autoridade Visual e UX do WaOPS

> **Status:** AUTHORITY. Este arquivo é a fonte única de verdade visual/UX do WaOPS.
> Qualquer componente, tela ou pattern visual **deve** derivar daqui. Divergências exigem atualização deste arquivo primeiro.
>
> **Escopo do controle:** layout, hierarquia visual, spacing, tipografia, cores, componentes, sidebar/header, dashboards, tables, charts, modals, forms, responsive, animações, estados de UI.
>
> **Este arquivo NÃO controla** (e nunca pode sobrescrever): autorização/RBAC, tenant isolation, entitlements/billing, estados de domínio, API, banco, segurança. Onde visual e regra de domínio colidem, a regra de domínio vence (ver precedência em `AGENTS.md`).

---

## 0. Proveniência e direção

A linguagem visual do WaOPS é derivada do projeto **Zaptix — EV Charging SaaS CRM (RonDesignLab, Behance 2025)** como direção estética de referência: dashboard claro e denso em dados, sidebar escura, acento laranja vibrante, numerais grandes, dot-matrix de progresso, stacked bars de status e painéis gradiente.

- **Inspiração de linguagem visual apenas.** Nenhum asset, logo, ilustração ou arquivo do Zaptix/RonDesignLab é copiado. Todos os componentes WaOPS são implementação original (Next.js + Tailwind + shadcn/ui).
- O Zaptix monitora estações de carga; o WaOPS monitora infraestrutura. A metáfora visual (muitos recursos com poucos estados, mapas, séries temporais, severidade) é a mesma — o domínio é diferente.

---

## 1. Princípios

1. **Dados primeiro.** Operador olha o dashboard para decidir em segundos. Nada decorativo compete com o dado.
2. **Estado é conteúdo.** Cor carrega significado operacional (ok / atenção / crítico). Nunca usar cor de status decorativamente.
3. **Clareza sobre densidade, densidade sobre decoração.** Tabelas e listas são compactas, mas com respiro mínimo consistente.
4. **Uma superfície clara, uma âncora escura.** Conteúdo em tema claro; sidebar (e overlays críticos) como âncora escura.
5. **Movimento sutil.** Transições de 150–250ms, easing suave. Animação existe para continuidade, não para atenção.
6. **Todo estado existe.** Nenhuma tela é desenhada apenas no estado "com dados".

---

## 2. Design Tokens

### 2.1 Cores — superfícies (tema claro)

| Token | Valor aprox. | Uso |
|---|---|---|
| `bg.app` | `#F4F4F2` | Fundo da aplicação (cinza-quente muito claro) |
| `surface.card` | `#FFFFFF` | Cards, painéis, modais |
| `surface.subtle` | `#EDEDEB` | Blocos internos, hover de tabela, empty states |
| `surface.dark` | `#141414` | Sidebar, header de overlays, fundo do painel gradiente escuro |
| `surface.dark-raised` | `#1E1E1E` | Itens de menu ativos/hover na sidebar |
| `border.default` | `#E7E7E4` | Bordas de cards, divisores |
| `border.strong` | `#D4D4D0` | Bordas de inputs, elementos focalizáveis |

### 2.2 Cores — brand

| Token | Valor aprox. | Uso |
|---|---|---|
| `brand.primary` | `#F1590A` (laranja vibrante) | CTA primário, foco de atenção, ponto ativo |
| `brand.primary-hover` | `#D94E06` | Hover/pressed do primário |
| `brand.soft` | `#FDEDE3` | Fundos de destaque suave, badges de brand |
| `brand.gradient.panel` | `#E86A2E → #F7B79B` (135°) | Painéis de resumo/financeiro (ver §4.6) |

### 2.3 Cores — status e severidade

Os tokens de status são **os mesmos** para badge, ponto de legenda, série de gráfico e linha de tabela. Um estado = um token.

| Token | Valor aprox. | Semântica WaOPS | Severidade de incidente |
|---|---|---|---|
| `status.ok` | `#12B886` (teal/verde) | healthy, running, available, in use | — |
| `status.info` | `#3B6FE0` (azul) | informativo, provisionado, pending | `info` |
| `status.warning` | `#F1590A` (laranja brand) | attention, degraded, need service | `warning` e `high`* |
| `status.critical` | `#E03131` (vermelho) | down, unreachable, oom | `critical` |
| `status.neutral` | `#8A8A86` (cinza) | stopped, inactive, not ready | — |

\* `high` usa laranja mais profundo (`#D94E06`) em texto/badge e o mesmo laranja em séries; `warning` e `high` compartilham a matiz, diferenciando por label e intensidade. **Nunca** substituir `status.critical` por laranja.

| Token | Uso |
|---|---|
| `text.primary` | `#1A1A1A` — títulos, valores KPI |
| `text.secondary` | `#5A5A56` — labels, descrições |
| `text.tertiary` | `#8A8A86` — hints, timestamps, unidades |
| `text.inverse` | `#FAFAFA` — texto sobre superfícies escuras |
| `text.on-brand` | `#FFFFFF` — texto sobre brand.primary/critical |

### 2.4 Tipografia

- **Família UI:** Inter (ou equivalente geométrico-humanista disponível). **Família numérica de KPI:** a mesma Inter, peso 300/400, tabular-nums (`font-variant-numeric: tabular-nums`).
- **Monospace** (IDs, fingerprints, tokens, runtime IDs): JetBrains Mono ou ui-monospace, sempre truncado com cópia ao hover.

| Token | Valor | Uso |
|---|---|---|
| `font.display-xl` | 48–56px / peso 300 / tracking -1% | Valor KPI herói (ex.: 983 kW → 983 kW de potência ingerida) |
| `font.display-lg` | 32–36px / peso 300 | KPI de card |
| `font.title-lg` | 20px / peso 600 | Título de página |
| `font.title-md` | 16px / peso 600 | Título de card/seção |
| `font.body` | 14px / peso 400 | Corpo, células de tabela |
| `font.label` | 12px / peso 500 / tracking +2% uppercase | Labels de KPI, legendas |
| `font.mono-sm` | 12.5px monospace | IDs, hashes, payloads |

### 2.5 Spacing, raios, sombras, motion

| Grupo | Token |
|---|---|
| Spacing (base 4/8) | `space.1` 4 · `space.2` 8 · `space.3` 12 · `space.4` 16 · `space.5` 24 · `space.6` 32 · `space.7` 48 |
| Radius | `radius.sm` 8 (inputs, badges) · `radius.md` 12 (dropdowns, popover) · `radius.lg` 20 (cards) · `radius.xl` 28 (modais) · `radius.full` (pills, dots) |
| Shadow | `shadow.card` `0 1px 2px rgba(20,20,20,.04), 0 4px 16px rgba(20,20,20,.06)` · `shadow.modal` `0 8px 40px rgba(20,20,20,.16)` · **nenhuma** sombra em tabela |
| Motion | `motion.fast` 150ms · `motion.base` 200ms · `motion.slow` 250ms · easing `cubic-bezier(.25,.8,.25,1)`; skeleton pulse 1.2s; nada acima de 250ms exceto gráficos em streaming |
| Densidade | Tabela: linha 40px; lista compacta: 32px; card KPI padding `space.5` |

---

## 3. Layout global

```text
┌──────────┬──────────────────────────────────────────────┐
│ SIDEBAR  │ HEADER (busca · filtro de período · ações)   │
│ escura   ├──────────────────────────────────────────────┤
│ 240px    │  CONTENT (bg.app)                            │
│ fixa     │  grid de cards / tabela / painel gradiente   │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar** (`surface.dark`, 240px fixa, colapsa para 64px em ≤1280px e vira drawer em <1024px): logo no topo; navegação por **module registry** (Core sempre; módulos comerciais conforme entitlement — seção "Módulos"); item ativo = pill `surface.dark-raised` com dot `brand.primary` à esquerda; rodapé com avatar do usuário + tenant switcher (lista memberships; trocar tenant refaz o contexto completo).
- **Header** (fundo `bg.app`, sem borda, 64px): busca global à esquerda; centro/direita: chips de filtro de período (`1h · 24h · 7d · 30d`, estilo pill), sino de notificações com dot de severidade, ações do contexto.
- **Content** max-width 1600px, padding `space.6`; grids de 12 colunas, gutters `space.4`.
- **Breadcrumbs** acima do título de página (font.label, `text.tertiary`), exceto no dashboard raiz.
- **Sem segunda sidebar, sem segundo padrão de navegação.** Toda navegação nova deriva destes dois elementos.

---

## 4. Componentes canônicos

A implementação usa **shadcn/ui como base** (dialog, dropdown, popover, tooltip, command, form) com os tokens acima. Componentes WaOPS canônicos (listados no `DESIGN_COMPONENT_MAP.md`) derivam dos padrões abaixo. Criar componente novo só quando nenhum destes serve, e documentá-lo no map.

### 4.1 Card
`surface.card`, `radius.lg`, `shadow.card`, borda `border.default`, padding `space.5`. Header do card: título `font.title-md` à esquerda, ações ícone (16px, `text.tertiary`, hover `text.primary`) à direita — sempre **no máximo 3** ações de ícone; overflow vai para menu.

### 4.2 KPI Card
Label `font.label` (uppercase, `text.secondary`) → valor `font.display-lg` (tabular-nums) → delta/comparativo (seta + %, cor de status semanticamente: alta CPU alta = `status.warning`, não "bom"). Variação **sparkline**: série de 24 pontos, 2px, `text.tertiary`; quando o KPI tem estado, a série usa `status.*`. Variação **herói** (1 por dashboard no máximo): `font.display-xl` sobre painel gradiente (§4.6).

### 4.3 Stacked Status Bars (assinatura WaOPS)
Gráfico de barras verticais finas (2px por barra, gap 2px) mostrando composição de estados por período — herdeiro direto do "Station Status" do Zaptix (In Use/Available/Need service/Not ready). Mapeamento WaOPS: **online** `status.ok`, **degraded** `status.warning`, **critical** `status.critical`, **offline/paused** `status.neutral`, **pending** `status.info`. Sempre com legenda de pontos (dot 6px + `font.label`) no topo direito do card; hover na barra mostra tooltip com valores exatos. É o componente padrão para "saúde de hosts/containers/services" ao longo do tempo.

### 4.4 Dot-Matrix Progress
Progresso discreto (ex.: quotas, uso de entitlement, carga): fileira de dots 4px, cheios = consumido (`brand.primary`), vazios = `border.strong`; acima de 80% os cheios viram `status.warning`, acima de 95% `status.critical`. Sempre acompanhado de "8 de 15" em `font.body`.

### 4.5 Gauge
Arco fino (2px) 240° para métricas 0–100% (CPU, memória, disco). Trilho `border.default`; preenchimento por estado (`status.ok` → `status.warning` → `status.critical` conforme limiar da regra); valor central `font.display-lg`. Um gauge por card; conjuntos de gauges usam grid 3 colunas.

### 4.6 Painel gradiente (resumo/financeiro)
Card especial com `brand.gradient.panel`, texto `text.on-brand`, para o resumo de maior destaque (uso da plataforma, custos, resumo de incidentes críticos). Numerais grandes em branco, séries em branco 60% opacity. **Regra:** no máximo 1 por página.

### 4.7 Tabela
Header `font.label` uppercase `text.tertiary`, sem borda, linha 40px, hover `surface.subtle`, sem zebra. Primeira coluna = entidade (nome + subtítulo `text.tertiary`); coluna de estado = Badge (§4.8); última coluna = ações de ícone. Paginação cursor-based com contagem "1–25 de 132". Seleção múltipla via checkbox quando a ação em massa existe. Loading = skeleton rows; empty = EmptyState (§7).

### 4.8 Badge / Severidade
Pill `radius.full`, `font.label` sem uppercase, fundo `status.*` 12% opacity, texto `status.*` escurecido 20%, dot 6px sólido opcional. Severidades de incidente: `info`→azul, `warning`→laranja, `high`→laranja profundo + ícone, `critical`→vermelho + ícone. Badge nunca é o único portador da informação — sempre com label textual.

### 4.9 Chips de filtro
Pill `surface.card` borda `border.strong`, dropdown interno (shadcn). Filtros aplicados aparecem como chips ativos com × . Sempre acima da tabela/lista, alinhados à direita; busca textual à esquerda.

### 4.10 Timeline de incidente
Vertical, ícone de evento 16px em círculo `surface.subtle`, conectados por linha `border.default`. Entradas: `created_at` (`text.tertiary`, mono) + texto `font.body`. Append-only visualmente — nunca permitir UI que sugira edição/remoção.

### 4.11 Mapa de recursos (dashboard)
Mapa claro (tiles acinzentados) com pins coloridos por estado (§2.3); pin ativo pulsa sutilmente (1x, 250ms). Sem mapa em tela pequena — colapsa para lista. **Apenas o dashboard usa mapa.**

### 4.12 Forms
Label `font.label` acima do campo; input 36px, `radius.sm`, borda `border.strong`, foco: anel 2px `brand.primary` (nunca remover outline). Erro: borda `status.critical` + mensagem 12px abaixo. Ações: primário (laranja) à direita, secundário (ghost) à esquerda; destructive sempre com confirmação em modal.

### 4.13 Modal / Drawer / Toast
Modal: `radius.xl`, `shadow.modal`, overlay 40% escuro. Drawer (direita, 480px) para detalhe de incidente/recurso. Toast: canto inferior direito, `surface.card`, barra lateral de 3px na cor de status, 5s.

---

## 5. Charts (padrão de séries)

- Biblioteca: Recharts. Grid horizontal apenas (`border.default` 1px, dashed); sem linhas verticais.
- Séries com espessura 2px; área sob a linha com gradiente 12%→0% da mesma cor — exceto dentro do painel gradiente (série branca).
- Barras de séries temporais: 2px de largura, gap 2px, `radius.full` no topo.
- Eixos: `font.label` sem uppercase, `text.tertiary`; tooltip padrão shadcn com `shadow.card`.
- Períodos: todos os charts respeitam os chips de período do header. Zoom/pan só no detail view.

---

## 6. Telas por funcionalidade (composição)

Toda tela existe nos **estados do §7**. Navegação da sidebar segue o module registry.

### 6.1 Dashboard (Operações)
- Linha 1: KPI herói em painel gradiente (disponibilidade ou incidentes ativos) + 3 KPI cards com sparkline (hosts online, agentes conectados, incidentes abertos).
- Linha 2: **Stacked Status Bars** de hosts (24h) + mapa de recursos.
- Linha 3: Incidents recentes (tabela 5 linhas, badge de severidade, link "ver todos") + gauges dos recursos mais quentes (CPU/mem do host crítico).
- Empty (tenant novo): EmptyState com CTA "Adicionar primeiro agente".

### 6.2 Resources (WaInventory)
- Tabela de recursos (hosts/containers/services alternados por tab): nome, tipo, ambiente, estado (badge), agente, último heartbeat, ações.
- Detalhe (drawer): gauges de CPU/mem/disco, série temporal do recurso, filesystems/interfaces como sub-tabela, containers do host listados abaixo.
- Dependências: lista simples Service → depende de → Resource (grafo visual é fase futura).

### 6.3 Incidents
- Lista: severidade (badge), título, recurso, estado, detectado há X, ações (ack/resolve inline conforme permissão).
- Detalhe (drawer ou página): cabeçalho com severidade e estado; **timeline** (§4.10); métrica relacionada (chart do fingerprint); ações ack/resolve/reopen com modal de confirmação quando destrutivo (resolve).
- Estado `resolved` exibido em cinza; `critical` aberto tem dot pulsante na lista (1x).

### 6.4 Agents
- Tabela: nome, versão, protocolo, status (online/offline via heartbeat), último seen, credencial gerada em, ações (revoke).
- **Enrollment:** modal escura (`surface.dark`) com comando de instalação + token one-time exibido em mono com copy; aviso "este token expira em 15 minutos e só pode ser usado uma vez". Depois de usado, o modal mostra o agent criado.

### 6.5 Notifications
- Canais: cards por canal (email/webhook) com estado, destino truncado, teste de envio (envia notificação real e mostra toast com resultado).
- Deliveries: tabela com status (delivered/failed/retrying), tentativas, timestamp, erro truncado.

### 6.6 Billing / Usage
- Painel gradiente de resumo (uso do ciclo) + Dot-Matrix Progress por quota (agentes, hosts, monitors, retenção) + tabela de usage counters por métrica.
- Módulo não contratado → estado de entitlement (§7), nunca dados parciais.

### 6.7 Settings / Admin
- Sub-navegação por tabs (Users & roles · Entitlements · Tenants).
- Users: tabela com membership, role (badge), estado; convite via modal.
- Roles: matriz de permissões (checkboxes por permission key; keys agrupadas por namespace `incidents.*`, `hosts.*`…); roles de sistema com lock.
- Entitlements: leitura dos módulos/features com override (somente perfis com `billing.manage`).

---

## 7. Estados obrigatórios (UI_STATE_MATRIX)

Nenhuma tela/componente é "pronto" sem todos os estados aplicáveis:

| Estado | Padrão visual |
|---|---|
| **Loading** | Skeletons com pulse (mesma forma do conteúdo); tabelas: 8 linhas skeleton; nunca spinner central em tela cheia |
| **Empty** | Ilustração leve (ícone 48px em `surface.subtle` círculo), título `font.title-md`, descrição 1 linha, **CTA primário** da ação que resolve (ex.: "Criar enrollment token") |
| **Error** | Card `surface.card` com ícone `status.critical`, mensagem em linguagem de operador, ação "Tentar novamente"; detalhe técnico só em expand (e nunca stacktrace cru) |
| **Stale** | Banner fino no topo do card: "Dados de {timestamp} — atualização pausada" com dot `status.warning`; botão recarregar |
| **Sem permissão** | Bloco com ícone cadeado, "Você não tem acesso a {recurso}", sem CTA de bypass; a navegação nem exibe o item |
| **Entitlement (módulo off)** | Card com preview "esmaecido" (opacity 40%, sem dados reais), badge "Módulo não contratado", CTA "Falar com o administrador"; sidebar mostra o item com cadeado |
| **Quota atingida** | Dot-Matrix cheio em `status.critical` + banner no card correspondente; ações de criação desabilitadas com tooltip do motivo |
| **Realtime off** | Indicador no header (dot cinza) + fallback de refresh manual |

---

## 8. Responsividade e acessibilidade

- Breakpoints: 640 / 1024 / 1280 / 1600. Tabelas viram cards empilhados <640px; mapa some <1024px; sidebar colapsa 1280px, vira drawer <1024px.
- Contraste mínimo AA (4.5:1 texto; 3:1 em elementos gráficos grandes). Laranja brand **em texto pequeno** usa a variante escura.
- Foco visível sempre (anel brand 2px); navegação por teclado completa; `prefers-reduced-motion` desliga animações.
- Ícones: Lucide, 16px UI / 20px navegação, stroke 1.5.

---

## 9. Regras duras (violam este documento)

1. Introduzir segunda paleta, segunda família tipográfica, segunda sidebar ou segunda component library.
2. Cor de status usada decorativamente (ex.: card "bonito em verde" sem estado ok).
3. UI funcional exibida para módulo sem entitlement (sem o estado do §7).
4. Criar componente duplicado com variação estética menor em vez de estender o canônico.
5. Mostrar `tenant_id`, segredo, token ou payload bruto onde o padrão define truncamento/copy.
6. Remover estados de loading/empty/error para "simplificar".
7. Usar o painel gradiente mais de uma vez por página.
8. Qualquer evolução de pattern reutilizável que não seja documentada aqui e no `DESIGN_COMPONENT_MAP.md`.

---

*Mantido pelo time WaOPS. Mudanças neste arquivo seguem o fluxo de PR; mudanças que afetam componentes já implementados exigem atualização do `DESIGN_COMPONENT_MAP.md` no mesmo PR.*

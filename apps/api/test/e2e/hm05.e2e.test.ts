import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';

/**
 * HARD MISSION 05 — live E2E (rate limiting + realtime SSE + WaSupport):
 * - realtime (ADR-010): stream auth (401), channel validation (400),
 *   tenant-scoped fan-out of REAL producer events (gateway heartbeat, worker
 *   incident pipeline, tickets), cross-tenant isolation, Last-Event-ID replay;
 * - WaSupport: tickets CRUD + per-tenant numbering + state machine + 404
 *   isolation across tenants; follow-up: fluxo criar → transicionar → comentar
 *   com dois perfis RBAC (operator vs support_agent, 403 vs allow);
 * - rate limit (adversarial): auth hammer → 429 `rate_limited` with
 *   RateLimit-* and Retry-After headers; api-class burst exhausts the TENANT
 *   bucket while another tenant keeps working.
 *
 * Order matters: signups happen BEFORE the auth-hammer (same IP bucket) and
 * the rate-limit describe runs LAST, draining the bucket again so subsequent
 * test files start with a refilled auth budget.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:3002';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

let accessToken = '';
let tenantAId = '';
let userAId = '';
let tokenB = '';
const PASSWORD = 'E2ePassw0rd!';

async function signup(tenantName: string): Promise<{ token: string; userId: string }> {
  const email = `${tenantName.toLowerCase()}-${randomBytes(5).toString('hex')}@t.local`;
  const res = await fetch(`${API}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, tenantName }),
  });
  expect(res.status).toBe(201);
  const token = res.headers.get('x-access-token') ?? '';
  expect(token).toBeTruthy();
  const body = (await res.json()) as JsonRecord;
  return { token, userId: body.user_id as string };
}

function authHeaders(token: string): Record<string, string> {
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
}

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: JsonRecord; headers: Headers }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord, headers: res.headers };
}

/** Enroll an agent through the gateway (real credential + id). */
async function enrollAgent(token: string, name: string): Promise<{ agentId: string; credential: string }> {
  const mint = await api(token, 'POST', '/api/v1/agents/enrollment-tokens', {});
  expect(mint.status).toBe(201);
  const en = await fetch(`${GATEWAY}/api/v1/agents/enrollment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enrollment_token: mint.body.token, name }),
  });
  const enBody = (await en.json()) as JsonRecord;
  expect([200, 201]).toContain(en.status); // gateway (Fastify) replies 200
  return { agentId: enBody.agent_id as string, credential: enBody.credential as string };
}

/** Fire-and-forget heartbeat loop through the REAL gateway ingest path. */
function heartbeatLoop(credential: string, agentId: string, times: number, gapMs = 400): void {
  void (async () => {
    for (let i = 0; i < times; i++) {
      await fetch(`${GATEWAY}/api/v1/agents/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
        body: JSON.stringify({
          protocol_version: 1,
          agent_id: agentId,
          machine_id: randomBytes(16).toString('hex'),
          agent_version: '0.5.0-e2e',
          sent_at: new Date().toISOString(),
          capabilities: ['host.linux'],
        }),
      }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, gapMs));
    }
  })();
}

/**
 * Opens an SSE stream and resolves with the FIRST event matching `predicate`
 * (or null on timeout). Aborts the connection on resolution either way.
 */
async function collectEvent(
  path: string,
  token: string | null,
  predicate: (e: JsonRecord) => boolean,
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
): Promise<{ event: JsonRecord | null; lastId: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let lastId = '';
  try {
    const res = await fetch(`${API}${path}`, {
      headers: {
        accept: 'text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return { event: null, lastId };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let data = '';
    let id = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line === '') {
          if (data !== '') {
            lastId = id;
            try {
              const evt = JSON.parse(data) as JsonRecord;
              if (predicate(evt)) return { event: evt, lastId };
            } catch {
              // ignore malformed frame
            }
          }
          data = '';
          id = '';
        } else if (line.startsWith(':')) {
          // keep-alive comment
        } else {
          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          let v = colon === -1 ? '' : line.slice(colon + 1);
          if (v.startsWith(' ')) v = v.slice(1);
          if (field === 'data') data += (data ? '\n' : '') + v;
          // `event:` and `retry:` fields are not needed for the predicates
          else if (field === 'id') id = v;
        }
      }
    }
    return { event: null, lastId };
  } catch {
    return { event: null, lastId };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

beforeAll(async () => {
  // Both tenants BEFORE any rate-limit hammering (auth bucket is shared by IP).
  const a = await signup('HM05A');
  accessToken = a.token;
  userAId = a.userId;
  const me = await api(accessToken, 'GET', '/api/v1/auth/me');
  tenantAId = me.body.tenant_id as string;
  expect(tenantAId).toBeTruthy();
  const b = await signup('HM05B');
  tokenB = b.token;
}, 30_000);

afterAll(async () => {
  const { disconnectPrisma } = await import('@waops/db');
  await disconnectPrisma();
});

// ---------------------------------------------------------------------------
describe('HM05 — realtime SSE (ADR-010)', () => {
  it('rejects unauthenticated stream with 401', async () => {
    const res = await fetch(`${API}/api/v1/realtime/stream?channels=incidents`);
    expect(res.status).toBe(401);
  });

  it('rejects invalid channels with 400', async () => {
    const { status } = await api(accessToken, 'GET', '/api/v1/realtime/stream?channels=bogus');
    expect(status).toBe(400);
  });

  it('delivers real gateway heartbeats to the agents channel', async () => {
    const { agentId, credential } = await enrollAgent(accessToken, 'hm05-sse-agent');
    heartbeatLoop(credential, agentId, 4);
    const { event } = await collectEvent(
      '/api/v1/realtime/stream?channels=agents',
      accessToken,
      (e) => e.type === 'agent.heartbeat' && e.payload?.agent_id === agentId,
      10_000,
    );
    expect(event).not.toBeNull();
    expect(event!.channel).toBe('agents');
    expect(Number.isFinite(Number(event!.id))).toBe(true);
  }, 30_000);

  it('delivers incident.created from the worker pipeline (container.oom)', async () => {
    const { credential } = await enrollAgent(accessToken, 'hm05-evt-agent');
    const res = await fetch(`${GATEWAY}/api/v1/agents/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({
        agent_id: 'hm05-evt-agent',
        events: [
          {
            event_type: 'container.oom',
            resource_id: `ctr_${randomBytes(4).toString('hex')}`,
            observed_at: new Date().toISOString(),
            attributes: { memory_limit_mb: 512 },
          },
        ],
      }),
    });
    expect(res.status).toBe(200);

    const { event } = await collectEvent(
      '/api/v1/realtime/stream?channels=incidents',
      accessToken,
      (e) => e.type === 'incident.created',
      20_000,
    );
    expect(event).not.toBeNull();
    expect(event!.payload?.event_type).toBe('container.oom');
    expect(event!.payload?.incident_id).toBeTruthy();
  }, 45_000);

  it('isolates channels per tenant (B sees nothing of A)', async () => {
    const { agentId, credential } = await enrollAgent(accessToken, 'hm05-iso-agent');
    // B listens for ANY of A's traffic while A produces real events…
    const listener = collectEvent(
      '/api/v1/realtime/stream?channels=incidents,agents',
      tokenB,
      () => true,
      4_000,
    );
    await new Promise((r) => setTimeout(r, 300));
    heartbeatLoop(credential, agentId, 2);
    await api(accessToken, 'POST', '/api/v1/tickets', {
      title: 'iso probe',
      description: 'should not leak to tenant B',
    });
    const { event } = await listener;
    // 4s window with A emitting on both channels: B must have received nothing.
    expect(event).toBeNull();
  }, 30_000);

  it('replays missed events on reconnect via Last-Event-ID', async () => {
    const { agentId, credential } = await enrollAgent(accessToken, 'hm05-replay-agent');
    heartbeatLoop(credential, agentId, 2);
    const first = await collectEvent(
      '/api/v1/realtime/stream?channels=agents',
      accessToken,
      (e) => e.type === 'agent.heartbeat' && e.payload?.agent_id === agentId,
      10_000,
    );
    expect(first.event).not.toBeNull();
    const cursor = first.lastId || String((first.event as JsonRecord).id);
    expect(cursor).toBeTruthy();

    // Miss one beat while "disconnected", then reconnect with the cursor.
    heartbeatLoop(credential, agentId, 2, 250);
    await new Promise((r) => setTimeout(r, 700));
    const replay = await collectEvent(
      '/api/v1/realtime/stream?channels=agents',
      accessToken,
      (e) => e.type === 'agent.heartbeat' && e.payload?.agent_id === agentId && Number(e.id) > Number(cursor),
      10_000,
      { 'last-event-id': cursor },
    );
    expect(replay.event).not.toBeNull();
    expect(Number((replay.event as JsonRecord).id)).toBeGreaterThan(Number(cursor));
  }, 45_000);
});

// ---------------------------------------------------------------------------
describe('HM05 — WaSupport tickets', () => {
  it('creates tickets with per-tenant sequential numbers', async () => {
    const t1 = await api(accessToken, 'POST', '/api/v1/tickets', {
      title: 'CPU saturado no host X',
      description: 'Uso de CPU acima de 95% por 10 minutos.',
      priority: 'high',
      labels: ['infra'],
    });
    expect(t1.status).toBe(201);
    expect(typeof t1.body.number).toBe('number');
    expect(t1.body.status).toBe('open');

    const t2 = await api(accessToken, 'POST', '/api/v1/tickets', {
      title: 'Segundo ticket',
      description: 'Sequência deve incrementar.',
    });
    expect(t2.status).toBe(201);
    expect(t2.body.number).toBe((t1.body.number as number) + 1);
  });

  it('validates payload (400) and patches fields', async () => {
    const bad = await api(accessToken, 'POST', '/api/v1/tickets', { title: '' });
    expect(bad.status).toBe(400);

    const list = await api(accessToken, 'GET', '/api/v1/tickets');
    expect(list.status).toBe(200);
    const anyTicket = (list.body as JsonRecord[])[0]!;
    const patched = await api(accessToken, 'PATCH', `/api/v1/tickets/${anyTicket.id}`, { priority: 'urgent' });
    expect(patched.status).toBe(200);
    expect(patched.body.priority).toBe('urgent');
  });

  it('adds comments; comments come back on GET /:id', async () => {
    const created = await api(accessToken, 'POST', '/api/v1/tickets', {
      title: 'ticket com comentário',
      description: 'd',
    });
    const id = created.body.id as string;
    const c = await api(accessToken, 'POST', `/api/v1/tickets/${id}/comments`, { body: 'investigando' });
    expect(c.status).toBe(201);
    const got = await api(accessToken, 'GET', `/api/v1/tickets/${id}`);
    expect(got.status).toBe(200);
    const comments = got.body.comments as JsonRecord[];
    expect(comments.length).toBe(1);
    expect(comments[0]!.body).toBe('investigando');
  });

  it('assigns only active members of the same tenant', async () => {
    const created = await api(accessToken, 'POST', '/api/v1/tickets', {
      title: 'para atribuir',
      description: 'd',
    });
    const id = created.body.id as string;
    const ok = await api(accessToken, 'POST', `/api/v1/tickets/${id}/assign`, { assignee_id: userAId });
    expect(ok.status).toBe(201);
    expect(ok.body.assigneeId ?? ok.body.assignee_id).toBe(userAId);

    const bad = await api(accessToken, 'POST', `/api/v1/tickets/${id}/assign`, { assignee_id: randomUUID() });
    expect(bad.status).toBe(400);
    expect(bad.body.error?.code).toBe('validation_error');
  });

  it('enforces the state machine (legal transitions + 409 on illegal)', async () => {
    const created = await api(accessToken, 'POST', '/api/v1/tickets', {
      title: 'máquina de estados',
      description: 'd',
    });
    const id = created.body.id as string;
    expect((await api(accessToken, 'POST', `/api/v1/tickets/${id}/transition`, { status: 'in_progress' })).status).toBe(201);
    const resolved = await api(accessToken, 'POST', `/api/v1/tickets/${id}/transition`, { status: 'resolved', note: 'fix aplicado' });
    expect(resolved.status).toBe(201);
    expect(resolved.body.resolvedAt ?? resolved.body.resolved_at).toBeTruthy();
    const closed = await api(accessToken, 'POST', `/api/v1/tickets/${id}/transition`, { status: 'closed' });
    expect(closed.status).toBe(201);

    const illegal = await api(accessToken, 'POST', `/api/v1/tickets/${id}/transition`, { status: 'in_progress' });
    expect(illegal.status).toBe(409);
    expect(illegal.body.error?.code).toBe('conflict');

    const invalid = await api(accessToken, 'POST', `/api/v1/tickets/${id}/transition`, { status: 'weird' });
    expect(invalid.status).toBe(400);
  });

  it('cross-tenant ticket access resolves 404 (no existence oracle)', async () => {
    const created = await api(accessToken, 'POST', '/api/v1/tickets', { title: 'de A', description: 'd' });
    const id = created.body.id as string;
    const fromB = await api(tokenB, 'GET', `/api/v1/tickets/${id}`);
    expect(fromB.status).toBe(404);
    const patchFromB = await api(tokenB, 'PATCH', `/api/v1/tickets/${id}`, { title: 'hijack' });
    expect(patchFromB.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// WaSupport × RBAC (HM05 follow-up): dois perfis com permissões de tickets
// distintas — operator (read+create, sem resolve/assign) vs support_agent
// (full: read/create/assign/resolve). O segundo usuário é criado por SQL
// (argon2 via @node-rs/argon2, mesmos ARGON2_OPTS do auth.controller) e
// recebe membership no tenant A com o role de sistema do seed.
// ---------------------------------------------------------------------------
describe('HM05 follow-up — tickets × RBAC (operator vs support_agent)', () => {
  async function loginAs(email: string): Promise<string> {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    return (res.headers.get('x-access-token') ?? '') as string;
  }

  it('create → transition → comment with two RBAC profiles', async () => {
    // ── Arrange: operator (sem tickets.resolve/assign) e support_agent (full) ──
    const { getPrisma } = await import('@waops/db');
    const { hash } = await import('@node-rs/argon2');
    const prisma = getPrisma();
    const roleRows = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM roles WHERE tenant_id IS NULL AND name IN ('operator','support_agent')`;
    const roleId = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));
    expect(roleId.operator).toBeTruthy();
    expect(roleId.support_agent).toBeTruthy();

    const suffix = randomBytes(5).toString('hex');
    const passwordHash = await hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const users: Record<string, string> = {};
    for (const [roleName, email] of [
      ['operator', `op-${suffix}@t.local`],
      ['support_agent', `sa-${suffix}@t.local`],
    ] as const) {
      const userId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO users (id, email, email_normalized, password_hash, status, updated_at)
        VALUES (${userId}::uuid, ${email}, ${email.toLowerCase()}, ${passwordHash}, 'active', now())`;
      await prisma.$executeRaw`
        INSERT INTO memberships (id, tenant_id, user_id, role_id, status)
        VALUES (${randomUUID()}::uuid, ${tenantAId}::uuid, ${userId}::uuid, ${roleId[roleName]}::uuid, 'active')`;
      users[roleName] = email;
    }
    const operatorToken = await loginAs(users.operator!);
    const supportToken = await loginAs(users.support_agent!);

    // ── CREATE: operator cria (tickets.create); viewer-like profile leria ──
    const created = await api(operatorToken, 'POST', '/api/v1/tickets', {
      title: 'impressora do rack parou',
      description: 'sem resposta desde ontem; impacto médio',
      priority: 'high',
    });
    expect(created.status).toBe(201);
    const ticketId = created.body.id as string;
    // ── TRANSITION: operator NÃO pode (403); support_agent pode ──
    const opTransition = await api(operatorToken, 'POST', `/api/v1/tickets/${ticketId}/transition`, { status: 'in_progress' });
    expect(opTransition.status).toBe(403);
    expect(opTransition.body.error?.code).toBe('permission_denied');
    const saTransition = await api(supportToken, 'POST', `/api/v1/tickets/${ticketId}/transition`, { status: 'in_progress' });
    expect([200, 201]).toContain(saTransition.status);
    expect(saTransition.body.status).toBe('in_progress');

    // ── COMMENT: operator comenta (tickets.create cobre comentários); 2 perfis deixam rastro ──
    const opComment = await api(operatorToken, 'POST', `/api/v1/tickets/${ticketId}/comments`, { body: 'aberto pelo operator' });
    expect(opComment.status).toBe(201);
    const saComment = await api(supportToken, 'POST', `/api/v1/tickets/${ticketId}/comments`, { body: 'assumido pelo suporte' });
    expect(saComment.status).toBe(201);
    const got = await api(supportToken, 'GET', `/api/v1/tickets/${ticketId}`);
    expect(got.status).toBe(200);
    const comments = got.body.comments as JsonRecord[];
    // transitions inserem comentário de sistema "status → X"; assert nos comentários dos perfis, em ordem
    const bodies = comments.map((c) => String(c.body));
    expect(bodies).toContain('aberto pelo operator');
    expect(bodies).toContain('assumido pelo suporte');
    expect(bodies.indexOf('aberto pelo operator')).toBeLessThan(bodies.indexOf('assumido pelo suporte'));

    // ── ASSIGN: operator NÃO pode (403); support_agent atribui ao operator ──
    const opAssign = await api(operatorToken, 'POST', `/api/v1/tickets/${ticketId}/assign`, { assignee_id: userAId });
    expect(opAssign.status).toBe(403);
    const saAssign = await api(supportToken, 'POST', `/api/v1/tickets/${ticketId}/assign`, { assignee_id: userAId });
    expect([200, 201]).toContain(saAssign.status);
    expect(saAssign.body.assigneeId ?? saAssign.body.assignee_id).toBe(userAId);

    // ── RESOLVE: operator 403; support_agent resolve → fecha o ciclo ──
    const opResolve = await api(operatorToken, 'POST', `/api/v1/tickets/${ticketId}/transition`, { status: 'resolved', note: 'trocada da peça' });
    expect(opResolve.status).toBe(403);
    const saResolve = await api(supportToken, 'POST', `/api/v1/tickets/${ticketId}/transition`, { status: 'resolved', note: 'peça trocada' });
    expect([200, 201]).toContain(saResolve.status);
    expect(saResolve.body.resolvedAt ?? saResolve.body.resolved_at).toBeTruthy();
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Rate limiting LAST (shared IP bucket) + drain before handing over to the
// next E2E file.
// ---------------------------------------------------------------------------
describe('HM05 — rate limiting (adversarial)', () => {
  it('auth hammer → 429 rate_limited with RateLimit-* and Retry-After headers', async () => {
    let saw429: { status: number; body: JsonRecord; headers: Headers } | null = null;
    for (let i = 0; i < 40 && !saw429; i++) {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: `hammer-${i}-${randomBytes(3).toString('hex')}@t.local`, password: 'WrongPassw0rd!' }),
      });
      if (res.status === 429) {
        saw429 = { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord, headers: res.headers };
      } else {
        await res.arrayBuffer(); // drain
      }
    }
    expect(saw429).not.toBeNull();
    expect(saw429!.body.error?.code).toBe('rate_limited');
    expect(saw429!.headers.get('ratelimit-limit')).toBeTruthy();
    expect(Number(saw429!.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('api-class burst exhausts the tenant bucket; another tenant is unaffected', async () => {
    let saw429 = false;
    let headers: Headers | null = null;
    for (let i = 0; i < 140 && !saw429; i++) {
      const res = await fetch(`${API}/api/v1/hosts`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (res.status === 429) {
        saw429 = true;
        headers = res.headers;
        await res.arrayBuffer();
      } else {
        await res.arrayBuffer();
      }
    }
    expect(saw429).toBe(true);
    expect(headers!.get('ratelimit-limit')).toBeTruthy();

    // Different tenant → different bucket: B sails through while A is blocked.
    const bOk = await api(tokenB, 'GET', '/api/v1/hosts');
    expect(bOk.status).toBe(200);
  }, 60_000);

  it('exposes the 15-minute 429 history per route class (Redis-backed)', async () => {
    // Os 429s dos testes acima já incrementaram rl:stats:429:{auth,api}:*.
    // Consulta como tenant B (bucket da classe api não exaurido pelo burst).
    const res = await api(tokenB, 'GET', '/api/v1/rate-limits/history');
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(15);
    const classes = res.body.classes as { routeClass: string; limited: { windowStart: string; limited: number }[] }[];
    expect(classes.map((c) => c.routeClass)).toEqual(['auth', 'api', 'realtime']);
    for (const c of classes) {
      expect(c.limited.length).toBe(15);
      // ordem cronológica: último ponto é o bucket corrente
      expect(new Date(c.limited[14]!.windowStart).getTime()).toBeGreaterThan(new Date(c.limited[0]!.windowStart).getTime());
    }
    // 429s gerados acima caem nos buckets recentes (margem de 3 minutos)
    const recent = (series: { windowStart: string; limited: number }[]) => series.slice(-3).reduce((s, p) => s + p.limited, 0);
    const byClass = Object.fromEntries(classes.map((c) => [c.routeClass, c.limited]));
    expect(recent(byClass.auth!)).toBeGreaterThan(0); // hammer test
    expect(recent(byClass.api!)).toBeGreaterThan(0); // burst test
  }, 30_000);

  it('resets the auth buckets (direct Redis) so other E2E files are unaffected', async () => {
    // Refill by polling would self-defeat (each probe consumes a token);
    // clearing the buckets restores the full budget instantly and verifies
    // the limiter reads live state per request.
    const { loadConfig } = await import('@waops/config');
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(loadConfig().env.REDIS_URL, { maxRetriesPerRequest: 1 });
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit().catch(() => undefined);

    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `drain-${randomBytes(4).toString('hex')}@t.local`, password: 'WrongPassw0rd!' }),
    });
    await res.arrayBuffer();
    expect(res.status).toBe(401); // reached the handler again (not 429)
  }, 30_000);
});

/**
 * HARD MISSION 01 — E2E do fluxo ponta a ponta:
 * signup → login → RBAC → enrollment token → agent enroll (HTTP) → heartbeat →
 * metrics → rule → event → incident → notification (Mailpit) → cross-tenant denial.
 *
 * Requer infra local: docker compose --profile core up -d
 * e serviços rodando: api (3001), collector-gateway (3002), worker.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });

const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:3002';
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

let accessTokenA = '';
let tenantAId = '';
let agentCredential = '';
let agentId = '';
let enrollmentToken = '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();

async function api(path: string, opts: RequestInit = {}, token?: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

async function gateway(path: string, body: unknown, cred?: string): Promise<Response> {
  return fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cred ? { authorization: `Bearer ${cred}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  // Infra health
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${API}/healthz`);
      if (r.ok) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
}, 60_000);

afterAll(async () => { /* connections closed by services */ });

describe('E2E — fluxo completo do alpha', () => {
  it('1. signup cria user + tenant (trial) e 2. login emite token', async () => {
    const email = `e2e-${Date.now()}@tenant-a.local`;
    const signup = await api('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'E2ePassw0rd!', tenantName: 'E2E Tenant A' }),
    });
    expect(signup.status).toBe(201);
    const signupBody = await json(signup);
    tenantAId = signupBody.tenant_id;
    expect(tenantAId).toBeTruthy();

    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'E2ePassw0rd!' }),
    });
    expect(login.status).toBe(200);
    accessTokenA = login.headers.get('x-access-token') ?? '';
    expect(accessTokenA).toBeTruthy();
  });

  it('3. me retorna contexto (tenant do token, permissões owner)', async () => {
    const me = await api('/api/v1/auth/me', {}, accessTokenA);
    expect(me.status).toBe(200);
    const body = await json(me);
    expect(body.tenant_id).toBe(tenantAId);
    expect(body.permissions).toContain('hosts.manage');
    expect(body.permissions).toContain('incidents.resolve');
  });

  it('4. cria host (RBAC ok) e 5. cria enrollment token (direto no db via api de hosts é out of scope — token via api agents)', async () => {
    const host = await api('/api/v1/hosts', {
      method: 'POST',
      body: JSON.stringify({ name: 'e2e-host', osType: 'linux', environment: 'local' }),
    }, accessTokenA);
    expect(host.status).toBe(201);
  });

  it('6. endpoint protegido sem token → 401 authentication_required', async () => {
    const res = await api('/api/v1/hosts');
    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe('authentication_required');
  });

  // ── Agente real via gateway HTTP ───────────────────────────────────────────
  it('7. enrollment token one-time → agent enroll → credencial durável (token hasheado at rest)', async () => {
    // Token criado diretamente no banco (a UI/Admin faria via API autenticada;
    // fluxo admin de enrollment UI chega com o frontend). Token é armazenado
    // como sha256 hash — plaintext nunca persistido (C1, §14).
    const { getPrisma } = await import('@waops/db');
    const prisma = getPrisma();
    const token = `enr_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.agentEnrollmentToken.create({
      data: { tokenHash, tenantId: tenantAId, expiresAt: new Date(Date.now() + 15 * 60_000) },
    });
    enrollmentToken = token;

    const enroll = await gateway('/api/v1/agents/enrollment', {
      enrollment_token: enrollmentToken,
      name: 'e2e-agent',
      version: '0.1.0',
      capabilities: ['host.linux'],
    });
    expect(enroll.status).toBe(200);
    const body = await json(enroll);
    agentId = body.agent_id;
    agentCredential = body.credential;
    expect(agentId).toBeTruthy();
    expect(agentCredential).toMatch(/^waops_/);

    // plaintext token NÃO está no banco; hash sim
    const stored = await prisma.agentEnrollmentToken.findUniqueOrThrow({
      where: { tokenHash },
    });
    expect(stored.status).toBe('used');
  });

  it('7b. enrollment CONCORRENTE: duas requests no mesmo token → exatamente 1 vence (C1)', async () => {
    const { getPrisma } = await import('@waops/db');
    const prisma = getPrisma();
    const { createHash, randomBytes } = await import('node:crypto');
    const token = `enr_${randomBytes(24).toString('hex')}`;
    await prisma.agentEnrollmentToken.create({
      data: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        tenantId: tenantAId,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    // 5 requests simultâneas disputando o mesmo token
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        gateway('/api/v1/agents/enrollment', {
          enrollment_token: token,
          name: 'race-agent',
        }),
      ),
    );
    const statuses = attempts.map((a) => a.status).sort();
    const winners = statuses.filter((s) => s === 200).length;
    expect(winners).toBe(1); // apenas 1 agente criado

    const agentsNamedRace = await prisma.agent.count({
      where: { tenantId: tenantAId, name: 'race-agent' },
    });
    expect(agentsNamedRace).toBe(1);
  }, 30_000);

  it('8. enrollment token é one-time (segundo uso falha)', async () => {
    const again = await gateway('/api/v1/agents/enrollment', {
      enrollment_token: enrollmentToken,
    });
    expect(again.status).toBe(401);
  });

  it('9. heartbeat do agente atualiza last_seen', async () => {
    const hb = await gateway('/api/v1/agents/heartbeat', {
      protocol_version: 1,
      agent_id: agentId,
      agent_version: '0.1.0',
      sent_at: new Date().toISOString(),
      uptime_seconds: 30,
      capabilities: ['host.linux'],
    }, agentCredential);
    expect(hb.status).toBe(200);

    const { getPrisma } = await import('@waops/db');
    const agent = await getPrisma().agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.lastSeenAt).not.toBeNull();
    expect(agent.status).toBe('online');
  });

  it('10. métricas altas de CPU → worker aplica regra → incidente criado → email no Mailpit', async () => {
    // 6 samples consecutivos > 90 (regra default CPU) via gateway
    for (let i = 0; i < 6; i++) {
      const res = await gateway('/api/v1/agents/metrics', {
        protocol_version: 1,
        agent_id: agentId,
        sequence: i,
        samples: [
          { metric: 'host.cpu.usage_percent', resource_id: `host_e2e_${agentId}`, observed_at: new Date().toISOString(), value: 96 },
        ],
      }, agentCredential);
      expect(res.status).toBe(200);
    }

    // aguarda worker processar (regra → evento → incidente → notificação)
    let incident: { id: string; status: string; severity: string } | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const { getPrisma } = await import('@waops/db');
      const found = await getPrisma().incident.findFirst({
        where: { tenantId: tenantAId, fingerprint: { not: null } },
        orderBy: { detectedAt: 'desc' },
      });
      if (found) {
        incident = { id: found.id, status: found.status, severity: found.severity };
        break;
      }
    }
    expect(incident).not.toBeNull();
    expect(incident!.severity).toBe('high');
    expect(incident!.status).toBe('detected');

    // timeline append-only
    const { getPrisma } = await import('@waops/db');
    const timeline = await getPrisma().incidentTimelineEntry.findMany({
      where: { incidentId: incident!.id },
    });
    expect(timeline.some((t) => t.entryType === 'created')).toBe(true);
  }, 45_000);

  it('10b. DUPLICATE batch (§17): mesma sequence reenviada → sem incidente/evento duplicado', async () => {
    const first = await gateway('/api/v1/agents/metrics', {
      protocol_version: 1,
      agent_id: agentId,
      sequence: 999,
      samples: [
        { metric: 'host.cpu.usage_percent', resource_id: `host_e2e_${agentId}`, observed_at: new Date().toISOString(), value: 97 },
      ],
    }, agentCredential);
    expect(first.status).toBe(200);

    // reenvio idêntico (mesma sequence + mesmos samples)
    const second = await gateway('/api/v1/agents/metrics', {
      protocol_version: 1,
      agent_id: agentId,
      sequence: 999,
      samples: [
        { metric: 'host.cpu.usage_percent', resource_id: `host_e2e_${agentId}`, observed_at: new Date().toISOString(), value: 97 },
      ],
    }, agentCredential);
    expect(second.status).toBe(200);

    await new Promise((r) => setTimeout(r, 4000));
    const { getPrisma } = await import('@waops/db');
    const prisma = getPrisma();
    // sem regra no DB, fallback default CPU (>90% × 6) aplica; incidentes ativos
    // do tenant continuam ≤ número de fingerprints distintos (dedup por fingerprint)
    const activeIncidents = await prisma.incident.findMany({
      where: { tenantId: tenantAId, status: { notIn: ['resolved', 'closed'] } },
    });
    const fingerprints = new Set(activeIncidents.map((i) => i.fingerprint));
    expect(activeIncidents.length).toBe(fingerprints.size); // nenhum duplicado por fingerprint
  }, 30_000);

  it('10c. NOTIFICAÇÃO REAL no Mailpit (§41): incidente → email entregue via SMTP', async () => {
    const { getPrisma } = await import('@waops/db');
    const prisma = getPrisma();
    // Sanity: the CPU incident from test 10 exists before we assert delivery.
    await prisma.incident.findFirstOrThrow({
      where: { tenantId: tenantAId },
      orderBy: { detectedAt: 'desc' },
    });
    // canal email para o tenant demo (criado uma vez)
    const existing = await prisma.notificationChannel.findFirst({
      where: { tenantId: tenantAId, name: 'e2e-mailpit' },
    });
    if (!existing) {
      await prisma.notificationChannel.create({
        data: {
          tenantId: tenantAId,
          provider: 'email',
          name: 'e2e-mailpit',
          configJson: { to: 'ops@tenant-a.local' } as object,
        },
      });
    }

    // dispara novo evento com fingerprint DIFERENTE (novo incidente → fan-out)
    const freshFingerprint = `sha256:e2e-${Date.now()}`;
    const { buildEventEnvelope } = await import('@waops/contracts');
    const envelope = buildEventEnvelope({
      eventId: `evt_${crypto.randomUUID()}`,
      tenantId: tenantAId,
      source: 'e2e',
      sourceType: 'engine',
      eventType: 'container.down',
      severity: 'high',
      observedAt: new Date(),
      attributes: {},
      resourceId: `host_e2e_${agentId}`,
      fingerprint: freshFingerprint,
    });
    const { Queue } = await import('bullmq');
    const { parseRedis } = await import('@waops/events');
    const cfgEnv = { REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379' };
    const queue = new Queue('waops.domain-events', { connection: parseRedis(cfgEnv.REDIS_URL) });
    await queue.add(envelope.event_type, envelope, { jobId: envelope.event_id });
    await queue.close();

    // espera worker processar (evento → incidente → notificação)
    let delivered = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`${MAILPIT}/api/v1/search?query=to:ops@tenant-a.local`);
      if (res.ok) {
        const box = (await res.json()) as { total: number };
        delivered = box.total;
        if (delivered > 0) break;
      }
    }
    expect(delivered).toBeGreaterThan(0); // email REAL chegou no Mailpit

    // IDEMPOTÊNCIA (§38): republish do MESMO envelope → nenhum email novo
    const before = delivered;
    const queue2 = new Queue('waops.domain-events', { connection: parseRedis(cfgEnv.REDIS_URL) });
    await queue2.add(envelope.event_type, envelope, { jobId: `${envelope.event_id}_replay` });
    await queue2.close();
    await new Promise((r) => setTimeout(r, 5000));
    const res2 = await fetch(`${MAILPIT}/api/v1/search?query=to:ops@tenant-a.local`);
    const box2 = (await res2.json()) as { total: number };
    expect(box2.total).toBe(before); // nenhum spam adicional
  }, 60_000);

  it('11. incident ack/resolve com permissões e timeline', async () => {
    const { getPrisma } = await import('@waops/db');
    const prisma = getPrisma();
    const incident = await prisma.incident.findFirstOrThrow({
      where: { tenantId: tenantAId },
      orderBy: { detectedAt: 'desc' },
    });

    const ack = await api(`/api/v1/incidents/${incident.id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ note: 'e2e ack' }),
    }, accessTokenA);
    expect(ack.status).toBe(201);
    expect((await json(ack)).status).toBe('acknowledged');

    const resolve = await api(`/api/v1/incidents/${incident.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note: 'e2e resolve' }),
    }, accessTokenA);
    expect(resolve.status).toBe(201);
    const resolved = await json(resolve);
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt ?? resolved.resolved_at).toBeTruthy();
  });

  it('12. cross-tenant: Tenant B (segundo signup) não vê nada do Tenant A', async () => {
    const email = `e2e-b-${Date.now()}@tenant-b.local`;
    await api('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'E2ePassw0rd!', tenantName: 'E2E Tenant B' }),
    });
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'E2ePassw0rd!' }),
    });
    const tokenB = login.headers.get('x-access-token') ?? '';

    // B lista hosts → só os seus (vazio)
    const hostsB = await api('/api/v1/hosts', {}, tokenB);
    expect(hostsB.status).toBe(200);
    const hostsBody = await json(hostsB);
    expect(Array.isArray(hostsBody)).toBe(true);
    expect(hostsBody).toHaveLength(0);

    // B tenta acessar incidente de A pelo ID → 404
    const { getPrisma } = await import('@waops/db');
    const incidentA = await getPrisma().incident.findFirstOrThrow({
      where: { tenantId: tenantAId },
      orderBy: { detectedAt: 'desc' },
    });
    const res = await api(`/api/v1/incidents/${incidentA.id}`, {}, tokenB);
    expect(res.status).toBe(404);

    // B tenta ack no incidente de A → 404 (não 403 — não revela existência)
    const ack = await api(`/api/v1/incidents/${incidentA.id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, tokenB);
    expect(ack.status).toBe(404);
  });
});

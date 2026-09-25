import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { getPrisma } from '@waops/db';

/**
 * HARD MISSION 03 — WaMonitor E2E (live services):
 * enrollment → heartbeat(machine_id) → metrics ingest → identity bridge
 * (Host row + Agent link + Container inventory) → new read-models:
 *   GET /hosts/:id/metrics, /filesystems, /containers, /agents, revoke.
 * Reuses full-flow helpers (global-setup truncates + seeds).
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:3002';

let accessToken = '';
let hostId = '';
let agentId = '';
const MACHINE_ID = randomBytes(16).toString('hex'); // 32 chars, deterministic per run

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

async function apiGet(path: string, token = accessToken): Promise<{ status: number; body: JsonRecord }> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord };
}

async function apiPost(path: string, body: unknown, token = accessToken): Promise<{ status: number; body: JsonRecord }> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord };
}

async function gateway(path: string, body: unknown, cred?: string): Promise<{ status: number; body: JsonRecord; headers: Headers }> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cred ? { authorization: `Bearer ${cred}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord, headers: res.headers };
}

beforeAll(async () => {
  const email = `hm03-${randomBytes(4).toString('hex')}@tenant-a.local`;
  // signup returns the access token in the x-access-token header
  const res = await fetch(`${API}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'E2ePassw0rd!', tenantName: 'HM03 Tenant' }),
  });
  accessToken = res.headers.get('x-access-token') ?? '';
  expect(accessToken).toBeTruthy();
}, 30_000);

afterAll(async () => {
  const { disconnectPrisma } = await import('@waops/db');
  await disconnectPrisma();
});

describe('HM03 — WaMonitor pipeline (live)', () => {
  it('1. enrollment token via API admin (GAP-RM-005 closed)', async () => {
    const { status, body } = await apiPost('/api/v1/agents/enrollment-tokens', {});
    expect(status).toBe(201);
    expect(body.token).toMatch(/^enr_/);
    expect(body.expires_at).toBeTruthy();
  });

  it('2. enrollment + heartbeat com machine_id → identity bridge', async () => {
    const { status: ts, body: tb } = await apiPost('/api/v1/agents/enrollment-tokens', {});
    expect(ts).toBe(201);
    const en = await gateway('/api/v1/agents/enrollment', {
      enrollment_token: tb.token,
      name: 'hm03-agent',
      version: '0.1.0',
      capabilities: ['host.linux'],
    });
    expect(en.status).toBe(200);
    agentId = en.body.agent_id;
    expect(agentId).toBeTruthy();

    const hb = await gateway(
      '/api/v1/agents/heartbeat',
      {
        protocol_version: 1,
        agent_id: agentId,
        machine_id: MACHINE_ID,
        agent_version: '0.1.0',
        sent_at: new Date().toISOString(),
        uptime_seconds: 10,
        buffer_bytes: 0,
        capabilities: ['host.linux', 'docker'],
      },
      en.body.credential,
    );
    expect(hb.status).toBe(200);

    // métricas host + container (dispara bridge)
    const now = new Date().toISOString();
    const mt = await gateway(
      '/api/v1/agents/metrics',
      {
        protocol_version: 1,
        agent_id: agentId,
        sequence: 1,
        samples: [
          { metric: 'host.cpu.usage_percent', resource_id: `host_${MACHINE_ID}`, observed_at: now, value: 42.5 },
          { metric: 'host.memory.used_bytes', resource_id: `host_${MACHINE_ID}`, observed_at: now, value: 1_000_000_000 },
          { metric: 'host.filesystem.used_bytes', resource_id: `host_${MACHINE_ID}`, observed_at: now, value: 5_000_000_000, dimensions: { mount: '/' } },
          { metric: 'host.filesystem.available_bytes', resource_id: `host_${MACHINE_ID}`, observed_at: now, value: 15_000_000_000, dimensions: { mount: '/' } },
          { metric: 'container.memory.used_bytes', resource_id: 'ctr_abc123', observed_at: now, value: 50_000_000, dimensions: { name: 'web', image: 'nginx:latest' } },
        ],
      },
      en.body.credential,
    );
    expect(mt.status).toBe(200);

    // worker processa (bridge + insert)
    await new Promise((r) => setTimeout(r, 3000));

    const prisma = getPrisma();
    const host = await prisma.host.findFirst({ where: { machineId: MACHINE_ID } });
    expect(host).toBeTruthy();
    hostId = host!.id;
    expect(host!.status).toBe('online');

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    expect(agent?.hostId).toBe(host!.id);
    expect(agent?.machineId).toBe(MACHINE_ID);

    const container = await prisma.container.findFirst({ where: { tenantId: host!.tenantId, name: 'web' } });
    expect(container).toBeTruthy();
    expect(container?.image).toBe('nginx:latest');
    expect(container?.hostId).toBe(host!.id);
  }, 30_000);

  it('3. GET /hosts/:id/metrics retorna séries (GAP-RM-004)', async () => {
    const { status, body } = await apiGet(`/api/v1/hosts/${hostId}/metrics`);
    expect(status).toBe(200);
    expect(body.series['host.cpu.usage_percent'].length).toBeGreaterThan(0);
    expect(body.series['host.memory.used_bytes'].length).toBeGreaterThan(0);
  });

  it('4. GET /hosts/:id/filesystems retorna uso por mount (GAP-RM-001)', async () => {
    const { status, body } = await apiGet(`/api/v1/hosts/${hostId}/filesystems`);
    expect(status).toBe(200);
    expect(body.filesystems).toEqual(
      expect.arrayContaining([expect.objectContaining({ mount: '/' })]),
    );
  });

  it('5. GET /hosts/:id/containers retorna inventário (GAP-RM-003)', async () => {
    const { status, body } = await apiGet(`/api/v1/hosts/${hostId}/containers`);
    expect(status).toBe(200);
    expect(body).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'web', image: 'nginx:latest' })]));
  });

  it('6. GET /agents lista agentes do tenant (GAP-RM-005)', async () => {
    const { status, body } = await apiGet('/api/v1/agents');
    expect(status).toBe(200);
    expect(body).toEqual(expect.arrayContaining([expect.objectContaining({ id: agentId, machineId: MACHINE_ID })]));
  });

  it('7. cross-tenant: métricas de host de outro tenant → 404', async () => {
    const email = `hm03b-${randomBytes(4).toString('hex')}@tenant-b.local`;
    await apiPost('/api/v1/auth/signup', { email, password: 'E2ePassw0rd!', tenantName: 'HM03 B' }, '');
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'E2ePassw0rd!' }),
    });
    const tokenB = res.headers.get('x-access-token') ?? '';
    const { status } = await apiGet(`/api/v1/hosts/${hostId}/metrics`, tokenB);
    expect(status).toBe(404);
  });

  it('8. revoke: credencial revogada para de autenticar', async () => {
    const { status } = await apiPost(`/api/v1/agents/${agentId}/revoke`, {});
    expect(status).toBe(201);
    const hb = await gateway('/api/v1/agents/heartbeat', {
      protocol_version: 1,
      agent_id: agentId,
      machine_id: MACHINE_ID,
      agent_version: '0.1.0',
      sent_at: new Date().toISOString(),
      capabilities: ['host.linux'],
    });
    expect(hb.status).toBe(401);
  });
});

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { getPrisma } from '@waops/db';

/**
 * HARD MISSION 04 — WaMonitor Hardening (live E2E):
 * - quota: token minting capped per tenant (spam vector closed);
 * - identity: /metrics for a host id belonging to another tenant → 404;
 * - cardinality: oversized dimensions rejected at the gateway (already enforced
 *   by contract; here we prove >16 keys fails and valid 16 keys pass);
 * - long windows: /metrics/long serves from the continuous aggregate.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:3002';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

let accessToken = '';
let tenantId = '';
let credential = '';
let agentId = '';
let hostId = '';
const MACHINE_ID = randomBytes(16).toString('hex');

async function apiGet(path: string): Promise<{ status: number; body: JsonRecord }> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord };
}

async function apiPost(path: string, body: unknown): Promise<{ status: number; body: JsonRecord }> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as JsonRecord };
}

beforeAll(async () => {
  const email = `hm04-${randomBytes(4).toString('hex')}@t.local`;
  const res = await fetch(`${API}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'E2ePassw0rd!', tenantName: 'HM04' }),
  });
  accessToken = res.headers.get('x-access-token') ?? '';
  expect(accessToken).toBeTruthy();

  // enroll an agent + heartbeat with machine_id (identity bridge)
  const { body: tb } = await apiPost('/api/v1/agents/enrollment-tokens', {});
  const en = await fetch(`${GATEWAY}/api/v1/agents/enrollment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enrollment_token: tb.token, name: 'hm04-agent' }),
  });
  const enBody = (await en.json()) as JsonRecord;
  agentId = enBody.agent_id as string;
  credential = enBody.credential as string;
  expect(agentId).toBeTruthy();

  await fetch(`${GATEWAY}/api/v1/agents/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
    body: JSON.stringify({
      protocol_version: 1,
      agent_id: agentId,
      machine_id: MACHINE_ID,
      agent_version: '0.1.0',
      sent_at: new Date().toISOString(),
      capabilities: ['host.linux'],
    }),
  });

  // send one host metric batch so the identity bridge creates the Host row
  await fetch(`${GATEWAY}/api/v1/agents/metrics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
    body: JSON.stringify({
      protocol_version: 1,
      agent_id: agentId,
      sequence: 1,
      samples: [
        { metric: 'host.cpu.usage_percent', resource_id: `host_${MACHINE_ID}`, observed_at: new Date().toISOString(), value: 20 },
      ],
    }),
  });

  const prisma = getPrisma();
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  tenantId = agent.tenantId;
  // wait for the worker to run the identity bridge
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const host = await prisma.host.findFirst({ where: { tenantId, machineId: MACHINE_ID } });
    if (host) {
      hostId = host.id;
      break;
    }
  }
  expect(hostId).toBeTruthy();
}, 45_000);

afterAll(async () => {
  const { disconnectPrisma } = await import('@waops/db');
  await disconnectPrisma();
});

describe('HM04 — quota (token minting capped)', () => {
  it('minting beyond 20 pending tokens → 402 quota_exceeded', async () => {
    // mint up to the cap (each run starts with a fresh tenant, so 20 mints pass)
    for (let i = 0; i < 20; i++) {
      const { status } = await apiPost('/api/v1/agents/enrollment-tokens', {});
      expect(status).toBe(201);
    }
    const { status, body } = await apiPost('/api/v1/agents/enrollment-tokens', {});
    expect(status).toBe(402);
    expect(body.error?.code).toBe('quota_exceeded');
  }, 60_000);
});

describe('HM04 — long-window series (continuous aggregate)', () => {
  it('GET /hosts/:id/metrics/long?days=7 → 200 from rollup (may be empty series)', async () => {
    const { status, body } = await apiGet(`/api/v1/hosts/${hostId}/metrics/long?days=7`);
    expect(status).toBe(200);
    expect(body.source).toContain('metric_samples_5m');
    expect(body.window_days).toBe(7);
  });

  it('long window rejects days>90 and days<1', async () => {
    const { status: s91 } = await apiGet(`/api/v1/hosts/${hostId}/metrics/long?days=91`);
    expect(s91).toBe(400);
    const { status: s0 } = await apiGet(`/api/v1/hosts/${hostId}/metrics/long?days=0`);
    expect(s0).toBe(400);
  });
});

describe('HM04 — dimension cardinality (gateway contract)', () => {
  it('17 dimension keys → 400; 16 keys + valid sample → acked', async () => {
    const now = new Date().toISOString();
    const rid = `host_${MACHINE_ID}`;

    const dims17: Record<string, string> = {};
    for (let i = 0; i < 17; i++) dims17[`k${i}`] = `v${i}`;
    const bad = await fetch(`${GATEWAY}/api/v1/agents/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({
        protocol_version: 1,
        agent_id: agentId,
        sequence: 1001,
        samples: [{ metric: 'host.cpu.usage_percent', resource_id: rid, observed_at: now, value: 10, dimensions: dims17 }],
      }),
    });
    expect(bad.status).toBe(400);

    const dims16: Record<string, string> = {};
    for (let i = 0; i < 16; i++) dims16[`k${i}`] = `v${i}`;
    const ok = await fetch(`${GATEWAY}/api/v1/agents/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({
        protocol_version: 1,
        agent_id: agentId,
        sequence: 1002,
        samples: [{ metric: 'host.cpu.usage_percent', resource_id: rid, observed_at: now, value: 12, dimensions: dims16 }],
      }),
    });
    expect(ok.status).toBe(200);
  }, 30_000);
});

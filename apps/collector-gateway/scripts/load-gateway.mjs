#!/usr/bin/env node
/**
 * HARD MISSION 05 follow-up — load/saturation suite for the collector-gateway
 * (data plane) at the TEST port convention (:5000).
 *
 * Real end-to-end flow per run: signup+login (control plane :4000) → enrollment
 * token → agent enroll (gateway) → saturation:
 *   - heartbeat: fixed 120/min per-agent window on the gateway; parallel burst
 *     measures THROUGHPUT (2xx) vs LOSS (429/other);
 *   - metrics: ingest batches through the REAL BullMQ queue path (jobId
 *     `metrics_<agent>_<sequence>` dedupes retries);
 *   - concurrent agents: 8 agents × parallel batches (isolation under load).
 *
 * Usage (docs/environments/LOCAL_DEVELOPMENT.md — test ports 4000/5000):
 *   API=http://localhost:4000 GATEWAY=http://localhost:5000 node apps/collector-gateway/scripts/load-gateway.mjs
 */
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID, randomBytes } from 'node:crypto';

const API = process.env.API ?? 'http://localhost:4000';
const GATEWAY = process.env.GATEWAY ?? 'http://localhost:5000';
const PASSWORD = 'E2ePassw0rd!';
const BURST = Number(process.env.HEARTBEAT_BURST ?? 150);
const BATCHES = Number(process.env.METRICS_BATCHES ?? 60);
const CONCURRENT_AGENTS = Number(process.env.CONCURRENT_AGENTS ?? 8);
const SAMPLES_PER_BATCH = 10;

const results = [];
/** @param {string} name @param {boolean} ok @param {string=} detail */
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body };
}

/** Provision a tenant + agent on the REAL services; returns ingest credential.
 * Auth budget is per-IP (10/min, ~1 token/6s refill) — on 429 we wait and retry
 * (self-healing regardless of prior bucket state). When `userToken` is given,
 * provisioning skips signup/login and enrolls under that tenant instead. */
async function provisionAgent(label, userToken) {
  let auth;
  if (!userToken) {
    const email = `gwload-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@t.local`;
    let su;
    for (;;) {
      su = await req(`${API}/api/v1/auth/signup`, {
        method: 'POST',
        body: JSON.stringify({ email, password: PASSWORD, tenantName: `gwload-${label}` }),
      });
      if (su.status === 201) break;
      if (su.status === 429) {
        await delay(7000);
        continue;
      }
      throw new Error(`signup failed (${su.status})`);
    }
    let li;
    for (;;) {
      li = await req(`${API}/api/v1/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: PASSWORD }) });
      if (li.status === 200) break;
      if (li.status === 429) {
        await delay(7000);
        continue;
      }
      throw new Error(`login failed (${li.status})`);
    }
    auth = { authorization: `Bearer ${li.headers.get('x-access-token')}` };
  } else {
    auth = { authorization: `Bearer ${userToken}` };
  }

  let mint;
  for (;;) {
    mint = await req(`${API}/api/v1/agents/enrollment-tokens`, { method: 'POST', headers: auth, body: '{}' });
    if (mint.status === 201) break;
    if (mint.status === 429) {
      await delay(7000);
      continue;
    }
    throw new Error(`enrollment-token mint failed (${mint.status})`);
  }
  const en = await req(`${GATEWAY}/api/v1/agents/enrollment`, {
    method: 'POST',
    body: JSON.stringify({ enrollment_token: mint.body.token, name: `gwload-${label}-${randomBytes(3).toString('hex')}` }),
  });
  if (![200, 201].includes(en.status)) throw new Error(`enroll failed (${en.status})`);
  return { agentId: en.body.agent_id, credential: en.body.credential, userToken: userToken ?? auth.authorization.slice(7) };
}

const heartbeatBody = (agentId) =>
  JSON.stringify({
    protocol_version: 1,
    agent_id: agentId,
    machine_id: randomBytes(16).toString('hex'),
    agent_version: '0.5.0-loadtest',
    sent_at: new Date().toISOString(),
    capabilities: ['host.linux'],
  });

const metricsBody = (agentId, sequence, n = SAMPLES_PER_BATCH) =>
  JSON.stringify({
    protocol_version: 1,
    agent_id: agentId,
    sequence,
    samples: Array.from({ length: n }, (_, i) => ({
      metric: 'host.cpu.usage_percent',
      resource_id: `host_${randomBytes(8).toString('hex')}`,
      observed_at: new Date().toISOString(),
      value: Math.round(Math.random() * 100),
      dimensions: { cpu: `cpu${i % 4}`, it: 'loadtest' },
    })),
  });

// ─── Provisioning ─────────────────────────────────────────────────────────────
console.log(`target: gateway ${GATEWAY} (control plane ${API})\n`);
const primary = await provisionAgent('primary');

// ─── Phase 1 — heartbeat saturation (single agent, parallel burst) ───────────
{
  const requests = Array.from({ length: BURST }, () =>
    req(`${GATEWAY}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: { authorization: `Bearer ${primary.credential}` },
      body: heartbeatBody(primary.agentId),
    }).catch(() => ({ status: 0 })),
  );
  const t0 = performance.now();
  const responses = await Promise.all(requests);
  const ms = Math.round(performance.now() - t0);
  const by = (s) => responses.filter((r) => r.status === s).length;
  const throughput = Math.round((by(200) / ms) * 1000);
  check(
    'heartbeat burst: 2xx (accepted) + 429 (limiter) cover everything, zero 5xx',
    by(200) + by(429) === BURST,
    `200=${by(200)} 429=${by(429)} other=${BURST - by(200) - by(429)}`,
  );
  check(
    'heartbeat: loss under saturation is bounded by the fixed window',
    by(429) >= BURST - 121 - Math.floor(ms / 1000) * 2, // window 120 + refill during burst
    `limited=${by(429)}`,
  );
  check('heartbeat: throughput measured', throughput > 0, `${throughput} req/s accepted (${ms}ms total)`);
  console.log(`  → heartbeat: ${by(200)} accepted, ${by(429)} limited, ${throughput} req/s`);
}

// ─── Phase 2 — metrics ingest through the REAL queue (throughput + dedupe) ───
// Dedicated agent: the gateway window is per-agent and SHARED by heartbeat +
// metrics — phase 1's burst exhausted the primary agent's 120/min.
{
  const metricsAgent = await provisionAgent('metrics', primary.userToken);
  const t0 = performance.now();
  const responses = [];
  for (let seq = 1; seq <= BATCHES; seq++) {
    responses.push(
      await req(`${GATEWAY}/api/v1/agents/metrics`, {
        method: 'POST',
        headers: { authorization: `Bearer ${metricsAgent.credential}` },
        body: metricsBody(metricsAgent.agentId, seq),
      }),
    );
  }
  const ms = Math.round(performance.now() - t0);
  const ok200 = responses.filter((r) => r.status === 200).length;
  const limited = responses.filter((r) => r.status === 429).length;
  const errors = responses.filter((r) => ![200, 429].includes(r.status)).length;
  check(
    'metrics sequential ingest: zero unexpected failures',
    errors === 0 && ok200 + limited === BATCHES,
    `200=${ok200} 429=${limited} err=${errors} (${Math.round((ok200 / ms) * 1000)} batches/s)`,
  );

  // Retransmission of the LAST sequence: jobId dedupe must still ack 200
  // (idempotent replay — the queue keeps exactly one job).
  const replay = await req(`${GATEWAY}/api/v1/agents/metrics`, {
    method: 'POST',
    headers: { authorization: `Bearer ${metricsAgent.credential}` },
    body: metricsBody(metricsAgent.agentId, BATCHES),
  });
  check('metrics: replayed sequence stays idempotent (200)', replay.status === 200, `status=${replay.status}`);
  console.log(`  → metrics: ${ok200}/${BATCHES} enqueued in ${ms}ms; replay seq=${BATCHES} → ${replay.status}`);
}

// ─── Phase 3 — concurrent agents (isolation under load) ─────────────────────
// All agents share ONE control-plane tenant (2 auth tokens total); enrollment
// itself goes through the gateway and each agent gets a FRESH 120/min window.
{
  const agents = [];
  for (let i = 0; i < CONCURRENT_AGENTS; i++) {
    agents.push(await provisionAgent(`p${i}`, primary.userToken));
  }
  const t0 = performance.now();
  const all = await Promise.all(
    agents.flatMap((a) =>
      Array.from({ length: 15 }, (_, i) =>
        req(`${GATEWAY}/api/v1/agents/metrics`, {
          method: 'POST',
          headers: { authorization: `Bearer ${a.credential}` },
          body: metricsBody(a.agentId, i + 1),
        }).catch(() => ({ status: 0 })),
      ),
    ),
  );
  const ms = Math.round(performance.now() - t0);
  const by = (s) => all.filter((r) => r.status === s).length;
  const total = CONCURRENT_AGENTS * 15;
  const throughput = Math.round((by(200) / ms) * 1000);
  check(
    `concurrent ingest (${CONCURRENT_AGENTS} agents × 15 batches): zero 5xx`,
    by(500) === 0 && by(0) === 0,
    `200=${by(200)} 429=${by(429)} err=${total - by(200) - by(429)}`,
  );
  check('concurrent ingest: majority accepted under saturation', by(200) >= total * 0.5, `${by(200)}/${total}`);
  console.log(`  → concurrent: ${by(200)} accepted / ${by(429)} limited in ${ms}ms (${throughput} batches/s)`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  for (const f of failed) console.error(`  FAIL ${f.name}`);
  process.exit(1);
}

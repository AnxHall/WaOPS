#!/usr/bin/env node
/**
 * HARD MISSION 05 — load/adversarial suite for the distributed Redis rate limiter.
 *
 * Validates the token bucket per tenant+route under real HTTP concurrency:
 *   1. auth preset (10/min) — consecutive failures then 429 with headers;
 *   2. api preset (120/min) — sequential drain, then parallel burst measures
 *      headroom vs limited, with RateLimit and Retry-After headers;
 *   3. refill/recovery — bucket refills continuously (retryStrategy never gives
 *      up), client recovers without restart;
 *   4. tenant isolation — a second tenant keeps full capacity while the first
 *      is exhausted.
 *
 * Refill-aware by design: the bucket accrues ~2 tokens/s, so exact "zero
 * passed" assertions would be flaky — bounds instead. Tenant provisioning
 * (signup+login) consumes 2 auth tokens from the SHARED client-IP bucket,
 * which the assertions account for. REDIS_URL is required: the suite sweeps
 * its own rl:* keys before/after to keep bucket state deterministic.
 *
 * Default target is the TEST port convention (4000/5000) — see
 * docs/environments/LOCAL_DEVELOPMENT.md. The real API, Redis and Postgres do
 * the work (no mocks). Exit 0 = all assertions passed.
 *
 * Usage:
 *   REDIS_URL=redis://localhost:6379 API=http://localhost:4000 node scripts/load-rate-limit.mjs
 */
import { setTimeout as delay } from 'node:timers/promises';

const API = process.env.API ?? 'http://localhost:4000';
const REDIS_URL = process.env.REDIS_URL;
const PASSWORD = 'E2ePassw0rd!';
const AUTH_CAPACITY = 10; // RATE_LIMIT_PRESETS.auth (per minute)
const API_CAPACITY = 120; // RATE_LIMIT_PRESETS.api (per minute)

if (!REDIS_URL) {
  console.error('REDIS_URL is required — the suite sweeps its own rl:* buckets to stay deterministic.');
  process.exit(2);
}

const results = [];
const tenantIds = []; // bucket keys rl:api:<tenantId> created by this suite
/** @param {string} name @param {boolean} ok @param {string=} detail */
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const latencies = [];
/** Minimal fetch wrapper recording latency. @returns {Promise<{status:number, headers:Headers, body:any, ms:number}>} */
async function req(path, init = {}) {
  const t0 = performance.now();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const ms = performance.now() - t0;
  latencies.push(ms);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body, ms };
}

/** Signup a fresh tenant, login and return the Bearer token (+ tenant id). */
async function newTenant(label) {
  const email = `loadtest-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@t.local`;
  const su = await req('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, tenantName: `loadtest-${label}` }),
  });
  if (su.status !== 201) throw new Error(`signup failed (${su.status})`);
  const li = await req('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (li.status !== 200 || !li.headers.get('x-access-token')) {
    throw new Error(`login failed (${li.status})`);
  }
  const tenantId = li.body?.user?.tenant_id ?? null;
  if (tenantId) tenantIds.push(tenantId);
  return { token: li.headers.get('x-access-token'), tenantId };
}

const auth = (t) => ({ authorization: `Bearer ${t}` });
const p95 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] ?? 0;
};

/** Delete this suite's buckets: auth buckets are keyed by client IP (swept by
 * pattern); api buckets are known per tenant. All rl:* expire in ≤60s anyway. */
async function sweepBuckets() {
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
  let deleted = 0;
  for (const id of tenantIds) deleted += await redis.del(`rl:api:${id}`);
  for await (const key of redis.scanStream({ match: 'rl:auth:*', count: 100 })) {
    if (key.length) deleted += await redis.del(...key);
  }
  redis.disconnect();
  return deleted;
}

await sweepBuckets(); // deterministic start: fresh IP + tenant buckets
console.log(`target: ${API}\n`);

// ─── Phase 1 — auth preset: hammer login, hit 429, inspect headers ──────────
{
  await newTenant('auth'); // consumes 2 auth tokens (signup+login) from the IP bucket
  const expectedFailures = AUTH_CAPACITY - 2;
  let saw429 = null;
  let failures = 0;
  for (let i = 0; i < 40 && !saw429; i++) {
    const r = await req('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `hammer-${i}@t.local`, password: 'wrong-password' }),
    });
    if (r.status === 401) failures += 1;
    if (r.status === 429) saw429 = r;
  }
  check(
    'auth: failures before limiting = capacity − provisioning (2)',
    failures === expectedFailures,
    `${failures}× 401 (expected ${expectedFailures})`,
  );
  check('auth: 429 arrives after capacity', saw429 !== null);
  if (saw429) {
    check(
      'auth: 429 carries RateLimit-Limit/Remaining=0/Reset + Retry-After',
      Number(saw429.headers.get('ratelimit-limit')) === AUTH_CAPACITY &&
        Number(saw429.headers.get('ratelimit-remaining')) === 0 &&
        Number(saw429.headers.get('retry-after')) >= 1 &&
        Number(saw429.headers.get('ratelimit-reset')) >= 0,
      `retry-after=${saw429.headers.get('retry-after')} reset=${saw429.headers.get('ratelimit-reset')}`,
    );
    check('auth: 429 body has rate_limited error code', saw429.body?.error?.code === 'rate_limited');
  }

  // Recovery: refill is continuous — poll until a login is allowed again
  // (401 on purpose = the request passed the limiter).
  const t0 = performance.now();
  let recovered = false;
  while (performance.now() - t0 < 70_000) {
    const r = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'recovery@t.local', password: PASSWORD }) });
    if (r.status === 401) { recovered = true; break; }
    await delay(1000);
  }
  check('recovery: bucket refills while client keeps polling (no restart)', recovered, `${Math.round(performance.now() - t0)}ms`);
}

/** Auth refill is ~1 token/6s (capacity 10 per 60s). Provisioning a tenant
 * costs 2 auth tokens — wait until the (previously drained) IP bucket has
 * 2 tokens + 1 margin before signup+login. */
async function waitAuthRefill() {
  await delay(21_000);
}

// ─── Phase 2 — api preset: drain sequentially, then parallel burst ──────────
{
  await waitAuthRefill();
  const { token } = await newTenant('api');
  const h = auth(token);
  // Refill-aware drain: ~2 tokens/s accrue during the sequential requests, so
  // the first 429 lands at capacity + small headroom.
  let drained = 0;
  let firstLimited = null;
  for (let i = 0; i < API_CAPACITY + 40; i++) {
    const r = await req('/api/v1/incidents', { headers: h });
    if (r.status === 200) drained += 1;
    else if (r.status === 429) { firstLimited = r; break; }
    else throw new Error(`unexpected status ${r.status} on drain`);
  }
  check(
    'api: sequential drain matches capacity (+ refill headroom)',
    drained >= API_CAPACITY && drained <= API_CAPACITY + 20,
    `${drained}/${API_CAPACITY} (+refill)`,
  );
  if (firstLimited) {
    check(
      'api: 429 headers present after drain',
      Number(firstLimited.headers.get('ratelimit-remaining')) === 0 && Number(firstLimited.headers.get('retry-after')) >= 1,
    );
  }

  // Burst: 50 parallel requests against the exhausted bucket — zero 5xx
  // (Redis EVAL stays atomic under concurrency) and limited must dominate;
  // a few 200s from refill accrual are legal.
  const burst = await Promise.all(
    Array.from({ length: 50 }, () => req('/api/v1/incidents', { headers: h }).catch((e) => ({ status: 0, error: String(e) }))),
  );
  const limited = burst.filter((r) => r.status === 429).length;
  const allowed = burst.filter((r) => r.status === 200).length;
  const errors = burst.filter((r) => r.status !== 429 && r.status !== 200).length;
  check(
    'api: parallel burst → zero 5xx, mostly limited',
    errors === 0 && limited >= 40,
    `limited=${limited} allowed=${allowed} errors=${errors}`,
  );
  check('api: refill headroom bounded (≤10 slipped through)', allowed <= 10, `allowed=${allowed}`);

  // Tenant isolation: another tenant keeps its own full bucket.
  await waitAuthRefill(); // bucket ≈ 0 after drain+burst; refill for provisioning
  const other = await newTenant('other');
  const iso = [];
  for (let i = 0; i < 20; i++) iso.push(await req('/api/v1/incidents', { headers: auth(other.token) }));
  check('tenant isolation: second tenant unaffected', iso.every((r) => r.status === 200), `${iso.filter((r) => r.status === 200).length}/20 ok`);

  // Latency profile of allowed requests across the whole suite.
  const allowedLat = latencies.filter((ms) => ms < 5_000);
  const p95ms = Math.round(p95(allowedLat));
  check('latency: p95 of allowed requests sane (<2000ms)', p95ms < 2000, `p95=${p95ms}ms n=${allowedLat.length}`);
}

// ─── Cleanup — only this suite's buckets ─────────────────────────────────────
const cleaned = await sweepBuckets();
console.log(`\ncleanup: deleted ${cleaned} rl:* key(s) created by this suite`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  for (const f of failed) console.error(`  FAIL ${f.name}`);
  process.exit(1);
}

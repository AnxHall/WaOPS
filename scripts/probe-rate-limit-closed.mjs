#!/usr/bin/env node
/* eslint-disable no-console -- CLI: console é o mecanismo de saída da sonda */
/**
 * Probe do modo de falha do rate limiter (HM05 follow-up hardening).
 *
 * Valida o comportamento do limiter quando o Redis está INDISPONÍVEL
 * (API iniciada com REDIS_URL apontando para uma porta morta). A sonda
 * faz um GET sem autenticação em /api/v1/hosts — o middleware de rate
 * limit roda ANTES dos guards, então a resposta revela o modo:
 *
 *   fail-closed (RATE_LIMIT_FAILURE_MODE=closed) → 503 dependency_unavailable
 *   fail-open   (default, sem a flag)            → 401 (limiter deixou passar)
 *
 * Usage:
 *   API=http://localhost:4000 node scripts/probe-rate-limit-closed.mjs               # espera 503 (closed)
 *   API=http://localhost:4001 node scripts/probe-rate-limit-closed.mjs --expect-open # espera 401 (open)
 *
 * Exit 0 = comportamento confirmado; exit 1 = comportamento inesperado.
 */
const api = process.env.API ?? 'http://localhost:4000';
const expectOpen = process.argv.includes('--expect-open');
const expected = expectOpen ? 401 : 503;

const res = await fetch(`${api}/api/v1/hosts`);
await res.arrayBuffer().catch(() => undefined);

let code = null;
try {
  code = (await res.json())?.error?.code ?? null;
} catch {
  /* corpo opcional */
}

console.log(`[probe] GET ${api}/api/v1/hosts (sem auth, Redis indisponível)`);
console.log(`[probe] status=${res.status} code=${code ?? '—'} expected=${expected}`);
if (res.status !== expected) {
  console.error(`[probe] FAIL — modo ${expectOpen ? 'fail-open' : 'fail-closed'} NÃO confirmado`);
  process.exit(1);
}
console.log(`[probe] PASS — modo ${expectOpen ? 'fail-open' : 'fail-closed'} confirmado`);

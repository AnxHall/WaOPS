#!/usr/bin/env node
/**
 * HARD MISSION 05 — supply-chain audit gate.
 * Runs `pnpm audit --json`, fails on any HIGH/CRITICAL vulnerability;
 * MODERATE/LOW findings are tolerated only when listed (by module path) in
 * scripts/audit-allowlist.txt with a justification comment. Exit codes:
 * 0 = clean/allowed, 1 = new vulnerability found (CI gate).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const ALLOWLIST = 'scripts/audit-allowlist.txt';

let audit;
{
  // pnpm audit exits non-zero when advisories exist; stdout carries the JSON
  // either way. shell:true resolves pnpm.cmd on Windows runners/locals alike.
  // Command is passed as a single string (DEP0190) — nothing user-controlled
  // is interpolated here.
  const r = spawnSync('pnpm audit --json', {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: true,
  });
  try {
    audit = JSON.parse(r.stdout ?? '');
  } catch {
    console.error('audit gate: unable to parse pnpm audit output');
    process.exit(1);
  }
}

const advisories = Object.values(audit.advisories ?? {});
const blocking = [];
const tolerated = [];

const allow = existsSync(ALLOWLIST)
  ? readFileSync(ALLOWLIST, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => l.split(/\s+/)[0])
  : [];

for (const a of advisories) {
  const finding = `${a.module_name}@${a.findings?.[0]?.version ?? '?'} <${a.severity}> ${a.url ?? ''}`;
  if (a.severity === 'high' || a.severity === 'critical') {
    blocking.push(finding);
  } else if (allow.includes(a.module_name)) {
    tolerated.push(finding);
  } else {
    blocking.push(`${finding} (add to ${ALLOWLIST} to tolerate)`);
  }
}

if (tolerated.length) {
  console.log(`audit gate: tolerated ${tolerated.length} allowlisted finding(s)`);
  for (const t of tolerated) console.log(`  ~ ${t}`);
}
if (blocking.length) {
  console.error(`audit gate: ${blocking.length} blocking finding(s):`);
  for (const b of blocking) console.error(`  ✗ ${b}`);
  process.exit(1);
}
console.log('audit gate: no blocking vulnerabilities');

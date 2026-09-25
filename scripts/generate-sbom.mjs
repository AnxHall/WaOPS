#!/usr/bin/env node
/**
 * HARD MISSION 05 — supply-chain: minimal CycloneDX 1.5 SBOM generator.
 * Reads pnpm-lock.yaml (v9 format) and emits a component list of all direct
 * + transitive dependencies of the workspace. No third-party deps on purpose
 * (the SBOM tool must not be a supply-chain risk of its own).
 *
 * Usage: node scripts/generate-sbom.mjs > sbom.cdx.json
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const lockPath = process.argv[2] ?? 'pnpm-lock.yaml';
const raw = readFileSync(lockPath, 'utf8');

// --- tiny YAML subset parser for pnpm-lock v9 package entries ----------------
// We only need package keys ("pkgname@version(...)") and their resolution.
const packages = new Map(); // pnpm id -> { name, version }
const lines = raw.split(/\r?\n/);
let inPackages = false;

for (const line of lines) {
  if (/^packages:/.test(line)) {
    inPackages = true;
    continue;
  }
  if (inPackages && /^[^ ]/.test(line) && !/^ {2}/.test(line)) {
    inPackages = /^packages:/.test(line);
    if (!inPackages) continue;
  }
  if (!inPackages) continue;
  const m = line.match(/^ {2}([^:]+):\s*$/);
  if (!m) continue;
  const id = m[1].trim().replace(/^['"]|['"]$/g, '');
  // pnpm v9 keys look like: 'name@version' optionally with (peer-hash) and
  // a following `:` separated specifier; name may contain @scope.
  const lastAt = id.lastIndexOf('@');
  if (lastAt <= 0) continue;
  let name = id.slice(0, lastAt);
  let version = id.slice(lastAt + 1);
  // strip peer suffixes like (peer=xyz) and decorations
  version = version.replace(/\(.*$/, '');
  name = name.replace(/\(.*$/, '');
  if (!name || !version) continue;
  packages.set(id, { name, version });
}

// --- collect resolved versions too (resolution: {integrity...}) -------------
// Not strictly needed for the SBOM component list; versions come from keys.

const now = new Date().toISOString();
const serial = createHash('sha256').update(raw).digest('hex').slice(0, 32);

const components = [...packages.entries()].map(([id, p]) => ({
  type: 'library',
  'bom-ref': `pkg:npm/${p.name}@${p.version}`,
  group: p.name.startsWith('@') ? p.name.split('/')[0] : undefined,
  name: p.name.startsWith('@') ? p.name.split('/')[1] : p.name,
  version: p.version,
  purl: `pkg:npm/${p.name}@${p.version}`,
  properties: [{ name: 'waops:lockfile-id', value: id }],
}));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${serial}-${Date.now().toString(16).padStart(12, '0')}`,
  version: 1,
  metadata: {
    timestamp: now,
    tools: [{ vendor: 'WaOPS', name: 'generate-sbom.mjs', version: '1.0.0' }],
    component: { type: 'application', name: 'waops', version: '0.5.0-alpha' },
  },
  components,
};

process.stdout.write(JSON.stringify(sbom, null, 2) + '\n');

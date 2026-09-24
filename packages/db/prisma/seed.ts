import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import { hash } from '@node-rs/argon2';
import { v4 as uuidv4 } from 'uuid';
import {
  MODULES_V1,
  PERMISSION_KEYS_V1,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from '@waops/contracts';

/**
 * Seed: permissions + system roles + modules + plans + demo tenants (A/B).
 * Idempotent (upsert-style by unique keys).
 */

loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv();

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function runSeed(): Promise<void> {
  await main();
}

async function main(): Promise<void> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    // Timescale extension + hypertable (idempotent; requires timescaledb shared_preload in image)
    await db
      .query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`)
      .catch(() => console.warn('[seed] timescaledb extension not available — skipping hypertable'));
    await db
      .query(
        `SELECT create_hypertable('metric_samples', 'observed_at', if_not_exists => TRUE, migrate_data => TRUE);`,
      )
      .catch(() => console.warn('[seed] hypertable skipped (already exists or extension missing)'));
    await db
      .query(
        `SELECT add_retention_policy('metric_samples', INTERVAL '30 days', if_not_exists => TRUE);`,
      )
      .catch(() => console.warn('[seed] retention policy skipped'));

    // ── Permissions ──────────────────────────────────────────────────────────
    for (const key of PERMISSION_KEYS_V1) {
      await db.query(
        `INSERT INTO permissions (id, key) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [uuidv4(), key],
      );
    }
    const permRows = await db.query<{ id: string; key: string }>(`SELECT id, key FROM permissions`);
    const permByKey = new Map(permRows.rows.map((r) => [r.key, r.id]));

    // ── System roles + role_permissions (tenant_id NULL = platform/system) ──
    for (const roleName of SYSTEM_ROLES) {
      const roleId = uuidv4();
      await db.query(
        `INSERT INTO roles (id, tenant_id, name, is_system)
         SELECT $1, NULL, $2, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id IS NULL AND name = $2)`,
        [roleId, roleName],
      );
      const roleRow = await db.query<{ id: string }>(
        `SELECT id FROM roles WHERE tenant_id IS NULL AND name = $1`,
        [roleName],
      );
      const id = roleRow.rows[0]!.id;
      for (const permKey of ROLE_PERMISSIONS[roleName]) {
        const permId = permByKey.get(permKey);
        if (!permId) throw new Error(`permission missing in db: ${permKey}`);
        await db.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, permId],
        );
      }
    }

    // ── Modules (from contracts/entitlements/modules.v1.yaml mirror) ─────────
    for (const mod of MODULES_V1) {
      await db.query(
        `INSERT INTO modules (id, key, name, status) VALUES ($1, $2, $3, 'active')
         ON CONFLICT (key) DO NOTHING`,
        [uuidv4(), mod.key, mod.name],
      );
    }

    // ── Plans ────────────────────────────────────────────────────────────────
    await db.query(
      `INSERT INTO plans (id, code, name, status, metadata_json)
       VALUES ($1, 'free-trial', 'Free Trial', 'active', $2)
       ON CONFLICT (code) DO NOTHING`,
      [uuidv4(), JSON.stringify({ trial_days: Number(process.env.TRIAL_DAYS ?? 3) })],
    );
    await db.query(
      `INSERT INTO plans (id, code, name, status, metadata_json)
       VALUES ($1, 'demo-pro', 'Demo Pro', 'active', $2)
       ON CONFLICT (code) DO NOTHING`,
      [uuidv4(), JSON.stringify({ note: 'local demo plan with all modules enabled' })],
    );

    const planRows = await db.query<{ id: string; code: string }>(`SELECT id, code FROM plans`);
    const planByCode = new Map(planRows.rows.map((r) => [r.code, r.id]));
    const moduleRows = await db.query<{ id: string; key: string }>(`SELECT id, key FROM modules`);
    const moduleByKey = new Map(moduleRows.rows.map((r) => [r.key, r.id]));

    // Demo plan: every module enabled
    const demoPlanId = planByCode.get('demo-pro')!;
    for (const mod of MODULES_V1) {
      for (const feature of mod.features) {
        await db.query(
          `INSERT INTO plan_entitlements (plan_id, module_id, feature_key, enabled)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT DO NOTHING`,
          [demoPlanId, moduleByKey.get(mod.key)!, feature],
        );
      }
    }

    // ── Demo tenants A/B with owner users ────────────────────────────────────
    const passwordHash = await hash('Demo1234!', ARGON2_OPTS);
    const trialEnd = new Date(Date.now() + Number(process.env.TRIAL_DAYS ?? 3) * 86400_000);

    const demoTenants = [
      { slug: 'tenant-a', name: 'Tenant A (demo)', email: 'owner@tenant-a.local' },
      { slug: 'tenant-b', name: 'Tenant B (demo)', email: 'owner@tenant-b.local' },
    ];

    for (const t of demoTenants) {
      const tenantRes = await db.query<{ id: string }>(
        `INSERT INTO tenants (id, slug, name, status, trial_ends_at, updated_at)
         VALUES ($1, $2, $3, 'active', $4, now())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [uuidv4(), t.slug, t.name, trialEnd],
      );
      const tenantId = tenantRes.rows[0]!.id;

      const userRes = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, email_normalized, password_hash, name, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', now())
         ON CONFLICT (email_normalized) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [uuidv4(), t.email, t.email.toLowerCase(), passwordHash, t.name],
      );
      const userId = userRes.rows[0]!.id;

      const ownerRole = await db.query<{ id: string }>(
        `SELECT id FROM roles WHERE tenant_id IS NULL AND name = 'tenant_owner'`,
      );
      await db.query(
        `INSERT INTO memberships (id, tenant_id, user_id, role_id, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT DO NOTHING`,
        [uuidv4(), tenantId, userId, ownerRole.rows[0]!.id],
      );

      // Subscription (manual provider) + entitlements from demo-pro plan
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 86400_000);
      await db.query(
        `INSERT INTO subscriptions (id, tenant_id, provider, plan_id, status, current_period_start, current_period_end, updated_at)
         SELECT $1, $2, 'manual', $3, 'active', $4, $5, now()
         WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = $2)`,
        [uuidv4(), tenantId, demoPlanId, now, periodEnd],
      );
      for (const mod of MODULES_V1) {
        for (const feature of mod.features) {
          await db.query(
            `INSERT INTO tenant_entitlements (id, tenant_id, module_id, feature_key, enabled, source)
             SELECT $1, $2, $3, $4, TRUE, 'seed'
             ON CONFLICT (tenant_id, module_id, feature_key) DO NOTHING`,
            [uuidv4(), tenantId, moduleByKey.get(mod.key)!, feature],
          );
        }
      }
    }

    console.log('[seed] done: permissions, roles, modules, plans, tenants A/B (owner@tenant-a.local / owner@tenant-b.local, senha Demo1234!)');
  } finally {
    await db.end();
  }
}

// Run directly when executed as a script; skip when imported (global-setup E2E).
const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
}

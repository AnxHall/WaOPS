import type { PrismaClient } from '@prisma/client';
import { MODULES_V1, type ModuleDefinition } from '@waops/contracts';

/** Commercial error classes (error-model.md). */
export class EntitlementRequiredError extends Error {
  readonly code = 'ENTITLEMENT_REQUIRED';
  constructor(public readonly moduleKey: string, public readonly featureKey: string) {
    super(`module/feature not entitled: ${moduleKey}.${featureKey}`);
  }
}

export class QuotaExceededError extends Error {
  readonly code = 'QUOTA_EXCEEDED';
  constructor(public readonly metricKey: string, public readonly limit: number) {
    super(`quota exceeded for ${metricKey} (limit ${limit})`);
  }
}

/** Module/Feature registry loaded from contracts mirror (modules.v1.yaml). */
export class ModuleRegistry {
  private readonly byKey = new Map<string, ModuleDefinition>();

  constructor(modules: readonly ModuleDefinition[] = MODULES_V1) {
    for (const m of modules) this.byKey.set(m.key, m);
  }

  get(key: string): ModuleDefinition | undefined {
    return this.byKey.get(key);
  }

  require(key: string): ModuleDefinition {
    const m = this.byKey.get(key);
    if (!m) throw new Error(`unknown module: ${key}`);
    return m;
  }

  hasFeature(moduleKey: string, featureKey: string): boolean {
    return this.byKey.get(moduleKey)?.features.includes(featureKey) ?? false;
  }

  list(): ModuleDefinition[] {
    return [...this.byKey.values()];
  }
}

export interface EntitlementCheck {
  moduleKey: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
}

/** Entitlement checks (tenant_entitlements with plan fallback is phase-2 billing work). */
export class EntitlementService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly registry: ModuleRegistry = new ModuleRegistry(),
  ) {}

  async check(tenantId: string, moduleKey: string, featureKey: string): Promise<EntitlementCheck> {
    const row = await this.prisma.tenantEntitlement.findUnique({
      where: { tenantId_moduleId_featureKey: await this.compositeKey(tenantId, moduleKey, featureKey) },
    });
    if (row) {
      return { moduleKey, featureKey, enabled: row.enabled, limitValue: row.limitValue };
    }
    return { moduleKey, featureKey, enabled: false, limitValue: null };
  }

  async assertEntitled(tenantId: string, moduleKey: string, featureKey: string): Promise<void> {
    if (!this.registry.hasFeature(moduleKey, featureKey)) {
      throw new Error(`unknown module/feature: ${moduleKey}.${featureKey}`);
    }
    const check = await this.check(tenantId, moduleKey, featureKey);
    if (!check.enabled) {
      throw new EntitlementRequiredError(moduleKey, featureKey);
    }
  }

  /** Resolve module id once; keeps composite key calls clean. */
  private async compositeKey(
    tenantId: string,
    moduleKey: string,
    featureKey: string,
  ): Promise<{ tenantId: string; moduleId: string; featureKey: string }> {
    const mod = await this.prisma.module.findUnique({ where: { key: moduleKey } });
    if (!mod) throw new Error(`module not present in db: ${moduleKey}`);
    return { tenantId, moduleId: mod.id, featureKey };
  }
}

/** Quota evaluation against explicit limit; usage comes from UsageMetering. */
export class QuotaService {
  constructor(private readonly prisma: PrismaClient) {}

  async currentUsage(tenantId: string, metricKey: string): Promise<number> {
    const periodStart = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
    const row = await this.prisma.usageCounter.findUnique({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey, periodStart } },
    });
    return row?.value ?? 0;
  }

  async assertWithinQuota(tenantId: string, metricKey: string, limit: number | null): Promise<void> {
    if (limit === null) return; // unlimited
    const usage = await this.currentUsage(tenantId, metricKey);
    if (usage >= limit) {
      throw new QuotaExceededError(metricKey, limit);
    }
  }
}

/** Usage metering abstraction — record()/increment() only; storage is usage_counters. */
export class UsageMetering {
  constructor(private readonly prisma: PrismaClient) {}

  async record(tenantId: string, metricKey: string, value: number): Promise<void> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    await this.prisma.usageCounter.upsert({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey, periodStart } },
      create: { tenantId, metricKey, periodStart, periodEnd, value },
      update: { value },
    });
  }

  async increment(tenantId: string, metricKey: string, delta = 1): Promise<void> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    await this.prisma.usageCounter.upsert({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey, periodStart } },
      create: { tenantId, metricKey, periodStart, periodEnd, value: delta },
      update: { value: { increment: delta } },
    });
  }
}

export { MODULES_V1 };

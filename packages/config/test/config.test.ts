import { describe, expect, it } from 'vitest';
import { loadConfig, resetConfigCache } from '../src/index.js';

const validEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: '0123456789abcdef0123456789abcdef',
  ENCRYPTION_MASTER_KEY: 'a'.repeat(64),
};

describe('loadConfig', () => {
  it('parses a valid env with defaults', () => {
    resetConfigCache();
    const cfg = loadConfig(validEnv);
    expect(cfg.env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(cfg.isProd).toBe(false);
  });

  it('fails fast when DATABASE_URL missing', () => {
    resetConfigCache();
    const withoutDb: Record<string, string> = { ...validEnv };
    delete withoutDb.DATABASE_URL;
    expect(() => loadConfig(withoutDb as never)).toThrow(/DATABASE_URL/);
  });

  it('fails fast when JWT_SECRET too short', () => {
    resetConfigCache();
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('fails fast when ENCRYPTION_MASTER_KEY not 64 hex', () => {
    resetConfigCache();
    expect(() => loadConfig({ ...validEnv, ENCRYPTION_MASTER_KEY: 'xyz' })).toThrow(
      /ENCRYPTION_MASTER_KEY/,
    );
  });
});

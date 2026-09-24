import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  APP_BASE_URL: z.string().default('http://app.waops.localhost'),
  API_BASE_URL: z.string().default('http://localhost:3001'),
  COLLECTOR_BASE_URL: z.string().default('http://localhost:3002'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(3),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('waops@localhost'),

  ENCRYPTION_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_MASTER_KEY must be 64 hex chars (32 bytes)'),

  PORT: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v ?? 3001);
      return Number.isInteger(n) && n > 0 ? n : 3001;
    }),
});

export type Env = z.infer<typeof EnvSchema>;
export type AppConfig = {
  env: Env;
  isProd: boolean;
  isDev: boolean;
  isTest: boolean;
};

let cached: AppConfig | null = null;

/** Fail-fast config loader: throws clearly when required config is missing/invalid. */
export function loadConfig(envSource: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  // Empty-string env vars are treated as unset (coerce would turn "" into 0/false).
  const cleaned = Object.fromEntries(
    Object.entries(envSource).filter(([, v]) => v !== ''),
  );
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration → ${issues}`);
  }
  cached = {
    env: parsed.data,
    isProd: parsed.data.NODE_ENV === 'production',
    isDev: parsed.data.NODE_ENV === 'development',
    isTest: parsed.data.NODE_ENV === 'test',
  };
  return cached;
}

/** Test helper to reset cached config. */
export function resetConfigCache(): void {
  cached = null;
}

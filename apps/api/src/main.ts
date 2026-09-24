import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { loadConfig } from '@waops/config';
import { createLogger, withCorrelation } from '@waops/observability';

async function bootstrap(): Promise<void> {
  loadDotenv({ path: resolve(process.cwd(), '../../.env') });
  const cfg = loadConfig(); // fail-fast on invalid env

  // Dynamic import: module graph (auth.module) evaluates AFTER env is loaded.
  const { AppModule } = await import('./app.module.js');
  const logger = createLogger({ level: cfg.env.LOG_LEVEL, name: 'waops-api' });

  const app = await NestFactory.create(AppModule, { logger: false, rawBody: false });
  app.use(cookieParser());
  app.enableCors({ origin: cfg.env.WEB_BASE_URL, credentials: true });
  await withCorrelation({ requestId: 'boot' }, async () => {
    await app.listen(cfg.env.PORT, '0.0.0.0');
    logger.info({ port: cfg.env.PORT, env: cfg.env.NODE_ENV }, 'waops-api listening');
  });
}

bootstrap().catch((err) => {
  // Bootstrap failure is fatal before logger may exist; stderr is the channel.
  // eslint-disable-next-line no-console
  console.error('fatal bootstrap error:', err);
  process.exit(1);
});

import { Controller, Get, Inject } from '@nestjs/common';
import { RequirePermission } from '../auth/permissions.guard.js';
import { RateLimitStatsService } from './rate-limit.stats.js';

/**
 * Rate-limit observability (HM05 follow-up) — 429/min por classe de rota
 * (janela corrente + histórico de 15 min). Requer sessão válida (JWT +
 * TenantContext); permissão leve de leitura — métrica agregada da
 * plataforma, sem dados sensíveis.
 */
@Controller('api/v1/rate-limits')
export class RateLimitStatsController {
  constructor(@Inject(RateLimitStatsService) private readonly stats: RateLimitStatsService) {}

  @Get()
  @RequirePermission('tenants.read')
  async get(): Promise<unknown> {
    return this.stats.stats();
  }

  @Get('history')
  @RequirePermission('tenants.read')
  async history(): Promise<unknown> {
    return this.stats.history();
  }
}

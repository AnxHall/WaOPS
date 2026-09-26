import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { makeRateLimitMiddleware, RATE_LIMIT_PRESETS } from './middleware/rate-limit.middleware.js';
import { RateLimitStatsService } from './middleware/rate-limit.stats.js';
import { RateLimitStatsController } from './middleware/rate-limit.controller.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RealtimeController } from './realtime/realtime.controller.js';
import { SupportModule } from './support/support.module.js';
import { TicketsController } from './support/tickets.controller.js';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { AuthController } from './auth/auth.controller.js';
import { PermissionsGuard } from './auth/permissions.guard.js';
import { TokenService } from './auth/jwt.service.js';
import { CorrelationMiddleware } from './correlation.middleware.js';
import { TenantContextMiddleware } from './auth/tenant-context.middleware.js';
import { GlobalExceptionFilter } from './http-exception.filter.js';
import { HealthController } from './health/health.controller.js';
import { AuditService } from './audit/audit.service.js';
import { HostsController } from './hosts/hosts.controller.js';
import { IncidentsController } from './incidents/incidents.controller.js';
import { MetricsController } from './metrics/metrics.controller.js';
import { AgentsController } from './agents/agents.controller.js';

@Module({
  imports: [AuthModule, RealtimeModule, SupportModule],
  controllers: [AuthController, HealthController, HostsController, IncidentsController, MetricsController, AgentsController, RealtimeController, TicketsController, RateLimitStatsController],
  providers: [
    TokenService,
    AuditService,
    RateLimitStatsService,
    Reflector,
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
    consumer.apply(TenantContextMiddleware).forRoutes('*');
    // HARD MISSION 05 — distributed token-bucket rate limiting (Redis).
    // auth: tight budget pre-authentication (brute-force / hammering vector);
    // api: per-tenant sustained budget on the v1 surface.
    consumer
      .apply(makeRateLimitMiddleware({ routeClass: 'auth', ...RATE_LIMIT_PRESETS.auth }))
      .forRoutes('api/v1/auth/login', 'api/v1/auth/signup', 'api/v1/auth/refresh');
    consumer
      .apply(makeRateLimitMiddleware({ routeClass: 'api', ...RATE_LIMIT_PRESETS.api }))
      .forRoutes('api/v1/(.*)');
    // realtime stream gets its own (tight) budget: reconnect storms are the
    // classic SSE abuse vector.
    consumer
      .apply(makeRateLimitMiddleware({ routeClass: 'realtime', ...RATE_LIMIT_PRESETS.realtime }))
      .forRoutes('api/v1/realtime/stream');
  }
}

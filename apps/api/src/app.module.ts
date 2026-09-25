import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
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
  imports: [AuthModule],
  controllers: [AuthController, HealthController, HostsController, IncidentsController, MetricsController, AgentsController],
  providers: [
    TokenService,
    AuditService,
    Reflector,
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}

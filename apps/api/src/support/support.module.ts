import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

/**
 * WaSupport foundation module (HM05). AuditService lives as a root provider in
 * AppModule; feature modules that inject it must provide it locally (or the
 * root module must be imported). RealtimePublisher comes via RealtimeModule.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [TicketsController],
  providers: [AuditService],
})
export class SupportModule {}

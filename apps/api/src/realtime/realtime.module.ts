import { Module } from '@nestjs/common';
import { RealtimeBroker } from './realtime.broker.js';
import { RealtimePublisher } from './realtime.publisher.js';
import { RealtimeController } from './realtime.controller.js';

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeBroker, RealtimePublisher],
  exports: [RealtimeBroker, RealtimePublisher],
})
export class RealtimeModule {}

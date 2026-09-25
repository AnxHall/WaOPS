import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { z } from 'zod';
import type { Response } from 'express';
import { ApiError } from '../errors.js';
import { RealtimeBroker, SSE_CHANNELS, type SseChannel } from './realtime.broker.js';
import type { AuthedRequest } from '../auth/tenant-context.middleware.js';

/**
 * ADR-010 — Realtime SSE endpoints (tenant-scoped by JWT; never query param).
 *
 * GET /api/v1/realtime/stream?channels=incidents,agents
 * Reconnection: standard `Last-Event-ID` header (native EventSource semantics)
 * replays retained per-tenant events newer than the cursor.
 *
 * Implementation note: Nest's @Sse() interceptor wraps observables and does not
 * fit the broker's long-lived Response streaming, so this controller writes the
 * text/event-stream response directly (same envelope as the filter would emit
 * for pre-stream errors — after headers are flushed, only SSE frames flow).
 */
const ChannelsSchema = z.object({
  channels: z
    .string()
    .default('incidents,agents')
    .transform((v) => v.split(',').map((s) => s.trim()))
    .refine(
      (arr) => arr.length > 0 && arr.length <= SSE_CHANNELS.length && arr.every((c) => (SSE_CHANNELS as readonly string[]).includes(c)),
      { message: `channels must be a comma list of: ${SSE_CHANNELS.join('|')}` },
    ),
});

@Controller('api/v1/realtime')
export class RealtimeController {
  constructor(@Inject(RealtimeBroker) private readonly broker: RealtimeBroker) {}

  @Get('stream')
  async stream(
    @Req() req: AuthedRequest,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    // Explicit 401 BEFORE touching the broker: the stream endpoint has no
    // permission guard, so unauthenticated requests would otherwise surface as
    // a 500 from requireTenantContext() inside the broker.
    if (!req.auth) {
      throw new ApiError('authentication_required', 'authentication required', 401);
    }
    const parsed = ChannelsSchema.safeParse(query);
    if (!parsed.success) {
      throw ApiError.validation('invalid channels', parsed.error.flatten());
    }
    const channels = parsed.data.channels as SseChannel[];
    const lastEventId = (req.headers['last-event-id'] as string | undefined) ?? undefined;
    await this.broker.stream(res, channels, lastEventId);
  }
}

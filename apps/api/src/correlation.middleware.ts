import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { correlationStorage, getOrCreateRequestId } from '@waops/observability';

/** Resolves request/correlation id and opens the ALS context for the request. */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = getOrCreateRequestId(req.headers['x-request-id']);
    res.setHeader('X-Request-Id', requestId);
    correlationStorage.run({ requestId }, () => next());
  }
}

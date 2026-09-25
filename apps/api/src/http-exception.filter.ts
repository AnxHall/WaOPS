import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from './errors.js';
import { getCorrelationLogger, currentCorrelation } from '@waops/observability';

/**
 * Global error envelope per error-model.md:
 * { error: { code, message, request_id, details } } — never leaks stack/SQL.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = currentCorrelation()?.requestId ?? 'unknown';
    const logger = getCorrelationLogger();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = 'internal_error';
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof ApiError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = 400;
      code = 'validation_error';
      message = 'Validation failed';
      details = { issues: exception.issues.map((i) => ({ path: i.path, message: i.message })) };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 401 ? 'authentication_required' : 'internal_error';
      message = exception.message;
    } else {
      message = 'Internal server error';
    }

    if (status >= 500) {
      logger.error({ err: exception, request_id: requestId }, 'unhandled error');
    } else {
      logger.warn({ code, request_id: requestId }, message);
    }

    res.status(status).json({
      error: {
        code,
        message,
        request_id: requestId,
        ...(details ? { details } : {}),
      },
    });
  }
}

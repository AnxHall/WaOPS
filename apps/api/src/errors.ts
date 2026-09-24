/** Stable machine-readable error codes (docs/development/backend/error-model.md). */
export type ApiErrorCode =
  | 'validation_error'
  | 'authentication_required'
  | 'permission_denied'
  | 'entitlement_required'
  | 'quota_exceeded'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'dependency_unavailable'
  | 'internal_error';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  static notFound(what: string): ApiError {
    return new ApiError('not_found', `${what} not found`, 404);
  }

  static validation(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError('validation_error', message, 400, details);
  }

  static conflict(message: string): ApiError {
    return new ApiError('conflict', message, 409);
  }

  static permissionDenied(): ApiError {
    return new ApiError('permission_denied', 'Permission denied', 403);
  }

  static entitlementRequired(moduleKey: string, featureKey: string): ApiError {
    return new ApiError(
      'entitlement_required',
      `Module not entitled: ${moduleKey}.${featureKey}`,
      402,
      { module: moduleKey, feature: featureKey },
    );
  }

  static quotaExceeded(metricKey: string, limit: number): ApiError {
    return new ApiError('quota_exceeded', `Quota exceeded: ${metricKey}`, 402, {
      metric: metricKey,
      limit,
    });
  }
}

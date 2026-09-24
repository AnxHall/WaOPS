import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { correlationStorage } from '@waops/observability';
import { runWithTenantContext, type TenantContext } from '@waops/tenancy';
import { TokenService, type AccessTokenClaims } from './jwt.service.js';

export interface AuthedRequest extends Request {
  auth?: AccessTokenClaims;
}

/**
 * TenantContext resolution — ONLY from the signed access token.
 * Any tenant_id in body/query/headers is ignored as authorization source
 * (multitenancy.md: nunca aceitar tenant_id livre do cliente).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(@Inject(TokenService) private readonly tokens: TokenService) {}

  use(req: AuthedRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();

    const token = header.slice('Bearer '.length).trim();
    this.tokens
      .verifyAccessToken(token)
      .then((claims) => {
        req.auth = claims;
        const ctx: TenantContext = {
          userId: claims.sub,
          tenantId: claims.tenant,
          organizationScope: claims.org,
          permissions: new Set(claims.perms),
          entitlements: new Set(claims.ents),
          requestId: correlationStorage.getStore()?.requestId ?? 'unknown',
          actorType: 'user',
        };
        // Merge correlation + tenant contexts for the rest of the request chain.
        runWithTenantContext(ctx, () => {
          res.on('finish', () => undefined); // keep scope alive through response
          next();
        });
      })
      .catch(() => next()); // invalid token → anonymous; guards decide 401/403
  }
}

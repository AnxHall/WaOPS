import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenClaims {
  sub: string; // user id
  tenant: string; // tenant id — authoritative scope source
  org: string | null;
  perms: string[];
  ents: string[];
  jti: string;
}

export interface RefreshTokenClaims {
  sub: string;
  tenant: string;
  jti: string;
}

const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800);
const JWT_ISSUER = 'waops';
const JWT_AUDIENCE = 'waops-api';

/**
 * Stateless access token (short TTL) + opaque refresh via signed JWT jti.
 * tenant scope vive no token assinado — frontend nunca manda tenant de autoridade.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      expiresIn: ACCESS_TTL,
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async signRefreshToken(claims: RefreshTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      expiresIn: REFRESH_TTL,
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.jwt.verifyAsync<AccessTokenClaims>(token, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    return this.jwt.verifyAsync<RefreshTokenClaims>(token, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  refreshCookieMaxAge(): number {
    return REFRESH_TTL * 1000;
  }
}

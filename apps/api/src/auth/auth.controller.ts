import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { hash, verify } from '@node-rs/argon2';
import { getPrisma, type PrismaClient } from '@waops/db';
import { PERMISSION_KEYS_V1, ROLE_PERMISSIONS } from '@waops/contracts';
import { currentCorrelation } from '@waops/observability';
import { loadConfig } from '@waops/config';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { TokenService } from './jwt.service.js';
import type { AuthedRequest } from './tenant-context.middleware.js';

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const REFRESH_COOKIE = 'waops_refresh';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  name: z.string().min(1).max(120).optional(),
  tenantName: z.string().min(2).max(120).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tenant';
}

@Controller('api/v1/auth')
export class AuthController {
  private readonly prisma: PrismaClient;

  constructor(@Inject(TokenService) private readonly tokens: TokenService) {
    this.prisma = getPrisma();
  }

  /** signup: cria user + tenant + membership owner + subscription trial (idempotency: unique email/slug). */
  @Post('signup')
  async signup(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const input = SignupSchema.parse(body);
    const cfg = loadConfig();
    const email = input.email.toLowerCase().trim();

    const exists = await this.prisma.user.findUnique({ where: { emailNormalized: email } });
    if (exists) throw ApiError.conflict('email already registered');

    const baseSlug = slugify(input.tenantName ?? email.split('@')[1] ?? 'tenant');
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    const trialEndsAt = new Date(Date.now() + cfg.env.TRIAL_DAYS * 86400_000);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          emailNormalized: email,
          passwordHash: await hash(input.password, ARGON2_OPTS),
          name: input.name ?? null,
        },
      });
      const tenant = await tx.tenant.create({
        data: { slug, name: input.tenantName ?? `Tenant ${user.id.slice(0, 6)}`, trialEndsAt },
      });
      const ownerRole = await tx.role.findFirst({
        where: { tenantId: null, name: 'tenant_owner', isSystem: true },
      });
      if (!ownerRole) throw new Error('system role tenant_owner missing (run seed)');
      await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id },
      });
      return { user, tenant };
    });

    const perms = ROLE_PERMISSIONS.tenant_owner;
    await this.issueSession(res, {
      sub: result.user.id,
      tenant: result.tenant.id,
      org: null,
      perms: [...perms],
      ents: [],
    });
    return { user_id: result.user.id, tenant_id: result.tenant.id, trial_ends_at: trialEndsAt.toISOString() };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const input = LoginSchema.parse(body);
    const email = input.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { emailNormalized: email } });
    // constant-ish failure: always verify against a hash to avoid user enumeration timing
    const hashToVerify = user?.passwordHash ?? 'argon2$mismatch$hash';
    const ok = await verify(hashToVerify, input.password, ARGON2_OPTS).catch(() => false);
    if (!user || !ok) throw new ApiError('authentication_required', 'invalid credentials', 401);

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw new ApiError('authentication_required', 'no active membership', 401);

    const role = await this.prisma.role.findUnique({
      where: { id: membership.roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    const perms = role
      ? role.rolePermissions.map((rp) => rp.permission.key)
      : [...PERMISSION_KEYS_V1];

    await this.issueSession(res, {
      sub: user.id,
      tenant: membership.tenantId,
      org: membership.organizationId,
      perms,
      ents: [],
    });
    return { user_id: user.id, tenant_id: membership.tenantId };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const raw = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!raw) throw new ApiError('authentication_required', 'missing refresh token', 401);
    let claims;
    try {
      claims = await this.tokens.verifyRefreshToken(raw);
    } catch {
      throw new ApiError('authentication_required', 'invalid refresh token', 401);
    }
    const membership = await this.prisma.membership.findFirst({
      where: { userId: claims.sub, tenantId: claims.tenant, status: 'active' },
    });
    if (!membership) throw new ApiError('authentication_required', 'membership revoked', 401);

    const role = await this.prisma.role.findUnique({
      where: { id: membership.roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    const perms = role ? role.rolePermissions.map((rp) => rp.permission.key) : [];
    await this.issueSession(res, {
      sub: claims.sub,
      tenant: claims.tenant,
      org: membership.organizationId,
      perms,
      ents: [],
    });
    return { user_id: claims.sub, tenant_id: claims.tenant };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
  }

  @Get('me')
  me(@Req() req: AuthedRequest): Record<string, unknown> {
    const ctx = currentCorrelation();
    if (!req.auth) throw new ApiError('authentication_required', 'authentication required', 401);
    return {
      user_id: req.auth.sub,
      tenant_id: req.auth.tenant,
      organization_scope: req.auth.org,
      permissions: req.auth.perms,
      request_id: ctx?.requestId,
    };
  }

  private async issueSession(
    res: Response,
    claims: { sub: string; tenant: string; org: string | null; perms: string[]; ents: string[] },
  ): Promise<void> {
    const accessToken = await this.tokens.signAccessToken({ ...claims, jti: crypto.randomUUID() });
    const refreshToken = await this.tokens.signRefreshToken({
      sub: claims.sub,
      tenant: claims.tenant,
      jti: crypto.randomUUID(),
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: this.tokens.refreshCookieMaxAge(),
      path: '/',
    });
    (res as Response & { locals?: Record<string, unknown> }).locals = {
      accessToken,
    };
    // Expose access token via header for SPA simplicity (cookie remains for refresh).
    res.setHeader('X-Access-Token', accessToken);
  }
}

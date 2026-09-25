import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getTenantContext } from '@waops/tenancy';
import { ApiError } from '../errors.js';

export const PERMISSION_KEY = 'waops:permission';

/** Route decorator: declares the permission required (deny-by-default). */
export const RequirePermission = (permission: string): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, permission) as MethodDecorator & ClassDecorator;

/**
 * Authorization happens in the backend. Frontend permissions are UX-only.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  // Reflector é stateless: instancia direta (tsx/esbuild não emite metadata de DI).
  private readonly reflector = new Reflector();

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // public route

    const req = context.switchToHttp().getRequest<{ auth?: unknown }>();
    const ctx = getTenantContext();
    if (!req.auth || !ctx) {
      throw new UnauthorizedException('authentication required');
    }
    if (!ctx.permissions.has(required)) {
      throw ApiError.permissionDenied();
    }
    return true;
  }
}

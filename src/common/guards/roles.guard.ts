import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return Boolean(request.user && required.includes(request.user.role));
  }
}

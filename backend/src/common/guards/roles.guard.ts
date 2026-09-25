import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Debe usarse siempre después de JwtAuthGuard: lee request.user (JwtPayload)
 * y lo compara contra los roles declarados con @Roles(...) en el handler/clase.
 * Si el endpoint no tiene @Roles, se deja pasar (solo exige estar autenticado).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user: JwtPayload }>().user;
    return requiredRoles.includes(user.rol);
  }
}

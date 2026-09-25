import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuloSistema, Rol } from '@prisma/client';
import { MODULO_KEY } from '../decorators/modulo.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Debe usarse siempre después de JwtAuthGuard + RolesGuard: lee request.user
 * (JwtPayload) y lo compara contra los módulos declarados con @Modulo(...) en el
 * handler/clase. Si el endpoint no tiene @Modulo, se deja pasar (el control de
 * acceso queda solo en manos de @Roles). MANAGER siempre pasa: su acceso a los
 * módulos es total por rol, no por lista delegada — ver AccesosModule.
 */
@Injectable()
export class ModuloAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ModuloSistema[]>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user: JwtPayload }>().user;

    if (user.rol === Rol.MANAGER) {
      return true;
    }

    return required.some((modulo) => user.modulos.includes(modulo));
  }
}

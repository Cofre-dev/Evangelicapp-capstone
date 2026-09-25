import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { CONTACTO_VENTAS_EMAIL, PLAN_LABEL, PLAN_LIMITS } from '../../common/constants/plan';
import { generateTemporaryPassword } from '../../common/utils/generate-temporary-password';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const USUARIO_SELECT = {
  id: true,
  username: true,
  email: true,
  nombre: true,
  apellido: true,
  telefono: true,
  fotoUrl: true,
  rol: true,
  activo: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UsuarioSelect;

const DIRECTORIO_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  fotoUrl: true,
  rol: true,
} satisfies Prisma.UsuarioSelect;

/** Orden de presentación de la tarjeta: el manager siempre primero, luego el resto del equipo. */
const ORDEN_ROL: Record<Rol, number> = {
  [Rol.MANAGER]: 0,
  [Rol.USUARIO]: 1,
  [Rol.SUPER_ADMIN]: 2,
};

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Equipo de la iglesia (rol USUARIO). El manager se gestiona aparte, vía onboarding. */
  async findAllForIglesia(iglesiaId: string) {
    return this.prisma.usuario.findMany({
      where: { iglesiaId, rol: { not: Rol.MANAGER } },
      select: USUARIO_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Directorio del equipo, tipo "tarjeta de presentación": foto, nombre y cargo de
   * todos los integrantes activos de la iglesia, incluido el manager (a diferencia de
   * findAllForIglesia, que es solo la lista administrable por el manager). Visible para
   * cualquier rol de la propia iglesia — ver UsuariosController#equipo.
   */
  async findDirectorio(iglesiaId: string) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { iglesiaId, activo: true },
      select: DIRECTORIO_SELECT,
    });

    return usuarios.sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre));
  }

  /**
   * MANAGER cuenta como un usuario más del tope del plan (ver PLAN_LIMITS): un plan
   * Básico de "3 usuarios" son 3 en total, incluido el manager. Se cuentan solo los
   * activos — desactivar a alguien libera un cupo para agregar a otra persona.
   */
  async create(iglesiaId: string, dto: CreateUsuarioDto) {
    const iglesia = await this.prisma.iglesia.findUniqueOrThrow({
      where: { id: iglesiaId },
      select: { plan: true },
    });

    const maximo = PLAN_LIMITS[iglesia.plan].maxUsuarios;
    const actuales = await this.prisma.usuario.count({
      where: { iglesiaId, activo: true, rol: { in: [Rol.MANAGER, Rol.USUARIO] } },
    });

    if (actuales >= maximo) {
      throw new ForbiddenException({
        code: 'PLAN_LIMITE_USUARIOS',
        message: `Tu plan ${PLAN_LABEL[iglesia.plan]} solo permite ${maximo} usuarios (incluyendo al manager). Habla con ${CONTACTO_VENTAS_EMAIL} para subir de plan.`,
        plan: iglesia.plan,
        maximo,
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: passwordHash,
          nombre: dto.nombre,
          apellido: dto.apellido,
          telefono: dto.telefono,
          rol: Rol.USUARIO,
          iglesiaId,
          mustChangePassword: true,
          onboardingCompletado: true, // el onboarding de datos personales es exclusivo del manager
        },
        select: USUARIO_SELECT,
      });

      return { usuario, temporaryPassword };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  async update(iglesiaId: string, usuarioId: string, dto: UpdateUsuarioDto) {
    await this.findMiembroEquipoOrThrow(iglesiaId, usuarioId);

    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...dto,
        // Reactivar a alguien limpia también el bloqueo de login (ver
        // AuthService#registrarLoginFallido): si un USUARIO llegó a los 5 intentos
        // fallidos y quedó desactivado, el MANAGER lo reactiva y vuelve a entrar.
        ...(dto.activo === true ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
      },
      select: USUARIO_SELECT,
    });
  }

  /**
   * Aísla por tenant: si el usuario no pertenece a esta iglesia (o es el propio
   * MANAGER) se responde 404 en vez de 403, para no filtrar que el registro existe.
   */
  private async findMiembroEquipoOrThrow(iglesiaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, iglesiaId, rol: { not: Rol.MANAGER } },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }
}

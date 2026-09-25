import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuloSistema, Rol } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MODULE_LABELS } from './modulo-sistema.constants';

@Injectable()
export class AccesosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo de módulos delegables, para pintar los checkboxes de la pantalla de Accesos. */
  catalogo() {
    return Object.values(ModuloSistema).map((modulo) => ({ id: modulo, label: MODULE_LABELS[modulo] }));
  }

  /** Usuarios con rol USUARIO de la iglesia junto a sus módulos otorgados, para la grilla de Accesos. */
  async findUsuariosConAccesos(iglesiaId: string) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { iglesiaId, rol: Rol.USUARIO },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        username: true,
        fotoUrl: true,
        activo: true,
        accesosPropios: { select: { modulo: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    return usuarios.map(({ accesosPropios, ...usuario }) => ({
      ...usuario,
      modulos: accesosPropios.map((acceso) => acceso.modulo),
    }));
  }

  /**
   * Reemplaza por completo los módulos otorgados a un usuario (borra los actuales y
   * crea los nuevos dentro de una transacción). Aísla por tenant: si el usuario no
   * pertenece a esta iglesia o no tiene rol USUARIO se responde 404 en vez de 403,
   * mismo patrón que UsuariosService#findMiembroEquipoOrThrow.
   */
  async reemplazarAccesos(
    iglesiaId: string,
    usuarioId: string,
    modulos: ModuloSistema[],
    otorgadoPorId: string,
  ) {
    await this.findUsuarioAsignableOrThrow(iglesiaId, usuarioId);

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.accesoModulo.deleteMany({ where: { usuarioId } });
      await tx.accesoModulo.createMany({
        data: modulos.map((modulo) => ({ usuarioId, iglesiaId, modulo, otorgadoPorId })),
      });
    });

    return this.findUsuariosConAccesos(iglesiaId).then((usuarios) =>
      usuarios.find((u) => u.id === usuarioId),
    );
  }

  private async findUsuarioAsignableOrThrow(iglesiaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, iglesiaId, rol: Rol.USUARIO },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }
}

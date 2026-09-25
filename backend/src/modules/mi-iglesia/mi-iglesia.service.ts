import { Injectable, NotFoundException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PLAN_LIMITS } from '../../common/constants/plan';
import { calcularEstadoFacturacion } from '../../common/utils/calcular-facturacion';
import { LOGO_RESIZE, resolverExtensionLogo } from '../iglesias/logo-upload.config';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { UpdateMiIglesiaDto } from './dto/update-mi-iglesia.dto';

const MI_IGLESIA_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  direccion: true,
  logoUrl: true,
  estado: true,
  visitantesPromedio: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Además de MI_IGLESIA_SELECT: los campos de plan/facturación, solo relevantes para el módulo de facturación. */
const MI_IGLESIA_FACTURACION_SELECT = {
  ...MI_IGLESIA_SELECT,
  plan: true,
  proximaFacturacion: true,
  ultimoPagoAt: true,
} as const;

@Injectable()
export class MiIglesiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findOne(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: MI_IGLESIA_SELECT,
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    return iglesia;
  }

  /**
   * Módulo de facturación (solo informativo, sin pasarela de pago todavía — ver
   * CLAUDE.md): plan contratado, semáforo de la próxima facturación y uso actual
   * contra los topes del plan, para que el manager sepa cuánto le queda de cupo.
   */
  async findFacturacion(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: MI_IGLESIA_FACTURACION_SELECT,
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const { plan, proximaFacturacion, ...iglesiaData } = iglesia;

    const [usuariosActuales, departamentosActuales] = await Promise.all([
      this.prisma.usuario.count({
        where: { iglesiaId, activo: true, rol: { in: [Rol.MANAGER, Rol.USUARIO] } },
      }),
      this.prisma.departamentoFinanciero.count({ where: { iglesiaId, activo: true } }),
    ]);

    const limitesPlan = PLAN_LIMITS[plan];

    return {
      ...iglesiaData,
      plan,
      facturacion: calcularEstadoFacturacion(proximaFacturacion),
      limites: {
        usuarios: { actuales: usuariosActuales, maximo: limitesPlan.maxUsuarios },
        departamentosFinancieros: {
          actuales: departamentosActuales,
          maximo: limitesPlan.maxDepartamentosFinancieros,
        },
      },
    };
  }

  /** Corrige datos ingresados mal en el alta (nombre, comuna, región, dirección). */
  async update(iglesiaId: string, dto: UpdateMiIglesiaDto) {
    await this.findOne(iglesiaId);

    return this.prisma.iglesia.update({
      where: { id: iglesiaId },
      data: {
        nombre: dto.nombre,
        comuna: dto.comuna,
        region: dto.region,
        direccion: dto.direccion,
      },
      select: MI_IGLESIA_SELECT,
    });
  }

  /**
   * Reemplaza el logo, borrando el objeto anterior del bucket si existía. Sube el
   * nuevo antes de borrar el viejo: si la subida falla, la iglesia no se queda sin logo.
   */
  async updateLogo(iglesiaId: string, logo: Express.Multer.File) {
    const iglesia = await this.findOne(iglesiaId);

    const logoUrl = await this.supabaseStorage.upload(
      'logos-iglesias',
      `${randomUUID()}${resolverExtensionLogo(logo.mimetype)}`,
      logo,
      LOGO_RESIZE,
    );

    if (iglesia.logoUrl) {
      await this.supabaseStorage.removeByPublicUrl(iglesia.logoUrl);
    }

    return this.prisma.iglesia.update({
      where: { id: iglesiaId },
      data: { logoUrl },
      select: MI_IGLESIA_SELECT,
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { formatearFechaLarga } from '../../common/utils/formatear-fecha';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { AuthService } from '../auth/auth.service';
import { resolverObjectNameCertificado } from './certificados/certificado-cache.util';
import { generarCertificadoPdf } from './certificados/certificado-pdf.builder';
import { CreatePresentacionDto } from './dto/create-presentacion.dto';
import { UpdatePresentacionDto } from './dto/update-presentacion.dto';

const CERTIFICADOS_BUCKET = 'certificados-ceremonias';

@Injectable()
export class PresentacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date) {
    return this.prisma.presentacion.findMany({
      where: { iglesiaId, ...(from && to ? { fecha: { gte: from, lte: to } } : {}) },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const presentacion = await this.prisma.presentacion.findFirst({ where: { id, iglesiaId } });

    if (!presentacion) {
      throw new NotFoundException('Presentación no encontrada');
    }

    return presentacion;
  }

  /** El folio es correlativo por iglesia (no global) — ver comentario en el modelo Prisma. */
  async create(iglesiaId: string, usuarioId: string, dto: CreatePresentacionDto) {
    return this.prisma.withTenantTransaction(async (tx) => {
      const { _max } = await tx.presentacion.aggregate({ where: { iglesiaId }, _max: { folio: true } });

      return tx.presentacion.create({
        data: {
          folio: (_max.folio ?? 0) + 1,
          fecha: new Date(dto.fecha),
          nombreNino: dto.nombreNino,
          nombrePadres: dto.nombrePadres,
          nombrePastor: dto.nombrePastor,
          ciudad: dto.ciudad,
          iglesiaId,
          creadoPorId: usuarioId,
        },
      });
    });
  }

  async update(iglesiaId: string, id: string, dto: UpdatePresentacionDto) {
    await this.findOne(iglesiaId, id);

    return this.prisma.presentacion.update({
      where: { id },
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        nombreNino: dto.nombreNino,
        nombrePadres: dto.nombrePadres,
        nombrePastor: dto.nombrePastor,
        ciudad: dto.ciudad,
      },
    });
  }

  /** Exige confirmar la contraseña del usuario: es un registro oficial, no se borra sin fricción. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);
    await this.findOne(iglesiaId, id);
    await this.prisma.presentacion.delete({ where: { id } });
  }

  async generarCertificado(iglesiaId: string, id: string): Promise<{ buffer: Buffer; folio: number }> {
    const presentacion = await this.findOne(iglesiaId, id);
    const iglesia = await this.prisma.iglesia.findUniqueOrThrow({
      where: { id: iglesiaId },
      select: { nombre: true, logoUrl: true },
    });

    const objectName = resolverObjectNameCertificado({
      tipo: 'presentaciones',
      id: presentacion.id,
      actualizadoEn: presentacion.updatedAt,
      logoUrl: iglesia.logoUrl,
    });

    const buffer = await this.supabaseStorage.getOrGenerate(CERTIFICADOS_BUCKET, objectName, () =>
      generarCertificadoPdf({
        subtitulo: 'DE PRESENTACIÓN',
        firmaCaption: 'Pastor(a) que realizó la presentación',
        nombrePastor: presentacion.nombrePastor,
        folio: presentacion.folio,
        iglesia,
        parrafo: [
          {
            texto: `${iglesia.nombre}, comunidad evangélica congregada en ${presentacion.ciudad}, deja constancia que con fecha ${formatearFechaLarga(presentacion.fecha)} fue presentado(a) ante la congregación el(la) niño(a) `,
          },
          { texto: presentacion.nombreNino, negrita: true },
          { texto: ', hijo(a) de ' },
          { texto: presentacion.nombrePadres, negrita: true },
          {
            texto:
              ', quienes lo(a) consagran al cuidado y las bendiciones de Dios, conforme a los principios de la fe cristiana evangélica, bajo el cuidado pastoral de ',
          },
          { texto: presentacion.nombrePastor, negrita: true },
          {
            texto:
              '. Se extiende el presente certificado para los fines que los interesados estimen pertinentes.',
          },
        ],
      }),
    );

    return { buffer, folio: presentacion.folio };
  }
}

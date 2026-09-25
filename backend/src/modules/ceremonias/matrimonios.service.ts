import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { formatearFechaLarga } from '../../common/utils/formatear-fecha';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { AuthService } from '../auth/auth.service';
import { resolverObjectNameCertificado } from './certificados/certificado-cache.util';
import { generarCertificadoPdf } from './certificados/certificado-pdf.builder';
import { CreateMatrimonioDto } from './dto/create-matrimonio.dto';
import { UpdateMatrimonioDto } from './dto/update-matrimonio.dto';

const CERTIFICADOS_BUCKET = 'certificados-ceremonias';

@Injectable()
export class MatrimoniosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date) {
    return this.prisma.matrimonio.findMany({
      where: { iglesiaId, ...(from && to ? { fecha: { gte: from, lte: to } } : {}) },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const matrimonio = await this.prisma.matrimonio.findFirst({ where: { id, iglesiaId } });

    if (!matrimonio) {
      throw new NotFoundException('Matrimonio no encontrado');
    }

    return matrimonio;
  }

  /** El folio es correlativo por iglesia (no global) — ver comentario en el modelo Prisma. */
  async create(iglesiaId: string, usuarioId: string, dto: CreateMatrimonioDto) {
    return this.prisma.withTenantTransaction(async (tx) => {
      const { _max } = await tx.matrimonio.aggregate({ where: { iglesiaId }, _max: { folio: true } });

      return tx.matrimonio.create({
        data: {
          folio: (_max.folio ?? 0) + 1,
          fecha: new Date(dto.fecha),
          nombreNovio: dto.nombreNovio,
          nombreNovia: dto.nombreNovia,
          nombrePastor: dto.nombrePastor,
          ciudad: dto.ciudad,
          iglesiaId,
          creadoPorId: usuarioId,
        },
      });
    });
  }

  async update(iglesiaId: string, id: string, dto: UpdateMatrimonioDto) {
    await this.findOne(iglesiaId, id);

    return this.prisma.matrimonio.update({
      where: { id },
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        nombreNovio: dto.nombreNovio,
        nombreNovia: dto.nombreNovia,
        nombrePastor: dto.nombrePastor,
        ciudad: dto.ciudad,
      },
    });
  }

  /** Exige confirmar la contraseña del usuario: es un registro oficial, no se borra sin fricción. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);
    await this.findOne(iglesiaId, id);
    await this.prisma.matrimonio.delete({ where: { id } });
  }

  async generarCertificado(iglesiaId: string, id: string): Promise<{ buffer: Buffer; folio: number }> {
    const matrimonio = await this.findOne(iglesiaId, id);
    const iglesia = await this.prisma.iglesia.findUniqueOrThrow({
      where: { id: iglesiaId },
      select: { nombre: true, logoUrl: true },
    });

    const objectName = resolverObjectNameCertificado({
      tipo: 'matrimonios',
      id: matrimonio.id,
      actualizadoEn: matrimonio.updatedAt,
      logoUrl: iglesia.logoUrl,
    });

    const buffer = await this.supabaseStorage.getOrGenerate(CERTIFICADOS_BUCKET, objectName, () =>
      generarCertificadoPdf({
        subtitulo: 'DE MATRIMONIO',
        firmaCaption: 'Pastor(a) que ofició la ceremonia',
        nombrePastor: matrimonio.nombrePastor,
        folio: matrimonio.folio,
        iglesia,
        parrafo: [
          {
            texto: `${iglesia.nombre}, comunidad evangélica congregada en ${matrimonio.ciudad}, deja constancia que con fecha ${formatearFechaLarga(matrimonio.fecha)} se celebró el matrimonio de `,
          },
          { texto: matrimonio.nombreNovio, negrita: true },
          { texto: ' y ' },
          { texto: matrimonio.nombreNovia, negrita: true },
          {
            texto:
              ', quienes se unieron en matrimonio ante Dios y esta congregación, conforme a los principios de la fe cristiana evangélica, bajo el cuidado pastoral de ',
          },
          { texto: matrimonio.nombrePastor, negrita: true },
          {
            texto:
              '. Se extiende el presente certificado para los fines que los interesados estimen pertinentes.',
          },
        ],
      }),
    );

    return { buffer, folio: matrimonio.folio };
  }
}

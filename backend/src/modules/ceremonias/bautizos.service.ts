import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { formatearFechaLarga } from '../../common/utils/formatear-fecha';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { AuthService } from '../auth/auth.service';
import { resolverObjectNameCertificado } from './certificados/certificado-cache.util';
import { generarCertificadoPdf } from './certificados/certificado-pdf.builder';
import { CreateBautizoDto } from './dto/create-bautizo.dto';
import { UpdateBautizoDto } from './dto/update-bautizo.dto';

const CERTIFICADOS_BUCKET = 'certificados-ceremonias';

@Injectable()
export class BautizosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date) {
    return this.prisma.bautizo.findMany({
      where: { iglesiaId, ...(from && to ? { fecha: { gte: from, lte: to } } : {}) },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const bautizo = await this.prisma.bautizo.findFirst({ where: { id, iglesiaId } });

    if (!bautizo) {
      throw new NotFoundException('Bautizo no encontrado');
    }

    return bautizo;
  }

  /** El folio es correlativo por iglesia (no global) — ver comentario en el modelo Prisma. */
  async create(iglesiaId: string, usuarioId: string, dto: CreateBautizoDto) {
    return this.prisma.withTenantTransaction(async (tx) => {
      const { _max } = await tx.bautizo.aggregate({ where: { iglesiaId }, _max: { folio: true } });

      return tx.bautizo.create({
        data: {
          folio: (_max.folio ?? 0) + 1,
          fecha: new Date(dto.fecha),
          nombrePersona: dto.nombrePersona,
          nombrePastor: dto.nombrePastor,
          ciudad: dto.ciudad,
          iglesiaId,
          creadoPorId: usuarioId,
        },
      });
    });
  }

  async update(iglesiaId: string, id: string, dto: UpdateBautizoDto) {
    await this.findOne(iglesiaId, id);

    return this.prisma.bautizo.update({
      where: { id },
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        nombrePersona: dto.nombrePersona,
        nombrePastor: dto.nombrePastor,
        ciudad: dto.ciudad,
      },
    });
  }

  /** Exige confirmar la contraseña del usuario: es un registro oficial, no se borra sin fricción. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);
    await this.findOne(iglesiaId, id);
    await this.prisma.bautizo.delete({ where: { id } });
  }

  async generarCertificado(iglesiaId: string, id: string): Promise<{ buffer: Buffer; folio: number }> {
    const bautizo = await this.findOne(iglesiaId, id);
    const iglesia = await this.prisma.iglesia.findUniqueOrThrow({
      where: { id: iglesiaId },
      select: { nombre: true, logoUrl: true },
    });

    const objectName = resolverObjectNameCertificado({
      tipo: 'bautizos',
      id: bautizo.id,
      actualizadoEn: bautizo.updatedAt,
      logoUrl: iglesia.logoUrl,
    });

    const buffer = await this.supabaseStorage.getOrGenerate(CERTIFICADOS_BUCKET, objectName, () =>
      generarCertificadoPdf({
        subtitulo: 'DE BAUTISMO',
        firmaCaption: 'Pastor(a) que realizó el bautismo',
        nombrePastor: bautizo.nombrePastor,
        folio: bautizo.folio,
        iglesia,
        parrafo: [
          {
            texto: `${iglesia.nombre}, comunidad evangélica congregada en ${bautizo.ciudad}, deja constancia que con fecha ${formatearFechaLarga(bautizo.fecha)} fue bautizado(a) en aguas `,
          },
          { texto: bautizo.nombrePersona, negrita: true },
          {
            texto:
              ', en obediencia a la fe profesada en Jesucristo como su Señor y Salvador, conforme a los principios de la fe cristiana evangélica, bajo el cuidado pastoral de ',
          },
          { texto: bautizo.nombrePastor, negrita: true },
          {
            texto:
              '. Se extiende el presente certificado para los fines que el interesado estime pertinentes.',
          },
        ],
      }),
    );

    return { buffer, folio: bautizo.folio };
  }
}

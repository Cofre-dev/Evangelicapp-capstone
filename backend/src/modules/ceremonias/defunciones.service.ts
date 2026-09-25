import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { formatearFechaLarga } from '../../common/utils/formatear-fecha';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { AuthService } from '../auth/auth.service';
import { resolverObjectNameCertificado } from './certificados/certificado-cache.util';
import { generarCertificadoPdf } from './certificados/certificado-pdf.builder';
import { CreateDefuncionDto } from './dto/create-defuncion.dto';
import { UpdateDefuncionDto } from './dto/update-defuncion.dto';

const CERTIFICADOS_BUCKET = 'certificados-ceremonias';

@Injectable()
export class DefuncionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date) {
    return this.prisma.defuncion.findMany({
      where: { iglesiaId, ...(from && to ? { fecha: { gte: from, lte: to } } : {}) },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const defuncion = await this.prisma.defuncion.findFirst({ where: { id, iglesiaId } });

    if (!defuncion) {
      throw new NotFoundException('Defunción no encontrada');
    }

    return defuncion;
  }

  /** El folio es correlativo por iglesia (no global) — ver comentario en el modelo Prisma. */
  async create(iglesiaId: string, usuarioId: string, dto: CreateDefuncionDto) {
    return this.prisma.withTenantTransaction(async (tx) => {
      const { _max } = await tx.defuncion.aggregate({ where: { iglesiaId }, _max: { folio: true } });

      return tx.defuncion.create({
        data: {
          folio: (_max.folio ?? 0) + 1,
          fecha: new Date(dto.fecha),
          nombreDifunto: dto.nombreDifunto,
          nombrePastor: dto.nombrePastor,
          ciudad: dto.ciudad,
          iglesiaId,
          creadoPorId: usuarioId,
        },
      });
    });
  }

  async update(iglesiaId: string, id: string, dto: UpdateDefuncionDto) {
    await this.findOne(iglesiaId, id);

    return this.prisma.defuncion.update({
      where: { id },
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        nombreDifunto: dto.nombreDifunto,
        nombrePastor: dto.nombrePastor,
        ciudad: dto.ciudad,
      },
    });
  }

  /** Exige confirmar la contraseña del usuario: es un registro oficial, no se borra sin fricción. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);
    await this.findOne(iglesiaId, id);
    await this.prisma.defuncion.delete({ where: { id } });
  }

  async generarCertificado(iglesiaId: string, id: string): Promise<{ buffer: Buffer; folio: number }> {
    const defuncion = await this.findOne(iglesiaId, id);
    const iglesia = await this.prisma.iglesia.findUniqueOrThrow({
      where: { id: iglesiaId },
      select: { nombre: true, logoUrl: true },
    });

    const objectName = resolverObjectNameCertificado({
      tipo: 'defunciones',
      id: defuncion.id,
      actualizadoEn: defuncion.updatedAt,
      logoUrl: iglesia.logoUrl,
    });

    const buffer = await this.supabaseStorage.getOrGenerate(CERTIFICADOS_BUCKET, objectName, () =>
      generarCertificadoPdf({
        subtitulo: 'DE DEFUNCIÓN',
        firmaCaption: 'Pastor(a) oficiante',
        nombrePastor: defuncion.nombrePastor,
        folio: defuncion.folio,
        iglesia,
        parrafo: [
          {
            texto: `${iglesia.nombre}, comunidad evangélica congregada en ${defuncion.ciudad}, deja constancia que `,
          },
          { texto: defuncion.nombreDifunto, negrita: true },
          {
            texto: `, miembro de esta congregación, partió a la presencia del Señor con fecha ${formatearFechaLarga(defuncion.fecha)}, habiendo profesado la fe cristiana evangélica. El presente certificado se extiende en su memoria, bajo el cuidado pastoral de `,
          },
          { texto: defuncion.nombrePastor, negrita: true },
          { texto: ', para los fines que sus familiares estimen pertinentes.' },
        ],
      }),
    );

    return { buffer, folio: defuncion.folio };
  }
}

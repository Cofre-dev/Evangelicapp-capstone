import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoIglesia } from '@prisma/client';
import { randomUUID } from 'crypto';
import { runAsService } from '../../common/context/tenant-context';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';
import { RegistrarIntegranteDto } from './dto/registrar-integrante.dto';
import { FOTO_INTEGRANTE_RESIZE, resolverExtensionFotoIntegrante } from './foto-upload.config';

@Injectable()
export class IntegrantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private buildUrlRegistro(qrToken: string): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    return `${frontendUrl}/integrantes/registro/${qrToken}`;
  }

  private async findIglesiaActivaPorToken(qrToken: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { integrantesQrToken: qrToken },
      select: { id: true, nombre: true, logoUrl: true, estado: true },
    });

    if (!iglesia || iglesia.estado !== EstadoIglesia.ACTIVA) {
      throw new NotFoundException('Código QR no válido');
    }

    return iglesia;
  }

  /**
   * Público: lo que ve el integrante al abrir el QR, antes de completar el formulario.
   * Fase 8 de docs/supabase.md (RLS): sin identidad de Usuario — el qrToken de un solo
   * uso ya es la autorización real (mismo criterio que Predicadores/AsistenciasService).
   */
  async getInvitacion(qrToken: string) {
    return runAsService(async () => {
      const iglesia = await this.findIglesiaActivaPorToken(qrToken);
      return { nombre: iglesia.nombre, logoUrl: iglesia.logoUrl };
    });
  }

  /**
   * El endpoint es público y sin verificación de identidad: nada prueba que
   * quien envía el formulario sea el dueño real del email o del RUN. Por eso,
   * si ya existe un integrante en esa iglesia con ese email O ese run (basta
   * que coincida cualquiera de los dos), NO se sobrescribe (evita que
   * cualquiera que adivine un correo o un RUN le pise el nombre/teléfono a
   * otra persona, o reciba de vuelta la fotoUrl real de esa persona — el
   * bucket es público. La respuesta siempre refleja lo que la propia request
   * acaba de enviar (nombre tipeado, foto recién subida si la hay, fecha
   * elegida en este envío), nunca un dato ya guardado de un registro ajeno.
   */
  async registrar(qrToken: string, dto: RegistrarIntegranteDto, foto?: Express.Multer.File) {
    return runAsService(() => this.registrarComoServicio(qrToken, dto, foto));
  }

  private async registrarComoServicio(
    qrToken: string,
    dto: RegistrarIntegranteDto,
    foto?: Express.Multer.File,
  ) {
    const iglesia = await this.findIglesiaActivaPorToken(qrToken);
    const fotoUrl = foto
      ? await this.supabaseStorage.upload(
          'fotos-integrantes',
          `${randomUUID()}${resolverExtensionFotoIntegrante(foto.mimetype)}`,
          foto,
          FOTO_INTEGRANTE_RESIZE,
        )
      : undefined;

    const existente = await this.prisma.integrante.findFirst({
      where: {
        iglesiaId: iglesia.id,
        OR: [{ email: dto.email }, { run: dto.run }],
      },
    });

    if (existente) {
      // La foto ya se subió al bucket antes de saber si era duplicado (si vino);
      // como no se va a persistir, se borra para no acumular objetos huérfanos.
      if (fotoUrl) {
        await this.supabaseStorage.removeByPublicUrl(fotoUrl);
      }

      return {
        nombreCompleto: dto.nombreCompleto,
        fotoUrl: fotoUrl ?? null,
        miembroDesde: new Date(dto.miembroDesde),
      };
    }

    try {
      const integrante = await this.prisma.integrante.create({
        data: {
          iglesiaId: iglesia.id,
          nombreCompleto: dto.nombreCompleto,
          email: dto.email,
          telefono: dto.telefono,
          run: dto.run,
          miembroDesde: new Date(dto.miembroDesde),
          fotoUrl,
        },
      });

      // Fase 5 de docs/supabase.md: censo en vivo — solo en el path de creación
      // real (arriba, el de duplicado ya salió con `return` sin llegar acá).
      this.realtimeService.emitAIglesia(iglesia.id, REALTIME_EVENTS.INTEGRANTE_REGISTRADO, {
        id: integrante.id,
        nombreCompleto: integrante.nombreCompleto,
        fotoUrl: integrante.fotoUrl,
        miembroDesde: integrante.miembroDesde,
      });

      return {
        nombreCompleto: integrante.nombreCompleto,
        fotoUrl: integrante.fotoUrl,
        miembroDesde: integrante.miembroDesde,
      };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  async findAll(iglesiaId: string) {
    return this.prisma.integrante.findMany({
      where: { iglesiaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQr(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: { integrantesQrToken: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    // No debería pasar (el campo tiene @default(cuid()) en el schema), pero si
    // una iglesia antigua quedó con el token en null, se genera uno recién acá.
    const qrToken = iglesia.integrantesQrToken ?? (await this.regenerarQr(iglesiaId)).qrToken;

    return { qrToken, urlRegistro: this.buildUrlRegistro(qrToken) };
  }

  async regenerarQr(iglesiaId: string) {
    const qrToken = randomUUID();

    await this.prisma.iglesia.update({
      where: { id: iglesiaId },
      data: { integrantesQrToken: qrToken },
    });

    return { qrToken, urlRegistro: this.buildUrlRegistro(qrToken) };
  }

  async remove(iglesiaId: string, id: string): Promise<void> {
    const { count } = await this.prisma.integrante.deleteMany({ where: { id, iglesiaId } });

    if (count === 0) {
      throw new NotFoundException('Integrante no encontrado');
    }
  }
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TipoEvento } from '@prisma/client';
import { generateSecureToken } from '../../common/utils/generate-secure-token';
import { MailService } from '../mail/mail.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';

@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  async findAll(iglesiaId: string, from?: Date, to?: Date) {
    return this.prisma.evento.findMany({
      where: {
        iglesiaId,
        ...(from && to ? { fechaInicio: { gte: from, lte: to } } : {}),
      },
      include: { predicadores: true },
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const evento = await this.prisma.evento.findFirst({
      where: { id, iglesiaId },
      include: { predicadores: true },
    });

    if (!evento) {
      throw new NotFoundException('Evento no encontrado');
    }

    return evento;
  }

  async create(iglesiaId: string, usuarioId: string, dto: CreateEventoDto) {
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    // Crear siempre cuenta como "agendar": la fecha de inicio nunca puede quedar en el pasado.
    this.validarFechas(fechaInicio, fechaFin, { validarNoPasado: true });

    const evento = await this.prisma.evento.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        tipo: dto.tipo,
        fechaInicio,
        fechaFin,
        ubicacion: dto.ubicacion,
        colorEtiqueta: dto.colorEtiqueta,
        notificarIntegrantes: dto.notificarIntegrantes ?? false,
        iglesiaId,
        creadoPorId: usuarioId,
      },
    });

    const predicadoresInvitados =
      dto.tipo === TipoEvento.CULTO && dto.predicadores?.length
        ? await this.invitarPredicadores(iglesiaId, evento, dto.predicadores)
        : [];

    if (dto.notificarIntegrantes) {
      await this.notificarIntegrantes(iglesiaId, evento, usuarioId, predicadoresInvitados);
    }

    return this.findOne(iglesiaId, evento.id);
  }

  async update(iglesiaId: string, id: string, dto: UpdateEventoDto) {
    const existente = await this.findOne(iglesiaId, id);

    const nuevaFechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : existente.fechaInicio;
    const nuevaFechaFin = dto.fechaFin ? new Date(dto.fechaFin) : existente.fechaFin;

    // Solo exigir "no en el pasado" si la fecha de inicio realmente está cambiando —
    // si no, editar un evento ya pasado (p.ej. corregir el título) quedaría bloqueado para siempre.
    const cambiaFechaInicio =
      dto.fechaInicio !== undefined && nuevaFechaInicio.getTime() !== existente.fechaInicio.getTime();

    this.validarFechas(nuevaFechaInicio, nuevaFechaFin, { validarNoPasado: cambiaFechaInicio });

    return this.prisma.evento.update({
      where: { id },
      data: {
        ...dto,
        fechaInicio: dto.fechaInicio ? nuevaFechaInicio : undefined,
        fechaFin: dto.fechaFin ? nuevaFechaFin : undefined,
      },
      include: { predicadores: true },
    });
  }

  private validarFechas(fechaInicio: Date, fechaFin: Date, opciones: { validarNoPasado: boolean }) {
    if (fechaFin <= fechaInicio) {
      throw new BadRequestException('La hora de término debe ser posterior a la hora de inicio');
    }

    if (opciones.validarNoPasado) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const fechaSolo = new Date(fechaInicio);
      fechaSolo.setHours(0, 0, 0, 0);

      if (fechaSolo < hoy) {
        throw new BadRequestException('No se pueden agendar eventos en fechas anteriores a hoy');
      }
    }
  }

  async remove(iglesiaId: string, id: string): Promise<void> {
    await this.findOne(iglesiaId, id);
    await this.prisma.evento.delete({ where: { id } });
  }

  /**
   * Quién de los Integrantes convocados (ver `notificarIntegrantes`) confirmó, rechazó
   * o todavía no responde. `findOne` ya valida que el evento pertenezca a `iglesiaId` —
   * evita que un manager consulte asistencias de otra iglesia adivinando un id de evento.
   */
  async findAsistencias(iglesiaId: string, id: string) {
    await this.findOne(iglesiaId, id);

    const asistencias = await this.prisma.asistenciaEvento.findMany({
      where: { eventoId: id },
      include: { integrante: { select: { nombreCompleto: true, email: true } } },
      orderBy: { integrante: { nombreCompleto: 'asc' } },
    });

    return asistencias.map((asistencia) => ({
      integranteId: asistencia.integranteId,
      nombreCompleto: asistencia.integrante.nombreCompleto,
      email: asistencia.integrante.email,
      estado: asistencia.estado,
      respondidoAt: asistencia.respondidoAt,
    }));
  }

  /**
   * Estado completo de la convocatoria del evento para el equipo de la iglesia:
   * predicadores invitados + integrantes convocados, con su confirmación/rechazo.
   * Vista in-app (una sola llamada); la página pública equivalente es
   * `GET /agenda/convocatoria/:token/estado` (ver ConvocatoriaService). El
   * frontend la mantiene en vivo con los eventos `predicador:respondio` /
   * `asistencia:respondida` del canal de Realtime de la iglesia.
   */
  async findConvocatoria(iglesiaId: string, id: string) {
    await this.findOne(iglesiaId, id);

    const [predicadores, asistencias] = await Promise.all([
      this.prisma.predicador.findMany({
        where: { eventoId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nombre: true, email: true, estado: true, respondidoAt: true },
      }),
      this.prisma.asistenciaEvento.findMany({
        where: { eventoId: id },
        orderBy: { integrante: { nombreCompleto: 'asc' } },
        select: {
          integranteId: true,
          estado: true,
          respondidoAt: true,
          integrante: { select: { nombreCompleto: true, email: true } },
        },
      }),
    ]);

    return {
      predicadores,
      asistencias: asistencias.map((a) => ({
        integranteId: a.integranteId,
        nombreCompleto: a.integrante.nombreCompleto,
        email: a.integrante.email,
        estado: a.estado,
        respondidoAt: a.respondidoAt,
      })),
    };
  }

  /**
   * Crea los `Predicador` del evento y les manda su invitación (plantilla propia,
   * ver `MailService#enviarInvitacionPredicador`). Devuelve los nombres de los que
   * el equipo cargó CON nombre — `notificarIntegrantes` los usa para decir en el
   * correo a la congregación quién predica (los sin nombre no se listan).
   */
  private async invitarPredicadores(
    iglesiaId: string,
    evento: { id: string; titulo: string; fechaInicio: Date; ubicacion: string | null },
    predicadores: { email: string; nombre?: string }[],
  ): Promise<string[]> {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: { nombre: true, logoUrl: true },
    });

    const nombresInvitados: string[] = [];

    for (const invitado of predicadores) {
      const predicador = await this.prisma.predicador.create({
        data: {
          eventoId: evento.id,
          email: invitado.email,
          nombre: invitado.nombre,
          tokenConfirmacion: generateSecureToken(),
        },
      });

      if (predicador.nombre) {
        nombresInvitados.push(predicador.nombre);
      }

      await this.mailService.enviarInvitacionPredicador({
        email: predicador.email,
        nombrePredicador: predicador.nombre,
        nombreIglesia: iglesia?.nombre ?? 'tu iglesia',
        tituloEvento: evento.titulo,
        fecha: evento.fechaInicio,
        ubicacion: evento.ubicacion,
        logoUrl: iglesia?.logoUrl ?? null,
        tokenConfirmacion: predicador.tokenConfirmacion,
      });
    }

    return nombresInvitados;
  }

  /**
   * Convocatoria masiva a todos los Integrantes de la iglesia (censo por QR), cada
   * uno con su propio token de RSVP. Filtra siempre por el mismo iglesiaId del
   * evento — nunca por uno que venga de otro lado.
   */
  private async notificarIntegrantes(
    iglesiaId: string,
    evento: {
      id: string;
      titulo: string;
      descripcion: string | null;
      fechaInicio: Date;
      ubicacion: string | null;
    },
    creadoPorId: string,
    predicadoresInvitados: string[],
  ): Promise<void> {
    const integrantes = await this.prisma.integrante.findMany({
      where: { iglesiaId },
      select: { id: true, email: true, telefono: true, nombreCompleto: true },
    });

    if (integrantes.length === 0) {
      return;
    }

    const invitaciones = integrantes.map((integrante) => ({
      integranteId: integrante.id,
      email: integrante.email,
      telefono: integrante.telefono,
      nombreCompleto: integrante.nombreCompleto,
      tokenConfirmacion: generateSecureToken(),
    }));

    // Fuente de verdad de "a quién se invitó" independiente de si el correo llega
    // a destino — por eso este insert sí se espera antes de responder al cliente.
    // Un solo createMany en vez de N inserts secuenciales; skipDuplicates cubre el
    // caso de reintento gracias a @@unique([eventoId, integranteId]).
    await this.prisma.asistenciaEvento.createMany({
      data: invitaciones.map(({ integranteId, tokenConfirmacion }) => ({
        eventoId: evento.id,
        integranteId,
        tokenConfirmacion,
      })),
      skipDuplicates: true,
    });

    const [iglesia, creador] = await Promise.all([
      this.prisma.iglesia.findUnique({ where: { id: iglesiaId }, select: { nombre: true, logoUrl: true } }),
      this.prisma.usuario.findUnique({
        where: { id: creadoPorId },
        select: { nombre: true, apellido: true },
      }),
    ]);
    const nombreCreador = creador ? `${creador.nombre} ${creador.apellido}` : null;

    // A diferencia de invitarPredicadores (secuencial, topado a 10 destinatarios por
    // ArrayMaxSize en CreateEventoDto), acá puede haber cientos de integrantes:
    // esperar el envío de todos los correos antes de responder haría la creación
    // del evento intolerablemente lenta. Se dispara en paralelo con
    // Promise.allSettled y NO se espera (sin await) — un fallo acá no debe tumbar
    // la creación del evento, que ya quedó confirmada en el paso anterior.
    //
    // WhatsApp se dispara junto al email, nunca en su reemplazo (decisión explícita):
    // mientras WHATSAPP_ACCESS_TOKEN no esté configurado, WhatsAppService usa un
    // provider no-op y el email sigue siendo el único canal real — ver whatsapp.module.ts.
    try {
      void Promise.allSettled(
        invitaciones.flatMap((invitacion) => [
          this.mailService.enviarConvocatoriaEvento({
            email: invitacion.email,
            tituloEvento: evento.titulo,
            descripcionEvento: evento.descripcion,
            nombreIglesia: iglesia?.nombre ?? 'tu iglesia',
            logoUrl: iglesia?.logoUrl ?? null,
            nombreCreador,
            predicadoresInvitados,
            tokenConfirmacion: invitacion.tokenConfirmacion,
          }),
          this.whatsappService.enviarConvocatoriaEvento({
            telefono: invitacion.telefono,
            nombreIntegrante: invitacion.nombreCompleto,
            tituloEvento: evento.titulo,
            nombreIglesia: iglesia?.nombre ?? 'tu iglesia',
            fecha: evento.fechaInicio,
            ubicacion: evento.ubicacion,
            tokenConfirmacion: invitacion.tokenConfirmacion,
          }),
        ]),
      );
    } catch (error) {
      this.logger.error(`Fallo al disparar las convocatorias del evento ${evento.id}`, error);
    }
  }
}

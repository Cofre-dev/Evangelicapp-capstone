import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EmailProvider } from './providers/email-provider.interface';

interface InvitacionPredicadorParams {
  email: string;
  /** Nombre del predicador invitado, si el equipo pastoral lo cargó; solo para el saludo. */
  nombrePredicador: string | null;
  nombreIglesia: string;
  tituloEvento: string;
  fecha: Date;
  ubicacion: string | null;
  /** Tal cual `Iglesia.logoUrl`: URL pública del bucket de Storage, o null. */
  logoUrl: string | null;
  tokenConfirmacion: string;
}

interface RecordatorioFacturacionParams {
  email: string;
  nombreIglesia: string;
  proximaFacturacion: Date;
}

interface FacturacionVencidaParams {
  email: string;
  nombreIglesia: string;
  diasEnMora: number;
}

interface ConvocatoriaEventoParams {
  email: string;
  tituloEvento: string;
  descripcionEvento: string | null;
  nombreIglesia: string;
  /** Tal cual se guarda en Iglesia.logoUrl: URL pública del bucket de Supabase Storage, o null. */
  logoUrl: string | null;
  /** Nombre completo del pastor/usuario que creó el evento; null si Evento.creadoPorId es null. */
  nombreCreador: string | null;
  /**
   * Nombres de los predicadores invitados que el equipo cargó CON nombre (los que
   * quedaron sin nombre no se listan — en un correo a la congregación un email suelto
   * no aporta). Vacío si no hay ninguno: entonces el correo no menciona predicador.
   */
  predicadoresInvitados: string[];
  tokenConfirmacion: string;
}

interface RecuperacionContrasenaParams {
  email: string;
  nombre: string;
  token: string;
  /** Minutos de validez del enlace, para decirlo en el cuerpo del correo. */
  expiraEnMinutos: number;
}

/** "Ana", "Ana y Beto", "Ana, Beto y Caro" — para listar predicadores en prosa. */
function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) {
    return nombres[0] ?? '';
  }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * `nombreIglesia`/`tituloEvento` los controla cualquier MANAGER/USUARIO
 * (ej. `CreateEventoDto.titulo` solo exige @IsString @IsNotEmpty) y este HTML sale
 * a una casilla externa real — sin escapar, un título malicioso podría inyectar
 * markup/enlaces en el correo del predicador invitado.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  /**
   * Invitación a un predicador invitado (pastor externo). Plantilla separada y de
   * tono más formal que la convocatoria a la congregación (`enviarConvocatoriaEvento`):
   * acá el destinatario es un par del equipo pastoral, no un asistente.
   */
  async enviarInvitacionPredicador(params: InvitacionPredicadorParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/predicacion/${params.tokenConfirmacion}`;
    const fechaTexto = params.fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const horaTexto = params.fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const tituloEvento = escapeHtml(params.tituloEvento);
    const saludo = params.nombrePredicador
      ? `Estimado/a ${escapeHtml(params.nombrePredicador)}`
      : 'Estimado/a hermano/a';
    const ubicacion = params.ubicacion ? escapeHtml(params.ubicacion) : null;
    const logoHtml = this.logoImgTag(params.logoUrl, nombreIglesia);
    const estadoHtml = this.verEstadoConvocatoriaHtml(params.tokenConfirmacion);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Invitación a predicar — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            ${logoHtml}
            <h2 style="color: #0369a1;">Invitación a predicar</h2>
            <p>${saludo}:</p>
            <p>La iglesia <strong>${nombreIglesia}</strong> le invita a compartir la Palabra en <strong>${tituloEvento}</strong>.</p>
            <table style="margin: 16px 0; font-size: 14px; color: #334155;">
              <tr><td style="padding: 2px 12px 2px 0;">Fecha</td><td><strong>${fechaTexto}</strong></td></tr>
              <tr><td style="padding: 2px 12px 2px 0;">Hora</td><td><strong>${horaTexto}</strong></td></tr>
              ${ubicacion ? `<tr><td style="padding: 2px 12px 2px 0;">Lugar</td><td><strong>${ubicacion}</strong></td></tr>` : ''}
            </table>
            <p>Le agradeceríamos confirmar su disponibilidad:</p>
            <p style="margin-top: 20px;">
              <a href="${link}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Confirmar o rechazar la invitación
              </a>
            </p>
            ${estadoHtml}
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Equipo pastoral — ${nombreIglesia}</p>
          </div>
        `,
      });
    } catch (error) {
      // Un fallo de envío no debe tumbar la creación del evento — el pastor
      // igual puede compartir el link de confirmación manualmente si hace falta.
      this.logger.error(`No se pudo enviar la invitación a ${params.email}`, error);
    }
  }

  /**
   * Convocatoria masiva a los Integrantes de la iglesia para un evento con
   * `notificarIntegrantes = true`. Título/descripción del evento y nombre de
   * iglesia/creador salen escapados por la misma razón que en
   * `enviarInvitacionPredicador`: son texto libre del equipo pastoral.
   */
  async enviarConvocatoriaEvento(params: ConvocatoriaEventoParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const backendUrl = this.config.get<string>('BACKEND_URL', 'http://localhost:3001');
    const linkBase = `${frontendUrl}/agenda/asistencia/${params.tokenConfirmacion}`;
    // Ambos botones apuntan al frontend (que llama al GET/POST del backend) con la
    // respuesta pre-seleccionada por query param — el correo nunca muta estado
    // directamente vía un link GET.
    const linkConfirmar = `${linkBase}?respuesta=CONFIRMADO`;
    const linkRechazar = `${linkBase}?respuesta=RECHAZADO`;

    const tituloEvento = escapeHtml(params.tituloEvento);
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const descripcionEvento = params.descripcionEvento ? escapeHtml(params.descripcionEvento) : null;
    const firmante = params.nombreCreador
      ? escapeHtml(params.nombreCreador)
      : `el equipo pastoral de ${nombreIglesia}`;
    const logoHtml = this.logoImgTag(params.logoUrl, nombreIglesia, backendUrl);

    // Solo se menciona el/los predicador(es) invitado(s) que el equipo cargó con
    // nombre; si el evento no tiene predicador, esta línea no aparece (pedido explícito).
    const predicadores = params.predicadoresInvitados.map((n) => escapeHtml(n));
    const predicadorHtml = predicadores.length
      ? `<p style="margin-top: 4px;">Predica${predicadores.length > 1 ? 'n' : ''}: <strong>${unirNombres(predicadores)}</strong></p>`
      : '';
    const estadoHtml = this.verEstadoConvocatoriaHtml(params.tokenConfirmacion);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: tituloEvento,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            ${logoHtml}
            <h2 style="color: #0369a1;">${tituloEvento}</h2>
            ${descripcionEvento ? `<p>${descripcionEvento}</p>` : ''}
            ${predicadorHtml}
            <p style="margin-top: 24px;">
              <a href="${linkConfirmar}" style="background:#22c55e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-right:8px;">
                Sí, voy a asistir
              </a>
              <a href="${linkRechazar}" style="background:#ef4444;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                No podré asistir
              </a>
            </p>
            ${estadoHtml}
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">${firmante} — ${nombreIglesia}</p>
          </div>
        `,
      });
    } catch (error) {
      // Mismo criterio que enviarInvitacionPredicador: un fallo de envío individual
      // no debe afectar al resto de la convocatoria ni a la creación del evento.
      this.logger.error(`No se pudo enviar la convocatoria a ${params.email}`, error);
    }
  }

  /** Aviso preventivo, 7 días antes del vencimiento (ver FacturacionRecordatoriosCron). */
  async enviarRecordatorioFacturacion(params: RecordatorioFacturacionParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const fechaTexto = params.proximaFacturacion.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Recordatorio: tu facturación vence en 7 días — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">${nombreIglesia}</h2>
            <p>Te escribimos para avisarte que la próxima facturación de tu cuenta en EvangelicApp vence el <strong>${fechaTexto}</strong> (en 7 días).</p>
            <p>No es necesario hacer nada todavía — este es solo un recordatorio para que lo tengas presente.</p>
            <p style="margin-top: 24px;">
              <a href="${frontendUrl}" style="background:#38bdf8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Ir a EvangelicApp
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      // Best-effort, mismo criterio que el resto de MailService: un correo que no sale
      // no debe tumbar la corrida del cron para el resto de las iglesias.
      this.logger.error(`No se pudo enviar el recordatorio de facturación a ${params.email}`, error);
    }
  }

  /**
   * Aviso de mora, enviado día por medio mientras la iglesia no pague (ver
   * FacturacionRecordatoriosCron) — 1, 3, 5, 7... días vencida, no todos los días.
   */
  async enviarFacturacionVencida(params: FacturacionVencidaParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const diasTexto = params.diasEnMora === 1 ? '1 día' : `${params.diasEnMora} días`;

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Tu facturación está vencida — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #dc2626;">${nombreIglesia}</h2>
            <p>Tu facturación venció hace <strong>${diasTexto}</strong>. Favor ponerte al día lo antes posible para evitar la suspensión del acceso de tu equipo a EvangelicApp.</p>
            <p style="margin-top: 24px;">
              <a href="${frontendUrl}" style="background:#dc2626;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Ir a EvangelicApp
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el aviso de facturación vencida a ${params.email}`, error);
    }
  }

  /**
   * "Olvidé mi contraseña" desde el login (ver AuthService#requestPasswordReset).
   * Best-effort y no lanza, igual que el resto de MailService: el endpoint
   * responde 200 pase lo que pase (no filtra si la cuenta existe). Si el correo
   * no sale queda logueado como error para diagnosticarlo por monitoreo — no se
   * le muestra un 500 a alguien que ya está bloqueado del sistema y no puede
   * hacer nada con ese error.
   */
  async enviarRecuperacionContrasena(params: RecuperacionContrasenaParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/recuperar-contrasena/${params.token}`;
    const nombre = escapeHtml(params.nombre);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: 'Restablece tu contraseña — EvangelicApp',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">Restablecer contraseña</h2>
            <p>Hola ${nombre},</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en EvangelicApp. Hacé clic en el botón para elegir una nueva:</p>
            <p style="margin-top: 20px;">
              <a href="${link}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Restablecer mi contraseña
              </a>
            </p>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
              El enlace vence en ${params.expiraEnMinutos} minutos y sirve una sola vez.
              Si no pediste esto, ignorá este correo — tu contraseña no cambia hasta que uses el enlace.
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo de recuperación a ${params.email}`, error);
    }
  }

  /**
   * `<img>` del logo de la iglesia para la cabecera de un correo. `logoUrl` es la URL
   * pública del bucket de Storage (absoluta); `backendUrl` solo se usa como fallback
   * para algún `logoUrl` viejo con ruta relativa (formato previo a Storage) sin re-subir.
   */
  private logoImgTag(logoUrl: string | null, altEscapado: string, backendUrl?: string): string {
    if (!logoUrl) {
      return '';
    }
    const src = logoUrl.startsWith('http') ? logoUrl : `${backendUrl ?? ''}${logoUrl}`;
    return `<img src="${src}" alt="${altEscapado}" style="max-width:72px;max-height:72px;border-radius:8px;margin-bottom:12px;" />`;
  }

  /**
   * Link discreto (texto, no botón) a la página pública de estado de la
   * convocatoria — quién confirmó / rechazó, en vivo. Va tanto en el correo al
   * predicador como en la convocatoria a la congregación; `token` es el
   * `tokenConfirmacion` del propio destinatario (ver ConvocatoriaService).
   */
  private verEstadoConvocatoriaHtml(token: string): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    return `<p style="margin-top: 16px; font-size: 13px;">
      <a href="${frontendUrl}/agenda/convocatoria/${token}" style="color:#64748b;text-decoration:underline;">
        Ver quién más confirmó su asistencia
      </a>
    </p>`;
  }
}

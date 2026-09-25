import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizarTelefonoE164 } from '../../common/utils/normalize-phone-e164.util';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './providers/whatsapp-provider.interface';

interface ConvocatoriaEventoWhatsAppParams {
  telefono: string;
  nombreIntegrante: string;
  tituloEvento: string;
  nombreIglesia: string;
  fecha: Date;
  ubicacion: string | null;
  tokenConfirmacion: string;
}

/**
 * Meta rechaza parámetros de plantilla con saltos de línea o compuestos solo de espacios —
 * a diferencia de MailService no hace falta escapar HTML (no es HTML), pero sí aplanar
 * texto libre del equipo pastoral (título/descripción de evento) antes de mandarlo.
 */
function limpiarParametro(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  /**
   * Convocatoria a un Integrante para un evento — se dispara en paralelo al email de
   * MailService#enviarConvocatoriaEvento (ver eventos.service.ts#notificarIntegrantes),
   * nunca en su reemplazo. Un fallo acá (teléfono no normalizable, error de la API de
   * Meta) no debe afectar ni al email ni al resto del batch de convocatoria.
   */
  async enviarConvocatoriaEvento(params: ConvocatoriaEventoWhatsAppParams): Promise<void> {
    const telefonoE164 = normalizarTelefonoE164(params.telefono);
    if (!telefonoE164) {
      this.logger.warn(`Teléfono no normalizable a E.164, se saltea WhatsApp: "${params.telefono}"`);
      return;
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/agenda/asistencia/${params.tokenConfirmacion}`;
    const templateName = this.config.get<string>(
      'WHATSAPP_TEMPLATE_CONVOCATORIA_EVENTO',
      'convocatoria_evento',
    );
    const fechaTexto = params.fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    try {
      await this.provider.sendTemplateMessage({
        to: telefonoE164,
        templateName,
        languageCode: 'es',
        variables: [
          limpiarParametro(params.nombreIntegrante),
          limpiarParametro(params.nombreIglesia),
          limpiarParametro(params.tituloEvento),
          fechaTexto,
          params.ubicacion ? limpiarParametro(params.ubicacion) : 'por confirmar',
          link,
        ],
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar la convocatoria de WhatsApp a ${telefonoE164}`, error);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * Sin WHATSAPP_ACCESS_TOKEN configurado, WhatsApp queda deshabilitado sin romper nada —
 * mismo criterio que SupabaseAuthService en modo no-op (Fase 7 de docs/supabase.md):
 * cualquiera puede correr el backend local sin credenciales de Meta, y el email
 * (MailService) sigue siendo el único canal activo hasta que se configuren.
 */
@Injectable()
export class NoopWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(NoopWhatsAppProvider.name);
  private avisado = false;

  sendTemplateMessage(): Promise<void> {
    if (!this.avisado) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN no configurado — notificaciones de WhatsApp deshabilitadas (el email sigue funcionando igual).',
      );
      this.avisado = true;
    }
    return Promise.resolve();
  }
}

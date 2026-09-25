import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendTemplateMessageParams, WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * API oficial de WhatsApp Business (Meta Cloud API) — nunca librerías no oficiales tipo
 * Baileys/whatsapp-web.js, por el riesgo real de baneo del número (ver docs/colaboradores-qr.md).
 * Un mensaje iniciado por el negocio (no una respuesta dentro de una conversación abierta por
 * el destinatario) exige una plantilla pre-aprobada en Meta — no se puede mandar texto libre,
 * a diferencia de EmailProvider.sendMail.
 */
@Injectable()
export class MetaCloudApiWhatsAppProvider implements WhatsAppProvider {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;

  constructor(private readonly config: ConfigService) {
    this.accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    this.phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.apiVersion = this.config.get<string>('WHATSAPP_API_VERSION', 'v21.0');
  }

  async sendTemplateMessage(params: SendTemplateMessageParams): Promise<void> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'template',
        template: {
          name: params.templateName,
          language: { code: params.languageCode },
          components: [
            {
              type: 'body',
              parameters: params.variables.map((texto) => ({ type: 'text', text: texto })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const detalle = await response.text();
      throw new Error(`WhatsApp API respondió ${response.status}: ${detalle}`);
    }
  }
}

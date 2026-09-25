export interface SendTemplateMessageParams {
  /** Número en formato E.164 (+56912345678) — ver normalizarTelefonoE164. */
  to: string;
  templateName: string;
  languageCode: string;
  /** Valores posicionales para las variables {{1}}, {{2}}... del body de la plantilla, en orden. */
  variables: string[];
}

/** Abstrae el transporte real de envío de WhatsApp (Meta Cloud API hoy) detrás de WhatsAppService. */
export interface WhatsAppProvider {
  sendTemplateMessage(params: SendTemplateMessageParams): Promise<void>;
}

/** Token de inyección del provider elegido en WhatsAppModule según si hay credenciales configuradas. */
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';

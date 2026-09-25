export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

/** Abstrae el transporte real de envío (SMTP hoy, Resend opcional) detrás de MailService. */
export interface EmailProvider {
  sendMail(params: SendMailParams): Promise<void>;
}

/** Token de inyección del provider elegido en MailModule según `MAIL_PROVIDER` (ver .env.example). */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

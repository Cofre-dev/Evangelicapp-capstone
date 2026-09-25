import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProvider, SendMailParams } from './email-provider.interface';

/**
 * Nota operativa (ver FEATURES.md): en modo sandbox, sin un dominio propio verificado
 * en Resend, el remitente `onboarding@resend.dev` solo entrega al correo del dueño de
 * la cuenta — el envío masivo real a una congregación no funciona hasta verificar un
 * dominio propio en el dashboard de Resend.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;
  private readonly mailFrom: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.mailFrom = this.config.get<string>('MAIL_FROM', 'Evangelicapp <onboarding@resend.dev>');
  }

  async sendMail(params: SendMailParams): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.mailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

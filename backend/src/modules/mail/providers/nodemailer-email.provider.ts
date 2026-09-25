import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailProvider, SendMailParams } from './email-provider.interface';

/** Transporte SMTP actual (Nodemailer) — movido tal cual desde MailService, sin cambiar comportamiento. */
@Injectable()
export class NodemailerEmailProvider implements EmailProvider {
  private readonly transporter: nodemailer.Transporter;
  private readonly mailFrom: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1025),
      secure: false,
    });
    this.mailFrom = this.config.get<string>('MAIL_FROM', '"Evangelicapp" <noreply@evangelicapp.cl>');
  }

  async sendMail(params: SendMailParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.mailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}

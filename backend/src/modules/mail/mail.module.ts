import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';
import { NodemailerEmailProvider } from './providers/nodemailer-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      // Instancia manualmente solo la implementación elegida (no ambas como providers
      // de Nest): el constructor de Resend explota si RESEND_API_KEY viene vacío, así
      // que ResendEmailProvider no debe construirse nunca en el default 'smtp'.
      // Default 'smtp': no cambia el comportamiento actual de dev/producción a menos
      // que se setee MAIL_PROVIDER=resend explícitamente (ver .env.example).
      useFactory: (config: ConfigService) =>
        config.get<string>('MAIL_PROVIDER', 'smtp') === 'resend'
          ? new ResendEmailProvider(config)
          : new NodemailerEmailProvider(config),
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}

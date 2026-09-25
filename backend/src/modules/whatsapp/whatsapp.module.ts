import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetaCloudApiWhatsAppProvider } from './providers/meta-cloud-api-whatsapp.provider';
import { NoopWhatsAppProvider } from './providers/noop-whatsapp.provider';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { WhatsAppService } from './whatsapp.service';

@Module({
  providers: [
    {
      provide: WHATSAPP_PROVIDER,
      // Mismo criterio que EMAIL_PROVIDER en MailModule: se instancia manualmente solo la
      // implementación elegida. MetaCloudApiWhatsAppProvider nunca debe construirse sin
      // WHATSAPP_ACCESS_TOKEN (su constructor explota con getOrThrow), así que el chequeo
      // de la env var pasa acá, no dentro del provider.
      useFactory: (config: ConfigService) =>
        config.get<string>('WHATSAPP_ACCESS_TOKEN')
          ? new MetaCloudApiWhatsAppProvider(config)
          : new NoopWhatsAppProvider(),
      inject: [ConfigService],
    },
    WhatsAppService,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}

import { Global, Module } from '@nestjs/common';
import { createPrismaService, PrismaService } from './prisma.service';

/**
 * Fase 8 de docs/supabase.md (RLS): `PrismaService` ya no es una clase que
 * Nest instancie directamente (`useClass` implícito) — el cliente con RLS
 * aplicado se construye vía `$extends` (ver prisma.service.ts), que devuelve
 * un objeto nuevo, no una instancia de la clase. `useFactory` registra ESE
 * objeto bajo el mismo token `PrismaService`, así que todo el resto del
 * backend lo sigue inyectando exactamente igual que antes
 * (`constructor(private readonly prisma: PrismaService)`).
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => createPrismaService(),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}

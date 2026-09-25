import { Injectable } from '@nestjs/common';
import { AuthService, SafeUsuario } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Datos personales -> Usuario; visitantesPromedio -> Iglesia (es un dato
   * del tenant, no de la cuenta). iglesiaId siempre viene del JWT, nunca del body.
   */
  async complete(
    usuarioId: string,
    iglesiaId: string,
    dto: CompleteOnboardingDto,
  ): Promise<SafeUsuario & { requiresPasswordChange: boolean; requiresOnboarding: boolean }> {
    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          telefono: dto.telefono,
          onboardingCompletado: true,
        },
      });
      await tx.iglesia.update({
        where: { id: iglesiaId },
        data: { visitantesPromedio: dto.visitantesPromedio },
      });
    });

    return this.authService.getProfile(usuarioId);
  }
}

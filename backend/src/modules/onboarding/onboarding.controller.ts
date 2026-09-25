import { Body, Controller, ForbiddenException, Patch, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';

/**
 * Solo el MANAGER pasa por este flujo: es el dueño del tenant y quien
 * recibe las credenciales temporales al crear la iglesia (ver SuperAdminModule).
 */
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Patch('complete')
  @Roles(Rol.MANAGER)
  async complete(@CurrentUser() user: JwtPayload, @Body() dto: CompleteOnboardingDto) {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }

    return this.onboardingService.complete(user.sub, user.iglesiaId, dto);
  }
}

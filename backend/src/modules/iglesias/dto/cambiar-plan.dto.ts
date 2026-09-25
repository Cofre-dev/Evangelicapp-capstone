import { PlanIglesia } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CambiarPlanDto {
  @IsEnum(PlanIglesia)
  plan: PlanIglesia;
}

import { ModuloSistema } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class ReemplazarAccesosDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(ModuloSistema, { each: true })
  modulos: ModuloSistema[];
}

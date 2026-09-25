import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNotFutureDate } from '../../../common/decorators/is-not-future-date.decorator';
import { IsRun } from '../../../common/decorators/is-run.decorator';
import { normalizarRun } from '../../../common/utils/run';

export class RegistrarIntegranteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreCompleto: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  telefono: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? normalizarRun(value) : value,
  )
  @IsRun()
  run: string;

  @IsDateString()
  @IsNotFutureDate()
  miembroDesde: string;
}

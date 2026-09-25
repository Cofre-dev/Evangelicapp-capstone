import { IsIn } from 'class-validator';

export class ResponderAsistenciaDto {
  @IsIn(['CONFIRMADO', 'RECHAZADO'])
  respuesta: 'CONFIRMADO' | 'RECHAZADO';
}

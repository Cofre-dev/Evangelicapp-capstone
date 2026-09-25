import { IsIn } from 'class-validator';

export class ResponderPredicadorDto {
  @IsIn(['CONFIRMADO', 'RECHAZADO'])
  respuesta: 'CONFIRMADO' | 'RECHAZADO';
}

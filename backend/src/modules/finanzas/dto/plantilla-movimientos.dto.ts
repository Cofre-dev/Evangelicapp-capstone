import { IsIn } from 'class-validator';

export class PlantillaMovimientosDto {
  @IsIn(['xlsx', 'csv'])
  formato: 'xlsx' | 'csv';
}

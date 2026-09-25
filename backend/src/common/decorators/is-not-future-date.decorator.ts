import { registerDecorator, ValidationOptions } from 'class-validator';

// Comparación por día en UTC (no por milisegundos): así "hoy" es válido sin importar
// la hora exacta del envío, y no depende de la zona horaria local del proceso
// (en producción el server corre en UTC; comparar en UTC evita un off-by-one
// cerca de la medianoche si el server y el usuario están en zonas distintas).
function esFechaFutura(value: string): boolean {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return false; // el formato lo valida @IsDateString por separado

  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const fechaUTC = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());

  return fechaUTC > hoyUTC;
}

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && !esFechaFutura(value);
        },
        defaultMessage(): string {
          return 'La fecha no puede ser futura';
        },
      },
    });
  };
}

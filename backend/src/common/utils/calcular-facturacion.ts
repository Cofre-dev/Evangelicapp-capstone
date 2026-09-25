import { DIAS_GRACIA_MORA, UMBRAL_AMARILLO_DIAS, UMBRAL_ROJO_DIAS } from '../constants/facturacion';

export type ColorFacturacion = 'VERDE' | 'AMARILLO' | 'ROJO';

export interface EstadoFacturacion {
  proximaFacturacion: Date;
  /** Negativo cuando ya está vencida. */
  diasParaFacturacion: number;
  color: ColorFacturacion;
  enMora: boolean;
  /** 0 cuando no está en mora. */
  diasEnMora: number;
  /** true cuando `diasEnMora >= DIAS_GRACIA_MORA` — habilita el botón "ocultar iglesia". */
  puedeOcultar: boolean;
}

/** Medianoche UTC del día calendario de `fecha` — evita que la hora del día distorsione el diff en días. */
function inicioDiaUtc(fecha: Date): number {
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diferenciaEnDias(desde: Date, hasta: Date): number {
  return Math.round((inicioDiaUtc(hasta) - inicioDiaUtc(desde)) / MS_POR_DIA);
}

/**
 * Calcula el semáforo de facturación de una iglesia. Escalón simple: verde es
 * "todo lo que no es amarillo ni rojo", amarillo arranca a los 7 días, rojo a los
 * 2 días y se mantiene (con contador de mora) una vez vencida la fecha.
 */
export function calcularEstadoFacturacion(
  proximaFacturacion: Date,
  ahora: Date = new Date(),
): EstadoFacturacion {
  const diasParaFacturacion = diferenciaEnDias(ahora, proximaFacturacion);
  const enMora = diasParaFacturacion < 0;
  const diasEnMora = enMora ? -diasParaFacturacion : 0;

  let color: ColorFacturacion;
  if (diasParaFacturacion <= UMBRAL_ROJO_DIAS) {
    color = 'ROJO';
  } else if (diasParaFacturacion <= UMBRAL_AMARILLO_DIAS) {
    color = 'AMARILLO';
  } else {
    color = 'VERDE';
  }

  return {
    proximaFacturacion,
    diasParaFacturacion,
    color,
    enMora,
    diasEnMora,
    puedeOcultar: diasEnMora >= DIAS_GRACIA_MORA,
  };
}

/**
 * Avanza la fecha de facturación en exactamente un mes calendario, preservando el
 * día del mes acordado (clampeado si el mes destino tiene menos días, ej. 31 ene ->
 * 28/29 feb). Se suma sobre la fecha de vencimiento anterior, nunca sobre "hoy": así
 * un pago confirmado tarde no le regala días de gracia extra a la iglesia ni corre el
 * día de cobro acordado.
 */
export function sumarUnMes(fecha: Date): Date {
  const diaOriginal = fecha.getUTCDate();
  const primerDiaMesSiguiente = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1);
  const diasEnMesSiguiente = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 2, 0),
  ).getUTCDate();

  return new Date(primerDiaMesSiguiente + (Math.min(diaOriginal, diasEnMesSiguiente) - 1) * MS_POR_DIA);
}

/** Suma `dias` días calendario a `fecha` (medianoche UTC del día resultante). */
export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(inicioDiaUtc(fecha) + dias * MS_POR_DIA);
}

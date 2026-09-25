import { PlanIglesia } from '@prisma/client';

/**
 * Topes de uso por plan comercial. `maxDepartamentosFinancieros: 0` significa "sin
 * acceso al módulo de subdepartamentos", no solo un límite bajo (ver
 * DepartamentosService#create). Estrategia comercial tipo "bencina 93/95/97":
 * siempre empujar al plan más caro (PRO) como el completo.
 */
export const PLAN_LIMITS: Record<PlanIglesia, { maxUsuarios: number; maxDepartamentosFinancieros: number }> =
  {
    [PlanIglesia.BASICO]: { maxUsuarios: 3, maxDepartamentosFinancieros: 0 },
    [PlanIglesia.MEDIO]: { maxUsuarios: 8, maxDepartamentosFinancieros: 0 },
    [PlanIglesia.PRO]: { maxUsuarios: 15, maxDepartamentosFinancieros: 10 },
  };

export const PLAN_LABEL: Record<PlanIglesia, string> = {
  [PlanIglesia.BASICO]: 'Básico',
  [PlanIglesia.MEDIO]: 'Medio',
  [PlanIglesia.PRO]: 'Pro',
};

export const CONTACTO_VENTAS_EMAIL = 'contacto@evangelic.app';

export type PlanIglesia = "BASICO" | "MEDIO" | "PRO";

export const PLAN_LABEL: Record<PlanIglesia, string> = {
  BASICO: "Básico",
  MEDIO: "Medio",
  PRO: "Pro",
};

export const PLAN_LIMITES: Record<PlanIglesia, { usuarios: number; departamentos: number }> = {
  BASICO: { usuarios: 3, departamentos: 0 },
  MEDIO: { usuarios: 8, departamentos: 0 },
  PRO: { usuarios: 15, departamentos: 10 },
};

export function planTieneSubdepartamentos(plan: PlanIglesia): boolean {
  return PLAN_LIMITES[plan].departamentos > 0;
}

export const PLAN_BADGE_CLASSES: Record<PlanIglesia, string> = {
  BASICO: "bg-slate-100 text-slate-700",
  MEDIO: "bg-sky-100 text-sky-700",
  PRO: "bg-violet-100 text-violet-700",
};

/** Ver backend/src/common/utils/calcular-facturacion.ts — el semáforo se calcula
 * siempre en el backend, el frontend solo lo pinta (ver frontend/prompt.md). */
export interface EstadoFacturacion {
  proximaFacturacion: string;
  diasParaFacturacion: number;
  color: "VERDE" | "AMARILLO" | "ROJO";
  enMora: boolean;
  diasEnMora: number;
  puedeOcultar: boolean;
}

export const FACTURACION_COLOR_CLASSES: Record<EstadoFacturacion["color"], string> = {
  VERDE: "bg-emerald-100 text-emerald-700",
  AMARILLO: "bg-amber-100 text-amber-700",
  ROJO: "bg-destructive/10 text-destructive",
};

/** Mismo semáforo que `FACTURACION_COLOR_CLASSES` pero como color de borde
 * sólido en vez de fondo de badge — para la franja izquierda de cada fila en
 * `/superadmin/iglesias` (hace escaneable la salud de cobro de todo el
 * portafolio de un vistazo, sin depender de leer una badge a mitad de fila). */
export const FACTURACION_BAR_CLASSES: Record<EstadoFacturacion["color"], string> = {
  VERDE: "border-l-emerald-500",
  AMARILLO: "border-l-amber-500",
  ROJO: "border-l-destructive",
};

export interface LimitesIglesia {
  usuarios: { actuales: number; maximo: number };
  departamentosFinancieros: { actuales: number; maximo: number };
}

export interface MiembroEquipo {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: "USUARIO";
  activo: boolean;
  createdAt: string;
}

/** Estadísticas de actividad/uso de una iglesia, bloque nuevo de
 * `GET /iglesias/:id` (ver frontend/prompt.md sección 5). Deliberadamente sin
 * nada financiero: el SuperAdmin no ve el detalle financiero/operativo
 * interno de una iglesia (regla de negocio explícita, no un olvido) — el
 * backend nunca manda montos/movimientos acá. No confundir con la
 * "Facturación" que sí sigue viviendo en `IglesiaDetalle.facturacion`: esa es
 * el cobro de la plataforma a la iglesia (nivel Evangelicapp), no el manejo
 * interno de plata de la propia iglesia (nivel `/finanzas`, ese sí vedado). */
export interface EstadisticasIglesia {
  usuariosActivosHoy: number;
  usuariosActivosSemana: number;
  eventos: { total: number; proximos30d: number };
  integrantesTotal: number;
  certificados: {
    total: number;
    porTipo: import("@/components/dashboard/types").CertificadosPorTipo;
    porMes: import("@/components/dashboard/types").PuntoMes[];
  };
  notasPendientes: number;
}

export interface IglesiaDetalle {
  id: string;
  nombre: string;
  comuna: string;
  region: string;
  direccion: string | null;
  logoUrl: string | null;
  estado: "ACTIVA" | "SUSPENDIDA" | "INACTIVA";
  visitantesPromedio: number | null;
  createdAt: string;
  ultimoPagoAt: string | null;
  plan: PlanIglesia;
  facturacion: EstadoFacturacion;
  limites: LimitesIglesia;
  // Este endpoint (`/iglesias/:id`, exclusivo de SUPER_ADMIN) no está
  // mencionado explícitamente en el brief de `frontend/prompt.md`. Se deja el
  // nombre del campo (`pastor`) sin tocar por no tener confirmación de que
  // haya cambiado, pero el valor literal de `rol` sí se actualiza a `MANAGER`
  // porque ese es un enum global del backend y "PASTOR" ya no existe en él —
  // dejarlo en "PASTOR" garantizaría un mismatch de tipos contra la respuesta
  // real. Señalado para confirmar con backend en vez de asumido en silencio.
  pastor: (Omit<MiembroEquipo, "rol"> & { rol: "MANAGER" }) | null;
  equipo: MiembroEquipo[];
  estadisticas: EstadisticasIglesia;
}

/** Forma compacta de iglesia usada tanto en `iglesiasRecientes`
 * (`GET /superadmin/dashboard`) como base de `IglesiaListItem`
 * (`GET /iglesias`) — ver frontend/prompt.md secciones 3 y 4. */
export interface IglesiaResumen {
  id: string;
  nombre: string;
  comuna: string;
  region: string;
  logoUrl: string | null;
  estado: "ACTIVA" | "SUSPENDIDA" | "INACTIVA";
  plan: PlanIglesia;
  createdAt: string;
  pastor: { nombre: string; apellido: string; email: string } | null;
}

/** `GET /iglesias` (nuevo, SuperAdmin) — mismo `IglesiaResumen` + el semáforo
 * de facturación por fila (ver frontend/prompt.md sección 4). */
export interface IglesiaListItem extends IglesiaResumen {
  facturacion: EstadoFacturacion;
}

/** `GET /iglesias/:id/historial-pagos` (SuperAdmin) — más reciente primero; el
 * último elemento del array es siempre la fecha de adquisición del plan (ver
 * frontend/prompt.md). Sin monto: el modelo de precios todavía no está
 * definido. */
export interface HistorialPagoItem {
  id: string;
  fecha: string;
  createdAt: string;
  registradoPor: { id: string; nombre: string; apellido: string } | null;
}

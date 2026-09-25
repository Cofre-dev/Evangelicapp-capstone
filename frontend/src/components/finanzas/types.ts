export type TipoMovimiento = "INGRESO" | "EGRESO";
export type MedioPago = "EFECTIVO" | "TRANSFERENCIA";
export type AccionAuditoria = "CREACION" | "EDICION" | "ELIMINACION";

export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

export const ACCION_AUDITORIA_LABEL: Record<AccionAuditoria, string> = {
  CREACION: "Creó",
  EDICION: "Editó",
  ELIMINACION: "Eliminó",
};

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoMovimiento;
}

/** Sub-libro opcional de finanzas (ej. Música, Diaconía). Solo el MANAGER lo administra. */
export interface Departamento {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  iglesiaId: string;
  creadoPorId: string;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  /** Prisma.Decimal viaja como string por JSON — convertir con Number() al usar. */
  monto: string;
  fecha: string;
  descripcion: string;
  medioPago: MedioPago;
  categoria: Categoria;
  /** null = movimiento de finanzas general. Inmutable tras crear el movimiento. */
  departamento: Departamento | null;
  createdAt: string;
  updatedAt: string;
  creadoPor: { nombre: string; apellido: string } | null;
}

export interface MovimientoAuditLog {
  id: string;
  accion: AccionAuditoria;
  createdAt: string;
  movimientoId: string;
  /** Sin FK (mismo criterio que movimientoId), agregado para poder filtrar logs
   * por departamento de forma estable aunque el departamento se haya renombrado
   * después de la acción registrada. */
  departamentoId: string | null;
  usuario: { nombre: string; apellido: string } | null;
  snapshot: {
    tipo: TipoMovimiento;
    monto: number;
    descripcion: string;
    medioPago: MedioPago;
    fecha: string;
    categoria: string;
    /** Nombre del departamento al momento de la acción (o null si era general) —
     * puede no coincidir con el nombre actual si el departamento fue renombrado. */
    departamento: string | null;
  };
}

export interface FinanzasDashboardPorDepartamento {
  departamentoId: string;
  nombre: string;
  ingresos: number;
  egresos: number;
  balance: number;
}

export interface FinanzasDashboard {
  totales: { ingresos: number; egresos: number; balance: number };
  porCategoriaIngreso: { categoria: string; total: number }[];
  porCategoriaEgreso: { categoria: string; total: number }[];
  /** Desglose informativo por departamento. Viene vacío (`[]`) si se filtró
   * con `general=true`. Si se filtró por un `departamentoId` puntual, viene
   * igual pero con un solo elemento (ese departamento) cuyos números son
   * idénticos a `totales` — redundante, así que el frontend solo debe pintar
   * este desglose cuando el contexto es "general" (confirmado por backend,
   * ver frontend/prompt.md sección "Respuesta de backend"). */
  porDepartamento?: FinanzasDashboardPorDepartamento[];
}

export interface ImportarMovimientosResultado {
  importados: number;
  categoriasCreadas: string[];
}

export interface ImportarMovimientosErrorFila {
  fila: number;
  mensaje: string;
}

/**
 * Destino de un movimiento/categoría: finanzas general o un departamento
 * puntual. No existe un tercer estado "todo" en las pantallas de trabajo — el
 * consolidado (sin filtro) solo se usa puntualmente para el dashboard general
 * y el botón "Exportar todo consolidado" (ver `frontend/prompt.md` secciones
 * 1.4 y 4).
 */
export type ContextoFinanzas = { tipo: "general" } | { tipo: "departamento"; id: string };

/** Query param que escopa movimientos/categorías/logs/exportar a un destino puntual. */
export function contextoQueryParam(contexto: ContextoFinanzas): string {
  return contexto.tipo === "general" ? "general=true" : `departamentoId=${contexto.id}`;
}

export const formatoCLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

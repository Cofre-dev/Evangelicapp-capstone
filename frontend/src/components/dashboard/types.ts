import type { IglesiaResumen, PlanIglesia } from "@/components/iglesias/types";

/** Punto de una serie mensual (`"YYYY-MM"`) — siempre 6 puntos, rellenado con
 * 0 donde no hay datos (ver frontend/prompt.md). Parsear con `parseMesLocal`
 * de `./format`, nunca con `new Date(mes)` directo. */
export interface PuntoMes {
  mes: string;
  cantidad: number;
}

/** Punto de una serie diaria (`"YYYY-MM-DD"`) — siempre 30 puntos. Parsear con
 * `parseFechaLocal` de `./format`, nunca con `new Date(fecha)` directo (ver
 * comentario en ese archivo sobre el corrimiento de fecha en UTC-3/-4). */
export interface PuntoDia {
  fecha: string;
  sesiones: number;
}

/** Punto de una serie horaria (0-23) — siempre 24 puntos, en hora **UTC**
 * (confirmado en frontend/prompt.md), no hora de Chile. */
export interface PuntoHora {
  hora: number;
  sesiones: number;
}

export interface CertificadosPorTipo {
  matrimonios: number;
  bautizos: number;
  defunciones: number;
  presentaciones: number;
}

export interface SuperAdminDashboardResponse {
  totales: {
    iglesias: number;
    iglesiasActivas: number;
    iglesiasSuspendidas: number;
    pastores: number;
    usuariosActivosHoy: number;
    usuariosActivosSemana: number;
    certificadosEmitidos: number;
  };
  porRegion: { region: string; cantidad: number }[];
  porPlan: { plan: PlanIglesia; cantidad: number }[];
  certificados: {
    porTipo: CertificadosPorTipo;
    porMes: PuntoMes[];
  };
  actividad: {
    porDia: PuntoDia[];
    porHora: PuntoHora[];
    tiempoPromedioSesionMinutos: number;
  };
  iglesiasRecientes: IglesiaResumen[];
}

/** Punto de tiempo de uso personal (`"YYYY-MM-DD"` + minutos) — siempre 7
 * puntos (una semana). Mismo criterio de parseo que `PuntoDia`. */
export interface PuntoTiempoDia {
  fecha: string;
  minutos: number;
}

export interface ManagerDashboardResponse {
  personal: {
    tiempoHoyMinutos: number;
    tiempoSemanaMinutos: number;
    tiempoPorDia: PuntoTiempoDia[];
    tareasPendientes: number;
  };
  agenda: { proximosEventos: number; eventosPorMes: PuntoMes[] } | null;
  ceremonias: { total: number; porTipo: CertificadosPorTipo; porMes: PuntoMes[] } | null;
  integrantes: { total: number; nuevosUltimoMes: number } | null;
  /** Solo viene para rol MANAGER — nunca para USUARIO (ver frontend/prompt.md). */
  equipo: { usuariosActivosHoy: number; usuariosActivosSemana: number; totalUsuarios: number } | null;
}

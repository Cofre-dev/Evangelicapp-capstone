export type TipoEvento = "CULTO" | "REUNION" | "LIMPIEZA" | "OTRO";
export type EstadoConfirmacionPredicador = "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";
export type EstadoAsistencia = "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";

export interface Predicador {
  id: string;
  nombre: string | null;
  email: string;
  estado: EstadoConfirmacionPredicador;
  respondidoAt: string | null;
}

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoEvento;
  fechaInicio: string;
  fechaFin: string;
  ubicacion: string | null;
  colorEtiqueta: string | null;
  predicadores: Predicador[];
  /** Refleja si se envió (o se va a enviar) convocatoria por correo a los Integrantes. Solo se define al crear. */
  notificarIntegrantes: boolean;
}

/**
 * Payload del evento de socket `predicador:respondio` (Realtime, ver
 * frontend/prompt.md) — se dispara cuando un predicador confirma o rechaza
 * desde el link público del email. `predicadorId` matchea contra `Predicador.id`.
 */
export interface PredicadorRespondioPayload {
  eventoId: string;
  predicadorId: string;
  nombre: string;
  email: string;
  estado: EstadoConfirmacionPredicador;
  respondidoAt: string;
}

/**
 * Payload del evento de Realtime `asistencia:respondida` (canal privado
 * `tenant:<iglesiaId>`, ver `src/hooks/use-realtime.ts` y `frontend/prompt.md`)
 * — se dispara cuando un integrante responde la convocatoria a un evento desde
 * el link público del correo. `integranteId` matchea contra
 * `AsistenciaResumen.integranteId`. `estado` nunca es `PENDIENTE` acá (solo se
 * emite al responder), pero es asignable a `EstadoAsistencia`.
 */
export interface AsistenciaRespondidaPayload {
  eventoId: string;
  integranteId: string;
  nombreCompleto: string;
  estado: Extract<EstadoAsistencia, "CONFIRMADO" | "RECHAZADO">;
  respondidoAt: string;
}

/**
 * Shape devuelto por `GET /agenda/asistencias/:token` y
 * `POST /agenda/asistencias/:token/responder` — ruta pública sin sesión,
 * análoga a la de predicadores pero para el RSVP de Integrantes.
 */
export interface AsistenciaEvento {
  nombre: string;
  email: string;
  estado: EstadoAsistencia;
  respondidoAt: string | null;
  evento: {
    titulo: string;
    descripcion: string | null;
    fechaInicio: string;
    fechaFin: string;
    ubicacion: string | null;
  };
  iglesia: {
    nombre: string;
    logoUrl: string | null;
  };
  /** Ya viene completamente armado y URL-encoded por el backend — usar tal cual en un <a href>. */
  googleCalendarLink: string;
}

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  CULTO: "Culto",
  REUNION: "Reunión",
  LIMPIEZA: "Limpieza",
  OTRO: "Otro",
};

export const TIPO_EVENTO_CHIP_CLASS: Record<TipoEvento, string> = {
  CULTO: "bg-sky-100 text-sky-700 border-sky-200",
  REUNION: "bg-violet-100 text-violet-700 border-violet-200",
  LIMPIEZA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  OTRO: "bg-slate-100 text-slate-700 border-slate-200",
};

export const ESTADO_PREDICADOR_LABEL: Record<EstadoConfirmacionPredicador, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  RECHAZADO: "Rechazado",
};

export const ESTADO_PREDICADOR_CLASS: Record<EstadoConfirmacionPredicador, string> = {
  PENDIENTE: "bg-muted text-muted-foreground",
  CONFIRMADO: "bg-emerald-100 text-emerald-700",
  RECHAZADO: "bg-red-100 text-red-700",
};

export const ESTADO_ASISTENCIA_LABEL: Record<EstadoAsistencia, string> = {
  PENDIENTE: "Sin responder",
  CONFIRMADO: "Confirmó",
  RECHAZADO: "Rechazó",
};

export const ESTADO_ASISTENCIA_CLASS: Record<EstadoAsistencia, string> = {
  PENDIENTE: "bg-muted text-muted-foreground",
  CONFIRMADO: "bg-emerald-100 text-emerald-700",
  RECHAZADO: "bg-red-100 text-red-700",
};

/** Shape de `GET /agenda/eventos/:id/asistencias` (MANAGER/USUARIO con módulo AGENDA). */
export interface AsistenciaResumen {
  integranteId: string;
  nombreCompleto: string;
  email: string;
  estado: EstadoAsistencia;
  respondidoAt: string | null;
}

/**
 * Shape de `GET /agenda/eventos/:id/convocatoria` (MANAGER/USUARIO con módulo
 * AGENDA) — vista unificada de predicadores invitados + RSVP de la
 * congregación para un evento (ver `frontend/prompt.md`, bloque A).
 * `predicadores` reusa `Predicador` (incluye email); `asistencias` reusa
 * `AsistenciaResumen`.
 */
export interface ConvocatoriaResumen {
  predicadores: Predicador[];
  asistencias: AsistenciaResumen[];
}

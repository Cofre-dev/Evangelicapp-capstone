export type EstadoTarea = "PENDIENTE" | "EN_REVISION" | "COMPLETADA";
export type TipoNota = "RECORDATORIO" | "NOTA";

export interface Nota {
  id: string;
  tipo: TipoNota;
  titulo: string;
  descripcion: string | null;
  fechaLimite: string | null;
  estado: EstadoTarea;
  archivado: boolean;
  createdAt: string;
  updatedAt: string;
  creadoPor: { nombre: string; apellido: string } | null;
  asignadoA: { id: string; nombre: string; apellido: string } | null;
}

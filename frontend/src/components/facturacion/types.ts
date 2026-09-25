import type { EstadoFacturacion, LimitesIglesia, PlanIglesia } from "@/components/iglesias/types";

export interface FacturacionResponse {
  id: string;
  nombre: string;
  estado: "ACTIVA" | "SUSPENDIDA" | "INACTIVA";
  plan: PlanIglesia;
  facturacion: EstadoFacturacion;
  limites: LimitesIglesia;
}

import { Baby, Droplet, Flower2, Heart, type LucideIcon } from "lucide-react";

export type CeremoniaTipo = "matrimonios" | "bautizos" | "defunciones" | "presentaciones";

/** Definición de un campo de texto del formulario de un submódulo de ceremonias. */
export interface CampoCeremonia {
  /** Nombre del campo tal como lo espera el DTO del backend. */
  name: string;
  label: string;
  maxLength: number;
  placeholder?: string;
  /**
   * Prellenar (editable) con el nombre del pastor de la sesión. Solo tiene efecto si
   * quien está creando el registro está logueado como MANAGER (el dueño de cuenta,
   * antes PASTOR) — si es un USUARIO no hay forma de saber, del lado del cliente,
   * quién es el pastor de la iglesia (la sesión no trae esa info y no hay endpoint
   * expuesto a USUARIO para consultarlo), así que se deja en blanco en ese caso.
   */
  prellenarPastor?: boolean;
}

export interface ConfigCeremonia {
  tipo: CeremoniaTipo;
  /** Título singular, ej. "Matrimonio". */
  nombreSingular: string;
  /** Título plural, ej. "Matrimonios". */
  nombrePlural: string;
  /** Campos del formulario (sin contar `fecha`, que es común a los 4 submódulos), en el orden en que deben mostrarse. */
  campos: CampoCeremonia[];
  /** Nombre(s) de campo(s) que arman el "nombre principal" mostrado en el listado. */
  camposNombrePrincipal: string[];
  /**
   * Ícono del submódulo (`lucide-react`), reutilizado en todos los lugares donde este
   * tipo de ceremonia necesita representación visual (estado vacío del listado, hero
   * del detalle) — mismo criterio de "un ícono por concepto" que el resto de la app.
   */
  icon: LucideIcon;
}

/**
 * Registro genérico de una ceremonia. Los 4 submódulos comparten estos campos base;
 * el resto de las claves (declaradas por submódulo en `ConfigCeremonia.campos`) viajan
 * como string y se acceden dinámicamente.
 */
export interface RegistroCeremonia {
  id: string;
  folio: number;
  iglesiaId: string;
  creadoPorId: string;
  createdAt: string;
  updatedAt: string;
  fecha: string;
  [campo: string]: string | number;
}

export const CEREMONIA_CONFIGS: Record<CeremoniaTipo, ConfigCeremonia> = {
  matrimonios: {
    tipo: "matrimonios",
    nombreSingular: "Matrimonio",
    nombrePlural: "Matrimonios",
    campos: [
      { name: "nombreNovio", label: "Nombre del novio", maxLength: 150 },
      { name: "nombreNovia", label: "Nombre de la novia", maxLength: 150 },
      { name: "nombrePastor", label: "Pastor oficiante", maxLength: 150, prellenarPastor: true },
      { name: "ciudad", label: "Ciudad", maxLength: 100, placeholder: "Ej: Santiago" },
    ],
    camposNombrePrincipal: ["nombreNovio", "nombreNovia"],
    icon: Heart,
  },
  bautizos: {
    tipo: "bautizos",
    nombreSingular: "Bautizo",
    nombrePlural: "Bautizos",
    campos: [
      { name: "nombrePersona", label: "Nombre de la persona", maxLength: 150 },
      { name: "nombrePastor", label: "Pastor oficiante", maxLength: 150, prellenarPastor: true },
      { name: "ciudad", label: "Ciudad", maxLength: 100, placeholder: "Ej: Santiago" },
    ],
    camposNombrePrincipal: ["nombrePersona"],
    icon: Droplet,
  },
  defunciones: {
    tipo: "defunciones",
    nombreSingular: "Defunción",
    nombrePlural: "Defunciones",
    campos: [
      { name: "nombreDifunto", label: "Nombre del difunto", maxLength: 150 },
      { name: "nombrePastor", label: "Pastor oficiante", maxLength: 150, prellenarPastor: true },
      { name: "ciudad", label: "Ciudad", maxLength: 100, placeholder: "Ej: Santiago" },
    ],
    camposNombrePrincipal: ["nombreDifunto"],
    icon: Flower2,
  },
  presentaciones: {
    tipo: "presentaciones",
    nombreSingular: "Presentación",
    nombrePlural: "Presentaciones",
    campos: [
      { name: "nombreNino", label: "Nombre del niño/a", maxLength: 150 },
      {
        name: "nombrePadres",
        label: "Nombre de los padres",
        maxLength: 200,
        placeholder: "Ej: Andrea Sepúlveda y Cristián Sepúlveda",
      },
      { name: "nombrePastor", label: "Pastor oficiante", maxLength: 150, prellenarPastor: true },
      { name: "ciudad", label: "Ciudad", maxLength: 100, placeholder: "Ej: Santiago" },
    ],
    camposNombrePrincipal: ["nombreNino"],
    icon: Baby,
  },
};

/** Nombre principal mostrado en el listado (ej. "Juan y María" para un matrimonio). */
export function nombrePrincipal(config: ConfigCeremonia, registro: RegistroCeremonia): string {
  return config.camposNombrePrincipal
    .map((campo) => String(registro[campo] ?? "").trim())
    .filter(Boolean)
    .join(" y ");
}

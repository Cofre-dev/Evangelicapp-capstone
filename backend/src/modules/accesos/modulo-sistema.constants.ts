import { ModuloSistema } from '@prisma/client';

/** Etiquetas legibles para pintar la pantalla de Accesos del frontend. */
export const MODULE_LABELS: Record<ModuloSistema, string> = {
  [ModuloSistema.AGENDA]: 'Agenda',
  [ModuloSistema.FINANZAS]: 'Finanzas',
  [ModuloSistema.CEREMONIAS]: 'Ceremonias',
  [ModuloSistema.INTEGRANTES]: 'Integrantes',
};

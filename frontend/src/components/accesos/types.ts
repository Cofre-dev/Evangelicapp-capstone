/**
 * Módulo delegable tal como lo describe el catálogo (`GET /accesos/catalogo`,
 * ver frontend/prompt.md). A propósito NO hay un union type fijo de ids
 * (`"AGENDA" | "FINANZAS" | ...`) acá: la tabla de Accesos debe poder mostrar
 * una columna nueva si el backend agrega un módulo al catálogo sin que el
 * frontend necesite un cambio de código para esa pantalla en particular (sí
 * lo necesita el navbar/home, que sí mapean id -> ruta/ícono, ver
 * `MODULO_NAV_ITEM` en navbar.tsx).
 */
export interface ModuloCatalogo {
  id: string;
  label: string;
}

/** Usuario con rol USUARIO de la iglesia, con los módulos que tiene otorgados
 * hoy (`GET /accesos/usuarios`). */
export interface UsuarioAccesos {
  id: string;
  nombre: string;
  apellido: string;
  username: string;
  fotoUrl: string | null;
  activo: boolean;
  modulos: string[];
}

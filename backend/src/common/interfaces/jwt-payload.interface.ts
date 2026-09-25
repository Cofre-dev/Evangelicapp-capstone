import { ModuloSistema, Rol } from '@prisma/client';

/**
 * Forma del access token. `iglesiaId` es null únicamente para SUPER_ADMIN.
 * Todo guard/service que necesite aislar por tenant lee este campo,
 * nunca un iglesiaId enviado por el cliente en body/query/params.
 *
 * `modulos` solo tiene contenido real para USUARIO (los módulos que el MANAGER
 * le otorgó vía AccesoModulo); para MANAGER/SUPER_ADMIN siempre es `[]`
 * porque su acceso no se decide por esta lista (ver ModuloAccessGuard).
 */
export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  iglesiaId: string | null;
  modulos: ModuloSistema[];
}

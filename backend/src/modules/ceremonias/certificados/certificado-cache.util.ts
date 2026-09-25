import { createHash } from 'crypto';

export type TipoCertificado = 'bautizos' | 'matrimonios' | 'defunciones' | 'presentaciones';

interface CertificadoCacheKeyParams {
  tipo: TipoCertificado;
  id: string;
  actualizadoEn: Date;
  logoUrl: string | null;
}

/**
 * Nombre del objeto cacheado en el bucket `certificados-ceremonias`. Cambia (invalidando
 * el caché) si se edita el registro de la ceremonia (`actualizadoEn`) o si cambia el logo
 * de la iglesia (`logoUrl` trae un nombre de archivo nuevo por subida — ver Fase 1 de
 * docs/supabase.md) — deliberadamente NO usa `Iglesia.updatedAt`, que cambia por cosas sin
 * relación con el certificado (facturación, datos de contacto) e invalidaría de más.
 *
 * Una versión vieja queda huérfana en el bucket cuando el registro o el logo cambian — no
 * se borra activamente, mismo criterio de tolerancia que el resto del storage (ver
 * `SupabaseStorageService`); el volumen esperado (ediciones de un certificado ya emitido
 * son raras) no justifica la complejidad de un cleanup.
 */
export function resolverObjectNameCertificado({
  tipo,
  id,
  actualizadoEn,
  logoUrl,
}: CertificadoCacheKeyParams): string {
  const hash = createHash('sha256')
    .update(`${id}:${actualizadoEn.getTime()}:${logoUrl ?? ''}`)
    .digest('hex')
    .slice(0, 16);

  return `${tipo}/${id}-${hash}.pdf`;
}

import { BadRequestException } from '@nestjs/common';
import { memoryStorage, type FileFilterCallback } from 'multer';
import type { ImageResizeOptions } from '../../supabase/supabase-storage.service';

/**
 * Única fuente de verdad de mimetypes permitidos y su extensión de guardado.
 * La extensión del objeto en el bucket SIEMPRE sale de este mapeo (mimetype ya
 * validado por fileFilter), nunca de `file.originalname` — ese nombre lo
 * controla quien sube el archivo, y usarlo permitiría guardar un archivo con
 * contenido cualquiera bajo una extensión ejecutable/servible como `.html`.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const MAX_FOTO_SIZE_BYTES = 3 * 1024 * 1024;

/** Mismo criterio que `FOTO_PERFIL_RESIZE`: avatar de tamaño fijo en el censo, recorte por encima de preservar bordes. */
export const FOTO_INTEGRANTE_RESIZE: ImageResizeOptions = { width: 256, height: 256, fit: 'cover' };

/** Extensión de guardado para el nombre del objeto en Supabase Storage (bucket `fotos-integrantes`). */
export function resolverExtensionFotoIntegrante(mimetype: string): string {
  const extension = MIME_EXTENSIONS[mimetype];
  if (!extension) {
    // No debería pasar: fileFilter ya rechazó cualquier mimetype fuera del mapeo.
    throw new BadRequestException('La foto debe ser PNG, JPG o WEBP');
  }
  return extension;
}

/**
 * Buffer en memoria: el archivo se sube a Supabase Storage, no queda en disco.
 * Este endpoint es público (landing del QR), así que el límite de tamaño y
 * el fileFilter son la única barrera contra archivos maliciosos o abusivos.
 */
export const integranteFotoMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (_req, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      callback(new BadRequestException('La foto debe ser PNG, JPG o WEBP'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_FOTO_SIZE_BYTES },
};

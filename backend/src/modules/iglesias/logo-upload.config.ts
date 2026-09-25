import { BadRequestException } from '@nestjs/common';
import { memoryStorage, type FileFilterCallback } from 'multer';
import type { ImageResizeOptions } from '../../supabase/supabase-storage.service';

/**
 * Única fuente de verdad de mimetypes permitidos y su extensión de guardado.
 * La extensión del objeto en el bucket SIEMPRE sale de este mapeo (mimetype ya
 * validado por fileFilter), nunca de `file.originalname` — ese nombre lo
 * controla quien sube el archivo, y usarlo permitiría guardar un archivo con
 * contenido cualquiera bajo una extensión ejecutable/servible como `.html`.
 *
 * Solo PNG (no JPG/WEBP como antes): el logo se embebe en los certificados de
 * ceremonias vía pdfkit (`certificado-pdf.builder.ts`), que solo soporta
 * PNG/JPEG — un logo WEBP se omitía en silencio del certificado. Reducir a un
 * único formato aceptado evita ese caso, tanto en el alta por SUPER_ADMIN
 * (IglesiasController.create) como en la edición por el MANAGER
 * (MiIglesiaController — reusa este mismo config).
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * `inside` (no `cover`): un logo no siempre es cuadrado y recortarlo perdería
 * contenido. El certificado PDF ya lo centra en un círculo de 64×64 vía `fit`
 * de pdfkit (`certificado-pdf.builder.ts`), así que da igual si el resultado
 * queda más angosto o más bajo que 512×512.
 */
export const LOGO_RESIZE: ImageResizeOptions = { width: 512, height: 512, fit: 'inside' };

/** Extensión de guardado para el nombre del objeto en Supabase Storage (bucket `logos-iglesias`). */
export function resolverExtensionLogo(mimetype: string): string {
  const extension = MIME_EXTENSIONS[mimetype];
  if (!extension) {
    // No debería pasar: fileFilter ya rechazó cualquier mimetype fuera del mapeo.
    throw new BadRequestException('El logo debe ser PNG');
  }
  return extension;
}

/** Buffer en memoria: el archivo se sube a Supabase Storage, no queda en disco. */
export const logoMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (_req, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      callback(new BadRequestException('El logo debe ser PNG'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_LOGO_SIZE_BYTES },
};

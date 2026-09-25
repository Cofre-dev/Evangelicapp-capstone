import { BadRequestException } from '@nestjs/common';
import { memoryStorage, type FileFilterCallback } from 'multer';
import type { ImageResizeOptions } from '../../supabase/supabase-storage.service';

/**
 * Mismo criterio que logo-upload.config.ts: la extensión del objeto en el bucket sale
 * siempre de este mapeo (mimetype ya validado por fileFilter), nunca de
 * `file.originalname`. A diferencia del logo de iglesia, la foto de perfil personal no
 * se usa en generación de certificados (pdfkit), así que mantiene el whitelist amplio.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const MAX_FOTO_SIZE_BYTES = 2 * 1024 * 1024;

/** `cover`: la foto de perfil se muestra en un avatar de tamaño fijo, así que
 * recortar para llenar el cuadrado importa más que preservar cada borde. */
export const FOTO_PERFIL_RESIZE: ImageResizeOptions = { width: 256, height: 256, fit: 'cover' };

/** Extensión de guardado para el nombre del objeto en Supabase Storage (bucket `fotos-perfil`). */
export function resolverExtensionFotoPerfil(mimetype: string): string {
  const extension = MIME_EXTENSIONS[mimetype];
  if (!extension) {
    // No debería pasar: fileFilter ya rechazó cualquier mimetype fuera del mapeo.
    throw new BadRequestException('La foto debe ser PNG, JPG o WEBP');
  }
  return extension;
}

/** Buffer en memoria: el archivo se sube a Supabase Storage, no queda en disco. */
export const fotoPerfilMulterOptions = {
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

import { BadRequestException } from '@nestjs/common';
import type { FileFilterCallback } from 'multer';
import { memoryStorage } from 'multer';

/**
 * El mimetype de un .csv es notoriamente inconsistente entre navegadores/SO (algunos
 * mandan `text/csv`, otros `application/vnd.ms-excel` o incluso `text/plain`). Por eso
 * se acepta si el mimetype coincide O si la extensión del archivo es .xlsx/.csv —
 * la validación real de contenido ocurre igual al parsear con exceljs en
 * FinanzasImportService, así que este filtro es solo la primera barrera.
 */
const MIME_TYPES_PERMITIDOS = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * memoryStorage (no diskStorage, a diferencia de logo-upload.config.ts): el archivo
 * solo se parsea en memoria con exceljs y nunca se persiste en disco.
 */
export const importMovimientosMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (_req, file: Express.Multer.File, callback: FileFilterCallback) => {
    const extensionValida = /\.(xlsx|csv)$/i.test(file.originalname);
    if (!MIME_TYPES_PERMITIDOS.has(file.mimetype) && !extensionValida) {
      callback(new BadRequestException('El archivo debe ser .xlsx o .csv'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_IMPORT_SIZE_BYTES },
};

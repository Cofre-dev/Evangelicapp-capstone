import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Traduce un P2002 (unique constraint) de Prisma a un mensaje legible,
 * distinguiendo qué campo chocó (username/email) cuando el modelo tiene
 * más de una columna única. Cualquier otro error se relanza sin tocar.
 */
export function translateUniqueConstraintError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return error;
  }

  const target = error.meta?.target as string[] | string | undefined;
  const targetStr = Array.isArray(target) ? target.join(',') : (target ?? '');

  if (targetStr.includes('username')) {
    return new ConflictException('Ese nombre de usuario ya está en uso');
  }
  if (targetStr.includes('email')) {
    return new ConflictException('Ya existe una cuenta con ese correo');
  }
  return new ConflictException('Ya existe un registro con ese valor');
}

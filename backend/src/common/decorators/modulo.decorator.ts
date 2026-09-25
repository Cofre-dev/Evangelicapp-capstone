import { SetMetadata } from '@nestjs/common';
import { ModuloSistema } from '@prisma/client';

export const MODULO_KEY = 'modulos';
export const Modulo = (...modulos: ModuloSistema[]) => SetMetadata(MODULO_KEY, modulos);

import { AsyncLocalStorage } from 'node:async_hooks';
import { Rol } from '@prisma/client';

/**
 * Contexto de tenant para RLS (Fase 8 de docs/supabase.md): lo que
 * `PrismaService` necesita en cada query para anteponer `set_config` (ver
 * prisma.service.ts) y que las policies de Postgres (`current_setting('app.…')`)
 * tengan de dónde leer `iglesiaId`/`rol`/`usuarioId`.
 *
 * `'SERVICE'` es un bypass explícito y acotado — nunca un rol real de Usuario —
 * para los pocos puntos que legítimamente necesitan leer/escribir sin estar
 * scopeados a una iglesia: login/refresh (todavía no hay identidad resuelta),
 * las 3 rutas públicas por token (predicadores/asistencias/registro de
 * integrantes) y el cron de facturación (cruza todas las iglesias a propósito).
 * `grep -r runAsService` encuentra todos los puntos de bypass de una sola vez.
 *
 * `inManagedTransaction` lo usa únicamente `PrismaService#withTenantTransaction`
 * para decirle al middleware de Prisma que no vuelva a envolver cada operación
 * dentro de una transacción interactiva ya abierta (ver comentario en
 * prisma.service.ts sobre por qué eso rompería la atomicidad).
 */
export interface TenantStore {
  usuarioId?: string;
  iglesiaId?: string | null;
  rol?: Rol | 'SERVICE';
  inManagedTransaction?: boolean;
}

const tenantContextStorage = new AsyncLocalStorage<TenantStore>();

/** Arranca un contexto nuevo. Lo usa `TenantContextMiddleware`, una vez por request. */
export function runWithTenantContext<T>(store: TenantStore, fn: () => T): T {
  return tenantContextStorage.run(store, fn);
}

export function getTenantContext(): TenantStore | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Muta el store activo (no crea uno nuevo) para que las queries que siguen en
 * el MISMO request —ya en curso dentro del `run()` del middleware— vean el
 * contexto actualizado. Usado por `JwtAuthGuard`/`RealtimeGateway` apenas
 * resuelven la identidad real del usuario, y por `AuthService#login` una vez
 * que ya conoce el `Usuario` completo.
 */
export function updateTenantContext(patch: Partial<TenantStore>): void {
  const store = tenantContextStorage.getStore();
  if (store) {
    Object.assign(store, patch);
  }
}

/**
 * Bypass explícito de tenant para operaciones que corren sin identidad de
 * Usuario autenticado. Anida un contexto nuevo — al terminar `fn`, el
 * contexto activo vuelve a ser el de antes (p. ej. login llama esto solo para
 * la búsqueda inicial por email; el resto del request sigue anónimo salvo que
 * algo más adelante llame `updateTenantContext` con la identidad real).
 */
export function runAsService<T>(fn: () => T): T {
  return tenantContextStorage.run({ rol: 'SERVICE' }, fn);
}

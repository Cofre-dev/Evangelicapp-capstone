import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { runWithTenantContext } from '../context/tenant-context';

/**
 * Fase 8 de docs/supabase.md: arranca el contexto de tenant (AsyncLocalStorage,
 * ver tenant-context.ts) para TODO el request, antes de que corra cualquier
 * guard/strategy — es lo que le permite a `JwtAuthGuard` mutar el contexto con
 * la identidad real y que esa mutación siga visible en el controller/servicio
 * que se ejecuta después.
 *
 * Anónimo por defecto (`{}`): sin un guard o un `runAsService` explícito
 * poblándolo, `current_setting('app.iglesia_id')` no resuelve nada y ninguna
 * policy de RLS hace match — fail-closed.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    runWithTenantContext({}, () => next());
  }
}

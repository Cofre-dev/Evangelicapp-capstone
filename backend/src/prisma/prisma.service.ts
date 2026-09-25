import { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantContext, runWithTenantContext } from '../common/context/tenant-context';

type TenantTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

/** `''` limpia el setting (nunca `null`: `set_config` exige texto). */
function tenantConfigValues() {
  const ctx = getTenantContext();
  return {
    usuarioId: ctx?.usuarioId ?? '',
    iglesiaId: ctx?.iglesiaId ?? '',
    rol: ctx?.rol ?? '',
  };
}

/**
 * Fase 8 de docs/supabase.md (RLS): construye el cliente extendido sobre un
 * `PrismaClient` crudo (`raw`).
 *
 * Usa Client Extensions (`$extends`), no Client Middleware (`$use`) — versión
 * anterior de este archivo, que rompía en runtime con "All elements of the
 * array need to be Prisma Client promises": `$use` le pasa a `next(params)`
 * una ejecución YA disparada (una Promise nativa), no la promesa perezosa que
 * `$transaction([...])` necesita para batchear. `$allOperations` de
 * extensions sí entrega esa promesa perezosa correcta vía `query(args)` — es
 * el patrón que la propia documentación de Prisma usa para RLS
 * (`prisma/prisma-client-extensions/row-level-security`), confirmado contra
 * ella antes de este cambio.
 *
 * `$extends` devuelve un objeto NUEVO, no `raw` modificado in-place — por eso
 * `PrismaService` (abajo) se registra como *provider* de Nest vía una
 * `useFactory` que entrega este objeto extendido bajo el mismo token, en vez
 * de ser la clase que Nest instancia directamente. `createPrismaService()`
 * es el único punto que construye esto; `PrismaModule` lo conecta al DI.
 */
function buildExtendedClient(raw: PrismaClient) {
  return raw.$extends({
    name: 'tenant-rls',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const ctx = getTenantContext();

          // Ya estamos dentro de una transacción abierta por withTenantTransaction
          // (ver client.withTenantTransaction abajo): el set_config de esa
          // transacción ya corrió una sola vez como su primer statement y sigue
          // vigente para todo lo que pase dentro de ella (transaction-local, no
          // statement-local). Esto en la práctica no debería dispararse nunca —
          // `withTenantTransaction` usa `tx` del cliente RAW (no extendido), así
          // que sus operaciones no pasan por acá — pero queda como resguardo si
          // algún día una llamada usa por error el cliente extendido adentro de
          // una transacción ya gestionada.
          if (ctx?.inManagedTransaction) {
            return query(args);
          }

          const { usuarioId, iglesiaId, rol } = tenantConfigValues();
          const [, result] = await raw.$transaction([
            raw.$executeRaw`SELECT set_config('app.usuario_id', ${usuarioId}, true),
                                     set_config('app.iglesia_id', ${iglesiaId}, true),
                                     set_config('app.rol', ${rol}, true)`,
            query(args),
          ]);

          return result;
        },
      },
    },
    client: {
      async onModuleInit() {
        await raw.$connect();
      },
      async onModuleDestroy() {
        await raw.$disconnect();
      },
      enableShutdownHooks(app: INestApplication) {
        process.on('beforeExit', () => {
          void app.close();
        });
      },
      /**
       * Para los 8 sitios que ya abren su propia transacción interactiva
       * (`iglesias.service.ts`, `bautizos/presentaciones/defunciones/
       * matrimonios.service.ts`, `accesos.service.ts`,
       * `finanzas-import.service.ts`, `onboarding.service.ts`): reemplaza el
       * `this.prisma.$transaction(...)` que usaban antes. Fija `set_config`
       * una sola vez, como primer statement de la transacción, sobre el
       * cliente RAW — `tx` nunca pasa por `$allOperations` de arriba, así que
       * no hace falta (ni se puede) volver a envolver cada operación
       * individual dentro de ella.
       */
      async withTenantTransaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: TenantTransactionOptions,
      ): Promise<T> {
        const ctx = getTenantContext() ?? {};
        const { usuarioId, iglesiaId, rol } = tenantConfigValues();

        return runWithTenantContext({ ...ctx, inManagedTransaction: true }, () =>
          raw.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.usuario_id', ${usuarioId}, true),
                                         set_config('app.iglesia_id', ${iglesiaId}, true),
                                         set_config('app.rol', ${rol}, true)`;
            return fn(tx);
          }, options),
        );
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof buildExtendedClient>;

export function createPrismaService(): ExtendedPrismaClient {
  return buildExtendedClient(new PrismaClient());
}

/**
 * Token de DI para todo el resto del backend — sigue siendo
 * `constructor(private readonly prisma: PrismaService)` sin cambios en
 * ninguno de los ~30 archivos que ya lo inyectaban así. `PrismaModule`
 * registra el objeto real (el de `createPrismaService()`, con RLS aplicado)
 * bajo este mismo token vía `useFactory` — el `class` de acá abajo nunca se
 * instancia directamente, solo existe para que Nest tenga un token con el
 * que registrar/inyectar, y el `interface` con el mismo nombre (declaration
 * merging de TypeScript) le da al tipo `PrismaService` la forma completa del
 * cliente extendido (todos los `this.prisma.modelo.metodo()` existentes,
 * más `withTenantTransaction`), sin necesidad de repetir cada método a mano.
 */
// A propósito NO `extends PrismaClient`: su forma choca con la del cliente
// extendido (firmas de `$executeRaw`/etc. levemente distintas una vez que
// pasan por `$extends`) y TypeScript no puede fusionar una clase e interfaz
// del mismo nombre si se contradicen. La clase vacía solo aporta el token de
// runtime; el `interface` de abajo le da a `PrismaService` toda la forma del
// cliente extendido.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intencional: ver comentario arriba.
export class PrismaService {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-empty-object-type -- intencional: ver comentario arriba.
export interface PrismaService extends ExtendedPrismaClient {}

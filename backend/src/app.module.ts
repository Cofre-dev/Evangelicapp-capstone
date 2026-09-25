import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { RefreshOriginMiddleware } from './common/middleware/refresh-origin.middleware';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { AccesosModule } from './modules/accesos/accesos.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { AuthModule } from './modules/auth/auth.module';
import { CeremoniasModule } from './modules/ceremonias/ceremonias.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinanzasModule } from './modules/finanzas/finanzas.module';
import { IglesiasModule } from './modules/iglesias/iglesias.module';
import { IntegrantesModule } from './modules/integrantes/integrantes.module';
import { MiIglesiaModule } from './modules/mi-iglesia/mi-iglesia.module';
import { NotasModule } from './modules/notas/notas.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Techo global por IP para toda ruta que no tenga su propio @Throttle() más
    // estricto (ver AuthController, PredicadoresController, AsistenciasController,
    // IntegrantesRegistroController) — pensado para tráfico normal de la app
    // autenticada, no como protección fina de un endpoint puntual.
    ThrottlerModule.forRoot([{ name: 'default', ttl: minutes(1), limit: 120 }]),
    PrismaModule,
    SupabaseModule,
    RealtimeModule,
    AuthModule,
    OnboardingModule,
    UsuariosModule,
    AccesosModule,
    SuperAdminModule,
    IglesiasModule,
    MiIglesiaModule,
    DashboardModule,
    AgendaModule,
    FinanzasModule,
    NotasModule,
    IntegrantesModule,
    CeremoniasModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Fase 8 de docs/supabase.md (RLS): tiene que correr antes que cualquier guard —
    // arranca el AsyncLocalStorage que JwtAuthGuard/LocalAuthGuard pueblan con la
    // identidad real apenas la resuelven (ver tenant-context.ts).
    consumer.apply(TenantContextMiddleware).forRoutes('*');

    consumer
      .apply(CsrfMiddleware)
      .exclude(
        // Login: todavía no hay sesión/cookie que proteger.
        { path: 'auth/login', method: RequestMethod.POST },
        // Recuperación de contraseña: rutas públicas sin sesión (el token del
        // link del email es la autenticación). Si un usuario logueado abre la
        // landing en el mismo navegador, su cookie no debe exigir el header CSRF
        // que esa página nunca envía — mismo criterio que integrantes/registro.
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST },
        // Confirmación pública de predicadores: el token de un solo uso es la propia
        // autenticación; no depende de cookies de sesión (ver PredicadoresController).
        { path: 'agenda/predicadores/:token/responder', method: RequestMethod.POST },
        // RSVP público de integrantes a un evento (convocatoria por email): mismo caso
        // que la confirmación de predicadores — el token de un solo uso es la propia
        // autenticación (ver AsistenciasController).
        { path: 'agenda/asistencias/:token/responder', method: RequestMethod.POST },
        // Registro público de integrantes por QR: mismo caso — si un Pastor/Secretaria
        // logueado abre la landing en el mismo navegador, su cookie de sesión no debe
        // exigir el header CSRF que esa landing pública nunca envía.
        { path: 'integrantes/registro/:qrToken', method: RequestMethod.POST },
        // Refresh: es el endpoint que le da al frontend un csrfToken nuevo cuando perdió
        // el que tenía en memoria (ej. tras un F5) — exigirle CSRF para conseguir el
        // primer csrfToken es un candado que pide su propia llave. A diferencia de
        // auth/login, acá SÍ hay una cookie de sesión (refresh_token) que un atacante
        // cross-site puede lograr que viaje (SameSite=None en producción, ver
        // cookies.ts), así que esta exclusión por sí sola no basta — por eso se
        // complementa con RefreshOriginMiddleware más abajo, que exige que el header
        // Origin coincida con CORS_ORIGIN (no falsificable por el navegador).
        { path: 'auth/refresh', method: RequestMethod.POST },
      )
      .forRoutes('*');

    // Ver comentario en refresh-origin.middleware.ts: cierra el hueco que deja la
    // exclusión de CSRF de arriba para este único endpoint (blind CSRF vía
    // SameSite=None podía forzar una rotación no solicitada y, en el peor caso,
    // un logout global de la víctima por la detección de reuso de refresh token).
    consumer.apply(RefreshOriginMiddleware).forRoutes({ path: 'auth/refresh', method: RequestMethod.POST });
  }
}

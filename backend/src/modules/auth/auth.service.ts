import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EstadoIglesia, ModuloSistema, PlanIglesia, Rol, Usuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { runAsService, updateTenantContext } from '../../common/context/tenant-context';
import { CuentaBloqueadaException } from '../../common/exceptions/cuenta-bloqueada.exception';
import { IglesiaSuspendidaException } from '../../common/exceptions/iglesia-suspendida.exception';
import { calcularEstadoFacturacion } from '../../common/utils/calcular-facturacion';
import { generateCsrfToken } from '../../common/utils/generate-csrf-token';
import { generateSecureToken } from '../../common/utils/generate-secure-token';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SupabaseAuthService, SupabaseSession } from '../../supabase/supabase-auth.service';
import { SupabaseJwtVerifierService } from '../../supabase/supabase-jwt-verifier.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { FOTO_PERFIL_RESIZE, resolverExtensionFotoPerfil } from './foto-perfil-upload.config';

export type SafeUsuario = Omit<Usuario, 'password'> & {
  /** Para que el pastor/equipo vea el logo, nombre y plan de su iglesia en la app. */
  iglesia: { nombre: string; logoUrl: string | null; plan: PlanIglesia } | null;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Token double-submit para CSRF; viaja en una cookie legible por JS, no en el body. */
  csrfToken: string;
}

export interface LoginResponse extends AuthTokens {
  usuario: SafeUsuario & { modulos: ModuloSistema[] };
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
}

export type PerfilResponse = SafeUsuario & {
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
  /** Módulos otorgados leídos frescos de la BD (ver comentario en getProfile). */
  modulos: ModuloSistema[];
};

/** Lo que LocalStrategy adjunta a `req.user` en POST /auth/login — no es un JwtPayload. */
export interface ValidatedLogin {
  usuario: Usuario;
  session: SupabaseSession;
}

/** Vida del link de "olvidé mi contraseña" (ver requestPasswordReset). */
const PASSWORD_RESET_TTL_MINUTES = 60;

/** Anti-fuerza-bruta del login (ver validateUser). */
const LOGIN_LOCK_AFTER_ATTEMPTS = 3; // a los 3 fallos seguidos: bloqueo temporal
const LOGIN_LOCK_MINUTES = 10;
const LOGIN_DEACTIVATE_AFTER_ATTEMPTS = 5; // a los 5: se desactiva la cuenta

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly supabaseJwtVerifier: SupabaseJwtVerifierService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Usado por LocalStrategy. Login por `email` contra Supabase Auth (Fase 7 de
   * docs/supabase.md, corte final) — ya no bcrypt como fuente de verdad.
   * Mensaje de error genérico para no filtrar si el usuario existe — pero esa
   * discreción solo aplica ANTES de confirmar la contraseña. Una vez que la
   * contraseña ya es correcta, sí es intencional decirle explícitamente a un
   * usuario de una iglesia en mora por qué no puede entrar (ver
   * IglesiaSuspendidaException) en vez del mismo error genérico.
   *
   * Fallback auto-sanador: si Supabase rechaza pero bcrypt local confirma que
   * la contraseña es correcta, significa que el espejo de Supabase nunca se
   * creó o quedó con una contraseña vieja (ej. el usuario cambió su
   * contraseña antes de que `changePassword` sincronizara hacia Supabase).
   * Se sincroniza y se reintenta una sola vez — nunca se emite una sesión
   * basada solo en bcrypt, porque los tokens de sesión reales solo los emite
   * Supabase.
   */
  async validateUser(email: string, password: string): Promise<ValidatedLogin> {
    // Fase 8 de docs/supabase.md (RLS): todavía no hay ninguna identidad resuelta en este
    // punto (es justo lo que este método va a averiguar) — bypass explícito de tenant,
    // igual que hace GoTrue por dentro con su propio service_role para el mismo caso.
    return runAsService(() => this.validateUserComoServicio(email, password));
  }

  private async validateUserComoServicio(email: string, password: string): Promise<ValidatedLogin> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { iglesia: { select: { estado: true, proximaFacturacion: true } } },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Anti-fuerza-bruta: si la cuenta está bloqueada, ni siquiera se prueba la
    // contraseña. Un bloqueo activo revela que la cuenta existe — inherente al
    // mecanismo, no una fuga extra (quien puede bloquearla ya lo sabe).
    if (usuario.lockedUntil && usuario.lockedUntil.getTime() > Date.now()) {
      const minutosRestantes = Math.max(1, Math.ceil((usuario.lockedUntil.getTime() - Date.now()) / 60_000));
      throw new CuentaBloqueadaException(minutosRestantes);
    }

    let session = await this.trySupabaseSignIn(email, password);

    if (!session) {
      const passwordMatches = await bcrypt.compare(password, usuario.password);
      if (!passwordMatches) {
        throw await this.registrarLoginFallido(usuario);
      }

      if (usuario.supabaseUserId) {
        await this.supabaseAuth.syncPassword(usuario.supabaseUserId, password);
      } else {
        await this.supabaseAuth.mirrorUsuario(usuario, password);
      }

      session = await this.trySupabaseSignIn(email, password);
      if (!session) {
        this.logger.error(
          `Supabase Auth siguió rechazando a ${usuario.id} después de sincronizar la contraseña`,
        );
        throw new UnauthorizedException('Credenciales inválidas');
      }
    }

    // Reconcilia identidad: la sesión de Supabase puede pertenecer a una cuenta
    // espejada en otro contexto (ej. una fila que solo existía en el Postgres local
    // antes de apuntar a Supabase) cuyo app_metadata no coincide con esta fila real.
    // Sin esto, JwtAuthGuard recibiría un usuarioId que no existe en la base actual y
    // el login fallaría en la siguiente request pese al 200 de acá — bug real, visto
    // en producción de pruebas al migrar de Postgres local a Supabase.
    if (session.supabaseUserId !== usuario.supabaseUserId) {
      await this.supabaseAuth.relinkUsuario(session.supabaseUserId, usuario);
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { supabaseUserId: session.supabaseUserId },
      });
      usuario.supabaseUserId = session.supabaseUserId;

      // El `session` que ya teníamos quedó con el app_metadata VIEJO horneado dentro del
      // JWT — los tokens de Supabase son estáticos, actualizar el usuario no reemite los
      // que ya se entregaron. Hay que volver a autenticar para obtener un access token
      // que sí refleje el app_metadata recién corregido.
      const sessionReautenticada = await this.trySupabaseSignIn(email, password);
      if (!sessionReautenticada) {
        this.logger.error(
          `No se pudo reautenticar a ${usuario.id} después de re-vincular su cuenta de Supabase`,
        );
        throw new UnauthorizedException('Credenciales inválidas');
      }
      session = sessionReautenticada;
    }

    // Contraseña confirmada válida: se limpia el contador de intentos fallidos
    // (aunque la iglesia esté en mora — eso no es culpa de la credencial).
    if (usuario.failedLoginAttempts > 0 || usuario.lockedUntil) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (usuario.iglesia?.estado === EstadoIglesia.SUSPENDIDA) {
      const { diasEnMora } = calcularEstadoFacturacion(usuario.iglesia.proximaFacturacion);
      throw new IglesiaSuspendidaException(diasEnMora);
    }

    const { iglesia, ...usuarioSinIglesia } = usuario;
    return { usuario: usuarioSinIglesia, session };
  }

  /**
   * Intento de login con contraseña incorrecta contra una cuenta que SÍ existe.
   * Sube el contador y devuelve (no lanza — para `throw await ...`) la excepción:
   * a los 3 fallos seguidos, bloqueo de 10 min; a los 5, se desactiva la cuenta
   * (reactivación manual por el MANAGER/SuperAdmin). Un login exitoso,
   * `changePassword` o `resetPassword` dejan el contador en 0.
   */
  private async registrarLoginFallido(usuario: {
    id: string;
    failedLoginAttempts: number;
  }): Promise<HttpException> {
    const intentos = usuario.failedLoginAttempts + 1;

    if (intentos >= LOGIN_DEACTIVATE_AFTER_ATTEMPTS) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { failedLoginAttempts: intentos, lockedUntil: null, activo: false },
      });
      this.logger.warn(`Cuenta ${usuario.id} desactivada tras ${intentos} intentos de login fallidos`);
      // Genérico a propósito: en el 5º intento el llamador ya es casi seguro un
      // atacante; que un legítimo llegue acá implica haber ignorado el aviso del 3º.
      return new UnauthorizedException('Credenciales inválidas');
    }

    if (intentos >= LOGIN_LOCK_AFTER_ATTEMPTS) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          failedLoginAttempts: intentos,
          lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000),
        },
      });
      return new CuentaBloqueadaException(LOGIN_LOCK_MINUTES);
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { failedLoginAttempts: intentos },
    });
    return new UnauthorizedException('Credenciales inválidas');
  }

  /**
   * Envuelve signInWithPassword para distinguir "Supabase dijo que la
   * contraseña es incorrecta" (null, esperado) de "Supabase no respondió bien
   * por otra razón" (config faltante, proyecto caído) — este segundo caso se
   * loguea como error real, pero de cara al llamador se trata igual como "no
   * autenticado", dejando que el fallback bcrypt decida si igual puede
   * entrar. Nota: si Supabase está genuinamente inalcanzable, el login queda
   * bloqueado igual (los tokens de sesión solo los emite Supabase) — es una
   * dependencia aceptada del corte, no algo que este fallback intente evitar.
   */
  private async trySupabaseSignIn(email: string, password: string): Promise<SupabaseSession | null> {
    try {
      return await this.supabaseAuth.signInWithPassword(email, password);
    } catch (error) {
      this.logger.error(`signInWithPassword falló para ${email}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Login inicial (incluye el primer ingreso del pastor con credenciales temporales).
   * El frontend usa requiresPasswordChange / requiresOnboarding para decidir si
   * muestra el modal obligatorio antes de dejar entrar a cualquier otra pantalla.
   */
  async login(usuario: Usuario, session: SupabaseSession): Promise<LoginResponse> {
    // Fase 8 de docs/supabase.md (RLS): a diferencia de validateUser, acá ya se conoce la
    // identidad real (login la validó) — se usa esa, no un bypass de servicio, para que
    // las escrituras de abajo (SesionActividad, Usuario) queden correctamente scoped.
    updateTenantContext({ usuarioId: usuario.id, iglesiaId: usuario.iglesiaId, rol: usuario.rol });

    const ahora = new Date();
    await Promise.all([
      this.prisma.sesionActividad.create({
        data: { usuarioId: usuario.id, iglesiaId: usuario.iglesiaId, inicioAt: ahora, ultimoLatidoAt: ahora },
      }),
      this.prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAccesoAt: ahora } }),
    ]);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      csrfToken: generateCsrfToken(),
      usuario: {
        ...(await this.attachIglesia(usuario)),
        modulos: await this.getModulosOtorgados(usuario),
      },
      requiresPasswordChange: usuario.mustChangePassword,
      requiresOnboarding: !usuario.onboardingCompletado,
    };
  }

  /**
   * Rehidrata la sesión en el frontend (F5, apertura de pestaña nueva, etc).
   *
   * A diferencia del claim `modulos` del JWT (fijado al emitir el token), acá se
   * leen frescos de la BD para que el frontend pueda pintar el menú al día apenas
   * el MANAGER otorga/revoca un módulo — aunque la API todavía no lo permita hasta
   * que el access token actual expire y se refresque (hasta 15 min, ver
   * ModuloAccessGuard/JwtAuthGuard). Es la misma ventana ya aceptada para `rol`.
   */
  async getProfile(usuarioId: string): Promise<PerfilResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    return {
      ...(await this.attachIglesia(usuario)),
      requiresPasswordChange: usuario.mustChangePassword,
      requiresOnboarding: !usuario.onboardingCompletado,
      modulos: await this.getModulosOtorgados(usuario),
    };
  }

  /**
   * Rota el refresh token contra GoTrue (`grant_type=refresh_token`) — ya no
   * hay tabla local que consultar: la rotación y la detección de reuso las
   * hace Supabase del lado de GoTrue (decisión ya aceptada, ver
   * docs/supabase.md paso 6).
   */
  async refreshTokens(refreshTokenCookie: string): Promise<AuthTokens> {
    let session: SupabaseSession;
    try {
      session = await this.supabaseAuth.refreshSession(refreshTokenCookie);
    } catch (error) {
      this.logger.debug(`refreshSession rechazado: ${(error as Error).message}`);
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuarioId = await this.supabaseJwtVerifier.verifyAndExtractUsuarioId(session.accessToken);

    // Fase 8 de docs/supabase.md (RLS): mismo bootstrap por-id que JwtAuthGuard — la policy
    // de `usuarios` permite auto-lectura por `id` para resolver esta misma búsqueda.
    updateTenantContext({ usuarioId });

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inválido o inactivo');
    }

    updateTenantContext({ iglesiaId: usuario.iglesiaId, rol: usuario.rol });

    // Respaldo best-effort del heartbeat (ver ./auth.controller.ts#heartbeat): un refresh
    // ocurre cada ~15 min mientras la pestaña está abierta, así que igual sirve como señal
    // de actividad aunque el heartbeat del frontend falle o tarde en desplegarse.
    await this.bumpActividad(usuario.id);

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      csrfToken: generateCsrfToken(),
    };
  }

  /**
   * `accessToken` viene de la cookie del propio request de logout — GoTrue
   * identifica qué sesión/usuario cerrar a partir de ese JWT, no de un id
   * suelto. `scope: 'global'` iguala el comportamiento anterior (revocar
   * refresh tokens en todos los dispositivos, no solo el actual).
   */
  async logout(usuarioId: string, accessToken: string | undefined): Promise<void> {
    await Promise.all([
      accessToken ? this.supabaseAuth.signOut(accessToken, 'global') : Promise.resolve(),
      this.prisma.sesionActividad.updateMany({
        where: { usuarioId, finAt: null },
        data: { finAt: new Date() },
      }),
    ]);
  }

  /**
   * Llamado por el frontend cada ~60s (ver POST /auth/heartbeat) mientras la pestaña está
   * visible, para que `SesionActividad.ultimoLatidoAt` refleje tiempo de uso real (no solo
   * login/logout). Si no hay sesión abierta (ej. dos pestañas, una ya deslogueada en otra)
   * no crea una nueva — un heartbeat no es un login.
   */
  async heartbeat(usuarioId: string): Promise<void> {
    await this.bumpActividad(usuarioId);
  }

  private async bumpActividad(usuarioId: string): Promise<void> {
    const ahora = new Date();
    const sesionAbierta = await this.prisma.sesionActividad.findFirst({
      where: { usuarioId, finAt: null },
      orderBy: { inicioAt: 'desc' },
      select: { id: true },
    });

    await Promise.all([
      this.prisma.usuario.update({ where: { id: usuarioId }, data: { ultimoAccesoAt: ahora } }),
      sesionAbierta
        ? this.prisma.sesionActividad.update({
            where: { id: sesionAbierta.id },
            data: { ultimoLatidoAt: ahora },
          })
        : Promise.resolve(),
    ]);
  }

  /**
   * Cambio de contraseña forzado (o voluntario). Actualiza el hash local Y
   * sincroniza la contraseña hacia Supabase (evita que se repita el
   * desincronizado que resuelve el fallback de `validateUser`) — best-effort:
   * si la sincronización falla, el próximo login se autosana igual, así que
   * no vale la pena bloquear la respuesta de este endpoint por eso. Cierra
   * las demás sesiones activas contra Supabase (`scope: 'global'`), mismo
   * efecto que antes tenía revocar todos los RefreshToken locales.
   */
  async changePassword(
    usuarioId: string,
    dto: ChangePasswordDto,
    accessToken: string | undefined,
  ): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    if (!(await this.confirmarPassword(usuario, dto.currentPassword))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        password: newPasswordHash,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    if (usuario.supabaseUserId) {
      await this.supabaseAuth.syncPassword(usuario.supabaseUserId, dto.newPassword).catch((error: Error) => {
        this.logger.warn(
          `No se pudo sincronizar la nueva contraseña a Supabase Auth para ${usuario.id}: ${error.message}`,
        );
      });
    }

    if (accessToken) {
      await this.supabaseAuth.signOut(accessToken, 'global');
    }
  }

  /**
   * "Olvidé mi contraseña" desde el login (ruta pública `POST /auth/forgot-password`).
   * SIEMPRE responde 200 desde el controller aunque la cuenta no exista o esté
   * inactiva — no filtra qué correos están registrados. Corre en `runAsService`
   * (Fase 8): en este punto no hay identidad, igual que `validateUser`.
   *
   * Solo el último link pedido sirve: cada pedido nuevo invalida los anteriores
   * que sigan sin usar.
   */
  async requestPasswordReset(email: string): Promise<void> {
    return runAsService(() => this.requestPasswordResetComoServicio(email));
  }

  private async requestPasswordResetComoServicio(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      return;
    }

    const rawToken = generateSecureToken();
    const ahora = new Date();

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { usuarioId: usuario.id, usedAt: null },
        data: { usedAt: ahora },
      });
      await tx.passwordResetToken.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: this.hashResetToken(rawToken),
          expiresAt: new Date(ahora.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
        },
      });
    });

    // enviarRecuperacionContrasena es best-effort y no lanza (igual que el resto
    // de MailService): el controller responde 200 igual — un fallo de correo
    // queda en los logs, no como un 500 para alguien ya bloqueado del sistema.
    await this.mailService.enviarRecuperacionContrasena({
      email: usuario.email,
      nombre: usuario.nombre,
      token: rawToken,
      expiraEnMinutos: PASSWORD_RESET_TTL_MINUTES,
    });
  }

  /**
   * Consume el link de recuperación (`POST /auth/reset-password`). Valida el token
   * (existe, sin usar, no expirado, usuario activo), fija la contraseña nueva en el
   * hash local Y la sincroniza a Supabase (misma lógica que `changePassword`), marca
   * el token como usado y cierra las sesiones locales abiertas del usuario.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    return runAsService(() => this.resetPasswordComoServicio(rawToken, newPassword));
  }

  private async resetPasswordComoServicio(rawToken: string, newPassword: string): Promise<void> {
    const registro = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashResetToken(rawToken) },
      include: { usuario: true },
    });

    const ahora = new Date();
    if (!registro || registro.usedAt || registro.expiresAt < ahora || !registro.usuario.activo) {
      throw new BadRequestException('El enlace de recuperación no es válido o expiró. Solicitá uno nuevo.');
    }

    const usuario = registro.usuario;
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          password: passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.update({ where: { id: registro.id }, data: { usedAt: ahora } });
      await tx.sesionActividad.updateMany({
        where: { usuarioId: usuario.id, finAt: null },
        data: { finAt: ahora },
      });
    });

    // Sincroniza a Supabase Auth (best-effort, igual que changePassword): si falla, el
    // próximo login se autosana vía el fallback de validateUser.
    const sync = usuario.supabaseUserId
      ? this.supabaseAuth.syncPassword(usuario.supabaseUserId, newPassword)
      : this.supabaseAuth.mirrorUsuario(usuario, newPassword);
    await sync.catch((error: Error) => {
      this.logger.warn(
        `No se pudo sincronizar la contraseña recuperada de ${usuario.id} a Supabase Auth: ${error.message}`,
      );
    });
  }

  /** SHA-256 hex del token del link — en la BD solo vive el hash, nunca el valor. */
  private hashResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** Autoedición del perfil: solo datos personales. Username/email/rol quedan fuera de alcance. */
  async updateMe(usuarioId: string, dto: UpdateMyProfileDto): Promise<PerfilResponse> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { nombre: dto.nombre, apellido: dto.apellido, telefono: dto.telefono },
    });

    return this.getProfile(usuarioId);
  }

  /** Reemplaza la foto de perfil, borrando el archivo anterior del disco si existía. */
  async updateMiFoto(usuarioId: string, foto: Express.Multer.File): Promise<PerfilResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    const fotoUrl = await this.supabaseStorage.upload(
      'fotos-perfil',
      `${randomUUID()}${resolverExtensionFotoPerfil(foto.mimetype)}`,
      foto,
      FOTO_PERFIL_RESIZE,
    );

    if (usuario.fotoUrl) {
      await this.supabaseStorage.removeByPublicUrl(usuario.fotoUrl);
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl },
    });

    return this.getProfile(usuarioId);
  }

  /**
   * Confirmación de identidad para acciones sensibles (ej. eliminar un movimiento
   * financiero, cambiar la fecha de facturación). Lanza `ForbiddenException` (403), no
   * `UnauthorizedException` (401) — el usuario SÍ está autenticado (ya pasó
   * JwtAuthGuard), solo falló esta confirmación puntual. Usar 401 acá hacía que el
   * frontend, que trata cualquier 401 como "sesión inválida, cerrar sesión", expulsara
   * al usuario del sistema con solo escribir mal la contraseña de confirmación — mismo
   * criterio que ya usa `IglesiaSuspendidaException` para esta misma distinción.
   */
  async verifyPassword(usuarioId: string, password: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException();
    }

    if (!(await this.confirmarPassword(usuario, password))) {
      throw new ForbiddenException('Contraseña incorrecta');
    }
  }

  /**
   * Confirma `password` contra la MISMA fuente de verdad que usa el login (Supabase
   * primero, bcrypt local como fallback con resincronización) — usado por
   * `changePassword` y `verifyPassword`. Sin esto, un usuario que inició sesión bien
   * (vía Supabase, porque su cuenta ya está relinkeada/vigente ahí) podía fallar en
   * cualquier acción de "confirma tu contraseña" si el hash local había quedado
   * desincronizado — bug real encontrado el 2026-08-16 al migrar de Postgres local a
   * Supabase: el login pasaba, pero re-ingresar la misma contraseña para confirmar un
   * cambio de fecha de facturación (u otras acciones con `ConfirmPasswordDto`) daba
   * "Contraseña incorrecta" pese a ser la contraseña correcta.
   */
  private async confirmarPassword(usuario: Usuario, password: string): Promise<boolean> {
    const session = await this.trySupabaseSignIn(usuario.email, password);
    if (session) {
      return true;
    }

    const passwordMatches = await bcrypt.compare(password, usuario.password);
    if (passwordMatches && usuario.supabaseUserId) {
      await this.supabaseAuth.syncPassword(usuario.supabaseUserId, password).catch((error: Error) => {
        this.logger.warn(`No se pudo sincronizar contraseña para ${usuario.id}: ${error.message}`);
      });
    }
    return passwordMatches;
  }

  /**
   * Solo USUARIO tiene módulos delegados por AccesoModulo (ver AccesosModule); para el
   * resto de los roles el acceso a módulos no se decide por esta lista (MANAGER tiene
   * acceso total vía ModuloAccessGuard, SUPER_ADMIN no usa estos módulos), así
   * que se evita la query en esos casos.
   */
  private async getModulosOtorgados(usuario: Usuario): Promise<ModuloSistema[]> {
    if (usuario.rol !== Rol.USUARIO) {
      return [];
    }

    const accesos = await this.prisma.accesoModulo.findMany({
      where: { usuarioId: usuario.id },
      select: { modulo: true },
    });

    return accesos.map((acceso) => acceso.modulo);
  }

  private async attachIglesia(usuario: Usuario): Promise<SafeUsuario> {
    const iglesia = usuario.iglesiaId
      ? await this.prisma.iglesia.findUnique({
          where: { id: usuario.iglesiaId },
          select: { nombre: true, logoUrl: true, plan: true },
        })
      : null;

    const { password, ...safe } = usuario;
    return { ...safe, iglesia };
  }
}

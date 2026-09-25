import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../common/constants/auth-cookies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthService, LoginResponse, ValidatedLogin } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { fotoPerfilMulterOptions } from './foto-perfil-upload.config';
import { LocalAuthGuard } from './guards/local-auth.guard';

/**
 * accessToken/refreshToken van solo en cookies httpOnly. csrfToken SÍ va en el
 * body: en el deploy real (frontend y backend en dominios distintos) una
 * cookie no-httpOnly seteada por el backend no es legible vía document.cookie
 * desde el origen del frontend (restricción de scoping por dominio, no de
 * httpOnly/sameSite) — el body es el único canal por el que el frontend puede
 * obtener el valor para reflejarlo en el header X-CSRF-Token.
 */
type LoginResponseBody = Omit<LoginResponse, 'accessToken' | 'refreshToken'>;

function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name];
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Login único para todos los roles, incluido el primer ingreso del pastor
   * con la contraseña temporal generada por el SuperAdmin. El body se valida
   * con LoginDto; las credenciales en sí las verifica LocalStrategy (que ahora
   * autentica contra Supabase Auth, con fallback auto-sanador — ver
   * AuthService#validateUser). accessToken/refreshToken nunca viajan en el
   * body: van en cookies httpOnly (ver ./cookies.ts), y ahora son los tokens
   * que emite Supabase, no un JWT propio. csrfToken sí viaja en el body (ver
   * comentario de LoginResponseBody más arriba) y sigue siendo 100% nuestro.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  // Sin sesión que identifique al atacante todavía — el único freno posible es por IP.
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  async login(
    @Body() _dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseBody> {
    const { usuario, session } = req.user as ValidatedLogin;
    const { accessToken, refreshToken, ...body } = await this.authService.login(usuario, session);

    setAuthCookies(res, this.config, { accessToken, refreshToken, csrfToken: body.csrfToken });

    return body;
  }

  /**
   * "Olvidé mi contraseña" (link en el login). Público, sin sesión. SIEMPRE
   * responde `{ ok: true }` aunque el correo no exista, esté inactivo o el envío
   * del mail falle — no filtra qué correos están registrados. Throttle agresivo
   * por IP.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: true }> {
    await this.authService.requestPasswordReset(dto.email);
    return { ok: true };
  }

  /**
   * Consume el link de recuperación (landing `/recuperar-contrasena/:token`).
   * Público. 400 si el token no es válido/expiró/ya se usó; el frontend
   * redirige al login tras el 200.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  /**
   * El refresh token de Supabase es un string opaco, no un JWT — no hay nada
   * que verificar localmente (a diferencia del JwtRefreshStrategy que existía
   * antes del corte), así que se lee la cookie directo y se le presenta a
   * GoTrue (`grant_type=refresh_token`), que es quien de verdad valida si
   * sigue vigente.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: minutes(1) } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; csrfToken: string }> {
    const refreshTokenCookie = readCookie(req, REFRESH_TOKEN_COOKIE);
    if (!refreshTokenCookie) {
      throw new UnauthorizedException('Falta el refresh token');
    }

    const { accessToken, refreshToken, csrfToken } = await this.authService.refreshTokens(refreshTokenCookie);

    setAuthCookies(res, this.config, { accessToken, refreshToken, csrfToken });

    return { ok: true, csrfToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.sub, readCookie(req, ACCESS_TOKEN_COOKIE));
    clearAuthCookies(res, this.config);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /**
   * Ping de actividad para KPIs de "usuarios activos"/"tiempo de uso" (dashboards de
   * SuperAdmin y de manager/usuario). El frontend lo llama cada ~60s mientras la pestaña
   * está visible (Page Visibility API), una vez pasados los gates de mustChangePassword/
   * onboarding — ver JwtAuthGuard#MUST_CHANGE_PASSWORD_ALLOWLIST.
   */
  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async heartbeat(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.heartbeat(user.sub);
  }

  /** Autoedición del perfil (cualquier rol). Solo datos personales: nombre, apellido, teléfono. */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMyProfileDto) {
    return this.authService.updateMe(user.sub, dto);
  }

  /** Sube/reemplaza la foto de perfil del usuario autenticado. */
  @Patch('me/foto')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('foto', fotoPerfilMulterOptions))
  async updateMiFoto(@CurrentUser() user: JwtPayload, @UploadedFile() foto?: Express.Multer.File) {
    if (!foto) {
      throw new BadRequestException('Debe adjuntar un archivo de foto');
    }
    return this.authService.updateMiFoto(user.sub, foto);
  }

  /**
   * Usado tanto para el cambio forzado tras el primer login (mustChangePassword)
   * como para un cambio voluntario posterior. Revoca las demás sesiones activas
   * (ahora del lado de Supabase, ver AuthService#changePassword).
   */
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.changePassword(user.sub, dto, readCookie(req, ACCESS_TOKEN_COOKIE));
  }
}

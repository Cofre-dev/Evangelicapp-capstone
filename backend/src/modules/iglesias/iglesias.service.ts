import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoIglesia, EstadoTarea, PlanIglesia, Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { PLAN_LIMITS } from '../../common/constants/plan';
import { bucketPorMes, inicioVentanaMensual } from '../../common/utils/bucket-por-mes.util';
import { calcularEstadoFacturacion, sumarDias, sumarUnMes } from '../../common/utils/calcular-facturacion';
import { generateTemporaryPassword } from '../../common/utils/generate-temporary-password';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { AuthService } from '../auth/auth.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';
import { ActualizarFacturacionDto } from './dto/actualizar-facturacion.dto';
import { CambiarPlanDto } from './dto/cambiar-plan.dto';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';
import { LOGO_RESIZE, resolverExtensionLogo } from './logo-upload.config';

/** Días entre la fecha de adquisición del plan y la primera facturación (ver CreateIglesiaDto). */
const DIAS_PRIMERA_FACTURACION = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MESES_VENTANA_CERTIFICADOS = 6;

export interface FiltrosIglesias {
  search?: string;
  estado?: EstadoIglesia;
  plan?: PlanIglesia;
  region?: string;
}

const LISTADO_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  logoUrl: true,
  estado: true,
  plan: true,
  proximaFacturacion: true,
  createdAt: true,
  usuarios: {
    select: { nombre: true, apellido: true, email: true },
    where: { rol: Rol.MANAGER },
    take: 1,
  },
} as const;

const DETALLE_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  direccion: true,
  logoUrl: true,
  estado: true,
  plan: true,
  proximaFacturacion: true,
  ultimoPagoAt: true,
  visitantesPromedio: true,
  createdAt: true,
  usuarios: {
    select: {
      id: true,
      username: true,
      email: true,
      nombre: true,
      apellido: true,
      rol: true,
      activo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

@Injectable()
export class IglesiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly authService: AuthService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Crea la iglesia y su manager (dueño del tenant) en una sola transacción —
   * una iglesia sin manager a cargo no tiene sentido en este modelo. La
   * contraseña temporal se devuelve una sola vez, igual que con el resto del equipo.
   * El logo se sube a Storage antes de abrir la transacción: es una llamada de red,
   * no debe mantener la transacción de Prisma abierta mientras espera.
   *
   * `proximaFacturacion` ya no la elige el SuperAdmin a mano: se calcula desde
   * `fechaAdquisicionPlan` + 30 días. Esa misma fecha queda como el primer registro
   * del historial de pagos de la iglesia (ver `historialPagos`) — adquirir el plan
   * es, en los hechos, el primer "pago" confirmado.
   */
  async create(dto: CreateIglesiaDto, superAdminId: string, logo?: Express.Multer.File) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const fechaAdquisicionPlan = new Date(dto.fechaAdquisicionPlan);
    const proximaFacturacion = sumarDias(fechaAdquisicionPlan, DIAS_PRIMERA_FACTURACION);
    const logoUrl = logo
      ? await this.supabaseStorage.upload(
          'logos-iglesias',
          `${randomUUID()}${resolverExtensionLogo(logo.mimetype)}`,
          logo,
          LOGO_RESIZE,
        )
      : undefined;

    try {
      const { iglesia, pastor } = await this.prisma.withTenantTransaction(async (tx) => {
        const iglesia = await tx.iglesia.create({
          data: {
            nombre: dto.nombre,
            comuna: dto.comuna,
            region: dto.region,
            direccion: dto.direccion,
            plan: dto.plan,
            proximaFacturacion,
            logoUrl,
          },
        });

        const pastor = await tx.usuario.create({
          data: {
            username: dto.pastorUsername,
            email: dto.pastorEmail,
            password: passwordHash,
            nombre: dto.pastorNombre,
            apellido: dto.pastorApellido,
            rol: Rol.MANAGER,
            iglesiaId: iglesia.id,
            mustChangePassword: true,
            onboardingCompletado: false,
          },
          select: { id: true, username: true, email: true, nombre: true, apellido: true },
        });

        await tx.pagoIglesia.create({
          data: { iglesiaId: iglesia.id, fecha: fechaAdquisicionPlan, registradoPorId: superAdminId },
        });

        return { iglesia, pastor };
      });

      return { iglesia, pastor, temporaryPassword };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  /**
   * Listado filtrable para la página "Iglesias" del SuperAdmin (búsqueda por nombre +
   * filtros de estado/plan/región). Sin paginación: el volumen de iglesias es bajo y
   * ningún otro listado del backend pagina hoy — no introducir el patrón solo acá.
   */
  async findAll(filtros: FiltrosIglesias) {
    const where: Prisma.IglesiaWhereInput = {
      ...(filtros.search ? { nombre: { contains: filtros.search, mode: 'insensitive' } } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.plan ? { plan: filtros.plan } : {}),
      ...(filtros.region ? { region: filtros.region } : {}),
    };

    const iglesias = await this.prisma.iglesia.findMany({
      where,
      select: LISTADO_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return iglesias.map((i) => this.mapListado(i));
  }

  private mapListado(iglesia: Prisma.IglesiaGetPayload<{ select: typeof LISTADO_SELECT }>) {
    const { usuarios, proximaFacturacion, ...resto } = iglesia;
    return {
      ...resto,
      pastor: usuarios[0] ?? null,
      facturacion: calcularEstadoFacturacion(proximaFacturacion),
    };
  }

  /**
   * Fase 5 de docs/supabase.md: avisa al dashboard del SuperAdmin (room
   * `superadmin`, ver RealtimeGateway) cada vez que cambia el EstadoIglesia o
   * la proximaFacturacion de una iglesia — los 2 campos que ese dashboard
   * necesita en vivo. Mismo shape que un item de `findAll` para que el
   * frontend pueda parchear la fila sin tener que volver a pedir la lista.
   */
  private async emitIglesiaActualizada(id: string): Promise<void> {
    const iglesia = await this.prisma.iglesia.findUnique({ where: { id }, select: LISTADO_SELECT });
    if (!iglesia) {
      return;
    }
    this.realtimeService.emitASuperAdmin(REALTIME_EVENTS.IGLESIA_ACTUALIZADA, this.mapListado(iglesia));
  }

  /**
   * Detalle para el SuperAdmin: la iglesia, quién es el manager, el resto del
   * equipo, el semáforo de facturación (ver calcularEstadoFacturacion) y el uso
   * actual contra los topes del plan contratado.
   */
  async findOne(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({ where: { id }, select: DETALLE_SELECT });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    return this.buildDetalle(iglesia);
  }

  /** Cambiar de plan nunca borra ni desactiva datos existentes — solo mueve los topes hacia delante. */
  async cambiarPlan(id: string, dto: CambiarPlanDto) {
    await this.requireExists(id);

    await this.prisma.iglesia.update({ where: { id }, data: { plan: dto.plan } });

    return this.findOne(id);
  }

  /**
   * Corrección manual de la fecha de facturación (no confundir con `marcarPagada`, que
   * además la avanza y queda en el historial). Exige reingresar la contraseña del
   * SuperAdmin (ver ActualizarFacturacionDto) — cambia cuándo se corta el acceso de una
   * iglesia por mora, no es una edición trivial. No genera entrada de historial de
   * pagos: es una corrección de dato, no una confirmación de pago.
   */
  async actualizarFacturacion(id: string, dto: ActualizarFacturacionDto, superAdminId: string) {
    await this.requireExists(id);
    await this.authService.verifyPassword(superAdminId, dto.password);

    await this.prisma.iglesia.update({
      where: { id },
      data: { proximaFacturacion: new Date(dto.proximaFacturacion) },
    });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /**
   * Confirmación manual de pago (no hay pasarela todavía): avanza la fecha de
   * facturación un mes exacto desde la fecha vencida (no desde "hoy"), reactiva la
   * iglesia si estaba oculta por mora, y deja un registro en el historial de pagos.
   */
  async marcarPagada(id: string, superAdminId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { proximaFacturacion: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const fechaPago = new Date();

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.iglesia.update({
        where: { id },
        data: {
          proximaFacturacion: sumarUnMes(iglesia.proximaFacturacion),
          ultimoPagoAt: fechaPago,
          estado: EstadoIglesia.ACTIVA,
        },
      });
      await tx.pagoIglesia.create({
        data: { iglesiaId: id, fecha: fechaPago, registradoPorId: superAdminId },
      });
    });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /** Historial de pagos/confirmaciones de facturación de la iglesia, más reciente primero. */
  async historialPagos(id: string) {
    await this.requireExists(id);

    return this.prisma.pagoIglesia.findMany({
      where: { iglesiaId: id },
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        fecha: true,
        createdAt: true,
        registradoPor: { select: { id: true, nombre: true, apellido: true } },
      },
    });
  }

  /**
   * Oculta la iglesia (bloquea login y sesiones activas de todo su equipo, ver
   * AuthService/JwtAuthGuard). Solo disponible con 3+ días de mora — reforzado acá
   * también, no solo en el frontend (ver DIAS_GRACIA_MORA).
   */
  async ocultar(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { proximaFacturacion: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const { puedeOcultar } = calcularEstadoFacturacion(iglesia.proximaFacturacion);
    if (!puedeOcultar) {
      throw new ForbiddenException(
        'Solo se puede ocultar una iglesia con 3 o más días de mora en su facturación.',
      );
    }

    await this.prisma.iglesia.update({ where: { id }, data: { estado: EstadoIglesia.SUSPENDIDA } });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /** Reactivación manual — siempre disponible (ej. el SuperAdmin ocultó por error). */
  async mostrar(id: string) {
    await this.requireExists(id);

    await this.prisma.iglesia.update({ where: { id }, data: { estado: EstadoIglesia.ACTIVA } });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  private async requireExists(id: string): Promise<void> {
    const iglesia = await this.prisma.iglesia.findUnique({ where: { id }, select: { id: true } });
    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }
  }

  private async buildDetalle(iglesia: Prisma.IglesiaGetPayload<{ select: typeof DETALLE_SELECT }>) {
    const { usuarios, plan, proximaFacturacion, ...iglesiaData } = iglesia;

    const iglesiaId = iglesia.id;
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - MS_POR_DIA);
    const hace7d = new Date(ahora.getTime() - 7 * MS_POR_DIA);
    const en30d = new Date(ahora.getTime() + 30 * MS_POR_DIA);
    const desdeVentanaCertificados = inicioVentanaMensual(MESES_VENTANA_CERTIFICADOS, ahora);
    const certificadoWhereReciente = { iglesiaId, createdAt: { gte: desdeVentanaCertificados } };

    const [
      departamentosActuales,
      usuariosActivosHoy,
      usuariosActivosSemana,
      eventosTotal,
      eventosProximos30d,
      integrantesTotal,
      matrimonios,
      bautizos,
      defunciones,
      presentaciones,
      matrimoniosRecientes,
      bautizosRecientes,
      defuncionesRecientes,
      presentacionesRecientes,
      notasPendientes,
    ] = await Promise.all([
      this.prisma.departamentoFinanciero.count({ where: { iglesiaId, activo: true } }),
      this.prisma.usuario.count({ where: { iglesiaId, ultimoAccesoAt: { gte: hace24h } } }),
      this.prisma.usuario.count({ where: { iglesiaId, ultimoAccesoAt: { gte: hace7d } } }),
      this.prisma.evento.count({ where: { iglesiaId } }),
      this.prisma.evento.count({ where: { iglesiaId, fechaInicio: { gte: ahora, lte: en30d } } }),
      this.prisma.integrante.count({ where: { iglesiaId } }),
      this.prisma.matrimonio.count({ where: { iglesiaId } }),
      this.prisma.bautizo.count({ where: { iglesiaId } }),
      this.prisma.defuncion.count({ where: { iglesiaId } }),
      this.prisma.presentacion.count({ where: { iglesiaId } }),
      this.prisma.matrimonio.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.bautizo.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.defuncion.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.presentacion.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.nota.count({
        where: { iglesiaId, estado: { not: EstadoTarea.COMPLETADA }, archivado: false },
      }),
    ]);

    const usuariosActuales = usuarios.filter(
      (u) => u.activo && (u.rol === Rol.MANAGER || u.rol === Rol.USUARIO),
    ).length;

    const limitesPlan = PLAN_LIMITS[plan];

    const fechasCertificadosRecientes = [
      ...matrimoniosRecientes,
      ...bautizosRecientes,
      ...defuncionesRecientes,
      ...presentacionesRecientes,
    ].map((r) => r.createdAt);

    return {
      ...iglesiaData,
      plan,
      pastor: usuarios.find((u) => u.rol === Rol.MANAGER) ?? null,
      equipo: usuarios.filter((u) => u.rol !== Rol.MANAGER),
      facturacion: calcularEstadoFacturacion(proximaFacturacion),
      limites: {
        usuarios: { actuales: usuariosActuales, maximo: limitesPlan.maxUsuarios },
        departamentosFinancieros: {
          actuales: departamentosActuales,
          maximo: limitesPlan.maxDepartamentosFinancieros,
        },
      },
      // KPIs de adopción/uso para el SuperAdmin — deliberadamente sin nada financiero
      // (montos, movimientos, categorías): ver CLAUDE.md, el SuperAdmin no ve el detalle
      // financiero/operativo interno de una iglesia.
      estadisticas: {
        usuariosActivosHoy,
        usuariosActivosSemana,
        eventos: { total: eventosTotal, proximos30d: eventosProximos30d },
        integrantesTotal,
        certificados: {
          total: matrimonios + bautizos + defunciones + presentaciones,
          porTipo: { matrimonios, bautizos, defunciones, presentaciones },
          porMes: bucketPorMes(fechasCertificadosRecientes, MESES_VENTANA_CERTIFICADOS, ahora),
        },
        notasPendientes,
      },
    };
  }
}

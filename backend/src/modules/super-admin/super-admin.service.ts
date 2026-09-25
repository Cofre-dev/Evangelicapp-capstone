import { Injectable } from '@nestjs/common';
import { EstadoIglesia, PlanIglesia, Rol } from '@prisma/client';
import { bucketPorMes, inicioVentanaMensual, BucketMensual } from '../../common/utils/bucket-por-mes.util';
import { PrismaService } from '../../prisma/prisma.service';

const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;
const DIAS_VENTANA_ACTIVIDAD = 30;
const MESES_VENTANA_CERTIFICADOS = 6;

export interface CertificadosPorTipo {
  matrimonios: number;
  bautizos: number;
  defunciones: number;
  presentaciones: number;
}

export interface DashboardResponse {
  totales: {
    iglesias: number;
    iglesiasActivas: number;
    iglesiasSuspendidas: number;
    pastores: number;
    /** Excluye SUPER_ADMIN: mide adopción de las iglesias, no el uso del propio equipo. */
    usuariosActivosHoy: number;
    usuariosActivosSemana: number;
    certificadosEmitidos: number;
  };
  porRegion: { region: string; cantidad: number }[];
  porPlan: { plan: PlanIglesia; cantidad: number }[];
  certificados: {
    porTipo: CertificadosPorTipo;
    porMes: BucketMensual[];
  };
  actividad: {
    porDia: { fecha: string; sesiones: number }[];
    porHora: { hora: number; sesiones: number }[];
    tiempoPromedioSesionMinutos: number;
  };
  /** Últimas 5 iglesias dadas de alta — el listado completo/filtrable vive en GET /iglesias. */
  iglesiasRecientes: {
    id: string;
    nombre: string;
    comuna: string;
    region: string;
    logoUrl: string | null;
    estado: EstadoIglesia;
    plan: PlanIglesia;
    createdAt: Date;
    pastor: { nombre: string; apellido: string; email: string } | null;
  }[];
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<DashboardResponse> {
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - MS_POR_DIA);
    const hace7d = new Date(ahora.getTime() - 7 * MS_POR_DIA);
    const hace30d = new Date(ahora.getTime() - DIAS_VENTANA_ACTIVIDAD * MS_POR_DIA);
    const desdeVentanaCertificados = inicioVentanaMensual(MESES_VENTANA_CERTIFICADOS, ahora);

    const [
      iglesiasTotal,
      iglesiasActivas,
      iglesiasSuspendidas,
      pastoresTotal,
      usuariosActivosHoy,
      usuariosActivosSemana,
      porRegionRaw,
      porPlanRaw,
      matrimonios,
      bautizos,
      defunciones,
      presentaciones,
      matrimoniosRecientes,
      bautizosRecientes,
      defuncionesRecientes,
      presentacionesRecientes,
      sesionesRecientes,
      iglesiasRecientes,
    ] = await Promise.all([
      this.prisma.iglesia.count(),
      this.prisma.iglesia.count({ where: { estado: EstadoIglesia.ACTIVA } }),
      this.prisma.iglesia.count({ where: { estado: EstadoIglesia.SUSPENDIDA } }),
      this.prisma.usuario.count({ where: { rol: Rol.MANAGER } }),
      this.prisma.usuario.count({ where: { iglesiaId: { not: null }, ultimoAccesoAt: { gte: hace24h } } }),
      this.prisma.usuario.count({ where: { iglesiaId: { not: null }, ultimoAccesoAt: { gte: hace7d } } }),
      this.prisma.iglesia.groupBy({ by: ['region'], _count: { _all: true } }),
      this.prisma.iglesia.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.matrimonio.count(),
      this.prisma.bautizo.count(),
      this.prisma.defuncion.count(),
      this.prisma.presentacion.count(),
      this.prisma.matrimonio.findMany({
        where: { createdAt: { gte: desdeVentanaCertificados } },
        select: { createdAt: true },
      }),
      this.prisma.bautizo.findMany({
        where: { createdAt: { gte: desdeVentanaCertificados } },
        select: { createdAt: true },
      }),
      this.prisma.defuncion.findMany({
        where: { createdAt: { gte: desdeVentanaCertificados } },
        select: { createdAt: true },
      }),
      this.prisma.presentacion.findMany({
        where: { createdAt: { gte: desdeVentanaCertificados } },
        select: { createdAt: true },
      }),
      this.prisma.sesionActividad.findMany({
        where: { inicioAt: { gte: hace30d } },
        select: { inicioAt: true, ultimoLatidoAt: true, finAt: true },
      }),
      this.prisma.iglesia.findMany({
        select: {
          id: true,
          nombre: true,
          comuna: true,
          region: true,
          logoUrl: true,
          estado: true,
          plan: true,
          createdAt: true,
          usuarios: {
            where: { rol: Rol.MANAGER },
            select: { nombre: true, apellido: true, email: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const certificadosPorTipo: CertificadosPorTipo = {
      matrimonios,
      bautizos,
      defunciones,
      presentaciones,
    };

    const fechasCertificadosRecientes = [
      ...matrimoniosRecientes,
      ...bautizosRecientes,
      ...defuncionesRecientes,
      ...presentacionesRecientes,
    ].map((r) => r.createdAt);

    return {
      totales: {
        iglesias: iglesiasTotal,
        iglesiasActivas,
        iglesiasSuspendidas,
        pastores: pastoresTotal,
        usuariosActivosHoy,
        usuariosActivosSemana,
        certificadosEmitidos: matrimonios + bautizos + defunciones + presentaciones,
      },
      porRegion: porRegionRaw
        .map((r) => ({ region: r.region, cantidad: r._count._all }))
        .sort((a, b) => b.cantidad - a.cantidad),
      porPlan: porPlanRaw
        .map((p) => ({ plan: p.plan, cantidad: p._count._all }))
        .sort((a, b) => b.cantidad - a.cantidad),
      certificados: {
        porTipo: certificadosPorTipo,
        porMes: bucketPorMes(fechasCertificadosRecientes, MESES_VENTANA_CERTIFICADOS, ahora),
      },
      actividad: this.calcularActividad(sesionesRecientes, ahora),
      iglesiasRecientes: iglesiasRecientes.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        comuna: i.comuna,
        region: i.region,
        logoUrl: i.logoUrl,
        estado: i.estado,
        plan: i.plan,
        createdAt: i.createdAt,
        pastor: i.usuarios[0] ?? null,
      })),
    };
  }

  /**
   * "Picos de actividad": tendencia diaria de los últimos 30 días (para ver el crecimiento/
   * caída de uso en el tiempo) y distribución por hora del día agregada de esa misma ventana
   * (para ver a qué horas se usa más la plataforma). El tiempo promedio de sesión usa
   * `finAt ?? ultimoLatidoAt` como fin real de uso — una sesión abandonada sin logout ya
   * dejó de recibir heartbeats, así que su último latido es su fin efectivo.
   */
  private calcularActividad(
    sesiones: { inicioAt: Date; ultimoLatidoAt: Date; finAt: Date | null }[],
    ahora: Date,
  ): DashboardResponse['actividad'] {
    const porDiaMap = new Map<string, number>();
    const porHora = new Array<number>(24).fill(0);
    let sumaDuracionMinutos = 0;

    for (const sesion of sesiones) {
      const clave = sesion.inicioAt.toISOString().slice(0, 10);
      porDiaMap.set(clave, (porDiaMap.get(clave) ?? 0) + 1);
      porHora[sesion.inicioAt.getUTCHours()] += 1;

      const fin = sesion.finAt ?? sesion.ultimoLatidoAt;
      const duracionMinutos = Math.max(0, (fin.getTime() - sesion.inicioAt.getTime()) / 60000);
      sumaDuracionMinutos += duracionMinutos;
    }

    const porDia: { fecha: string; sesiones: number }[] = [];
    for (let i = DIAS_VENTANA_ACTIVIDAD - 1; i >= 0; i--) {
      const fecha = new Date(ahora.getTime() - i * MS_POR_DIA).toISOString().slice(0, 10);
      porDia.push({ fecha, sesiones: porDiaMap.get(fecha) ?? 0 });
    }

    return {
      porDia,
      porHora: porHora.map((sesionesHora, hora) => ({ hora, sesiones: sesionesHora })),
      tiempoPromedioSesionMinutos:
        sesiones.length === 0 ? 0 : Math.round((sumaDuracionMinutos / sesiones.length) * 10) / 10,
    };
  }
}

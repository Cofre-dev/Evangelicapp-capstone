import { Injectable } from '@nestjs/common';
import { EstadoTarea, ModuloSistema, Rol, TipoNota } from '@prisma/client';
import { bucketPorMes, inicioVentanaMensual } from '../../common/utils/bucket-por-mes.util';
import { PrismaService } from '../../prisma/prisma.service';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_VENTANA_TIEMPO_PERSONAL = 7;
const MESES_VENTANA_TENDENCIAS = 6;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Landing de MANAGER/USUARIO. Replica la misma regla de `ModuloAccessGuard` (MANAGER ve
   * todo; USUARIO solo los módulos que tenga en `modulos`) para decidir qué bloques incluir
   * — a diferencia del guard, acá no es todo-o-nada: cada sección se omite si no corresponde,
   * en vez de rechazar el endpoint completo. Finanzas no se incluye: el frontend pega directo
   * a GET /finanzas/movimientos/dashboard, que ya se autogestiona ese permiso.
   */
  async getDashboard(iglesiaId: string, usuarioId: string, rol: Rol, modulos: ModuloSistema[]) {
    const tieneModulo = (modulo: ModuloSistema) => rol === Rol.MANAGER || modulos.includes(modulo);

    const ahora = new Date();
    const en30d = new Date(ahora.getTime() + 30 * MS_POR_DIA);
    const hace30d = new Date(ahora.getTime() - 30 * MS_POR_DIA);
    const desdeVentanaTendencias = inicioVentanaMensual(MESES_VENTANA_TENDENCIAS, ahora);

    const [personal, agenda, ceremonias, integrantes, equipo] = await Promise.all([
      this.getPersonal(iglesiaId, usuarioId, ahora),
      tieneModulo(ModuloSistema.AGENDA)
        ? this.getAgenda(iglesiaId, ahora, en30d, desdeVentanaTendencias)
        : null,
      tieneModulo(ModuloSistema.CEREMONIAS)
        ? this.getCeremonias(iglesiaId, ahora, desdeVentanaTendencias)
        : null,
      tieneModulo(ModuloSistema.INTEGRANTES) ? this.getIntegrantes(iglesiaId, hace30d) : null,
      rol === Rol.MANAGER ? this.getEquipo(iglesiaId, ahora) : null,
    ]);

    return { personal, agenda, ceremonias, integrantes, equipo };
  }

  /** Tiempo de uso del propio usuario (no de toda la iglesia) + sus tareas pendientes. */
  private async getPersonal(iglesiaId: string, usuarioId: string, ahora: Date) {
    const haceNDias = new Date(ahora.getTime() - (DIAS_VENTANA_TIEMPO_PERSONAL - 1) * MS_POR_DIA);

    const [sesiones, tareasPendientes] = await Promise.all([
      this.prisma.sesionActividad.findMany({
        where: { usuarioId, inicioAt: { gte: haceNDias } },
        select: { inicioAt: true, ultimoLatidoAt: true, finAt: true },
      }),
      this.prisma.nota.count({
        where: {
          iglesiaId,
          asignadoAId: usuarioId,
          tipo: TipoNota.RECORDATORIO,
          estado: { not: EstadoTarea.COMPLETADA },
        },
      }),
    ]);

    const minutosPorDia = new Map<string, number>();
    for (const sesion of sesiones) {
      const clave = sesion.inicioAt.toISOString().slice(0, 10);
      const fin = sesion.finAt ?? sesion.ultimoLatidoAt;
      const minutos = Math.max(0, (fin.getTime() - sesion.inicioAt.getTime()) / 60000);
      minutosPorDia.set(clave, (minutosPorDia.get(clave) ?? 0) + minutos);
    }

    const tiempoPorDia: { fecha: string; minutos: number }[] = [];
    for (let i = DIAS_VENTANA_TIEMPO_PERSONAL - 1; i >= 0; i--) {
      const fecha = new Date(ahora.getTime() - i * MS_POR_DIA).toISOString().slice(0, 10);
      tiempoPorDia.push({ fecha, minutos: Math.round(minutosPorDia.get(fecha) ?? 0) });
    }

    const hoyClave = ahora.toISOString().slice(0, 10);

    return {
      tiempoHoyMinutos: Math.round(minutosPorDia.get(hoyClave) ?? 0),
      tiempoSemanaMinutos: tiempoPorDia.reduce((acc, dia) => acc + dia.minutos, 0),
      tiempoPorDia,
      tareasPendientes,
    };
  }

  private async getAgenda(iglesiaId: string, ahora: Date, en30d: Date, desdeVentanaTendencias: Date) {
    const [proximosEventos, eventosRecientes] = await Promise.all([
      this.prisma.evento.count({ where: { iglesiaId, fechaInicio: { gte: ahora, lte: en30d } } }),
      this.prisma.evento.findMany({
        where: { iglesiaId, fechaInicio: { gte: desdeVentanaTendencias } },
        select: { fechaInicio: true },
      }),
    ]);

    return {
      proximosEventos,
      eventosPorMes: bucketPorMes(
        eventosRecientes.map((e) => e.fechaInicio),
        MESES_VENTANA_TENDENCIAS,
        ahora,
      ),
    };
  }

  private async getCeremonias(iglesiaId: string, ahora: Date, desdeVentanaTendencias: Date) {
    const certificadoWhere = { iglesiaId };
    const certificadoWhereReciente = { iglesiaId, createdAt: { gte: desdeVentanaTendencias } };

    const [
      matrimonios,
      bautizos,
      defunciones,
      presentaciones,
      matrimoniosRecientes,
      bautizosRecientes,
      defuncionesRecientes,
      presentacionesRecientes,
    ] = await Promise.all([
      this.prisma.matrimonio.count({ where: certificadoWhere }),
      this.prisma.bautizo.count({ where: certificadoWhere }),
      this.prisma.defuncion.count({ where: certificadoWhere }),
      this.prisma.presentacion.count({ where: certificadoWhere }),
      this.prisma.matrimonio.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.bautizo.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.defuncion.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.presentacion.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
    ]);

    const fechasRecientes = [
      ...matrimoniosRecientes,
      ...bautizosRecientes,
      ...defuncionesRecientes,
      ...presentacionesRecientes,
    ].map((r) => r.createdAt);

    return {
      total: matrimonios + bautizos + defunciones + presentaciones,
      porTipo: { matrimonios, bautizos, defunciones, presentaciones },
      porMes: bucketPorMes(fechasRecientes, MESES_VENTANA_TENDENCIAS, ahora),
    };
  }

  private async getIntegrantes(iglesiaId: string, hace30d: Date) {
    const [total, nuevosUltimoMes] = await Promise.all([
      this.prisma.integrante.count({ where: { iglesiaId } }),
      this.prisma.integrante.count({ where: { iglesiaId, createdAt: { gte: hace30d } } }),
    ]);

    return { total, nuevosUltimoMes };
  }

  /** Solo MANAGER: actividad de su propio equipo (tesoreros/secretarias), no de él mismo. */
  private async getEquipo(iglesiaId: string, ahora: Date) {
    const hace24h = new Date(ahora.getTime() - MS_POR_DIA);
    const hace7d = new Date(ahora.getTime() - 7 * MS_POR_DIA);

    const [usuariosActivosHoy, usuariosActivosSemana, totalUsuarios] = await Promise.all([
      this.prisma.usuario.count({ where: { iglesiaId, ultimoAccesoAt: { gte: hace24h } } }),
      this.prisma.usuario.count({ where: { iglesiaId, ultimoAccesoAt: { gte: hace7d } } }),
      this.prisma.usuario.count({
        where: { iglesiaId, activo: true, rol: { in: [Rol.MANAGER, Rol.USUARIO] } },
      }),
    ]);

    return { usuariosActivosHoy, usuariosActivosSemana, totalUsuarios };
  }
}

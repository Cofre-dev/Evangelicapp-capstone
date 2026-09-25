-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'PASTOR', 'TESORERO', 'SECRETARIA', 'MIEMBRO');

-- CreateEnum
CREATE TYPE "EstadoIglesia" AS ENUM ('ACTIVA', 'SUSPENDIDA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CULTO', 'REUNION', 'LIMPIEZA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoConfirmacionPredicador" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREACION', 'EDICION', 'ELIMINACION');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'EN_REVISION', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('RECORDATORIO', 'NOTA');

-- CreateTable
CREATE TABLE "iglesias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "logoUrl" TEXT,
    "comuna" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "direccion" TEXT,
    "estado" "EstadoIglesia" NOT NULL DEFAULT 'ACTIVA',
    "visitantesPromedio" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iglesias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "Rol" NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompletado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoEvento" NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "ubicacion" TEXT,
    "colorEtiqueta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predicadores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT,
    "email" TEXT NOT NULL,
    "tokenConfirmacion" TEXT NOT NULL,
    "estado" "EstadoConfirmacionPredicador" NOT NULL DEFAULT 'PENDIENTE',
    "respondidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,

    CONSTRAINT "predicadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_financieras" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iglesiaId" TEXT NOT NULL,

    CONSTRAINT "categorias_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "medioPago" "MedioPago" NOT NULL DEFAULT 'EFECTIVO',
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_auditoria" (
    "id" TEXT NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iglesiaId" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "movimientos_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNota" NOT NULL DEFAULT 'RECORDATORIO',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaLimite" TIMESTAMP(3),
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "asignadoAId" TEXT,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_iglesiaId_idx" ON "usuarios"("iglesiaId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuarioId_idx" ON "refresh_tokens"("usuarioId");

-- CreateIndex
CREATE INDEX "eventos_iglesiaId_fechaInicio_idx" ON "eventos"("iglesiaId", "fechaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "predicadores_tokenConfirmacion_key" ON "predicadores"("tokenConfirmacion");

-- CreateIndex
CREATE INDEX "predicadores_eventoId_idx" ON "predicadores"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_financieras_iglesiaId_nombre_tipo_key" ON "categorias_financieras"("iglesiaId", "nombre", "tipo");

-- CreateIndex
CREATE INDEX "movimientos_financieros_iglesiaId_fecha_idx" ON "movimientos_financieros"("iglesiaId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_auditoria_iglesiaId_createdAt_idx" ON "movimientos_auditoria"("iglesiaId", "createdAt");

-- CreateIndex
CREATE INDEX "notas_iglesiaId_fechaLimite_idx" ON "notas"("iglesiaId", "fechaLimite");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predicadores" ADD CONSTRAINT "predicadores_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_financieras" ADD CONSTRAINT "categorias_financieras_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financieras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_auditoria" ADD CONSTRAINT "movimientos_auditoria_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_auditoria" ADD CONSTRAINT "movimientos_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


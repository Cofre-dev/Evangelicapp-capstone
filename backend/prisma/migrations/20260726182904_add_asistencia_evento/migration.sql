-- CreateEnum
CREATE TYPE "EstadoConfirmacionAsistencia" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "notificarIntegrantes" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "asistencias_evento" (
    "id" TEXT NOT NULL,
    "tokenConfirmacion" TEXT NOT NULL,
    "estado" "EstadoConfirmacionAsistencia" NOT NULL DEFAULT 'PENDIENTE',
    "respondidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,
    "integranteId" TEXT NOT NULL,

    CONSTRAINT "asistencias_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_evento_tokenConfirmacion_key" ON "asistencias_evento"("tokenConfirmacion");

-- CreateIndex
CREATE INDEX "asistencias_evento_eventoId_idx" ON "asistencias_evento"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_evento_eventoId_integranteId_key" ON "asistencias_evento"("eventoId", "integranteId");

-- AddForeignKey
ALTER TABLE "asistencias_evento" ADD CONSTRAINT "asistencias_evento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias_evento" ADD CONSTRAINT "asistencias_evento_integranteId_fkey" FOREIGN KEY ("integranteId") REFERENCES "integrantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

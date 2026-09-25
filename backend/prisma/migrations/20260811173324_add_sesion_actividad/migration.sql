-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "ultimoAccesoAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sesiones_actividad" (
    "id" TEXT NOT NULL,
    "inicioAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoLatidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finAt" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "iglesiaId" TEXT,

    CONSTRAINT "sesiones_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sesiones_actividad_usuarioId_inicioAt_idx" ON "sesiones_actividad"("usuarioId", "inicioAt");

-- CreateIndex
CREATE INDEX "sesiones_actividad_iglesiaId_inicioAt_idx" ON "sesiones_actividad"("iglesiaId", "inicioAt");

-- CreateIndex
CREATE INDEX "usuarios_iglesiaId_ultimoAccesoAt_idx" ON "usuarios"("iglesiaId", "ultimoAccesoAt");

-- AddForeignKey
ALTER TABLE "sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

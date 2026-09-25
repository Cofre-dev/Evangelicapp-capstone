-- DropIndex
DROP INDEX "categorias_financieras_iglesiaId_nombre_tipo_key";

-- AlterTable
ALTER TABLE "categorias_financieras" ADD COLUMN     "departamentoId" TEXT;

-- AlterTable
ALTER TABLE "movimientos_financieros" ADD COLUMN     "departamentoId" TEXT;

-- CreateTable
CREATE TABLE "departamentos_financieros" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "departamentos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departamentos_financieros_iglesiaId_idx" ON "departamentos_financieros"("iglesiaId");

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_financieros_iglesiaId_nombre_key" ON "departamentos_financieros"("iglesiaId", "nombre");

-- CreateIndex
CREATE INDEX "categorias_financieras_iglesiaId_departamentoId_idx" ON "categorias_financieras"("iglesiaId", "departamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_financieras_iglesiaId_departamentoId_nombre_tipo_key" ON "categorias_financieras"("iglesiaId", "departamentoId", "nombre", "tipo");

-- CreateIndex
CREATE INDEX "movimientos_financieros_iglesiaId_departamentoId_fecha_idx" ON "movimientos_financieros"("iglesiaId", "departamentoId", "fecha");

-- AddForeignKey
ALTER TABLE "departamentos_financieros" ADD CONSTRAINT "departamentos_financieros_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamentos_financieros" ADD CONSTRAINT "departamentos_financieros_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_financieras" ADD CONSTRAINT "categorias_financieras_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos_financieros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos_financieros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


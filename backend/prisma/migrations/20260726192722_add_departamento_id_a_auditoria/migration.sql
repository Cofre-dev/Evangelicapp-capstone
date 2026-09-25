-- AlterTable
ALTER TABLE "movimientos_auditoria" ADD COLUMN     "departamentoId" TEXT;

-- CreateIndex
CREATE INDEX "movimientos_auditoria_iglesiaId_departamentoId_createdAt_idx" ON "movimientos_auditoria"("iglesiaId", "departamentoId", "createdAt");


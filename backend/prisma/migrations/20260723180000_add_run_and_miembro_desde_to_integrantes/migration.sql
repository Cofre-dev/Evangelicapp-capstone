-- AlterTable
ALTER TABLE "integrantes" ADD COLUMN     "miembroDesde" TIMESTAMP(3),
ADD COLUMN     "run" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "integrantes_iglesiaId_run_key" ON "integrantes"("iglesiaId", "run");

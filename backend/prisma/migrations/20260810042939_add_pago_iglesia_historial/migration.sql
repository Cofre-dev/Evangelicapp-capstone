-- CreateTable
CREATE TABLE "pagos_iglesia" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iglesiaId" TEXT NOT NULL,
    "registradoPorId" TEXT,

    CONSTRAINT "pagos_iglesia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_iglesia_iglesiaId_fecha_idx" ON "pagos_iglesia"("iglesiaId", "fecha");

-- AddForeignKey
ALTER TABLE "pagos_iglesia" ADD CONSTRAINT "pagos_iglesia_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_iglesia" ADD CONSTRAINT "pagos_iglesia_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

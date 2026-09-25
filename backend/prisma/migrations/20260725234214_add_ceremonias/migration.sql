-- CreateTable
CREATE TABLE "matrimonios" (
    "id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombreNovio" TEXT NOT NULL,
    "nombreNovia" TEXT NOT NULL,
    "nombrePastor" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "matrimonios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bautizos" (
    "id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombrePersona" TEXT NOT NULL,
    "nombrePastor" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "bautizos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defunciones" (
    "id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombreDifunto" TEXT NOT NULL,
    "nombrePastor" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "defunciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentaciones" (
    "id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombreNino" TEXT NOT NULL,
    "nombrePadres" TEXT NOT NULL,
    "nombrePastor" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "presentaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matrimonios_iglesiaId_fecha_idx" ON "matrimonios"("iglesiaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "matrimonios_iglesiaId_folio_key" ON "matrimonios"("iglesiaId", "folio");

-- CreateIndex
CREATE INDEX "bautizos_iglesiaId_fecha_idx" ON "bautizos"("iglesiaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "bautizos_iglesiaId_folio_key" ON "bautizos"("iglesiaId", "folio");

-- CreateIndex
CREATE INDEX "defunciones_iglesiaId_fecha_idx" ON "defunciones"("iglesiaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "defunciones_iglesiaId_folio_key" ON "defunciones"("iglesiaId", "folio");

-- CreateIndex
CREATE INDEX "presentaciones_iglesiaId_fecha_idx" ON "presentaciones"("iglesiaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "presentaciones_iglesiaId_folio_key" ON "presentaciones"("iglesiaId", "folio");

-- AddForeignKey
ALTER TABLE "matrimonios" ADD CONSTRAINT "matrimonios_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matrimonios" ADD CONSTRAINT "matrimonios_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bautizos" ADD CONSTRAINT "bautizos_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bautizos" ADD CONSTRAINT "bautizos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defunciones" ADD CONSTRAINT "defunciones_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defunciones" ADD CONSTRAINT "defunciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

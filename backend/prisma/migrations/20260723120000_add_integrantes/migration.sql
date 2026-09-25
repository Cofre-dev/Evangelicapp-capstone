-- AlterTable
ALTER TABLE "iglesias" ADD COLUMN     "integrantesQrToken" TEXT;

-- CreateTable
CREATE TABLE "integrantes" (
    "id" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,

    CONSTRAINT "integrantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integrantes_iglesiaId_idx" ON "integrantes"("iglesiaId");

-- CreateIndex
CREATE UNIQUE INDEX "integrantes_iglesiaId_email_key" ON "integrantes"("iglesiaId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "iglesias_integrantesQrToken_key" ON "iglesias"("integrantesQrToken");

-- AddForeignKey
ALTER TABLE "integrantes" ADD CONSTRAINT "integrantes_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

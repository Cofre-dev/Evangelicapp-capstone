-- AlterTable
ALTER TABLE "notas" ADD COLUMN     "archivado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "fotoUrl" TEXT;

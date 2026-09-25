-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('AGENDA', 'FINANZAS', 'CEREMONIAS', 'INTEGRANTES');

-- AlterEnum
-- Mapeo explícito en vez de cast directo: PASTOR -> MANAGER (rename real del rol) y
-- TESORERO/SECRETARIA -> USUARIO (por si quedara alguna fila viva pese a la limpieza
-- previa de usuarios de prueba) porque esos labels no existen en el enum nuevo.
BEGIN;
CREATE TYPE "Rol_new" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'USUARIO', 'MIEMBRO');
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE "Rol_new" USING (
  CASE "rol"::text
    WHEN 'PASTOR' THEN 'MANAGER'
    WHEN 'TESORERO' THEN 'USUARIO'
    WHEN 'SECRETARIA' THEN 'USUARIO'
    ELSE "rol"::text
  END::"Rol_new"
);
ALTER TYPE "Rol" RENAME TO "Rol_old";
ALTER TYPE "Rol_new" RENAME TO "Rol";
DROP TYPE "Rol_old";
COMMIT;

-- CreateTable
CREATE TABLE "accesos_modulo" (
    "id" TEXT NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "otorgadoPorId" TEXT,

    CONSTRAINT "accesos_modulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accesos_modulo_iglesiaId_idx" ON "accesos_modulo"("iglesiaId");

-- CreateIndex
CREATE UNIQUE INDEX "accesos_modulo_usuarioId_modulo_key" ON "accesos_modulo"("usuarioId", "modulo");

-- AddForeignKey
ALTER TABLE "accesos_modulo" ADD CONSTRAINT "accesos_modulo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_modulo" ADD CONSTRAINT "accesos_modulo_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_modulo" ADD CONSTRAINT "accesos_modulo_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


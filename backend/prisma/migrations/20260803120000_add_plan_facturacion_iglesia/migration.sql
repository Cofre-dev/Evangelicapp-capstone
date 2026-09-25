-- CreateEnum
CREATE TYPE "PlanIglesia" AS ENUM ('BASICO', 'MEDIO', 'PRO');

-- AlterTable
-- DEFAULT temporal solo para no romper las filas ya existentes (datos de prueba, no
-- producción real todavía — ver FEATURES.md). Se quita apenas termina el backfill:
-- la app (CreateIglesiaDto) exige "plan" y "proximaFacturacion" explícitos en cada
-- alta nueva, así que un DEFAULT permanente contradiría la regla de negocio "toda
-- iglesia elige su plan y su fecha de facturación al crearse".
ALTER TABLE "iglesias" ADD COLUMN     "plan" "PlanIglesia" NOT NULL DEFAULT 'BASICO',
ADD COLUMN     "proximaFacturacion" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
ADD COLUMN     "ultimoPagoAt" TIMESTAMP(3);

ALTER TABLE "iglesias" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "iglesias" ALTER COLUMN "proximaFacturacion" DROP DEFAULT;

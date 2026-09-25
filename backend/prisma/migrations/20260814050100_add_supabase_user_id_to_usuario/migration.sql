-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "supabaseUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_supabaseUserId_key" ON "usuarios"("supabaseUserId");

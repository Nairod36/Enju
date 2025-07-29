/*
  Warnings:

  - You are about to drop the `biomes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trees` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "biomes" DROP CONSTRAINT "biomes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "trees" DROP CONSTRAINT "trees_biome_id_fkey";

-- AlterTable
ALTER TABLE "islands" ADD COLUMN     "description" TEXT DEFAULT 'Mon île personnelle',
ADD COLUMN     "health_score" DECIMAL(5,2) NOT NULL DEFAULT 100,
ADD COLUMN     "last_update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "total_trees" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "biomes";

-- DropTable
DROP TABLE "trees";

-- DropEnum
DROP TYPE "PlantSpecies";

-- CreateIndex
CREATE INDEX "islands_health_score_idx" ON "islands"("health_score");

-- CreateIndex
CREATE INDEX "islands_total_trees_idx" ON "islands"("total_trees");

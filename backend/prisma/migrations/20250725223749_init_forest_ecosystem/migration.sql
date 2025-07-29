-- CreateEnum
CREATE TYPE "PlantSpecies" AS ENUM ('SEEDLING', 'SPROUT', 'SAPLING', 'TREE', 'GIANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "wallet_address" TEXT NOT NULL,
    "chain_id" INTEGER DEFAULT 1,
    "is_connected" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity_score" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "token_balance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "nonce" TEXT,
    "profile_image" TEXT,
    "bio" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biomes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Ma Forêt',
    "description" TEXT DEFAULT 'Mon biome personnel',
    "total_trees" INTEGER NOT NULL DEFAULT 0,
    "health_score" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "last_update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trees" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "biome_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "PlantSpecies" NOT NULL DEFAULT 'SEEDLING',
    "position_x" INTEGER NOT NULL,
    "position_y" INTEGER NOT NULL,
    "growth_level" INTEGER NOT NULL DEFAULT 1,
    "health" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "last_growth_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_health_check" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_alive" BOOLEAN NOT NULL DEFAULT true,
    "is_degraded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reward" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_wallet_address_idx" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_activity_score_idx" ON "users"("activity_score");

-- CreateIndex
CREATE INDEX "users_last_activity_at_idx" ON "users"("last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "biomes_user_id_key" ON "biomes"("user_id");

-- CreateIndex
CREATE INDEX "biomes_user_id_idx" ON "biomes"("user_id");

-- CreateIndex
CREATE INDEX "biomes_health_score_idx" ON "biomes"("health_score");

-- CreateIndex
CREATE INDEX "biomes_total_trees_idx" ON "biomes"("total_trees");

-- CreateIndex
CREATE INDEX "trees_biome_id_idx" ON "trees"("biome_id");

-- CreateIndex
CREATE INDEX "trees_health_is_alive_idx" ON "trees"("health", "is_alive");

-- CreateIndex
CREATE INDEX "trees_last_health_check_idx" ON "trees"("last_health_check");

-- CreateIndex
CREATE INDEX "trees_growth_level_idx" ON "trees"("growth_level");

-- CreateIndex
CREATE UNIQUE INDEX "trees_biome_id_position_x_position_y_key" ON "trees"("biome_id", "position_x", "position_y");

-- AddForeignKey
ALTER TABLE "biomes" ADD CONSTRAINT "biomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trees" ADD CONSTRAINT "trees_biome_id_fkey" FOREIGN KEY ("biome_id") REFERENCES "biomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

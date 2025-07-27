-- CreateTable
CREATE TABLE "islands" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "island_data" JSONB NOT NULL,
    "tree_count" INTEGER NOT NULL DEFAULT 0,
    "last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL DEFAULT '1.0.0',

    CONSTRAINT "islands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "island_trees" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "island_id" TEXT NOT NULL,
    "tree_data" JSONB NOT NULL,

    CONSTRAINT "island_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "island_chests" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "island_id" TEXT NOT NULL,
    "chest_data" JSONB NOT NULL,

    CONSTRAINT "island_chests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "island_used_tiles" (
    "id" TEXT NOT NULL,
    "island_id" TEXT NOT NULL,
    "tile_key" TEXT NOT NULL,

    CONSTRAINT "island_used_tiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "islands_user_id_idx" ON "islands"("user_id");

-- CreateIndex
CREATE INDEX "islands_is_active_idx" ON "islands"("is_active");

-- CreateIndex
CREATE INDEX "islands_seed_idx" ON "islands"("seed");

-- CreateIndex
CREATE INDEX "island_trees_island_id_idx" ON "island_trees"("island_id");

-- CreateIndex
CREATE INDEX "island_chests_island_id_idx" ON "island_chests"("island_id");

-- CreateIndex
CREATE INDEX "island_used_tiles_island_id_idx" ON "island_used_tiles"("island_id");

-- CreateIndex
CREATE UNIQUE INDEX "island_used_tiles_island_id_tile_key_key" ON "island_used_tiles"("island_id", "tile_key");

-- AddForeignKey
ALTER TABLE "islands" ADD CONSTRAINT "islands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "island_trees" ADD CONSTRAINT "island_trees_island_id_fkey" FOREIGN KEY ("island_id") REFERENCES "islands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "island_chests" ADD CONSTRAINT "island_chests_island_id_fkey" FOREIGN KEY ("island_id") REFERENCES "islands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "island_used_tiles" ADD CONSTRAINT "island_used_tiles_island_id_fkey" FOREIGN KEY ("island_id") REFERENCES "islands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

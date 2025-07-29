-- CreateTable
CREATE TABLE "public"."escrow_events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "escrow_address" TEXT NOT NULL,
    "hashlock" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "order_hash" TEXT,
    "maker" TEXT,
    "taker" TEXT,
    "amount" DOUBLE PRECISION,
    "token" TEXT,
    "chain_id" INTEGER NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "escrow_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escrow_events_tx_hash_key" ON "public"."escrow_events"("tx_hash");

-- CreateIndex
CREATE INDEX "escrow_events_hashlock_idx" ON "public"."escrow_events"("hashlock");

-- CreateIndex
CREATE INDEX "escrow_events_event_type_idx" ON "public"."escrow_events"("event_type");

-- CreateIndex
CREATE INDEX "escrow_events_created_at_idx" ON "public"."escrow_events"("created_at");

-- CreateIndex
CREATE INDEX "escrow_events_processed_idx" ON "public"."escrow_events"("processed");

-- CreateTable
CREATE TABLE "TickerMeta" (
    "id" SERIAL NOT NULL,
    "region" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT,
    "instrumentType" TEXT,
    "exchange" TEXT,
    "currency" TEXT,
    "nameOverridden" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TickerMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TickerMeta_region_ticker_key" ON "TickerMeta"("region", "ticker");

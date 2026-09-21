-- CreateTable
CREATE TABLE "DailySnapshot" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "holdingsValueSgd" DOUBLE PRECISION NOT NULL,
    "cashValueSgd" DOUBLE PRECISION NOT NULL,
    "totalValueSgd" DOUBLE PRECISION NOT NULL,
    "costBasisSgd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailySnapshot_date_key" ON "DailySnapshot"("date");

-- CreateIndex
CREATE INDEX "DailySnapshot_date_idx" ON "DailySnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_region_ticker_key" ON "WatchlistItem"("region", "ticker");

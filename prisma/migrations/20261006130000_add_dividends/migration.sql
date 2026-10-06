-- CreateTable
CREATE TABLE "Dividend" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "region" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "amountSgd" DOUBLE PRECISION NOT NULL,
    "withholding" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dividend_ticker_region_idx" ON "Dividend"("ticker", "region");

-- CreateIndex
CREATE INDEX "Dividend_date_idx" ON "Dividend"("date");

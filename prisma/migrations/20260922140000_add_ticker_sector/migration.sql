-- Hand-entered exposure tag for an instrument ("Banks", "Semiconductors",
-- "US Equity Index"). Nullable on purpose: no free data source classifies
-- these holdings, so an untagged instrument must read as unknown rather than
-- silently becoming an "Other" bucket in the exposure breakdown.
ALTER TABLE "TickerMeta" ADD COLUMN "sector" TEXT;

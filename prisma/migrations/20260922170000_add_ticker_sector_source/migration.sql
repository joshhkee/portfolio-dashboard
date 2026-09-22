-- Where a TickerMeta.sector came from.
--
-- "auto"   — suggested by lib/sectors.ts when the instrument was first seen
-- "manual" — set or edited by the owner
-- NULL     — no tag at all (the column is only meaningful beside `sector`)
--
-- Additive and nullable, so the currently deployed revision — which does not
-- know this column exists — keeps working against the same shared database.

ALTER TABLE "TickerMeta" ADD COLUMN "sectorSource" TEXT;

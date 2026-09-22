-- When a deposit actually ARRIVED, as opposed to the month it is attributed
-- to ("Contribution"."date", always that month's first day).
--
-- Attribution is what the outlay curve and the per-month pivot need, so it
-- cannot double as the payment date: a month funded two months late has to
-- keep belonging to its own month. Nullable on purpose — the historical sheet
-- recorded payment dates for the scheduled months, and an unknown date must
-- read as unknown rather than silently counting as on time.
ALTER TABLE "Contribution" ADD COLUMN "paidOn" TIMESTAMP(3);

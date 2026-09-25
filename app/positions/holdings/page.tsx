import { getOpenPositionsFor } from "@/lib/get-positions";
import PositionsTable from "@/components/PositionsTable";

export const dynamic = "force-dynamic";

/**
 * Every open position, once.
 *
 * This used to be three pages — `/positions/us`, `/positions/sg` and
 * `/positions/hk` — each rendering the same table with the same columns and
 * differing only in the region they filtered to. Three pages of one region each
 * made comparing markets a tab switch and a memory test, which is the exact
 * comparison a holdings table exists to support. The stacked cells in
 * PositionsTable are what made one page fit: eleven columns of figures became
 * eight, so all the rows sit in one table without horizontal scroll. The old
 * region URLs still resolve — `next.config.js` forwards them here, carrying the
 * `?ticker=` deep link the command palette uses.
 *
 * One consequence is deliberate and stated on the page: rows stay in each
 * market's NATIVE currency. Adding HK$ to S$ to US$ is not a number, and
 * converting every row to one currency would put the FX rate's daily move into
 * figures that are supposed to describe the holding. The totals and the
 * portfolio share ARE converted — to SGD, the currency the rest of the app
 * reports in — because a total has to be one currency to mean anything.
 */
export default async function OpenPositionsPage() {
  const rows = await getOpenPositionsFor(["US", "SG", "HK"], "SGD");

  return <PositionsTable rows={rows} displayCurrency="SGD" />;
}

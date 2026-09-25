import { redirect } from "next/navigation";

/**
 * The Positions section opens on its one table.
 *
 * Kept as a redirect rather than a landing page: there is no summary that would
 * be useful at this level that isn't already the dashboard's job. It used to
 * open on the US tab, which implied a region-first reading of the section; there
 * is one holdings page now, covering all three markets.
 */
export default function PositionsIndexPage() {
  redirect("/positions/holdings");
}

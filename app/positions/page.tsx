import { redirect } from "next/navigation";

/**
 * The Positions section opens on the US tab, matching the old Holdings index.
 * Kept as a redirect rather than a landing page: there is no summary that would
 * be useful at this level that isn't already the dashboard's job.
 */
export default function PositionsIndexPage() {
  redirect("/positions/us");
}

import { getOpenPositionsFor } from "@/lib/get-positions";
import PositionsTable from "@/components/PositionsTable";

export const dynamic = "force-dynamic";

export default async function OpenPositionsHKPage() {
  const rows = await getOpenPositionsFor(["HK"]);

  return <PositionsTable rows={rows} />;
}

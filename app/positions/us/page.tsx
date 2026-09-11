import { getOpenPositionsFor } from "@/lib/get-positions";
import PositionsTable from "@/components/PositionsTable";

export const dynamic = "force-dynamic";

export default async function OpenPositionsUSPage() {
  const rows = await getOpenPositionsFor(["US"]);

  return <PositionsTable rows={rows} />;
}

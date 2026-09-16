import { getOpenPositionsFor } from "@/lib/get-positions";
import PositionsTable from "@/components/PositionsTable";

export const dynamic = "force-dynamic";

export default async function OpenPositionsSGPage() {
  const rows = await getOpenPositionsFor(["SG"], "SGD");

  return <PositionsTable rows={rows} displayCurrency="SGD" />;
}

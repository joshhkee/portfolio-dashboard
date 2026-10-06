import { prisma } from "@/lib/prisma";
import DividendPanel from "@/components/DividendPanel";

export const dynamic = "force-dynamic";

export default async function DividendsPage() {
  const records = await prisma.dividend.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }] });
  return <DividendPanel records={records} />;
}

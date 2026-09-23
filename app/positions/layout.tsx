"use client";

import { Wallet, ListOrdered } from "lucide-react";
import RegionFlag from "@/components/RegionFlag";
import SectionTabs from "@/components/SectionTabs";

/**
 * The Positions object: what the portfolio HOLDS.
 *
 * One section with four tabs. Exposure lives here rather than in the top nav
 * because it answers a question about these same positions — "what am I in" —
 * with the same values regrouped; a peer nav slot made it look like a separate
 * body of work. Cash is NOT a tab here: it is money, not a position, and it
 * lives with the rest of the money in /money.
 */
export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs
        label="Positions"
        tabs={[
          { href: "/positions/us", label: "US", icon: <RegionFlag region="US" /> },
          { href: "/positions/sg", label: "SG", icon: <RegionFlag region="SG" /> },
          { href: "/positions/hk", label: "HK", icon: <RegionFlag region="HK" /> },
          {
            href: "/positions/exposure",
            label: "Exposure",
            icon: <Wallet size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
          // The ledger that built these positions, and the only place an entry
          // can be edited. It used to be a top-level page in its own right,
          // which read as if it were a peer of the positions it produced.
          //
          // Named for what it is: every row here is one transaction, and a
          // "trade" is only one of the two kinds it holds. The old name made
          // the page sound like a report of completed trades, which is a
          // different page (Performance · Realized).
          {
            href: "/positions/transactions",
            label: "Transactions",
            icon: <ListOrdered size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
        ]}
      />
      {children}
    </div>
  );
}

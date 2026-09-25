"use client";

import { Wallet, ListOrdered, Briefcase } from "lucide-react";
import SectionTabs from "@/components/SectionTabs";

/**
 * The Positions object: what the portfolio HOLDS.
 *
 * One section with three tabs. Exposure lives here rather than in the top nav
 * because it answers a question about these same positions — "what am I in" —
 * with the same values regrouped; a peer nav slot made it look like a separate
 * body of work. Cash is NOT a tab here: it is money, not a position, and it
 * lives with the rest of the money in /money.
 *
 * US / SG / HK used to be three tabs. They were the same table three times over
 * — same columns, same sort, one region filtered in — so comparing two markets
 * meant switching tabs and remembering figures, and the tab strip advertised a
 * distinction the page did not actually make. The stacked cells in
 * PositionsTable cut eleven columns of figures to eight, and the width that
 * freed is what put all three regions in ONE table with a Region column, which
 * is the comparison the pages were for. The per-region URLs still work (see
 * `next.config.js`), and the flags went with the tabs they distinguished.
 */
export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs
        label="Positions"
        tabs={[
          {
            href: "/positions/holdings",
            label: "Holdings",
            icon: <Briefcase size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
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

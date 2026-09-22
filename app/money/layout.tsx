"use client";

import { Wallet, PiggyBank } from "lucide-react";
import SectionTabs from "@/components/SectionTabs";

/**
 * The Money object: everything that happened to cash rather than to shares.
 *
 * Deposits (who paid what, when it arrived, whether the month is complete),
 * the currency conversions, and the balances those conversions left behind.
 * Cash sat under Holdings until now, which was wrong in an instructive way:
 * it is not a position and never contributed to any holdings figure, and every
 * page that had to say "holdings only, cash excluded" was working around it.
 */
export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs
        label="Money"
        tabs={[
          {
            href: "/money",
            label: "Deposits",
            icon: <PiggyBank size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
          {
            href: "/money/cash",
            label: "Cash",
            icon: <Wallet size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
        ]}
      />
      {children}
    </div>
  );
}

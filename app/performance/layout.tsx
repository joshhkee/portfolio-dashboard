"use client";

import { LineChart, Layers, CheckCircle2 } from "lucide-react";
import SectionTabs from "@/components/SectionTabs";

/**
 * The Performance object: how the portfolio has done, and why.
 *
 * Attribution is a tab here rather than a peer of it, because it answers the
 * same question one level deeper — "which holding, in which period, produced
 * this number" — over the same value series. The old layout gave it its own
 * top-level slot next to Performance-shaped pages, which made the nav list
 * reports rather than objects.
 */
export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs
        label="Performance"
        tabs={[
          {
            href: "/performance",
            label: "Returns & risk",
            icon: <LineChart size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
          {
            href: "/performance/attribution",
            label: "Attribution",
            icon: <Layers size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
          // Realized trades are a performance RESULT (what a closed position
          // actually earned), not a kitchen-sink page of their own.
          {
            href: "/performance/realized",
            label: "Realized",
            icon: <CheckCircle2 size={14} strokeWidth={1.75} className="text-ink-500" />,
          },
        ]}
      />
      {children}
    </div>
  );
}

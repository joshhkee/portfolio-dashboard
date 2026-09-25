import { SkeletonBar, SkeletonStatus } from "@/components/Skeleton";

/**
 * Cash: the three balances, then the exchange log.
 *
 * The balances are a fixed-cost row of cards; the log is the panel that takes
 * the rest and scrolls. It is a TABLE now — date, sold, bought, rate, priced by —
 * rather than a list of loose spans, so the placeholder uses the real
 * `.ledger-table` / `.table-scroll` classes: same five column widths, same
 * borders, same height, and the first logged exchange lands where the first
 * placeholder row was.
 */
export default function LoadingCash() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading cash balances" />
      <div className="page-bar">
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBar className="h-7 w-28 rounded-md" />
      </div>
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {["SGD", "USD", "HKD"].map((c) => (
          <div key={c} className="panel flex flex-col gap-2 p-5">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-7 w-32" />
            <SkeletonBar className="h-3 w-24" />
          </div>
        ))}
      </div>
      <section className="panel panel-fit">
        <div className="panel-head">
          <SkeletonBar className="h-3 w-28" />
          <SkeletonBar className="h-3 w-16" />
        </div>
        <div className="table-scroll">
          <table className="ledger-table table-compact">
            <thead>
              <tr>
                {["Date", "Sold", "Bought", "Rate", "Priced by"].map((label) => (
                  <th key={label} className={label === "Date" ? "cell-pad-start" : label === "Priced by" ? "cell-pad-end text-right" : "text-right"}>
                    <SkeletonBar className="h-3 w-14" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, r) => (
                <tr key={r}>
                  <td className="cell-pad-start">
                    <SkeletonBar className="h-4 w-20" />
                  </td>
                  {Array.from({ length: 3 }, (_, c) => (
                    <td key={c} className="text-right">
                      <SkeletonBar className="ml-auto h-4 w-20" />
                    </td>
                  ))}
                  <td className="cell-pad-end text-right">
                    <SkeletonBar className="ml-auto h-4 w-12" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

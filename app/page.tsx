import Link from "next/link";
import { Plus, TriangleAlert, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { NativeMoney, Percent, PlainMoney, formatAmount } from "@/components/SignedNumber";
import { currencySymbol, currencyForRegion, convertCurrency, fetchFxRates } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import { dayKey, getSnapshots, recordTodaySnapshot } from "@/lib/snapshots";
import { depositSchedule } from "@/lib/schedule";
import { readVisit } from "@/lib/session";
import PortfolioPerformance from "@/components/PortfolioPerformance";
import TopPositions from "@/components/TopPositions";

export const dynamic = "force-dynamic";

const sgd = currencySymbol.SGD;
const CURRENCY_TO_REGION: Record<string, string> = { SGD: "SG", USD: "US", HKD: "HK" };

interface AttentionItem {
  tone: "warn" | "info";
  text: string;
  href: string;
  linkLabel: string;
}

/** One row of the movers tile: the instrument, what it costs, and how far it
 *  moved today. */
interface MoverRow {
  region: string;
  ticker: string;
  valueSgd: number;
  /** Latest session's change as a fraction, e.g. 0.031 for +3.1%. */
  dayChangePct: number;
  /** Latest price in the holding's own currency. */
  price: number;
}

/**
 * One side of the movers tile.
 *
 * Each row is a link into that region's table with the ticker preselected, so
 * "what moved" is a door to "what is my position in it" rather than a dead
 * readout — the same pattern the largest-positions strip uses. An empty column
 * says so with a dash instead of collapsing, so the tile keeps its shape.
 */
function MoverColumn({ label, rows }: { label: string; rows: MoverRow[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-500">—</p>
      ) : (
        rows.map((row) => (
          <Link
            key={`${row.region}-${row.ticker}`}
            href={`/positions/${row.region.toLowerCase()}?ticker=${encodeURIComponent(
              row.ticker
            )}`}
            title={`S$${formatAmount(row.valueSgd)} held · ${row.ticker} at ${currencySymbol[currencyForRegion(row.region)]}${formatAmount(row.price)}`}
            className="flex items-baseline gap-2 text-xs transition hover:text-accent motion-reduce:transition-none"
          >
            <span className="num truncate text-ink-100">{row.ticker}</span>
            {/* The price, so a mover is a price you can act on rather than a
                percentage with nothing to attach it to. Neutral ink: a price
                is a value, and colour here means up or down. The change keeps
                a fixed width so the percentages line up down the column. */}
            <span className="num ml-auto shrink-0 text-ink-300">
              {currencySymbol[currencyForRegion(row.region)]}
              {formatAmount(row.price)}
            </span>
            <span className="num w-[3.75rem] shrink-0 text-right">
              <Percent value={row.dayChangePct} />
            </span>
          </Link>
        ))
      )}
    </div>
  );
}

/**
 * Today — the dashboard.
 *
 * It used to be a factsheet: twelve panels, three and a half screens, every
 * number the app can compute (risk stats, the calendar-year table, the
 * stakeholder split, the correlation matrix, recent activity) stacked in the
 * order the parts were built. It answered "what is everything" to someone whose
 * actual question on opening it is "what is it worth, am I on schedule, and does
 * anything need me".
 *
 * So this page is built around those three questions and nothing else:
 *
 *   the value, and what changed since you last looked
 *   a list of things that need a decision, drawn from data the app already has
 *   one chart, the deposit schedule as a single line, the largest positions
 *
 * The owner's rule for this page is that it must be readable in ONE look on a
 * desktop — no scrolling to reach the bottom of it. So on `lg` the last two
 * blocks sit SIDE BY SIDE (the chart beside the largest positions) rather than
 * stacked, and the chart takes whatever height the window has left instead of a
 * fixed 256px plot. A tall monitor gets a taller chart rather than 400px of
 * empty page; a short one still shows everything, down to the chart's minimum.
 * Anything that cannot shrink — the hero, the deposit line, the position rows —
 * is kept small enough that the row always fits, which is why those blocks are
 * measured rather than guessed at.
 *
 * Everything that used to be here still exists — it moved to the page that owns
 * it: the statistics and risk panel to /performance, attribution to
 * /performance/attribution, the stakeholder split and deposit schedule to
 * /money, the full ledger to /positions/trades. Nothing was deleted, and all of
 * it is a keystroke away in the command palette.
 */
export default async function TodayPage() {
  // Who is looking, and when they last did. Must be read BEFORE the snapshot
  // writer touches the stored rows, so the baseline is genuinely the previous
  // visit rather than this one.
  const visit = await readVisit();

  // Opportunistic, idempotent, throttled, fails soft — and deliberately on the
  // dashboard only. This is the page that gates "the series is current"; a
  // lens like /performance should not be writing rows as a side effect of being
  // looked at.
  await recordTodaySnapshot();

  // Every read is a round trip to a remote pooler, so they go out together and
  // the ledger is read ONCE and shared: getOpenPositionsFor() replays the same
  // rows this page already fetched.
  const [allTransactions, contributions, cashRows, rates, snapshots] = await Promise.all([
    prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
    prisma.contribution.findMany({ orderBy: { date: "asc" } }),
    prisma.cashBalance.findMany(),
    fetchFxRates(),
    getSnapshots(),
  ]);

  const positions = await getOpenPositionsFor(["US", "SG", "HK"], "SGD", rates, allTransactions);

  const holdingsValueSgd = positions.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  let cashTotalSgd = 0;
  for (const row of cashRows) {
    cashTotalSgd += convertCurrency(row.balance, CURRENCY_TO_REGION[row.currency], "SGD", rates);
  }
  const totalPortfolioValue = holdingsValueSgd + cashTotalSgd;

  const totalOutlay = contributions.reduce((sum, c) => sum + c.amount, 0);
  const growthAbsolute = totalPortfolioValue - totalOutlay;
  const growth = totalOutlay > 0 ? growthAbsolute / totalOutlay : 0;

  // --- What changed since this person last looked ---------------------------
  //
  // The baseline is a STORED daily value, not a live one, because a live value
  // from a previous visit was never recorded and cannot be invented. So the
  // comparison is deliberately day-precise: "since your last visit on 21 Sep",
  // against the value stored for that day.
  //
  // Without an account (the shared-password gate carries no identity) there is
  // no honest "last visit" at all, so it falls back to the previous recorded
  // day and says so, rather than pretending.
  const snapshotsAsc = snapshots;
  const latestDay = snapshotsAsc.length > 0 ? snapshotsAsc[snapshotsAsc.length - 1].date : null;
  const visitDay = visit.previousSeenAt ? dayKey(visit.previousSeenAt) : null;

  const baseline = visitDay
    ? snapshotsAsc.filter((s) => s.date <= visitDay).pop() ?? snapshotsAsc[0] ?? null
    : snapshotsAsc.length >= 2
      ? snapshotsAsc[snapshotsAsc.length - 2]
      : null;

  const sinceChange = baseline ? totalPortfolioValue - baseline.totalValueSgd : null;
  const sincePct =
    baseline && baseline.totalValueSgd > 0 && sinceChange !== null
      ? sinceChange / baseline.totalValueSgd
      : null;
  // New money is not a return. When deposits landed since the baseline, the part
  // of the change that is simply more contributions is separated out, so a
  // deposit month cannot read as a good month.
  const sinceNewMoney = baseline ? Math.max(0, totalOutlay - baseline.costBasisSgd) : 0;

  const baselineCaption =
    sinceChange === null || !baseline
      ? null
      : visitDay === null
        ? `since the last recorded day (${formatShortDate(new Date(`${baseline.date}T00:00:00Z`))})`
        : baseline.date === latestDay
          ? "since the value stored earlier today"
          : `since your last visit on ${formatShortDate(new Date(`${baseline.date}T00:00:00Z`))}`;

  // --- The deposit schedule, as one line --------------------------------
  const schedule = depositSchedule(
    contributions.map((c) => ({ label: c.label, date: c.date, paidOn: c.paidOn }))
  );
  const latestMonth = schedule.rows[schedule.rows.length - 1] ?? null;
  const nextMonth = latestMonth
    ? (() => {
        const [y, m] = latestMonth.month.split("-").map(Number);
        const start = Date.UTC(y, m, 1); // one month after the latest recorded
        const end = Date.UTC(y, m + 1, 0);
        return { label: new Date(start).toISOString().slice(0, 7), dueBy: end };
      })()
    : null;
  const nextOverdue = nextMonth ? Date.now() > nextMonth.dueBy : false;

  // --- Today's movers ---------------------------------------------------
  //
  // The tile used to be "Needs attention", which was the wrong half of the
  // day: on a portfolio built by monthly deposits there is usually nothing to
  // decide, so the panel spent most of its life saying "Nothing needs you".
  // What changes every day is what moved — and that data is already in hand,
  // because the same chart call that prices each position reports the latest
  // session's change (see QuoteMeta.dayChangePct). No new request, no new
  // store.
  //
  // Ranked by PERCENT, not by dollars: the question "what is happening" is
  // answered by the biggest move, and ranking by value would just print the
  // largest holdings back every day. Positions with no reported change are
  // left out rather than shown as flat — a missing quote is not a flat day.
  const moved: MoverRow[] = positions.flatMap((p) =>
    p.dayChangePct === null
      ? []
      : [
          {
            region: p.region,
            ticker: p.ticker,
            valueSgd: p.totalHoldingsConverted,
            dayChangePct: p.dayChangePct,
            price: p.currentPrice,
          },
        ]
  );
  const byChange = [...moved].sort((a, b) => b.dayChangePct - a.dayChangePct);
  const gainers = byChange.filter((p) => p.dayChangePct > 0).slice(0, 3);
  const losers = byChange
    .filter((p) => p.dayChangePct < 0)
    .slice(-3)
    .reverse();

  // --- And the things that genuinely need you ---------------------------
  //
  // Kept to signals that mean a number on screen is wrong or a month has
  // closed unrecorded. Two nudges were deliberately dropped from here because
  // they are housekeeping rather than decisions, and each already has a page
  // that owns it: untagged sectors (it is the whole point of
  // /positions/exposure) and cash sitting idle (the owner's model parks money
  // in the account on purpose, since nothing here earns interest, so ageing
  // cash is not a problem to report).
  const urgent: AttentionItem[] = [];

  if (nextMonth && nextOverdue) {
    urgent.push({
      tone: "warn",
      text: `No deposit recorded for ${formatMonthKey(nextMonth.label)} — the month has closed.`,
      href: "/money",
      linkLabel: "Record it",
    });
  }
  const unpriced = positions.filter((p) => p.priceUnavailable);
  if (unpriced.length > 0) {
    urgent.push({
      tone: "warn",
      text: `${unpriced.length} position${unpriced.length === 1 ? "" : "s"} have no live quote and are valued at cost (${unpriced
        .map((p) => p.ticker)
        .slice(0, 3)
        .join(", ")}${unpriced.length > 3 ? "…" : ""}).`,
      href: `/positions/${unpriced[0].region.toLowerCase()}`,
      linkLabel: "See them",
    });
  }

  const top = [...positions]
    .sort((a, b) => b.totalHoldingsConverted - a.totalHoldingsConverted)
    .slice(0, 5)
    .map((p) => ({
      region: p.region,
      ticker: p.ticker,
      name: p.name,
      valueSgd: p.totalHoldingsConverted,
      plPct: p.unrealizedPLPct,
      priceUnavailable: p.priceUnavailable,
    }));

  return (
    // The height is DEFINITE on `lg`, and that is what makes the chart's `fill`
    // work: the chart's height is "whatever is left", which is only a question
    // with an answer if the page has a height to divide up. 121px is the chrome
    // above it — the 57px bar plus main's 32px padding top and bottom — measured,
    // not guessed. If a window is genuinely too short for the fixed blocks, the
    // row overflows and the page scrolls, which is the honest degrade.
    //
    // The gaps are tight on purpose: every 4px here comes out of the chart's
    // height budget.
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh_-_121px)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm text-ink-300">Today</h1>
          <p className="text-xs text-ink-500">
            {positions.length} position{positions.length === 1 ? "" : "s"} · S$
            {formatAmount(cashTotalSgd)} cash
            {visit.account ? ` · signed in as ${visit.account.username}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/positions/trades?add=1" className="btn-primary flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.5} />
            Log a trade
          </Link>
          <Link href="/money?add=1" className="btn-ghost flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.5} />
            Record a deposit
          </Link>
        </div>
      </div>

      {/* The value, and the change since this person was last here — the two
          things someone opening the dashboard actually came for. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel flex flex-col gap-4 p-5 lg:col-span-2">
          <div>
            <p className="text-xs text-ink-300">Total portfolio value (S$, holdings + cash)</p>
            {/* A total is not a gain, so it carries no green: colour in this
                app means "up or down", and a figure that is simply the sum of
                what you own would be green whatever happened to it. See the
                colour rule in docs/PLAN.md. */}
            <p className="num mt-1 text-4xl font-medium text-ink-100">
              <PlainMoney value={totalPortfolioValue} symbol={sgd} />
            </p>
          </div>

          {sinceChange !== null && baselineCaption && (
            <div className="flex flex-col gap-1">
              <p className="num text-lg">
                <NativeMoney value={sinceChange} symbol={sgd} showPlus />
                {sincePct !== null && (
                  <span className="ml-2 text-sm">
                    (<Percent value={sincePct} />)
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-500">
                {baselineCaption}
                {sinceNewMoney > 0.5 && (
                  <>
                    {" — of which S$"}
                    {formatAmount(sinceNewMoney)} is new deposits, so the rest is market movement
                  </>
                )}
                .
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 border-t border-ink-700 pt-4">
            <p className="text-xs text-ink-300">
              Since inception{" "}
              <span className="num ml-1 text-sm text-ink-100">
                <NativeMoney value={growthAbsolute} symbol={sgd} showPlus />
              </span>{" "}
              <span className="num text-sm">
                (<Percent value={growth} />)
              </span>
            </p>
            <p className="text-xs text-ink-300">
              Contributed{" "}
              <span className="num ml-1 text-sm text-ink-100">
                {sgd}
                {formatAmount(totalOutlay)}
              </span>{" "}
              across {new Set(contributions.map((c) => c.contributorId)).size} people
            </p>
          </div>
        </div>

        {/* The day's movers, then anything that genuinely needs a decision.
            Gainers and losers sit in two columns so six rows cost three rows
            of height — this page's rule is that it fits one screen. */}
        <div className="panel flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-300">
              Today&apos;s movers
            </p>
            <p className="text-[10px] text-ink-500" title="Change since the previous close, per the quote source.">
              latest session
            </p>
          </div>

          {gainers.length === 0 && losers.length === 0 ? (
            <p className="text-sm text-ink-300">No live quotes to compare yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4">
              <MoverColumn label="Gainers" rows={gainers} />
              <MoverColumn label="Losers" rows={losers} />
            </div>
          )}

          {urgent.length > 0 && (
            <ul className="mt-1 flex flex-col gap-2 border-t border-ink-700 pt-3">
              {urgent.map((item) => (
                <li key={item.text} className="flex items-start gap-2">
                  <TriangleAlert size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-loss" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink-100">{item.text}</span>
                    <Link
                      href={item.href}
                      className="text-xs text-ink-500 transition hover:text-accent motion-reduce:transition-none"
                    >
                      {item.linkLabel} →
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* The schedule, in one line: what is in, and what is next due. Whether a
          month's money landed inside its own month is deliberately not said
          here — deposits are bulk and sometimes late on purpose, and since
          nothing in the account earns interest there is no cost to correcting
          that, so it is a note the schedule page keeps, not a headline. */}
      {latestMonth && nextMonth && (
        <Link
          href="/money"
          className="panel flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-xs transition hover:border-ink-500 motion-reduce:transition-none"
        >
          <span className="font-medium uppercase tracking-wide text-ink-300">Deposits</span>
          <span className="text-ink-100">
            {latestMonth.label} recorded · {schedule.measuredMonths} months in
          </span>
          <span className="text-ink-500">·</span>
          <span className={nextOverdue ? "text-loss" : "text-ink-300"}>
            {formatMonthKey(nextMonth.label)} {nextOverdue ? "is overdue" : "due by"}{" "}
            {formatShortDate(new Date(nextMonth.dueBy))}
          </span>
          <ChevronRight size={13} strokeWidth={2} className="ml-auto text-ink-500" />
        </Link>
      )}

      {/* The bottom of the page, SIDE BY SIDE on `lg`: the one chart the
          dashboard owns, and the largest positions.

          Stacked, these two measured 376 + 373 = 749px of the page's height,
          which is what pushed the bottom of it off a laptop screen. Beside each
          other the row is as tall as its taller half, and the chart is the
          column that flexes: `fill` hands it the leftover height instead of the
          fixed 256px plot, so a taller window spends the space on the chart
          rather than on whitespace. */}
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-5">
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-3">
          <PortfolioPerformance data={snapshots} charts="value" fill />
          <p className="text-right text-xs">
            <Link
              href="/performance"
              className="text-ink-500 transition hover:text-accent motion-reduce:transition-none"
            >
              Returns, risk and the benchmark comparison →
            </Link>
          </p>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-2">
          <TopPositions
            rows={top}
            totalCount={positions.length}
            hiddenCount={top.length}
            fill
          />
        </div>
      </div>
    </div>
  );
}

/** "2026-10" -> "Oct 2026", for a month label the schedule talks in. */
function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

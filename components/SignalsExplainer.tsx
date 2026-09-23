"use client";

import { useState } from "react";

/**
 * What the four signals measure, and what people usually do with them.
 *
 * This exists because the tiles state facts and stop, which was a deliberate
 * first choice and turned out to be too far the other way: "RSI 27" and "below
 * its 200-day average" are only useful to someone who already knows what those
 * mean for a purchase. So each one gets what it measures, how it is normally
 * read, and the caveat that makes it honest — a description of the past, not a
 * prediction, and nothing at all about the business.
 *
 * Collapsible for the same reason the benchmark explainer is: several
 * paragraphs of commentary do not belong open by default on a page whose rule is
 * one glance, and a tooltip would be unreachable on touch. `aria-expanded` +
 * `aria-controls`, so it works from a keyboard and a screen reader too.
 */
export default function SignalsExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel border-ink-700 bg-ink-900/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="signals-explainer"
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-xs text-ink-300 transition hover:text-ink-100 motion-reduce:transition-none"
      >
        <span className="min-w-0">
          <span className="text-ink-100">How to read these</span>
          <span className="text-ink-500"> — what each one means for buying, and where it misleads</span>
        </span>
        <span className="shrink-0 text-ink-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div
          id="signals-explainer"
          className="flex flex-col gap-3 border-t border-ink-700 px-4 py-3 text-xs leading-relaxed text-ink-300"
        >
          {/* Two columns rather than a stack of four: each measure is a short
              paragraph, and four paragraphs at the full panel width is a wall
              of one-long-line prose. Two columns halve the line length and put
              the measures side by side, which is also how they are read — as
              four answers to one question. */}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-ink-100">Position in the 1-year range</dt>
              <dd className="mt-1">
                Where today&apos;s price sits between the lowest and highest close of the past
                year — the left end is the year&apos;s cheapest price, the right end its most
                expensive. A low reading means you are buying nearer the bottom of the year than
                the top, which is all it means: a share at 20% of its range is there because
                something pushed it down, and sometimes that is an opportunity and sometimes it is
                the market being right. Use it to choose a level, not to justify one.
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-ink-100">Below the 1-year high</dt>
              <dd className="mt-1">
                The same fact in the form most people quote it. Under about 5% means you are
                buying at or near the year&apos;s high — the trend is with you, but there is no
                cushion, so a stop has to sit close and will be hit by ordinary noise. Past 20% is
                where the market has already repriced the instrument, and the question stops being
                &quot;is it cheap&quot; and becomes &quot;has the reason it fell changed&quot;.
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-ink-100">RSI (14)</dt>
              <dd className="mt-1">
                How one-sided the last 14 sessions were, from 0 to 100. Below 30 is the
                conventional &quot;sold off hard&quot; reading — often the better entry, provided
                the business is intact — and above 70 is &quot;run up hard&quot;, which is not a
                sell signal but is a bad moment to chase. It can sit at either extreme for weeks,
                so treat it as &quot;is this stretched right now&quot;, never as a date.
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-ink-100">Trend (price vs the 50- and 200-day averages)</dt>
              <dd className="mt-1">
                The average is what the price has averaged lately, so the two lines together say
                which way it has been going. An <span className="text-ink-100">uptrend</span> means
                price above a rising average — the classic &quot;buy the pullback&quot; setup, and
                Mixed usually describes exactly that: a dip inside a rising trend. A{" "}
                <span className="text-ink-100">downtrend</span> is where cheap keeps getting
                cheaper, and where a low range reading is least reassuring.
              </dd>
            </div>
          </dl>

          <p className="border-t border-ink-800 pt-3 text-ink-500">
            How they combine: an entry level near the year&apos;s low, in an instrument whose
            longer trend is still up, and with RSI near or below the oversold band, is the setup
            these four describe. The reading they cannot give you is whether the company is worth
            owning — these are prices, and prices alone do not know that. Nothing here is a
            recommendation, and none of it accounts for how much of the portfolio one position
            should be.
          </p>
        </div>
      )}
    </div>
  );
}

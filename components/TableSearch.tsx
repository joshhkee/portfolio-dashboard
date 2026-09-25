"use client";

import { createContext, useContext, useMemo, useState } from "react";
import SearchBox from "@/components/SearchBox";

interface TableSearchState {
  /** What has been typed into the page bar's field. */
  query: string;
  setQuery: (query: string) => void;
  /** How many rows the filtered table is showing, or null before the table
   *  has reported — the count lives in the page bar while the filtering
   *  lives in the table, and the two have to agree. */
  shown: number | null;
  setShown: (shown: number) => void;
}

const TableSearchContext = createContext<TableSearchState | null>(null);

/**
 * The filter shared between a page bar and the table it filters.
 *
 * The ledger's search box used to sit in the table's own head row with a
 * "Newest first" caption beside it — a whole row of a one-screen page spent on a
 * caption that said nothing (`Newest first` is the default and the column header
 * already carries the arrow) and a field that filters the rows directly beneath
 * it. Moving the field up into the page bar, where the count and the export
 * button already are, returns that row to the table: `.table-scroll` is `flex-1`
 * inside the page, so ~36px of chrome is ~36px of rows.
 *
 * That move is why this exists. The page bar is written by the PAGE (a server
 * component) and the filtering happens in the table (a client component), so the
 * one piece of state they both need has to live above both. The provider owns
 * the query; the page renders `<TableSearchField>` where the field belongs and
 * `<TableSearchCount>` beside the count it qualifies; the table reads the query
 * and reports how many rows survived it.
 *
 * The count is the part worth stating: without it, filtering leaves the page bar
 * claiming "64 entries" over a table showing 12 rows. The table publishes its
 * filtered length back here after render, and `TableSearchCount` prints
 * `12 of 64 entries` while a query is active and plain `64 entries` otherwise.
 *
 * Not the command palette (§7): that is the global search for pages, tickers and
 * actions. This only ever filters the table it is wrapped around.
 */
export function TableSearch({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<number | null>(null);

  const value = useMemo<TableSearchState>(
    () => ({ query, setQuery, shown, setShown }),
    [query, shown]
  );

  return <TableSearchContext.Provider value={value}>{children}</TableSearchContext.Provider>;
}

export function useTableSearch(): TableSearchState {
  const state = useContext(TableSearchContext);
  if (!state) throw new Error("useTableSearch must be used inside <TableSearch>");
  return state;
}

/** The field itself, bound to the shared query. Renders `SearchBox`, so the
 *  input's look stays in one place. */
export function TableSearchField({
  placeholder,
  ariaLabel,
}: {
  placeholder?: string;
  ariaLabel?: string;
}) {
  const { query, setQuery } = useTableSearch();
  return (
    <SearchBox value={query} onChange={setQuery} placeholder={placeholder} ariaLabel={ariaLabel} />
  );
}

/** The count that sits with the page's own figures. Reads the query, so it says
 *  what is SHOWING rather than what exists — the number a reader can check
 *  against the table. */
export function TableSearchCount({
  total,
  singular,
  plural,
}: {
  total: number;
  singular: string;
  plural: string;
}) {
  const { query, shown } = useTableSearch();
  const filtering = query.trim().length > 0;
  const value = filtering && shown !== null ? `${shown} of ${total}` : String(total);
  const unit = !filtering && total === 1 ? singular : plural;

  return (
    <p className="num text-xs text-ink-500" title={filtering ? "Rows matching your search." : undefined}>
      {value} {unit}
    </p>
  );
}

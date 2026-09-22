// Ranking for the Cmd/Ctrl+K command palette.
//
// Kept pure and separate from the component for one reason: ranking is the
// part users actually notice when it's wrong (typing "hold" and getting
// "Watchlist" first), and a pure function is the only form of it that can be
// pinned by tests. The component stays responsible for keyboard handling and
// rendering, nothing else.

/**
 * Window event that opens the palette.
 *
 * The nav's trigger button and the palette itself are separate components
 * rendered in different places, and this is deliberately not shared React
 * state: a custom event needs no context provider, no prop drilling through
 * the layout, and keeps the palette the only thing that knows about its own
 * open/closed state.
 */
export const OPEN_PALETTE_EVENT = "portfolio:open-palette";

export interface Command {
  /** Stable identity, used as the React key and for de-duplication. */
  id: string;
  /** What the user reads and types against. */
  label: string;
  /** Grouping shown to the right of the label, e.g. "Holdings". */
  group: string;
  /** Where selecting it goes. */
  href: string;
  /** Secondary text (e.g. the instrument name), shown dimmed. */
  hint?: string;
  /** Extra searchable text that isn't displayed, e.g. "sg d05 dbs". */
  keywords?: string;
}

/** How many results the palette shows at once. */
export const COMMAND_LIMIT = 8;

/**
 * Rank commands against a query and return the top matches.
 *
 * Tiers, best first:
 *   0. exact label match
 *   1. label starts with the query          ("hold" → "Holdings")
 *   2. a word inside the label starts with it ("trans" → "Log a transaction")
 *   3. the query appears anywhere in label/hint/keywords
 *
 * Ties are alphabetical so the order is stable between keystrokes — a list
 * that reshuffles unpredictably as you type is worse than a slightly worse
 * ranking. An empty query returns the first `limit` commands in their
 * natural (already curated) order, which is what makes opening the palette
 * useful before typing anything.
 */
export function filterCommands(
  commands: Command[],
  query: string,
  limit: number = COMMAND_LIMIT
): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands.slice(0, limit);

  const scored: { command: Command; score: number }[] = [];

  for (const command of commands) {
    const label = command.label.toLowerCase();
    const haystack = `${label} ${(command.keywords ?? "").toLowerCase()} ${(
      command.hint ?? ""
    ).toLowerCase()}`;

    let score: number;
    if (label === q) score = 0;
    else if (label.startsWith(q)) score = 1;
    else if (label.split(/\s+/).some((word) => word.startsWith(q))) score = 2;
    else if (haystack.includes(q)) score = 3;
    else continue;

    scored.push({ command, score });
  }

  scored.sort(
    (a, b) => a.score - b.score || a.command.label.localeCompare(b.command.label)
  );
  return scored.slice(0, limit).map((s) => s.command);
}

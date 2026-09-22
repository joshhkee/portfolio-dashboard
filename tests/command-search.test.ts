import { describe, it, expect } from "vitest";
import { filterCommands, type Command } from "@/lib/command-search";

function cmd(label: string, extra: Partial<Command> = {}): Command {
  return { id: label, label, group: "Pages", href: "/", ...extra };
}

const commands: Command[] = [
  cmd("Home", { href: "/" }),
  cmd("Holdings", { href: "/holdings/us" }),
  cmd("Watchlist", { href: "/watchlist" }),
  cmd("Log a transaction", { href: "/transactions?add=1", keywords: "buy sell add" }),
  cmd("Record a deposit", { href: "/outlay?add=1", keywords: "contribution outlay" }),
  cmd("US VOO", {
    group: "Holdings",
    href: "/holdings/us?ticker=VOO",
    hint: "Vanguard S&P 500 ETF",
  }),
];

describe("filterCommands", () => {
  it("returns the curated order for an empty query", () => {
    expect(filterCommands(commands, "").map((c) => c.label)).toEqual([
      "Home",
      "Holdings",
      "Watchlist",
      "Log a transaction",
      "Record a deposit",
      "US VOO",
    ]);
  });

  it("ranks an exact label match first", () => {
    expect(filterCommands(commands, "holdings")[0].label).toBe("Holdings");
  });

  it("ranks a label prefix above a mid-word match", () => {
    // "wa" is a prefix of Watchlist; it's also inside nothing else here.
    expect(filterCommands(commands, "wa")[0].label).toBe("Watchlist");
  });

  it("matches a later word in the label", () => {
    const results = filterCommands(commands, "transaction");
    expect(results[0].label).toBe("Log a transaction");
  });

  it("matches hidden keywords that aren't in the label", () => {
    const results = filterCommands(commands, "buy");
    expect(results.map((c) => c.label)).toContain("Log a transaction");
  });

  it("matches the dimmed hint text", () => {
    const results = filterCommands(commands, "vanguard");
    expect(results.map((c) => c.label)).toEqual(["US VOO"]);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(filterCommands(commands, "  WATCH  ")[0].label).toBe("Watchlist");
  });

  it("returns nothing when nothing matches", () => {
    expect(filterCommands(commands, "zzzz")).toEqual([]);
  });

  it("caps the number of results", () => {
    const many = Array.from({ length: 30 }, (_, i) => cmd(`Item ${i}`));
    expect(filterCommands(many, "item", 8)).toHaveLength(8);
    expect(filterCommands(many, "", 3)).toHaveLength(3);
  });

  it("orders ties alphabetically so the list doesn't reshuffle while typing", () => {
    const ties = [cmd("Zeta fund"), cmd("Alpha fund"), cmd("Mid fund")];
    expect(filterCommands(ties, "fund").map((c) => c.label)).toEqual([
      "Alpha fund",
      "Mid fund",
      "Zeta fund",
    ]);
  });

  it("prefers a prefix match over a keyword match", () => {
    const list = [cmd("Watchlist"), cmd("Holdings", { keywords: "watch portfolio" })];
    expect(filterCommands(list, "watch")[0].label).toBe("Watchlist");
  });
});

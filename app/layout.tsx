import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import CommandPalette from "@/components/CommandPalette";
import { accountAdminContext } from "@/lib/account-admin";

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Investments",
  description: "Personal portfolio ledger and dashboard",
};

/**
 * The chrome, with the session resolved once for the whole app.
 *
 * The nav needs to know whether to offer the accounts page, and the answer
 * depends on who is signed in — so it is resolved here, on the server, and
 * handed to the (client) nav. This file is already the one place every page
 * passes through, which is what keeps it a single query rather than one per
 * page that wants it.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // `view`, not `manage`: the accounts page is where a member REQUESTS an
  // account, so the link has to be reachable by someone who cannot manage one —
  // the page itself says which of the two they are.
  const { me, view } = await accountAdminContext();

  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        {/* The shell. ONE screen tall, and the only thing inside it that can
            scroll is <main> — which from `lg` never needs to, because every
            page is written in `.screen` / `.panel-fit` (see globals.css) so
            its content fits the height it is given and anything that outgrows
            its box scrolls inside itself.

            `h-dvh`, not `min-h-screen`: the difference is the mobile address
            bar, and a page measured against `100vh` on a phone is a page whose
            bottom row sits under the browser's chrome. `overflow-hidden` here
            is what makes "the page does not scroll" true at the shell level
            rather than a claim about each page's content — the scroll region
            is <main>, and on a window too short for a page's fixed blocks
            <main> is where the scrollbar appears. Hiding it rather than
            letting it scroll would clip the last panel, which DESIGN.md §4
            forbids ("nothing inside a panel should ever be cut in half").

            The padding is 16px rather than the 32px this used to carry: every
            pixel here comes out of the screen's budget, and the pages supply
            their own gaps. */}
        <div className="flex h-dvh flex-col overflow-hidden">
          <Nav account={{ username: me?.username ?? null, canManage: view.ok }} />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
            {children}
          </main>
          {/* Mounted once for the whole app so Cmd/Ctrl+K works from any
              page; it renders nothing until opened. */}
          <CommandPalette />
        </div>
      </body>
    </html>
  );
}

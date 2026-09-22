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
        <div className="flex min-h-screen flex-col">
          <Nav account={{ username: me?.username ?? null, canManage: view.ok }} />
          <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
          {/* Mounted once for the whole app so Cmd/Ctrl+K works from any
              page; it renders nothing until opened. */}
          <CommandPalette />
        </div>
      </body>
    </html>
  );
}

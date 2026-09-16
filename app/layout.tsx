import type { Metadata } from "next";
import { JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

// Both are variable fonts, so the full weight range is available
// (font-medium / font-semibold still work) without pinning weights.
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="mx-auto min-w-0 w-full max-w-[1180px] flex-1 px-6 py-10 sm:px-10 sm:py-12">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

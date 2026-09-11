// Seeds the database with the historical data pulled from the existing
// Google Sheet, so the app isn't empty on first run. Safe to run once
// against a fresh database — re-running it will duplicate rows, since
// there's no natural unique key on a transaction/contribution.
//
// Run with: npm run seed

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONTRIBUTORS = ["Josh", "Roy", "Chin", "Keng", "Zhiming"] as const;

// [label, date, amounts-by-contributor] — zero/undefined amounts are skipped.
const CONTRIBUTION_ROWS: [string, string, Partial<Record<(typeof CONTRIBUTORS)[number], number>>][] = [
  ["Initial Investment", "2025-03-01", { Josh: 1252, Roy: 2500, Keng: 2500, Zhiming: 2500 }],
  ["MAR (2025)", "2025-03-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["APR (2025)", "2025-04-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 4400, Zhiming: 500 }],
  ["MAY (2025)", "2025-05-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["JUN (2025)", "2025-06-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["JUL (2025)", "2025-07-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["AUG (2025)", "2025-08-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["SEP (2025)", "2025-09-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["OCT (2025)", "2025-10-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["NOV (2025)", "2025-11-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["DEC (2025)", "2025-12-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["JAN (2026)", "2026-01-01", { Josh: 1000, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["FEB (2026)", "2026-02-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["MAR (2026)", "2026-03-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["Additional", "2026-03-15", { Keng: 1945 }],
  ["APR (2026)", "2026-04-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["MAY (2026)", "2026-05-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["JUN (2026)", "2026-06-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["JUL (2026)", "2026-07-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["AUG (2026)", "2026-08-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
  ["SEP (2026)", "2026-09-01", { Josh: 500, Roy: 500, Chin: 200, Keng: 500, Zhiming: 500 }],
];

interface SeedTxn {
  date: string;
  action: "Buy" | "Sell";
  ticker: string;
  region: "US" | "SG" | "HK";
  qty: number;
  price: number;
  notes: string;
}

const TRANSACTIONS: SeedTxn[] = [
  { date: "2025-03-03", action: "Buy", ticker: "VOO", region: "US", qty: 5, price: 546.0, notes: "VOO - Vanguard S&P 500 ETF" },
  { date: "2025-03-03", action: "Buy", ticker: "D05", region: "SG", qty: 100, price: 45.7, notes: "D05 - DBS" },
  { date: "2025-04-03", action: "Buy", ticker: "B", region: "US", qty: 50, price: 18.35, notes: "B - Barrick Mining" },
  { date: "2025-04-24", action: "Buy", ticker: "B", region: "US", qty: 50, price: 19.0, notes: "B - Second Buy" },
  { date: "2025-06-02", action: "Sell", ticker: "B", region: "US", qty: 100, price: 21.5, notes: "B - Sell All" },
  { date: "2025-06-05", action: "Buy", ticker: "QQQ", region: "US", qty: 4, price: 530.0, notes: "QQQ - Invesco QQQ Trust" },
  { date: "2025-06-05", action: "Sell", ticker: "QQQ", region: "US", qty: 4, price: 553.0, notes: "QQQ - Sell All" },
  { date: "2025-06-06", action: "Buy", ticker: "D05", region: "SG", qty: 100, price: 45.0, notes: "D05 - Second Buy" },
  { date: "2025-07-08", action: "Sell", ticker: "VOO", region: "US", qty: 5, price: 570.2, notes: "VOO - Sell All" },
  { date: "2025-07-08", action: "Buy", ticker: "PG", region: "US", qty: 12, price: 158.2, notes: "PG - Proctor & Gamble" },
  { date: "2025-07-11", action: "Buy", ticker: "PANW", region: "US", qty: 5, price: 189.0, notes: "PANW - Palo Alto Networks" },
  { date: "2025-07-11", action: "Buy", ticker: "ZS", region: "US", qty: 5, price: 293.0, notes: "ZS - Zscaler" },
  { date: "2025-08-13", action: "Buy", ticker: "03115", region: "HK", qty: 200, price: 93.5, notes: "03115 - iShares Core Hang Seng Index ETF" },
  { date: "2025-08-19", action: "Buy", ticker: "01810", region: "HK", qty: 200, price: 52.5, notes: "01810 - XIAOMI-W" },
  { date: "2025-09-24", action: "Buy", ticker: "B", region: "US", qty: 50, price: 33.5, notes: "B - Barrick Mining" },
  { date: "2025-10-09", action: "Buy", ticker: "QQQ", region: "US", qty: 5, price: 603.0, notes: "QQQ - Invesco QQQ Trust" },
  { date: "2025-10-13", action: "Buy", ticker: "VUG", region: "US", qty: 30, price: 79.54, notes: "VUG - Vanguard Growth ETF" },
  { date: "2025-10-13", action: "Buy", ticker: "ES3", region: "SG", qty: 350, price: 4.45, notes: "ES3 - STI ETF" },
  { date: "2025-11-14", action: "Sell", ticker: "03115", region: "HK", qty: 200, price: 100.0, notes: "03115 - Sell All" },
  { date: "2025-12-22", action: "Sell", ticker: "B", region: "US", qty: 50, price: 46.0, notes: "B - Sell All" },
  { date: "2025-12-22", action: "Buy", ticker: "ZS", region: "US", qty: 5, price: 233.49, notes: "ZS - Second Buy (Avg Down to x10@$263.25)" },
  { date: "2025-12-24", action: "Buy", ticker: "B", region: "US", qty: 50, price: 44.0, notes: "B - Barrick Mining" },
  { date: "2026-01-29", action: "Buy", ticker: "VOO", region: "US", qty: 5, price: 639.0, notes: "VOO - Vanguard S&P 500 ETF" },
  { date: "2026-01-30", action: "Buy", ticker: "B", region: "US", qty: 25, price: 48.5, notes: "B - Second Buy" },
  { date: "2026-02-24", action: "Sell", ticker: "PG", region: "US", qty: 12, price: 166.5, notes: "PG - Sell All" },
  { date: "2025-03-05", action: "Buy", ticker: "SLV", region: "US", qty: 20, price: 74.0, notes: "SLV - iShares Silver Trust" },
  { date: "2026-04-08", action: "Buy", ticker: "VOO", region: "US", qty: 5, price: 619.0, notes: "VOO - Second Buy (Avg Down to x10@$629)" },
  { date: "2026-05-06", action: "Sell", ticker: "QQQ", region: "US", qty: 3, price: 695.0, notes: "QQQ - Sell Part (60%)" },
  { date: "2026-05-11", action: "Buy", ticker: "ZS", region: "US", qty: 10, price: 151.0, notes: "ZS - Third buy (Avg down to x20@$207.12)" },
  { date: "2026-05-11", action: "Buy", ticker: "IXJ", region: "US", qty: 15, price: 91.5, notes: "IXJ - iShares Global Healthcare ETF" },
  { date: "2026-05-11", action: "Buy", ticker: "VHT", region: "US", qty: 5, price: 268.0, notes: "VHT - Vanguard Health Care ETF" },
  { date: "2026-05-14", action: "Sell", ticker: "PANW", region: "US", qty: 3, price: 236.0, notes: "PANW - Partial Exit (60%)" },
  { date: "2026-05-18", action: "Buy", ticker: "FLKR", region: "US", qty: 15, price: 58.44, notes: "FLKR - Franklin Templeton ETF (FTSE South Korea)" },
  { date: "2026-05-18", action: "Buy", ticker: "DRAM", region: "US", qty: 15, price: 52.0, notes: "DRAM - Roundhill Memory ETF" },
  { date: "2026-05-18", action: "Buy", ticker: "VT", region: "US", qty: 5.6241, price: 153.8, notes: "VT - Vanguard Total World Stock ETF (MAY DCA: $865)" },
  { date: "2026-05-22", action: "Sell", ticker: "ZS", region: "US", qty: 5, price: 183.0, notes: "ZS - Partial Sell (25%)" },
  { date: "2026-05-26", action: "Sell", ticker: "PANW", region: "US", qty: 2, price: 263.0, notes: "PANW - Second Sell (Full Exit: Remaining 40%)" },
  { date: "2026-05-26", action: "Buy", ticker: "NOW", region: "US", qty: 15, price: 102.0, notes: "NOW: ServiceNow" },
  { date: "2026-06-02", action: "Buy", ticker: "PLTR", region: "US", qty: 5, price: 154.0, notes: "PLTR: Palantir" },
  { date: "2026-06-05", action: "Sell", ticker: "DRAM", region: "US", qty: 15, price: 62.4, notes: "DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)" },
  { date: "2026-06-05", action: "Sell", ticker: "QQQ", region: "US", qty: 2, price: 700.0, notes: "QQQ - 100% Stoploss Exit (700 SL, 750 TP)" },
  { date: "2026-06-08", action: "Buy", ticker: "VT", region: "US", qty: 5.5637, price: 155.47, notes: "VT - Monthly DCA ($865)" },
  { date: "2026-06-08", action: "Sell", ticker: "FLKR", region: "US", qty: 15, price: 61.36, notes: "FLKR - 100% Stoploss Exit (61.36 SL, 76 TP)" },
  { date: "2026-06-12", action: "Buy", ticker: "QQQM", region: "US", qty: 5, price: 295.0, notes: "QQQM: Invesco NASDAQ 100 ETF" },
  { date: "2026-06-18", action: "Buy", ticker: "XLF", region: "US", qty: 25, price: 54.0, notes: "XLF: Financial Select Sector SPDR Fund" },
  { date: "2026-06-23", action: "Buy", ticker: "DRAM", region: "US", qty: 15, price: 60.0, notes: "DRAM: Roundhill Memory ETF" },
  { date: "2026-07-08", action: "Buy", ticker: "VT", region: "US", qty: 5.5846, price: 154.89, notes: "VT - Monthly DCA ($865)" },
  { date: "2026-07-14", action: "Buy", ticker: "OV8", region: "SG", qty: 200, price: 3.32, notes: "OV8: Sheng Shiong" },
  { date: "2026-07-21", action: "Buy", ticker: "D05", region: "SG", qty: 15, price: 72.0, notes: "DBS - Third Buy (Odd Lot)" },
  { date: "2026-08-05", action: "Buy", ticker: "VT", region: "US", qty: 5.3894, price: 160.5, notes: "VT - Monthly DCA ($865), Brought Forward" },
  { date: "2026-08-13", action: "Buy", ticker: "D05", region: "SG", qty: 15, price: 75.84, notes: "DBS - Fourth Buy (Odd Lot)" },
  { date: "2026-08-18", action: "Sell", ticker: "ZS", region: "US", qty: 8, price: 188.0, notes: "ZS - Partial Sell (8 of 15 Shares)" },
  { date: "2026-08-18", action: "Buy", ticker: "IREN", region: "US", qty: 30, price: 43.0, notes: "IREN - IREN Ltd" },
  { date: "2026-08-31", action: "Sell", ticker: "ZS", region: "US", qty: 7, price: 190.0, notes: "ZS - Full Sell" },
  { date: "2026-09-09", action: "Buy", ticker: "S63", region: "SG", qty: 100, price: 10.41, notes: "ST Engineering" },
];

async function main() {
  const existingTxns = await prisma.transaction.count();
  const existingContribs = await prisma.contribution.count();
  if (existingTxns > 0 || existingContribs > 0) {
    console.log("Database already has data — skipping seed to avoid duplicates.");
    console.log("(Delete existing rows first if you really want to re-seed.)");
    return;
  }

  const contributorRecords = new Map<string, { id: number }>();
  for (const name of CONTRIBUTORS) {
    const c = await prisma.contributor.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    contributorRecords.set(name, c);
  }

  let contributionCount = 0;
  for (const [label, date, amounts] of CONTRIBUTION_ROWS) {
    for (const [name, amount] of Object.entries(amounts)) {
      if (!amount) continue;
      await prisma.contribution.create({
        data: {
          contributorId: contributorRecords.get(name)!.id,
          label,
          date: new Date(date),
          amount,
        },
      });
      contributionCount++;
    }
  }

  for (const t of TRANSACTIONS) {
    await prisma.transaction.create({
      data: {
        date: new Date(t.date),
        action: t.action,
        ticker: t.ticker,
        region: t.region,
        qty: t.qty,
        price: t.price,
        notes: t.notes,
      },
    });
  }

  console.log(`Seeded ${contributionCount} contributions and ${TRANSACTIONS.length} transactions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

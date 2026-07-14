import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed data grouped by category, with representative click counts so the
 * "Popular" sort and usage stats have something to show.
 */
const SEED_SHORTCUTS: {
  keyword: string;
  url: string;
  category: string;
  clickCount: number;
}[] = [
  { keyword: "gh", url: "https://github.com/acme", category: "Eng", clickCount: 8421 },
  { keyword: "jira", url: "https://acme.atlassian.net", category: "Eng", clickCount: 6210 },
  { keyword: "sentry", url: "https://sentry.io/acme", category: "Eng", clickCount: 1840 },
  { keyword: "grafana", url: "https://grafana.acme.io", category: "Eng", clickCount: 2310 },
  { keyword: "deploy", url: "https://deploy.acme.io", category: "Eng", clickCount: 980 },
  { keyword: "runbook", url: "https://wiki.acme.io/runbooks", category: "Eng", clickCount: 1120 },
  { keyword: "oncall", url: "https://acme.pagerduty.com", category: "Eng", clickCount: 1450 },
  { keyword: "status", url: "https://status.acme.io", category: "Eng", clickCount: 2670 },
  { keyword: "docs", url: "https://docs.acme.io", category: "Docs", clickCount: 9310 },
  { keyword: "wiki", url: "https://wiki.acme.io", category: "Docs", clickCount: 7020 },
  { keyword: "handbook", url: "https://handbook.acme.io", category: "Docs", clickCount: 3410 },
  { keyword: "api", url: "https://docs.acme.io/api", category: "Docs", clickCount: 2890 },
  { keyword: "adr", url: "https://wiki.acme.io/adr", category: "Docs", clickCount: 610 },
  { keyword: "figma", url: "https://figma.com/acme", category: "Design", clickCount: 5230 },
  { keyword: "brand", url: "https://brand.acme.io", category: "Design", clickCount: 1290 },
  { keyword: "icons", url: "https://icons.acme.io", category: "Design", clickCount: 740 },
  { keyword: "hr", url: "https://workday.acme.io", category: "People", clickCount: 4120 },
  { keyword: "benefits", url: "https://benefits.acme.io", category: "People", clickCount: 1980 },
  { keyword: "pto", url: "https://pto.acme.io", category: "People", clickCount: 5410 },
  { keyword: "payroll", url: "https://payroll.acme.io", category: "People", clickCount: 2260 },
  { keyword: "org", url: "https://org.acme.io", category: "People", clickCount: 1670 },
  { keyword: "careers", url: "https://acme.io/careers", category: "People", clickCount: 830 },
  { keyword: "vpn", url: "https://vpn.acme.io/setup", category: "Ops", clickCount: 3550 },
  { keyword: "dash", url: "https://dash.acme.io", category: "Ops", clickCount: 4680 },
  { keyword: "metrics", url: "https://metrics.acme.io", category: "Ops", clickCount: 2140 },
  { keyword: "roadmap", url: "https://roadmap.acme.io", category: "Product", clickCount: 3980 },
  { keyword: "okrs", url: "https://okrs.acme.io", category: "Product", clickCount: 2510 },
  { keyword: "board", url: "https://board.acme.io", category: "Product", clickCount: 1430 },
  { keyword: "slack", url: "https://acme.slack.com", category: "Comms", clickCount: 12040 },
  { keyword: "allhands", url: "https://zoom.us/acme-allhands", category: "Comms", clickCount: 1760 },
];

const SEED_OWNER_ID = "admin";

async function main() {
  // The migration backfills this row already; upserting here too makes
  // the seed script safe to run standalone against any fresh database.
  await prisma.user.upsert({
    where: { id: SEED_OWNER_ID },
    update: {},
    create: { id: SEED_OWNER_ID, username: "admin", passwordHash: "", isAdmin: true },
  });

  for (const shortcut of SEED_SHORTCUTS) {
    await prisma.shortcut.upsert({
      where: { keyword: shortcut.keyword },
      update: { url: shortcut.url, category: shortcut.category },
      create: { ...shortcut, userId: SEED_OWNER_ID },
    });
  }
  console.log(`Seeded ${SEED_SHORTCUTS.length} shortcuts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

# Personal Finance Tracker

A local-first SPA for tracking expenses, income, savings, and a small investment portfolio. React + Vite + Tailwind + Zustand, with optional Supabase sync on top. Dark-first editorial UI — typographically calm, generously spaced, built to feel like a private ledger rather than a dashboard.

## Modules

- **Dashboard** — greeting strip, four-KPI band (net worth, monthly cashflow, savings rate, portfolio value), twelve-month net-worth arc, income-vs-expenses bars, recent activity, upcoming fixed expenses and dividends, monthly cashflow distribution summary
- **Expenses** — filtered month/category ledger with modal entry, recurring-expense schedule, twelve-month spend chart, category donut with legend, CSV import with column mapping and CSV export
- **Income** — fixed/variable/dividend models, monthly trend, by-source donut with legend
- **Portfolio** — holdings table with manual Yahoo refresh, TWRR / XIRR / dividend-yield KPIs, target-vs-actual allocation, dividend history that mirrors into the income ledger
- **Savings** — running balance (starting balance + logged entries), savings-over-time chart, entry ledger with deposit/withdrawal distinction; transfer-linked entries are read-only
- **Transfers** — cross-module money movement: savings → expenses, savings → portfolio, cashflow → savings, cashflow → portfolio; each transfer auto-creates linked records in both source and destination modules; cascade delete removes all linked records
- **Settings** — base currency, locale, expense categories, portfolio allocation targets, Supabase config, sync conflicts, JSON backup/restore

## Money flow model

Monthly cashflow = **income − expenses − cashflow allocations to savings/portfolio**. It represents the money actually left to spend, not gross earnings.

- **Income** is a read-only record of what you earned — never modified by transfers
- **Fixed/recurring expenses** are auto-created as expense entries when their charge day arrives each month, so they deduct from cashflow automatically
- **Transfers** move money between modules and create linked records atomically; deleting a transfer cascades to all linked records

## Design system

- Editorial tokens in `src/styles.css` + `tailwind.config.js` — Fraunces display serif, Instrument Sans body, JetBrains Mono for numerals
- UI primitives in `src/components/ui/`: `Card`, `Button`, `FormField`, `Input` / `Select` / `Textarea` / `Toggle` / `Checkbox`, `Table`, `Stat`, `Modal`, `EmptyState`, `Skeleton`
- Motion helpers in `src/utils/motion.js` — staggered rise-on-mount, `useCountUp` for KPI number tweens, `useInView` for one-shot reveals, all gated on `prefers-reduced-motion`
- Dark theme by default with a warm light theme at `[data-theme='light']`; toggle lives in the header
- Global Promise-based confirm dialogs via `ConfirmContext` — all destructive actions go through a shared modal

## Local data model

- `settings` in `localStorage`
- IndexedDB stores (v5): `expenses`, `fixedExpenses`, `incomes`, `holdings`, `dividends`, `portfolioCashflows`, `savings`, `savingsEntries`, `budgets`, `rollovers`, `transfers`

All money values are stored in cents as integers. Dates are ISO strings.

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
```

## Supabase sync (optional)

Layered on top of the local-first data — IndexedDB is always the source of truth on the device.

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` (one-row-per-entity schema with RLS).
3. Add the project URL and publishable key in `.env` or on the Settings page.
4. Sign in with a magic link from Settings.
5. Push local → cloud to seed, then pull/push incrementally. Conflicts surface in Settings → Conflicts for manual resolution.

Sync is per-entity (`store_name + record_id`) with `updated_at` / `deleted_at` so it's incremental, not snapshot-based. All stores including `transfers` participate automatically.

## Notes

- Yahoo prices cache in `sessionStorage` with a 15-minute TTL.
- PDF export is client-side via `html2canvas` + `jsPDF`.
- XIRR uses Newton's method with a ±1000% clamp; divergent cases return `null` and render as `—` rather than a misleading pinned value.
- Vite warns about a large dashboard chunk — charting libraries are heavy; not split yet.
- Mobile-responsive down to ~360px: hamburger nav drawer, stacked KPIs, truncating Stat values, donut charts with percentage radii.

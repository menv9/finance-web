# Personal Finance Tracker

SPA local-first built with React, Vite, Tailwind CSS, React Router, Recharts and Zustand.

## Included in v1

- Dashboard with KPIs, net worth chart, cashflow chart and upcoming events
- Expenses module with CRUD, month/category filters, CSV import and CSV export
- Income module with fixed, variable and dividend income models
- Portfolio module with holdings table, manual Yahoo refresh flow and derived metrics
- Settings for categories, allocation targets, locale/base currency and full backup import/export
- Persistence split between `localStorage` for settings and IndexedDB for larger datasets

## Added in v2

- Optional Supabase configuration in Settings
- Magic-link sign-in with `@supabase/supabase-js`
- Incremental per-entity sync to Supabase instead of whole-app snapshot sync
- SQL schema starter for a `finance_records` table with RLS in `supabase/schema.sql`
- `.env.example` keys for browser configuration

## Local data model

- `settings` in `localStorage`
- IndexedDB stores:
  - `expenses`
  - `fixedExpenses`
  - `incomes`
  - `holdings`
  - `dividends`
  - `portfolioCashflows`

All money values are stored in cents as integers.

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
```

## Supabase setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql`.
3. Add your project URL and publishable key either in `.env` or from the app Settings page.
4. Use the magic-link sign-in from Settings.
5. Push local data to create the first remote records.

## Notes

- Yahoo prices are cached in `sessionStorage` with a 15-minute TTL.
- PDF export is generated client-side with `html2canvas` and `jsPDF`.
- The current build passes, but Vite still warns about a large dashboard chunk because charting libraries are heavy.
- Remote sync now stores one row per entity (`store_name + record_id`) with `updated_at` and `deleted_at` so pull/push can be incremental.

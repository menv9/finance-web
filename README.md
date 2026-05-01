# Personal Finance Tracker

A local-first personal finance app built with React, Vite, Tailwind CSS, Zustand, IndexedDB, and optional Supabase sync. It is designed as a private ledger for tracking bank accounts, expenses, income, savings, budgets, transfers, and an investment portfolio.

## Features

- Dashboard with total balance, net worth, savings, portfolio value, income vs. expense charts, recent activity, and upcoming events.
- Bank accounts with editable balances, one main account, CSV import, and a total balance based only on account balances.
- Expenses with account selection, categories, attachments, recurring bills, charts, filters, and CSV export.
- Income tracking for fixed, variable, and asset-linked income, with account selection for where money lands.
- Savings buckets, savings entries, projections, and transfer-linked records.
- Budgets, rollovers, and monthly planning views.
- Portfolio holdings, dividends, sales, allocation targets, TWRR/XIRR-style metrics, and price refresh support.
- Local JSON backup and restore.
- Optional Supabase cloud sync with conflict handling and activity history.

## Money Model

The app treats bank accounts as the source of cash truth.

- `Total balance` is the sum of all bank account balances.
- Expenses subtract from the selected bank account.
- Income adds to the selected bank account.
- A bank account cannot go below zero.
- Imported bank CSV transactions are tagged to the selected account, but the account balance is updated from the statement's latest running balance to avoid double counting.
- Existing legacy transactions without an account stay in history, but they do not affect total balance until assigned to an account.

All money values are stored as integer cents. Dates are ISO strings.

## Tech Stack

- React 19
- Vite 6
- Tailwind CSS
- Zustand
- IndexedDB for local financial records
- `localStorage` for settings and sync metadata
- Supabase Auth, Database, and Storage for optional sync and attachments
- Recharts for charts
- Vitest for tests

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

Preview a production build:

```bash
npm run preview
```

## Project Structure

```text
src/
  components/        Shared UI, shell, imports, dialogs, forms, tour pieces
  components/forms/  Data-entry forms for expenses, income, savings, portfolio
  components/ui/     Reusable primitives such as Button, Card, Modal, Stat
  data/              Defaults and seed configuration
  hooks/             Shared React hooks
  pages/             Route-level app screens
  store/             Zustand finance store and business operations
  utils/             Finance calculations, storage, sync, CSV, dates, formatting
supabase/
  schema.sql         Optional Supabase schema and RLS setup
```

## Supabase Sync

Sync is optional. The app works fully offline/local without Supabase.

To enable sync:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add your Supabase URL and anon key in Settings.
4. Sign in with magic link or Google, depending on configuration.
5. Push local data to seed the cloud, then pull/push incrementally.

Sync records are stored per entity using `store_name` and `record_id`, with tombstones for deletes and conflict detection for records changed on multiple devices.

## Important Local Stores

IndexedDB stores include:

- `bankAccounts`
- `expenses`
- `fixedExpenses`
- `incomes`
- `savings`
- `savingsEntries`
- `savingsGoals`
- `budgets`
- `rollovers`
- `transfers`
- `holdings`
- `dividends`
- `portfolioCashflows`
- `portfolioSales`
- `attachments`
- `activityLog`

Settings and sync metadata live in `localStorage`.

## Testing Notes

The test suite covers:

- Finance metric calculations.
- CSV parsing/import helpers.
- Sync conflict helpers.
- Store behavior for account-backed income and expenses, including account balance updates and negative-balance prevention.

Run all tests with:

```bash
npm run test
```

## Current Notes

- Vite may warn about large chunks because the dashboard and charting libraries are heavy.
- Attachments are cached locally and can be uploaded to Supabase Storage when sync is configured.
- Portfolio market data uses client-side fetching and short-lived browser caching.

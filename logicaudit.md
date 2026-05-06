# Logic & Pre-Release Audit — Remaining Items

> Items C1–C12, H2–H4, H6–H16, M1, M3–M10 have been resolved. H1 is a known limitation (requires historical FX storage — deferred). This file tracks what's left.

---

## High

| # | File:Line | Issue |
|---|---|---|
| H5 | `SavingsPage.jsx:536` | Savings trend chart double-counts `currentBalanceCents` base + historical entries → curve diverges from KPI |

---

## Medium

| # | File:Line | Issue |
|---|---|---|
| M2 | `SavingsPage.jsx:486,1258` | `unallocatedSavingsCents` can exceed `totalSavedCents` after releases — allows over-allocation |

---

## Pre-release gaps (dedicated passes needed)

### 1. Input validation & abuse vectors
- 10MB activity comment? Profile bio?
- Transaction amount = `Number.MAX_SAFE_INTEGER` or `-Infinity` or `NaN`?
- Category name with `<script>` / SQL-ish payloads / RTL override chars?
- Avatar upload — MIME enforcement, size cap, content scan?
- Display name with zero-width chars or homoglyphs (impersonation)?
- Friend invite spam — rate limit per user per hour?

### 2. Rate limiting
- Any endpoint hit per-keystroke or per-render?
- Alpha Vantage key handling — each user supplies their own, or proxy?

### 3. PII / GDPR / account deletion
- Account deletion must purge `social_activity`, `activity_comments`, `friend_ledger`, `shared_goal_contributions`, `profiles`, avatars in storage, all financial tables
- Need a "right to export" data dump endpoint
- Cookie/localStorage disclosures

### 4. First-run UX
- Empty states across all pages
- Tooltips/help text for finance terms (cost basis, FIFO, etc.)
- Currency/locale auto-detect or explicit prompt

### 5. Error surfaces
- Silent failures are tolerable for personal use; for public users they mean churn
- Need consistent toast/error UI on every async failure path
- Sentry/equivalent for unhandled rejections

### 6. Performance at scale
- IndexedDB hydration time with thousands of records
- Sync payload size — full pull on large transaction histories
- Activity feed with many friends and events
- Portfolio chart with years of daily snapshots

### 7. Observability
- Logging strategy for production
- Telemetry for feature usage (without tracking PII)

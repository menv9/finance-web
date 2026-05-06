# Logic & Pre-Release Audit — Remaining Items

> Items C1–C11, H2, H3, H8, H9, H11, H12, H13, H16 have been resolved. H1 is a known limitation (requires historical FX storage — deferred). This file tracks what's left.

---

## Critical

### C12 — `wipeAllData` writes tombstones before clearing IDB

**File:** `src/store/useFinanceStore.js:2555-2637`

Order of ops: write tombstones → set Zustand state → `clearAllStores()` → `pushToSupabase()`. If the tab crashes between steps 2 and 3, IDB still has the records. On reload, `bootstrap` restores them, `triggerAutoPush` re-pushes them as live, overwriting the tombstones. The delete is lost.

**Fix:** clear IDB *before* writing tombstones, or write tombstones inside the same async transaction as the IDB clear.

---

## High

| # | File:Line | Issue |
|---|---|---|
| H4 | `SavingsPage.jsx:1247`, store `2373` | Goal release race — `goalBalances` includes allocations but pool check is global; double-submit drives goal balance negative |
| H5 | `SavingsPage.jsx:536` | Savings trend chart double-counts `currentBalanceCents` base + historical entries → curve diverges from KPI |
| H6 | `useFinanceStore.js:966-977` | Account switch race — `setActiveUserId` set after `pullFromSupabase` fan-out; focus handler can pull against null user |
| H7 | `OnboardingPage.jsx:173-184` | Re-entering onboarding stacks balances additively; no `onboardingCompleted` route guard |
| H10 | `BudgetTab.jsx:104-106` | Budgets page has no month selector — `selectedMonth` setter discarded, prior-month rollovers permanently unactionable |
| H14 | `PlatformsPage.jsx:218-237` | Broker summary excludes unassigned holdings — totals show 0 while detail table shows real positions |
| H15 | `AppShell.jsx:344-348` | `pft-theme-identity-set` localStorage flag not user-scoped — theme cross-contamination on shared devices |

---

## Medium

| # | File:Line | Issue |
|---|---|---|
| M1 | `BudgetTab.jsx:95-116` | "Cashflow after budgets" subtracts budget *ceiling* from already-net cashflow — misleading label |
| M2 | `SavingsPage.jsx:486,1258` | `unallocatedSavingsCents` can exceed `totalSavedCents` after releases — allows over-allocation |
| M3 | `DebtsPage.jsx:245` | "Monthly commitments" KPI includes zero-balance (paid-off) debts |
| M4 | `useFinanceStore.js:1773-1778` | Editing old foreign-currency sale uses today's FX → bank delta drift vs. original sale |
| M5 | `FriendsMoneyPage.jsx:634,644` | `youOweEntries` includes in-flight `kind==='payment'` rows → double-counts when payment + original IOU both pending |
| M6 | `useFinanceStore.js:2973` | `removeFriend` leaves pending ledger entries dangling, no warning, no cancel path. GDPR/account-deletion implications |
| M7 | `ResetPasswordPage.jsx:27` | `/reset-password` lets logged-in user change password silently with no auth-state guard |
| M8 | `storage.js:49-59` | `withStore` resolves with raw `IDBRequest` not value — latent footgun |
| M9 | `useFinanceStore.js:710-711` | `_cascadingDeletes` module-level Set, no reset on logout/wipe (mostly safe due to `finally`) |
| M10 | `SharedGoalsPage.jsx:112` | Edit-mode `inviteIds` pre-populated but `updateSharedGoal` ignores it — dead state |

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
- M6 (`removeFriend` orphans) is the canary — full account delete is likely worse
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

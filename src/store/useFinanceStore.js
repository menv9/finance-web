import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../data/defaults';
import {
  clearAllStores,
  clearActiveUserId,
  clearLocalUserData,
  deleteRecord,
  ensureEntitySyncFields,
  ensureSeedData,
  exportDatabaseSnapshot,
  getAllRecords,
  getActiveUserId,
  getRecord,
  importDatabaseSnapshot,
  loadSyncMeta,
  loadSettings,
  putRecord,
  saveSettings,
  saveSyncMeta,
  sanitizeSettingsForSync,
  setActiveUserId,
} from '../utils/storage';
import { computeDashboardData, computePortfolioMetrics, isFixedIncomeSchedule } from '../utils/finance';
import {
  clearSupabaseBrowserClient,
  createSupabaseBrowserClient,
  fetchRemoteChanges,
  getSupabaseBrowserClient,
  getSupabaseConfig,
  upsertRemoteRecords,
} from '../utils/supabase';
import { buildConflict, detectConflict, removeConflict, upsertConflict } from '../utils/sync';
import { fetchTickerPrice } from '../utils/yahoo';
import { loadAppMode, saveAppMode } from '../utils/appMode';
import {
  acceptFriendRequest as apiAcceptFriendRequest,
  avatarPathFromUrl,
  createOwnProfile,
  deleteFriendship,
  fetchFriendships,
  fetchOwnProfile,
  fetchProfilesByIds,
  insertFriendRequest,
  removeAvatarObject,
  searchProfileByEmail,
  searchProfilesByUsername,
  updateOwnProfile,
  uploadAvatar,
  validateUsername,
} from '../utils/profilesApi';
import {
  addComment as apiAddComment,
  addContribution as apiAddContribution,
  acceptGoalInvitation as apiAcceptGoalInvitation,
  addGoalParticipant,
  addReaction as apiAddReaction,
  createSharedGoal as apiCreateSharedGoal,
  fetchGoalInvitations,
  deleteActivity as apiDeleteActivity,
  deleteComment as apiDeleteComment,
  deleteContribution as apiDeleteContribution,
  deleteSharedGoal as apiDeleteSharedGoal,
  fetchActivityPrivacy,
  fetchFeedForUser,
  fetchSharedGoals,
  insertActivity,
  removeGoalParticipant,
  removeReaction as apiRemoveReaction,
  updateSharedGoal as apiUpdateSharedGoal,
  upsertActivityPrivacy,
} from '../utils/socialApi';
import {
  cancelLedgerEntry as apiCancelLedgerEntry,
  createLedgerEntry as apiCreateLedgerEntry,
  fetchFriendLedger,
  rejectLedgerEntry as apiRejectLedgerEntry,
  settleLedgerEntry as apiSettleLedgerEntry,
  updateLedgerEntry as apiUpdateLedgerEntry,
} from '../utils/friendsMoneyApi';

const STORE_KEYS = ['expenses', 'fixedExpenses', 'incomes', 'investmentPortfolios', 'holdings', 'dividends', 'portfolioCashflows', 'portfolioSales', 'savings', 'savingsEntries', 'savingsGoals', 'budgets', 'rollovers', 'transfers', 'bankAccounts', 'debts', 'attachments', 'activityLog', 'portfolioSnapshots'];
const STORE_STATE_KEY = {
  savings: 'savingsConfig',
};
const STORE_LABELS = {
  expenses: 'Expense',
  fixedExpenses: 'Recurring bill',
  incomes: 'Income',
  investmentPortfolios: 'Investment portfolio',
  holdings: 'Holding',
  dividends: 'Dividend',
  portfolioCashflows: 'Portfolio cashflow',
  portfolioSales: 'Portfolio sale',
  savings: 'Savings settings',
  savingsEntries: 'Saving',
  savingsGoals: 'Bucket',
  budgets: 'Budget',
  rollovers: 'Budget rollover',
  transfers: 'Transfer',
  bankAccounts: 'Bank account',
  debts: 'Debt',
  attachments: 'Attachment',
  settings: 'Settings',
  activityLog: 'Activity log',
  portfolioSnapshots: 'Portfolio snapshot',
};
const STORE_MODULES = {
  expenses: 'Expenses',
  fixedExpenses: 'Expenses',
  incomes: 'Income',
  investmentPortfolios: 'Portfolio',
  holdings: 'Portfolio',
  dividends: 'Portfolio',
  portfolioCashflows: 'Portfolio',
  portfolioSales: 'Portfolio',
  savings: 'Savings',
  savingsEntries: 'Savings',
  savingsGoals: 'Savings',
  budgets: 'Budgets',
  rollovers: 'Budgets',
  transfers: 'Transfers',
  bankAccounts: 'Accounts',
  debts: 'Debts',
  attachments: 'Expenses',
  settings: 'Settings',
  activityLog: 'Settings',
  portfolioSnapshots: 'Investing',
};
let authSubscription = null;
let autoPushTimer = null;

function addMonthsToMonth(month, offset) {
  const [year, monthNumber] = (month || '').split('-').map(Number);
  if (!year || !monthNumber) return month;
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthOffset(fromMonth, toMonth) {
  const [fromYear, fromMonthNumber] = (fromMonth || '').split('-').map(Number);
  const [toYear, toMonthNumber] = (toMonth || '').split('-').map(Number);
  if (!fromYear || !fromMonthNumber || !toYear || !toMonthNumber) return 0;
  return (toYear - fromYear) * 12 + (toMonthNumber - fromMonthNumber);
}

function fixedIncomePaymentDate(schedule, accountingMonth, explicitDate) {
  if (explicitDate) return explicitDate;
  const configuredReceivedMonth = schedule.date?.slice(0, 7);
  const configuredReportMonth = schedule.accountingMonth || configuredReceivedMonth;
  const receivedMonthOffset = monthOffset(configuredReportMonth, configuredReceivedMonth);
  const receivedMonth = addMonthsToMonth(accountingMonth, receivedMonthOffset);
  const fallbackDay = Number(schedule.date?.slice(8, 10)) || 1;
  const day = Math.min(Math.max(Number(schedule.payDay || fallbackDay), 1), 31);
  const lastDay = new Date(Number(receivedMonth.slice(0, 4)), Number(receivedMonth.slice(5, 7)), 0).getDate();
  return `${receivedMonth}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
let focusHandler = null;
let autoPullInterval = null;

const SAVINGS_DEFAULT = {
  id: 'savings-config',
  currentBalanceCents: 0,
  monthlyOverrideCents: 0,
  annualReturnRate: 0,
  goalCents: 0,
  projectionYears: 30,
};

function buildDerived(state) {
  const fxRates = state.fxRates || {};
  const baseCurrency = state.settings?.baseCurrency || 'EUR';
  return {
    dashboard: computeDashboardData({ ...state, fxRates }),
    portfolio: computePortfolioMetrics(
      state.holdings,
      state.dividends,
      state.portfolioCashflows,
      state.settings.allocationTargets,
      fxRates,
      baseCurrency,
    ),
  };
}

function savingsBalanceCents(state) {
  return (state.savingsConfig?.currentBalanceCents || 0) +
    (state.savingsEntries || [])
      .filter((entry) => entry.source !== 'allocation')
      .reduce((sum, entry) => sum + (entry.amountCents || 0), 0);
}

async function migrateInitialCashToBankAccounts(accounts, settings) {
  if (accounts?.length || !settings?.initialCashBalanceCents) return accounts || [];
  const timestamp = new Date().toISOString();
  const account = ensureEntitySyncFields({
    id: 'bank-main',
    name: 'Main bank',
    balanceCents: settings.initialCashBalanceCents,
    currency: settings.baseCurrency || 'EUR',
    updatedAt: timestamp,
  }, timestamp);
  await putRecord('bankAccounts', account);
  return [account];
}

function assertSourceHasFunds(state, source, amountCents) {
  if (!amountCents || amountCents <= 0) return;
  if (source === 'savings') {
    const balance = savingsBalanceCents(state);
    if (amountCents > balance) {
      throw new Error('Not enough savings balance for this amount.');
    }
  }
  if (source === 'cashflow' || source === 'income') {
    const balance = state.derived?.dashboard?.availableBalanceCents ?? buildDerived(state).dashboard.availableBalanceCents;
    if (amountCents > balance) {
      throw new Error('Not enough available cashflow for this amount.');
    }
  }
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function portfolioSnapshotId(timestamp = new Date().toISOString()) {
  return `psn-${timestamp.slice(0, 13)}`;
}

function portfolioScopedSnapshotId(portfolioId, timestamp = new Date().toISOString()) {
  return `psn-${portfolioId}-${timestamp.slice(0, 13)}`;
}

function defaultInvestmentPortfolio(timestamp = new Date().toISOString()) {
  return ensureEntitySyncFields({
    id: 'ipr-main',
    name: 'Main Portfolio',
    description: '',
    color: '#0f5132',
    updatedAt: timestamp,
  }, timestamp);
}

function inferPortfolioIdFromTicker(ticker, holdings, fallbackPortfolioId = null) {
  if (!ticker) return fallbackPortfolioId;
  const matches = (holdings || []).filter((holding) => holding.ticker === ticker && holding.portfolioId);
  const uniqueIds = [...new Set(matches.map((holding) => holding.portfolioId))];
  return uniqueIds.length === 1 ? uniqueIds[0] : fallbackPortfolioId;
}

async function normalizeInvestmentPortfolioRecords(records, settings) {
  const timestamp = new Date().toISOString();
  const portfolios = [...(records.investmentPortfolios || [])];
  if (!portfolios.length && (records.holdings || []).length) {
    portfolios.push(defaultInvestmentPortfolio(timestamp));
  }
  const fallbackPortfolioId = portfolios[0]?.id || null;
  const normalizedHoldings = (records.holdings || []).map((holding) => (
    holding.portfolioId || !fallbackPortfolioId ? holding : { ...holding, portfolioId: fallbackPortfolioId, updatedAt: timestamp }
  ));
  const holdingsById = new Map(normalizedHoldings.map((holding) => [holding.id, holding]));
  const normalizedSales = (records.portfolioSales || []).map((sale) => {
    const portfolioId = sale.portfolioId || holdingsById.get(sale.holdingId)?.portfolioId || fallbackPortfolioId;
    return portfolioId && !sale.portfolioId ? { ...sale, portfolioId, updatedAt: timestamp } : sale;
  });
  const normalizedCashflows = (records.portfolioCashflows || []).map((cashflow) => {
    const portfolioId = cashflow.portfolioId || holdingsById.get(cashflow.holdingId)?.portfolioId || fallbackPortfolioId;
    return portfolioId && !cashflow.portfolioId ? { ...cashflow, portfolioId, updatedAt: timestamp } : cashflow;
  });
  const normalizedDividends = (records.dividends || []).map((dividend) => {
    const portfolioId = dividend.portfolioId || inferPortfolioIdFromTicker(dividend.ticker, normalizedHoldings, fallbackPortfolioId);
    return portfolioId && !dividend.portfolioId ? { ...dividend, portfolioId, updatedAt: timestamp } : dividend;
  });

  await Promise.all([
    ...portfolios
      .filter((portfolio) => !(records.investmentPortfolios || []).some((item) => item.id === portfolio.id))
      .map((portfolio) => putRecord('investmentPortfolios', ensureEntitySyncFields(portfolio, timestamp))),
    ...normalizedHoldings.filter((item, index) => item !== records.holdings[index]).map((item) => putRecord('holdings', item)),
    ...normalizedSales.filter((item, index) => item !== records.portfolioSales[index]).map((item) => putRecord('portfolioSales', item)),
    ...normalizedCashflows.filter((item, index) => item !== records.portfolioCashflows[index]).map((item) => putRecord('portfolioCashflows', item)),
    ...normalizedDividends.filter((item, index) => item !== records.dividends[index]).map((item) => putRecord('dividends', item)),
  ]);

  void settings;
  return {
    ...records,
    investmentPortfolios: portfolios,
    holdings: normalizedHoldings,
    portfolioSales: normalizedSales,
    portfolioCashflows: normalizedCashflows,
    dividends: normalizedDividends,
  };
}

function portfolioSaleCashflowCents(sale) {
  return Math.max(sale.proceedsCents || 0, 0);
}

// Convert sale monetary fields (proceeds, cost, P&L, fees) to base currency.
// Prices per unit (salePriceCents, averageBuyPriceCents) stay in native currency for display.
function applySaleFx(sale, cashflow, holdingCurrency, fxRates, baseCurrency) {
  if (!holdingCurrency || holdingCurrency === baseCurrency) return { sale, cashflow };
  const rate = fxRates[holdingCurrency];
  if (rate == null) return { sale, cashflow };
  const conv = (v) => (v != null ? Math.round(v * rate) : v);
  const convertedSale = {
    ...sale,
    grossProceedsCents: conv(sale.grossProceedsCents),
    proceedsCents: conv(sale.proceedsCents),
    costBasisCents: conv(sale.costBasisCents),
    realizedPnlCents: conv(sale.realizedPnlCents),
    cashflowCents: conv(sale.cashflowCents),
    feeCents: conv(sale.feeCents),
    buyFeeCents: conv(sale.buyFeeCents),
  };
  const convertedCashflow = {
    ...cashflow,
    amountCents: conv(cashflow.amountCents),
  };
  return { sale: convertedSale, cashflow: convertedCashflow };
}

function upsertItem(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  return index >= 0 ? items.map((item) => (item.id === nextItem.id ? nextItem : item)) : [nextItem, ...items];
}

function accountDeltaForRecord(storeName, record) {
  if (!record?.bankAccountId || !record.amountCents) return null;
  if (storeName === 'expenses') {
    return { accountId: record.bankAccountId, deltaCents: -Math.abs(record.amountCents || 0) };
  }
  if (storeName === 'incomes') {
    if (isFixedIncomeSchedule(record)) return null;
    return { accountId: record.bankAccountId, deltaCents: record.amountCents || 0 };
  }
  return null;
}

function buildBankAccountAdjustments(storeName, previous, nextRecord, skipAccountAdjustment) {
  if (skipAccountAdjustment || (storeName !== 'expenses' && storeName !== 'incomes')) return new Map();
  const adjustments = new Map();
  const addAdjustment = (adjustment, multiplier = 1) => {
    if (!adjustment?.accountId || !adjustment.deltaCents) return;
    adjustments.set(
      adjustment.accountId,
      (adjustments.get(adjustment.accountId) || 0) + adjustment.deltaCents * multiplier,
    );
  };
  addAdjustment(accountDeltaForRecord(storeName, previous), -1);
  addAdjustment(accountDeltaForRecord(storeName, nextRecord), 1);
  return adjustments;
}

function applyBankAccountAdjustments(accounts, adjustments, timestamp) {
  if (!adjustments.size) return accounts;
  return accounts.map((account) => {
    const deltaCents = adjustments.get(account.id);
    if (!deltaCents) return account;
    const balanceCents = (account.balanceCents || 0) + deltaCents;
    if (balanceCents < 0) {
      throw new Error(`Not enough balance in ${account.name || 'this bank account'}.`);
    }
    return ensureEntitySyncFields({
      ...account,
      balanceCents,
      updatedAt: timestamp,
    }, timestamp);
  });
}

// Linked debt payments — when an expense has linkedDebtId, decrement that
// debt's currentBalanceCents by the expense amount. Reverses on edit/delete.
function debtDeltaForRecord(storeName, record) {
  if (storeName !== 'expenses') return null;
  if (!record?.linkedDebtId || !record.amountCents) return null;
  return { debtId: record.linkedDebtId, deltaCents: -Math.abs(record.amountCents || 0) };
}

function buildDebtAdjustments(storeName, previous, nextRecord) {
  if (storeName !== 'expenses') return new Map();
  const adjustments = new Map();
  const addAdjustment = (adjustment, multiplier = 1) => {
    if (!adjustment?.debtId || !adjustment.deltaCents) return;
    adjustments.set(
      adjustment.debtId,
      (adjustments.get(adjustment.debtId) || 0) + adjustment.deltaCents * multiplier,
    );
  };
  addAdjustment(debtDeltaForRecord(storeName, previous), -1);
  addAdjustment(debtDeltaForRecord(storeName, nextRecord), 1);
  return adjustments;
}

function applyDebtAdjustments(debts, adjustments, timestamp) {
  if (!adjustments.size) return debts;
  return debts.map((debt) => {
    const deltaCents = adjustments.get(debt.id);
    if (!deltaCents) return debt;
    const currentBalanceCents = Math.max(0, (debt.currentBalanceCents || 0) + deltaCents);
    return ensureEntitySyncFields({
      ...debt,
      currentBalanceCents,
      updatedAt: timestamp,
    }, timestamp);
  });
}

function buildSaleUpdate({ holding, sale, percent, salePriceCents, feeCents, date, timestamp, cashflowId, bankAccountId }) {
  const salePercent = Math.min(Math.max(Number(percent || 0), 0), 100);
  if (salePercent <= 0) throw new Error('Sale percent must be greater than 0');

  const currentQuantity = Number(holding.quantity || 0);
  if (currentQuantity <= 0) throw new Error('Holding has no quantity to sell');

  const soldQuantity = Math.min(currentQuantity, currentQuantity * (salePercent / 100));
  const soldRatio = currentQuantity ? soldQuantity / currentQuantity : 0;
  const isFullSale = currentQuantity - soldQuantity <= 10 ** -12 || salePercent >= 100;
  const nextQuantity = isFullSale ? 0 : currentQuantity - soldQuantity;
  const effectivePriceCents = Math.round(Number(salePriceCents || holding.currentPriceCents || 0));
  const saleFeeCents = Math.round(Number(feeCents ?? sale?.feeCents ?? 0));
  const holdingFeeCents = Math.round((holding.feeCents || 0) * soldRatio);
  const remainingHoldingFeeCents = Math.max(0, (holding.feeCents || 0) - holdingFeeCents);
  const grossProceedsCents = Math.round(soldQuantity * effectivePriceCents);
  const proceedsCents = Math.max(0, grossProceedsCents - saleFeeCents);
  const costBasisCents = Math.round(soldQuantity * (holding.averageBuyPriceCents || 0)) + holdingFeeCents;
  const saleDate = date || timestamp.slice(0, 10);
  const saleId = sale?.id || makeId('psl');

  const nextHolding = ensureEntitySyncFields({
    ...holding,
    quantity: nextQuantity,
    feeCents: remainingHoldingFeeCents,
    archivedAt: isFullSale ? saleDate : null,
    updatedAt: timestamp,
  }, timestamp);
  const nextSale = ensureEntitySyncFields({
    id: saleId,
      date: saleDate,
      holdingId: holding.id,
      portfolioId: holding.portfolioId || sale?.portfolioId || null,
      ticker: holding.ticker,
    name: holding.name,
    platform: holding.platform,
    percent: salePercent,
    quantity: soldQuantity,
    quantityDecimals: holding.quantityDecimals,
    averageBuyPriceCents: holding.averageBuyPriceCents || 0,
    salePriceCents: effectivePriceCents,
    grossProceedsCents,
    feeCents: saleFeeCents,
    buyFeeCents: holdingFeeCents,
    proceedsCents,
    costBasisCents,
    realizedPnlCents: proceedsCents - costBasisCents,
    cashflowCents: portfolioSaleCashflowCents({ proceedsCents, realizedPnlCents: proceedsCents - costBasisCents }),
    linkedIncomeId: null,
    bankAccountId: bankAccountId ?? sale?.bankAccountId ?? null,
    updatedAt: timestamp,
  }, timestamp);
  const nextCashflow = ensureEntitySyncFields({
    id: cashflowId || makeId('pcf'),
    date: saleDate,
      amountCents: proceedsCents,
      holdingId: holding.id,
      portfolioId: holding.portfolioId || sale?.portfolioId || null,
      ticker: holding.ticker,
    kind: 'sell',
    linkedSaleId: nextSale.id,
    bankAccountId: bankAccountId ?? sale?.bankAccountId ?? null,
    updatedAt: timestamp,
  }, timestamp);

  return { nextHolding, nextSale, nextCashflow };
}

// The 'savings' IndexedDB store holds a single config object, but Zustand
// exposes it as `savingsConfig` (not an array). This helper normalises every
// store name into the flat array that the sync functions expect.
function getStateRecords(state, storeName) {
  if (storeName === 'savings') {
    return state.savingsConfig?.id ? [state.savingsConfig] : [];
  }
  return state[storeName] || [];
}

function buildSyncRecord(userId, storeName, record) {
  return {
    user_id: userId,
    store_name: storeName,
    record_id: record.id,
    payload: record,
    updated_at: record.updatedAt || new Date().toISOString(),
    deleted_at: null,
  };
}

function buildDeleteTombstone(userId, storeName, tombstone) {
  return {
    user_id: userId,
    store_name: storeName,
    record_id: tombstone.id,
    payload: null,
    updated_at: tombstone.updatedAt,
    deleted_at: tombstone.deletedAt,
  };
}

function getStoreStateKey(storeName) {
  return STORE_STATE_KEY[storeName] || storeName;
}

function getRecordLabel(storeName, record) {
  if (!record) return STORE_LABELS[storeName] || storeName;
  if (storeName === 'budgets') return record.category ? `${record.category} budget` : 'Category budget';
  if (storeName === 'rollovers') return record.category ? `${record.category} rollover` : 'Budget rollover';
  if (storeName === 'portfolioCashflows') return record.ticker ? `${record.ticker} cashflow` : record.kind || 'Portfolio cashflow';
  if (storeName === 'portfolioSales') return record.ticker ? `${record.ticker} sale` : 'Portfolio sale';
  if (storeName === 'transfers') {
    const direction = [record.fromModule, record.toModule].filter(Boolean).join(' to ');
    return direction ? `${direction} transfer` : 'Transfer';
  }
  if (storeName === 'savings') return 'Savings settings';
  if (storeName === 'settings') return 'Settings';
  if (storeName === 'activityLog') return 'Activity log entry';
  return (
    record.description ||
    record.name ||
    record.source ||
    record.ticker ||
    record.category ||
    record.fileName ||
    STORE_LABELS[storeName] ||
    'Record'
  );
}

function buildActivitySummary(action, storeName, before, after) {
  const label = getRecordLabel(storeName, after || before);
  const type = STORE_LABELS[storeName] || storeName;
  if (action === 'create') return `Created ${type.toLowerCase()} "${label}"`;
  if (action === 'update') return `Updated ${type.toLowerCase()} "${label}"`;
  if (action === 'delete') return `Deleted ${type.toLowerCase()} "${label}"`;
  if (action === 'undo') return `Undid ${type.toLowerCase()} "${label}"`;
  return `${action} ${type.toLowerCase()} "${label}"`;
}

function buildActivityLog({ storeName, action, before = null, after = null, undoable = true, summary = null }) {
  const timestamp = new Date().toISOString();
  const record = after || before || {};
  return ensureEntitySyncFields({
    id: makeId('log'),
    createdAt: timestamp,
    module: STORE_MODULES[storeName] || 'General',
    action,
    recordType: storeName,
    recordId: record.id || storeName,
    label: getRecordLabel(storeName, record),
    summary: summary || buildActivitySummary(action, storeName, before, after),
    before,
    after,
    undoable,
    undoneAt: null,
    undoneByLogId: null,
  }, timestamp);
}

function buildSettingsActivity(previousSettings, nextSettings, partial, summary = null) {
  const sensitive = new Set(['finnhubApiKey', 'alphaVantageApiKey', 'supabaseUrl', 'supabaseAnonKey']);
  const allKeys = Object.keys(partial || {});
  const keys = allKeys.filter((key) => !sensitive.has(key));
  if (!keys.length && allKeys.length) {
    return buildActivityLog({
      storeName: 'settings',
      action: 'update',
      before: { id: 'settings' },
      after: { id: 'settings' },
      undoable: false,
      summary: 'Updated protected settings',
    });
  }
  if (!keys.length) return null;
  const before = { id: 'settings', ...Object.fromEntries(keys.map((key) => [key, previousSettings[key]])) };
  const after = { id: 'settings', ...Object.fromEntries(keys.map((key) => [key, nextSettings[key]])) };
  return buildActivityLog({
    storeName: 'settings',
    action: 'update',
    before,
    after,
    summary: summary || `Updated settings: ${keys.join(', ')}`,
  });
}

async function cleanupGeneratedPortfolioIncomesForState(get, set) {
  const { portfolioSales, dividends, incomes } = get();
  const timestamp = new Date().toISOString();
  const dividendLinkedIncomeIds = new Set((dividends || []).map((item) => item.linkedIncomeId).filter(Boolean));
  const saleLinkedIncomeIds = new Set((portfolioSales || []).map((item) => item.linkedIncomeId).filter(Boolean));
  const incomeIdsToDelete = new Set(
    (incomes || [])
      .filter((income) =>
        (income.incomeKind === 'portfolio_sale' && (income.linkedSaleId || saleLinkedIncomeIds.has(income.id))) ||
        dividendLinkedIncomeIds.has(income.id)
      )
      .map((income) => income.id),
  );
  const salesToUpdate = (portfolioSales || [])
    .filter((sale) => sale.linkedIncomeId || sale.cashflowCents !== portfolioSaleCashflowCents(sale))
    .map((sale) => ensureEntitySyncFields({
      ...sale,
      linkedIncomeId: null,
      cashflowCents: portfolioSaleCashflowCents(sale),
      updatedAt: timestamp,
    }, timestamp));
  const dividendsToUpdate = (dividends || [])
    .filter((dividend) => dividend.linkedIncomeId)
    .map((dividend) => ensureEntitySyncFields({
      ...dividend,
      linkedIncomeId: null,
      updatedAt: timestamp,
    }, timestamp));

  if (!incomeIdsToDelete.size && !salesToUpdate.length && !dividendsToUpdate.length) return;

  await Promise.all([
    ...[...incomeIdsToDelete].map((id) => deleteRecord('incomes', id)),
    ...salesToUpdate.map((record) => putRecord('portfolioSales', record)),
    ...dividendsToUpdate.map((record) => putRecord('dividends', record)),
  ]);
  set((state) => {
    const deletedIncomeIds = new Set(incomeIdsToDelete);
    const updatedSaleIds = new Set(salesToUpdate.map((sale) => sale.id));
    const updatedDividendIds = new Set(dividendsToUpdate.map((dividend) => dividend.id));
    const nextIncomes = state.incomes.filter((income) => !deletedIncomeIds.has(income.id));
    const nextPortfolioSales = state.portfolioSales.map((sale) =>
      updatedSaleIds.has(sale.id) ? salesToUpdate.find((item) => item.id === sale.id) : sale
    );
    const nextDividends = state.dividends.map((dividend) =>
      updatedDividendIds.has(dividend.id) ? dividendsToUpdate.find((item) => item.id === dividend.id) : dividend
    );
    const nextDeletedRecords = {
      ...state.syncMeta.deletedRecords,
      incomes: [
        ...(state.syncMeta.deletedRecords.incomes || []).filter((item) => !deletedIncomeIds.has(item.id)),
        ...[...deletedIncomeIds].map((id) => ({ id, updatedAt: timestamp, deletedAt: timestamp })),
      ],
      portfolioSales: (state.syncMeta.deletedRecords.portfolioSales || []).filter((item) => !updatedSaleIds.has(item.id)),
      dividends: (state.syncMeta.deletedRecords.dividends || []).filter((item) => !updatedDividendIds.has(item.id)),
    };
    const nextSyncMeta = {
      ...state.syncMeta,
      deletedRecords: nextDeletedRecords,
      conflicts: state.syncMeta.conflicts.filter(
        (item) =>
          !deletedIncomeIds.has(item.id?.replace('incomes:', '')) &&
          !updatedSaleIds.has(item.id?.replace('portfolioSales:', '')) &&
          !updatedDividendIds.has(item.id?.replace('dividends:', '')),
      ),
    };
    saveSyncMeta(nextSyncMeta);
    const nextState = {
      ...state,
      incomes: nextIncomes,
      portfolioSales: nextPortfolioSales,
      dividends: nextDividends,
      syncMeta: nextSyncMeta,
    };
    return { ...nextState, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
  });
  if (typeof get().triggerAutoPush === 'function') get().triggerAutoPush();
}

async function persistActivityLogs(set, logs) {
  if (!logs?.length) return [];
  await Promise.all(logs.map((log) => putRecord('activityLog', log)));
  set((state) => ({ activityLog: [...logs, ...(state.activityLog || [])] }));
  return logs;
}

// Tracks in-flight deletions so paired records (savings entry ↔ expense /
// portfolio cashflow) can cascade in either direction without infinite recursion.
const _cascadingDeletes = new Set();

export const useFinanceStore = create((set, get) => ({
  hydrated: false,
  tourActive: false,
  appMode: loadAppMode(),
  fxRates: {},
  settings: DEFAULT_SETTINGS,
  supabaseConfigured: false,
  supabaseSession: null,
  supabaseUser: null,
  supabaseSyncStatus: 'idle',
  supabaseLastSyncedAt: null,
  supabaseError: '',
  profile: null,
  friends: [],
  pendingIncoming: [],
  pendingOutgoing: [],
  profileStatus: 'idle',
  profileError: '',
  activityFeed: [],
  activityPrivacy: null,
  sharedGoals: [],
  goalInvitations: [],
  friendLedger: [],
  socialStatus: 'idle',
  socialError: '',
  syncMeta: {
    lastPulledAt: {},
    deletedRecords: {},
    conflicts: [],
  },
  expenses: [],
  fixedExpenses: [],
  incomes: [],
  investmentPortfolios: [],
  holdings: [],
  dividends: [],
  portfolioCashflows: [],
  portfolioSales: [],
  savingsConfig: SAVINGS_DEFAULT,
  savingsEntries: [],
  savingsGoals: [],
  budgets: [],
  rollovers: [],
  transfers: [],
  bankAccounts: [],
  debts: [],
  attachments: [],
  activityLog: [],
  portfolioSnapshots: [],
  derived: {
    dashboard: {
      netWorthCents: 0,
      cashflowCents: 0,
      availableBalanceCents: 0,
      bankBalanceCents: 0,
      savingsBalanceCents: 0,
      savingsRate: 0,
      portfolioPnlMonthCents: 0,
      expenseSeries: [],
      incomeSeries: [],
      netWorthSeries: [],
      cashflowSeries: [],
      upcomingEvents: [],
    },
    portfolio: {
      currentValueCents: 0,
      investedCents: 0,
      pnlCents: 0,
      pnlPercent: 0,
      dividendIncomeCents: 0,
      dividendYield: 0,
      twrr: 0,
      xirr: 0,
      allocationActual: [],
    },
  },

  reloadStoreData: async () => {
    const settings = loadSettings();
    const syncMeta = loadSyncMeta();
    const records = await Promise.all(STORE_KEYS.map((storeName) => getAllRecords(storeName)));
    const normalizedRecords = records.map((list) => list.map((item) => ensureEntitySyncFields(item)));
    normalizedRecords[14] = await migrateInitialCashToBankAccounts(normalizedRecords[14], settings);
    const portfolioRecords = await normalizeInvestmentPortfolioRecords({
      investmentPortfolios: normalizedRecords[3],
      holdings: normalizedRecords[4],
      dividends: normalizedRecords[5],
      portfolioCashflows: normalizedRecords[6],
      portfolioSales: normalizedRecords[7],
    }, settings);
    set((state) => {
      const nextState = {
        ...state,
        settings,
        syncMeta,
        expenses: normalizedRecords[0],
        fixedExpenses: normalizedRecords[1],
        incomes: normalizedRecords[2],
        investmentPortfolios: portfolioRecords.investmentPortfolios,
        holdings: portfolioRecords.holdings,
        dividends: portfolioRecords.dividends,
        portfolioCashflows: portfolioRecords.portfolioCashflows,
        portfolioSales: portfolioRecords.portfolioSales,
        savingsConfig: normalizedRecords[8][0] || SAVINGS_DEFAULT,
        savingsEntries: normalizedRecords[9],
        savingsGoals: normalizedRecords[10],
        budgets: normalizedRecords[11],
        rollovers: normalizedRecords[12],
        transfers: normalizedRecords[13],
        bankAccounts: normalizedRecords[14],
        debts: normalizedRecords[15],
        attachments: normalizedRecords[16],
        activityLog: normalizedRecords[17],
        portfolioSnapshots: normalizedRecords[18],
      };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    await cleanupGeneratedPortfolioIncomesForState(get, set);
  },

  bootstrap: async () => {
    await ensureSeedData();
    const settings = loadSettings();
    const syncMeta = loadSyncMeta();
    const records = await Promise.all(STORE_KEYS.map((storeName) => getAllRecords(storeName)));
    const normalizedRecords = records.map((list) => list.map((item) => ensureEntitySyncFields(item)));
    normalizedRecords[14] = await migrateInitialCashToBankAccounts(normalizedRecords[14], settings);
    const portfolioRecords = await normalizeInvestmentPortfolioRecords({
      investmentPortfolios: normalizedRecords[3],
      holdings: normalizedRecords[4],
      dividends: normalizedRecords[5],
      portfolioCashflows: normalizedRecords[6],
      portfolioSales: normalizedRecords[7],
    }, settings);
    await Promise.all(
      STORE_KEYS.map(async (storeName, index) => {
        const dirty = normalizedRecords[index].filter((item) => !records[index].find((original) => original.id === item.id && original.updatedAt));
        await Promise.all(dirty.map((item) => putRecord(storeName, item)));
      }),
    );
    const nextState = {
      settings,
      expenses: normalizedRecords[0],
      fixedExpenses: normalizedRecords[1],
      incomes: normalizedRecords[2],
      investmentPortfolios: portfolioRecords.investmentPortfolios,
      holdings: portfolioRecords.holdings,
      dividends: portfolioRecords.dividends,
      portfolioCashflows: portfolioRecords.portfolioCashflows,
      portfolioSales: portfolioRecords.portfolioSales,
      savingsConfig: normalizedRecords[8][0] || SAVINGS_DEFAULT,
      savingsEntries: normalizedRecords[9],
      savingsGoals: normalizedRecords[10],
      budgets: normalizedRecords[11],
      rollovers: normalizedRecords[12],
      transfers: normalizedRecords[13],
      bankAccounts: normalizedRecords[14],
      debts: normalizedRecords[15],
      attachments: normalizedRecords[16],
      activityLog: normalizedRecords[17],
      portfolioSnapshots: normalizedRecords[18],
      hydrated: false,
      supabaseConfigured: Boolean(getSupabaseConfig(settings).url && getSupabaseConfig(settings).anonKey),
      syncMeta,
    };
    set({ ...nextState, derived: buildDerived(nextState) });
    await cleanupGeneratedPortfolioIncomesForState(get, set);
    await get().autoCreateFixedExpenses();
    await get().initializeSupabase();
    set({ hydrated: true });
  },

  initializeSupabase: async () => {
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }

    clearSupabaseBrowserClient();
    const settings = get().settings;
    const client = createSupabaseBrowserClient(settings);
    const config = getSupabaseConfig(settings);

    if (!client) {
      if (autoPullInterval) { clearInterval(autoPullInterval); autoPullInterval = null; }
      if (focusHandler) { window.removeEventListener('focus', focusHandler); focusHandler = null; }
      set({
        supabaseConfigured: false,
        supabaseSession: null,
        supabaseUser: null,
        supabaseSyncStatus: 'idle',
        supabaseError: '',
      });
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      set({
        supabaseConfigured: Boolean(config.url && config.anonKey),
        supabaseSyncStatus: 'error',
        supabaseError: error.message,
      });
      return;
    }

    set({
      supabaseConfigured: Boolean(config.url && config.anonKey),
      supabaseSession: data.session,
      supabaseUser: data.session?.user ?? null,
      supabaseError: '',
    });

    // Already signed in on app load — pull latest data immediately
    if (data.session) {
      window.setTimeout(() => {
        get().pullFromSupabase().catch(() => {});
        get().loadProfile().catch(() => {});
        get().loadFriendships().catch(() => {});
      }, 0);
    }

    // Re-register focus handler so switching back to the tab syncs silently
    if (focusHandler) window.removeEventListener('focus', focusHandler);
    focusHandler = () => {
      const { supabaseUser, supabaseSyncStatus } = get();
      if (!supabaseUser) return;
      if (supabaseSyncStatus === 'syncing-up' || supabaseSyncStatus === 'syncing-down') return;
      get().pullFromSupabase().catch(() => {});
    };
    window.addEventListener('focus', focusHandler);

    // Poll every 8 s so open tabs on other devices pick up changes quickly
    if (autoPullInterval) clearInterval(autoPullInterval);
    autoPullInterval = setInterval(() => {
      const { supabaseUser, supabaseSyncStatus } = get();
      if (!supabaseUser) return;
      if (supabaseSyncStatus === 'syncing-up' || supabaseSyncStatus === 'syncing-down') return;
      get().pullFromSupabase().catch(() => {});
    }, 8_000);

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      set({
        supabaseSession: session,
        supabaseUser: session?.user ?? null,
        supabaseSyncStatus: event === 'SIGNED_OUT' ? 'idle' : get().supabaseSyncStatus,
        supabaseError: '',
      });

      if (event === 'SIGNED_IN') {
        const newUserId = session?.user?.id;
        window.setTimeout(async () => {
          const storedUserId = getActiveUserId();
          if (newUserId && storedUserId && newUserId !== storedUserId) {
            await clearAllStores();
            clearLocalUserData();
            await get().reloadStoreData();
          }
          if (newUserId) setActiveUserId(newUserId);
          get().pullFromSupabase().catch(() => {});
          get().loadProfile().catch(() => {});
          get().loadFriendships().catch(() => {});
        }, 0);
      }
      if (event === 'SIGNED_OUT') {
        clearActiveUserId();
        set({
          profile: null,
          friends: [],
          pendingIncoming: [],
          pendingOutgoing: [],
          profileStatus: 'idle',
          profileError: '',
        });
      }
    });

    authSubscription = subscription;
  },

  toggleTheme: async () => {
    const nextTheme = get().settings.theme === 'light' ? 'dark' : 'light';
    const settings = { ...get().settings, theme: nextTheme };
    saveSettings(settings);
    set((state) => ({ settings, derived: buildDerived({ ...state, settings }) }));
  },

  setTheme: async (theme) => {
    const settings = { ...get().settings, theme };
    saveSettings(settings);
    set((state) => ({ settings, derived: buildDerived({ ...state, settings }) }));
  },

  setTourActive: (value) => set({ tourActive: value }),

  setAppMode: (mode) => {
    const next = mode === 'lite' ? 'lite' : 'pro';
    saveAppMode(next);
    set({ appMode: next });
  },

  updateSettings: async (partial) => {
    const previousSettings = get().settings;
    const settings = { ...previousSettings, ...partial };
    saveSettings(settings);
    set((state) => ({ settings, derived: buildDerived({ ...state, settings }) }));
    const log = buildSettingsActivity(previousSettings, settings, partial);
    if (log) await persistActivityLogs(set, [log]);
    get().triggerAutoPush();
    if (partial.modules?.social !== undefined && partial.modules.social !== previousSettings.modules?.social) {
      const user = get().supabaseUser;
      if (user && get().profile) {
        updateOwnProfile(user.id, { social_enabled: partial.modules.social !== false }).catch(() => {});
      }
    }
  },

  saveSavingsConfig: async (config) => {
    const previous = get().savingsConfig?.id ? get().savingsConfig : null;
    const record = ensureEntitySyncFields(
      { ...SAVINGS_DEFAULT, ...config, id: 'savings-config' },
      new Date().toISOString(),
    );
    await putRecord('savings', record);
    set({ savingsConfig: record });
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'savings',
      action: previous ? 'update' : 'create',
      before: previous,
      after: record,
    })]);
    get().triggerAutoPush();
  },

  saveSavingsEntry: async (entry) => {
    const previous = entry.id ? get().savingsEntries.find((item) => item.id === entry.id) : null;
    const timestamp = new Date().toISOString();
    const metadataOnlyTypedEntry = previous?.kind && !previous.transferId;
    let entryToSave = entry;
    if (metadataOnlyTypedEntry) {
      entryToSave = {
        ...previous,
        date: entry.date || previous.date,
        accountingMonth: entry.accountingMonth || entry.date?.slice(0, 7) || previous.accountingMonth || previous.date?.slice(0, 7),
        note: entry.note ?? previous.note,
        updatedAt: timestamp,
      };
    } else if (!entryToSave.accountingMonth) {
      entryToSave = { ...entryToSave, accountingMonth: entryToSave.date?.slice(0, 7) };
    }
    if (!entryToSave.transferId && entryToSave.source !== 'allocation') {
      const previousPositive = previous && !previous.transferId && previous.source !== 'allocation' ? Math.max(previous.amountCents || 0, 0) : 0;
      const nextPositive = Math.max(entryToSave.amountCents || 0, 0);
      assertSourceHasFunds(get(), 'cashflow', nextPositive - previousPositive);
    }
    const record = ensureEntitySyncFields(
      { ...entryToSave, id: entryToSave.id || `sav-${crypto.randomUUID()}` },
      timestamp,
    );
    const linkedUpdates = [];
    if (metadataOnlyTypedEntry && previous.kind === 'expense' && previous.expenseId) {
      const linkedExpense = get().expenses.find((item) => item.id === previous.expenseId);
      if (linkedExpense) {
        linkedUpdates.push({
          storeName: 'expenses',
          before: linkedExpense,
          record: ensureEntitySyncFields({
            ...linkedExpense,
            date: record.date,
            description: record.note ?? linkedExpense.description,
            updatedAt: timestamp,
          }, timestamp),
        });
      }
    } else if (metadataOnlyTypedEntry && previous.kind === 'portfolio_buy' && previous.cashflowId) {
      const linkedCashflow = get().portfolioCashflows.find((item) => item.id === previous.cashflowId);
      if (linkedCashflow) {
        linkedUpdates.push({
          storeName: 'portfolioCashflows',
          before: linkedCashflow,
          record: ensureEntitySyncFields({
            ...linkedCashflow,
            date: record.date,
            updatedAt: timestamp,
          }, timestamp),
        });
      }
    }
    // Deduct from linked bank account (reverse previous, apply new)
    const bankAdjustments = new Map();
    if (!metadataOnlyTypedEntry && !record.transferId && record.source !== 'allocation') {
      if (previous?.bankAccountId && previous.amountCents) {
        bankAdjustments.set(previous.bankAccountId, (bankAdjustments.get(previous.bankAccountId) || 0) + previous.amountCents);
      }
      if (record.bankAccountId && record.amountCents) {
        bankAdjustments.set(record.bankAccountId, (bankAdjustments.get(record.bankAccountId) || 0) - record.amountCents);
      }
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAdjustments, timestamp);
    await Promise.all([
      putRecord('savingsEntries', record),
      ...linkedUpdates.map(({ storeName, record: linkedRecord }) => putRecord(storeName, linkedRecord)),
    ]);
    if (bankAdjustments.size) {
      await Promise.all(
        adjustedBankAccounts
          .filter((account) => bankAdjustments.has(account.id))
          .map((account) => putRecord('bankAccounts', account)),
      );
    }
    set((state) => {
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAdjustments, timestamp);
      let nextState = { ...state, savingsEntries: upsertItem(state.savingsEntries, record), bankAccounts: nextBankAccounts };
      for (const { storeName, record: linkedRecord } of linkedUpdates) {
        nextState = { ...nextState, [storeName]: upsertItem(nextState[storeName] || [], linkedRecord) };
      }
      return { ...nextState, derived: buildDerived(nextState) };
    });
    await persistActivityLogs(set, [
      buildActivityLog({
        storeName: 'savingsEntries',
        action: previous ? 'update' : 'create',
        before: previous,
        after: record,
      }),
      ...linkedUpdates.map(({ storeName, before, record: linkedRecord }) =>
        buildActivityLog({ storeName, action: 'update', before, after: linkedRecord }),
      ),
    ]);
    get().triggerAutoPush();
    return record;
  },

  removeSavingsEntry: async (id) => {
    const previous = get().savingsEntries.find((item) => item.id === id);
    const timestamp = new Date().toISOString();
    // Reverse the bank account deduction that was applied when the entry was saved
    const bankAdjustments = new Map();
    if (previous && !previous.transferId && previous.source !== 'allocation' && previous.bankAccountId && previous.amountCents) {
      bankAdjustments.set(previous.bankAccountId, previous.amountCents);
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAdjustments, timestamp);
    await deleteRecord('savingsEntries', id);
    if (bankAdjustments.size) {
      await Promise.all(
        adjustedBankAccounts
          .filter((account) => bankAdjustments.has(account.id))
          .map((account) => putRecord('bankAccounts', account)),
      );
    }
    set((state) => {
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAdjustments, timestamp);
      const nextState = { ...state, savingsEntries: state.savingsEntries.filter((e) => e.id !== id), bankAccounts: nextBankAccounts };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    if (previous) {
      await persistActivityLogs(set, [buildActivityLog({
        storeName: 'savingsEntries',
        action: 'delete',
        before: previous,
        after: null,
      })]);
    }
    get().triggerAutoPush();
  },

  saveSavingsGoal: async (goal) => {
    const timestamp = new Date().toISOString();
    const existing = goal.id ? get().savingsGoals.find((item) => item.id === goal.id) : null;
    const record = {
      ...ensureEntitySyncFields({
        id: goal.id || makeId('svg'),
        name: goal.name,
        targetCents: goal.targetCents || 0,
        createdAt: existing?.createdAt || goal.createdAt || timestamp,
      }, timestamp),
      updatedAt: timestamp,
    };
    await putRecord('savingsGoals', record);
    set((state) => {
      const nextSavingsGoals = upsertItem(state.savingsGoals, record);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        savingsGoals: (state.syncMeta.deletedRecords.savingsGoals || []).filter((item) => item.id !== record.id),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => item.id !== `savingsGoals:${record.id}`),
      };
      saveSyncMeta(nextSyncMeta);
      return { savingsGoals: nextSavingsGoals, syncMeta: nextSyncMeta };
    });
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'savingsGoals',
      action: existing ? 'update' : 'create',
      before: existing,
      after: record,
    })]);
    get().triggerAutoPush();
    return record;
  },

  removeSavingsGoal: async (id) => {
    const previous = get().savingsGoals.find((item) => item.id === id);
    await deleteRecord('savingsGoals', id);
    const timestamp = new Date().toISOString();
    set((state) => {
      const nextSavingsGoals = state.savingsGoals.filter((item) => item.id !== id);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        savingsGoals: [
          ...(state.syncMeta.deletedRecords.savingsGoals || []).filter((item) => item.id !== id),
          { id, updatedAt: timestamp, deletedAt: timestamp },
        ],
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => item.id !== `savingsGoals:${id}`),
      };
      saveSyncMeta(nextSyncMeta);
      return { savingsGoals: nextSavingsGoals, syncMeta: nextSyncMeta };
    });
    if (previous) {
      await persistActivityLogs(set, [buildActivityLog({
        storeName: 'savingsGoals',
        action: 'delete',
        before: previous,
        after: null,
      })]);
    }
    get().triggerAutoPush();
  },

  saveDebt: async (debt) => {
    const timestamp = new Date().toISOString();
    const existing = debt.id ? get().debts.find((item) => item.id === debt.id) : null;
    const baseCurrency = get().settings.baseCurrency || 'EUR';
    const record = {
      ...ensureEntitySyncFields({
        id: debt.id || makeId('debt'),
        name: debt.name || '',
        lender: debt.lender || '',
        type: debt.type || 'loan',
        originalAmountCents: debt.originalAmountCents ?? 0,
        currentBalanceCents: debt.currentBalanceCents ?? 0,
        interestRatePercent: debt.interestRatePercent ?? null,
        monthlyPaymentCents: debt.monthlyPaymentCents ?? null,
        startDate: debt.startDate || null,
        endDate: debt.endDate || null,
        currency: debt.currency || baseCurrency,
        notes: debt.notes || '',
        createdAt: existing?.createdAt || debt.createdAt || timestamp,
      }, timestamp),
      updatedAt: timestamp,
    };
    await putRecord('debts', record);
    set((state) => {
      const nextDebts = upsertItem(state.debts, record);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        debts: (state.syncMeta.deletedRecords.debts || []).filter((item) => item.id !== record.id),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => item.id !== `debts:${record.id}`),
      };
      saveSyncMeta(nextSyncMeta);
      return {
        debts: nextDebts,
        syncMeta: nextSyncMeta,
        derived: buildDerived({ ...state, debts: nextDebts }),
      };
    });
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'debts',
      action: existing ? 'update' : 'create',
      before: existing,
      after: record,
    })]);
    get().triggerAutoPush();
    return record;
  },

  removeDebt: async (id) => {
    const previous = get().debts.find((item) => item.id === id);
    await deleteRecord('debts', id);
    const timestamp = new Date().toISOString();
    set((state) => {
      const nextDebts = state.debts.filter((item) => item.id !== id);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        debts: [
          ...(state.syncMeta.deletedRecords.debts || []).filter((item) => item.id !== id),
          { id, updatedAt: timestamp, deletedAt: timestamp },
        ],
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => item.id !== `debts:${id}`),
      };
      saveSyncMeta(nextSyncMeta);
      return {
        debts: nextDebts,
        syncMeta: nextSyncMeta,
        derived: buildDerived({ ...state, debts: nextDebts }),
      };
    });
    if (previous) {
      await persistActivityLogs(set, [buildActivityLog({
        storeName: 'debts',
        action: 'delete',
        before: previous,
        after: null,
      })]);
    }
    get().triggerAutoPush();
  },

  saveSupabaseSettings: async (partial) => {
    const previousSettings = get().settings;
    const settings = { ...previousSettings, ...partial };
    saveSettings(settings);
    set((state) => ({
      settings,
      supabaseConfigured: Boolean(getSupabaseConfig(settings).url && getSupabaseConfig(settings).anonKey),
      derived: buildDerived({ ...state, settings }),
    }));
    const log = buildSettingsActivity(previousSettings, settings, partial, 'Updated sync settings');
    if (log) await persistActivityLogs(set, [log]);
    await get().initializeSupabase();
  },

  enableLocalOnlyMode: async () => {
    try { await get().signOutSupabase(); } catch { /* no session, ignore */ }
    await get().saveSupabaseSettings({ localOnlyMode: true });
  },

  // After this resolves, supabaseConfigured is true again and the user can sign in
  // normally. Existing local records flow up to Supabase automatically on the next
  // triggerAutoPush tick after sign-in — pushToSupabase serializes the full local
  // state, so no explicit migration step is needed.
  disableLocalOnlyMode: async () => {
    await get().saveSupabaseSettings({ localOnlyMode: false });
  },

  triggerAutoPush: () => {
    if (autoPushTimer) clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(() => {
      autoPushTimer = null;
      const { supabaseUser, supabaseSyncStatus, pushToSupabase } = get();
      if (!supabaseUser) return;
      if (supabaseSyncStatus === 'syncing-up' || supabaseSyncStatus === 'syncing-down') return;
      pushToSupabase().catch(() => {});
    }, 1000);
  },

  saveEntity: async (storeName, entity, { skipAutoCreate = false, skipAccountAdjustment = false } = {}) => {
    let value = entity;
    const previous = entity.id ? get()[storeName]?.find((item) => item.id === entity.id) : null;

    // When an expense is flagged recurring, mirror it into the Recurring bills store
    // and keep a back-reference so repeat saves don't spawn duplicates.
    if (storeName === 'expenses' && value.isRecurring && !value.fixedExpenseId) {
      const chargeDay = Number((value.date || '').slice(-2)) || 1;
      // skipAutoCreate=true: the expense state hasn't been written yet, so
      // autoCreateFixedExpenses would see the old isRecurring:false and create a
      // duplicate. The outer expense save triggers autoCreateFixedExpenses itself.
      const fixed = await get().saveEntity('fixedExpenses', {
        name: value.description || value.category || 'Recurring charge',
        amountCents: value.amountCents,
        currency: value.currency,
        chargeDay,
        category: value.category,
        bankAccountId: value.bankAccountId || null,
        active: true,
        alerts: true,
      }, { skipAutoCreate: true });
      value = { ...value, fixedExpenseId: fixed.id };
    }
    if (storeName === 'incomes' && !value.accountingMonth) {
      value = { ...value, accountingMonth: value.date?.slice(0, 7) };
    }
    if (storeName === 'holdings' && !value.portfolioId) {
      const fallbackPortfolioId = get().investmentPortfolios?.[0]?.id;
      if (!fallbackPortfolioId) throw new Error('Create a portfolio before adding holdings.');
      value = { ...value, portfolioId: fallbackPortfolioId };
    }
    if ((storeName === 'portfolioSales' || storeName === 'portfolioCashflows') && !value.portfolioId) {
      const portfolioId = get().holdings.find((holding) => holding.id === value.holdingId)?.portfolioId
        || get().investmentPortfolios?.[0]?.id;
      if (portfolioId) value = { ...value, portfolioId };
    }
    if (storeName === 'dividends' && !value.portfolioId) {
      const portfolioId = inferPortfolioIdFromTicker(value.ticker, get().holdings, get().investmentPortfolios?.[0]?.id);
      if (portfolioId) value = { ...value, portfolioId };
    }

    const prefix = storeName.slice(0, 3);
    // Always stamp a fresh updatedAt — existing records carry their old timestamp which
    // would make ensureEntitySyncFields keep it, causing other devices to miss the edit.
    const timestamp = new Date().toISOString();
    const record = { ...ensureEntitySyncFields({ ...value, id: value.id || makeId(prefix) }), updatedAt: timestamp };
    const bankAccountAdjustments = buildBankAccountAdjustments(storeName, previous, record, skipAccountAdjustment);
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);
    const debtAdjustments = buildDebtAdjustments(storeName, previous, record);
    const adjustedDebts = applyDebtAdjustments(get().debts || [], debtAdjustments, timestamp);
    await putRecord(storeName, record);
    if (adjustedBankAccounts !== get().bankAccounts) {
      await Promise.all(
        adjustedBankAccounts
          .filter((account) => bankAccountAdjustments.has(account.id))
          .map((account) => putRecord('bankAccounts', account)),
      );
    }
    if (adjustedDebts !== get().debts) {
      await Promise.all(
        adjustedDebts
          .filter((debt) => debtAdjustments.has(debt.id))
          .map((debt) => putRecord('debts', debt)),
      );
    }
    set((state) => {
      const nextList = upsertItem(state[storeName], record);
      const nextBankAccounts = storeName === 'bankAccounts'
        ? nextList
        : applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDebts = storeName === 'debts'
        ? nextList
        : applyDebtAdjustments(state.debts || [], debtAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        [storeName]: (state.syncMeta.deletedRecords[storeName] || []).filter((item) => item.id !== record.id),
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
        ...(debtAdjustments.size
          ? { debts: (state.syncMeta.deletedRecords.debts || []).filter((item) => !debtAdjustments.has(item.id)) }
          : {}),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => (
          item.id !== `${storeName}:${record.id}` &&
          (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))) &&
          (!debtAdjustments.size || !debtAdjustments.has(item.id?.replace('debts:', '')))
        )),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, [storeName]: nextList, bankAccounts: nextBankAccounts, debts: nextDebts };
      return {
        [storeName]: nextList,
        bankAccounts: nextBankAccounts,
        debts: nextDebts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });
    await persistActivityLogs(set, [buildActivityLog({
      storeName,
      action: previous ? 'update' : 'create',
      before: previous,
      after: record,
    })]);
    get().triggerAutoPush();
    // When a fixed expense is saved, immediately check if it needs an expense entry this month
    if (storeName === 'fixedExpenses' && !skipAutoCreate) {
      await get().autoCreateFixedExpenses();
    }
    return record;
  },

  removeEntity: async (storeName, id) => {
    const cascadeKey = `${storeName}:${id}`;
    if (_cascadingDeletes.has(cascadeKey)) return;
    _cascadingDeletes.add(cascadeKey);
    try {
    const previous = get()[storeName]?.find((item) => item.id === id);
    if (storeName === 'investmentPortfolios') {
      const activeHoldings = get().holdings.filter(
        (item) => item.portfolioId === id && !item.archivedAt && (item.quantity || 0) > 0,
      );
      if (activeHoldings.length) {
        throw new Error('This portfolio still has active holdings. Sell or remove them before deleting it.');
      }
      // Cascade: remove all linked data for this portfolio
      const linkedHoldings = get().holdings.filter((item) => item.portfolioId === id);
      for (const h of linkedHoldings) await get().removeEntity('holdings', h.id);
      const linkedSales = get().portfolioSales.filter((item) => item.portfolioId === id);
      for (const s of linkedSales) await get().removeEntity('portfolioSales', s.id);
      const linkedCashflows = get().portfolioCashflows.filter((item) => item.portfolioId === id);
      for (const c of linkedCashflows) await get().removeEntity('portfolioCashflows', c.id);
      const linkedDividends = get().dividends.filter((item) => item.portfolioId === id);
      for (const d of linkedDividends) await get().removeEntity('dividends', d.id);
      const linkedSnapshots = get().portfolioSnapshots.filter((item) => item.portfolioId === id);
      for (const s of linkedSnapshots) await get().removeEntity('portfolioSnapshots', s.id);
    }
    // Cascade: deleting a holding must remove its cost-basis cashflows and dividends,
    // otherwise XIRR/TWRR keep seeing phantom flows against a ticker that no longer exists.
    if (storeName === 'holdings') {
      const holding = get().holdings.find((h) => h.id === id);
      const cashflows = get().portfolioCashflows.filter((c) => c.holdingId === id);
      for (const cf of cashflows) {
        await get().removeEntity('portfolioCashflows', cf.id);
      }
      if (holding?.ticker) {
        const dividends = get().dividends.filter((d) => (
          d.ticker === holding.ticker &&
          (!holding.portfolioId || !d.portfolioId || d.portfolioId === holding.portfolioId)
        ));
        for (const div of dividends) {
          await get().removeDividend(div.id);
        }
      }
    }
    if (storeName === 'savingsEntries' && previous) {
      if (previous.kind === 'expense' && previous.expenseId) {
        await get().removeEntity('expenses', previous.expenseId);
      } else if (previous.kind === 'portfolio_buy' && previous.cashflowId) {
        await get().removeEntity('portfolioCashflows', previous.cashflowId);
      }
    }
    // Reverse cascade: deleting one half of a typed pair removes the other,
    // otherwise the orphan record silently corrupts the savings balance.
    if (storeName === 'expenses' && previous) {
      const linked = get().savingsEntries.find((e) => e.expenseId === id);
      if (linked) await get().removeEntity('savingsEntries', linked.id);
    }
    if (storeName === 'portfolioCashflows' && previous) {
      const linked = get().savingsEntries.find((e) => e.cashflowId === id);
      if (linked) await get().removeEntity('savingsEntries', linked.id);
    }

    const timestamp = new Date().toISOString();
    const bankAccountAdjustments = buildBankAccountAdjustments(storeName, previous, null, false);
    // Cashflow-funded portfolio buys deduct from the bank when created
    // (executed manually in addPortfolioBuy, outside buildBankAccountAdjustments).
    // Reverse that deduction on delete.
    if (
      storeName === 'portfolioCashflows'
      && previous?.source === 'cashflow'
      && previous.bankAccountId
      && previous.amountCents
    ) {
      bankAccountAdjustments.set(
        previous.bankAccountId,
        (bankAccountAdjustments.get(previous.bankAccountId) || 0) + Math.abs(previous.amountCents),
      );
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);
    const debtAdjustments = buildDebtAdjustments(storeName, previous, null);
    const adjustedDebts = applyDebtAdjustments(get().debts || [], debtAdjustments, timestamp);
    await deleteRecord(storeName, id);
    if (adjustedBankAccounts !== get().bankAccounts) {
      await Promise.all(
        adjustedBankAccounts
          .filter((account) => bankAccountAdjustments.has(account.id))
          .map((account) => putRecord('bankAccounts', account)),
      );
    }
    if (adjustedDebts !== get().debts) {
      await Promise.all(
        adjustedDebts
          .filter((debt) => debtAdjustments.has(debt.id))
          .map((debt) => putRecord('debts', debt)),
      );
    }
    set((state) => {
      const nextList = state[storeName].filter((item) => item.id !== id);
      const nextBankAccounts = storeName === 'bankAccounts'
        ? nextList
        : applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDebts = storeName === 'debts'
        ? nextList
        : applyDebtAdjustments(state.debts || [], debtAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        [storeName]: [
          ...(state.syncMeta.deletedRecords[storeName] || []).filter((item) => item.id !== id),
          { id, updatedAt: timestamp, deletedAt: timestamp },
        ],
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
        ...(debtAdjustments.size
          ? { debts: (state.syncMeta.deletedRecords.debts || []).filter((item) => !debtAdjustments.has(item.id)) }
          : {}),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => (
          item.id !== `${storeName}:${id}` &&
          (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))) &&
          (!debtAdjustments.size || !debtAdjustments.has(item.id?.replace('debts:', '')))
        )),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, [storeName]: nextList, bankAccounts: nextBankAccounts, debts: nextDebts };
      return {
        [storeName]: nextList,
        bankAccounts: nextBankAccounts,
        debts: nextDebts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });
    if (previous) {
      await persistActivityLogs(set, [buildActivityLog({
        storeName,
        action: 'delete',
        before: previous,
        after: null,
      })]);
    }
    get().triggerAutoPush();
    } finally {
      _cascadingDeletes.delete(cascadeKey);
    }
  },

  sellHolding: async ({ holdingId, percent, salePriceCents, feeCents, date, bankAccountId }) => {
    const holding = get().holdings.find((item) => item.id === holdingId);
    if (!holding) throw new Error('Holding not found');
    if ((get().bankAccounts || []).length && !bankAccountId) {
      throw new Error('Select a destination bank account for this sale.');
    }

    const timestamp = new Date().toISOString();
    const baseCurrency = get().settings.baseCurrency || 'EUR';
    const { nextHolding, nextSale: nativeSale, nextCashflow: nativeCashflow } = buildSaleUpdate({
      holding,
      percent,
      salePriceCents,
      feeCents,
      date,
      timestamp,
      bankAccountId,
    });
    // Convert monetary amounts to base currency if holding is in a foreign currency
    const { sale: rawSale, cashflow } = applySaleFx(
      nativeSale, nativeCashflow,
      holding.currency, get().fxRates || {}, baseCurrency,
    );
    const sale = ensureEntitySyncFields({ ...rawSale, linkedIncomeId: null, updatedAt: timestamp }, timestamp);
    const bankAccountAdjustments = new Map();
    if (sale.bankAccountId && sale.proceedsCents) {
      bankAccountAdjustments.set(sale.bankAccountId, sale.proceedsCents);
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);

    await putRecord('holdings', nextHolding);
    await putRecord('portfolioSales', sale);
    await putRecord('portfolioCashflows', cashflow);
    await Promise.all(
      adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    );

    set((state) => {
      const nextHoldings = upsertItem(state.holdings, nextHolding);
      const nextPortfolioSales = upsertItem(state.portfolioSales, sale);
      const nextPortfolioCashflows = upsertItem(state.portfolioCashflows, cashflow);
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        holdings: (state.syncMeta.deletedRecords.holdings || []).filter((item) => item.id !== nextHolding.id),
        portfolioSales: (state.syncMeta.deletedRecords.portfolioSales || []).filter((item) => item.id !== sale.id),
        portfolioCashflows: (state.syncMeta.deletedRecords.portfolioCashflows || []).filter((item) => item.id !== cashflow.id),
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `holdings:${nextHolding.id}` &&
            item.id !== `portfolioSales:${sale.id}` &&
            item.id !== `portfolioCashflows:${cashflow.id}` &&
            (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))),
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = {
        ...state,
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        bankAccounts: nextBankAccounts,
      };
      return {
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        bankAccounts: nextBankAccounts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    await persistActivityLogs(set, [
      buildActivityLog({ storeName: 'holdings', action: 'update', before: holding, after: nextHolding }),
      buildActivityLog({ storeName: 'portfolioSales', action: 'create', before: null, after: sale }),
      buildActivityLog({ storeName: 'portfolioCashflows', action: 'create', before: null, after: cashflow }),
    ]);
    get().triggerAutoPush();
    return sale;
  },

  updatePortfolioSale: async ({ saleId, percent, salePriceCents, feeCents, date, bankAccountId }) => {
    const currentSale = get().portfolioSales.find((item) => item.id === saleId);
    if (!currentSale) throw new Error('Sale not found');
    const destinationBankAccountId = bankAccountId ?? currentSale.bankAccountId ?? null;
    if ((get().bankAccounts || []).length && !destinationBankAccountId) {
      throw new Error('Select a destination bank account for this sale.');
    }

    const holding = get().holdings.find((item) => item.id === currentSale.holdingId);
    if (!holding) throw new Error('Holding not found');

    const timestamp = new Date().toISOString();
    const restoredHolding = ensureEntitySyncFields({
      ...holding,
      quantity: Number(holding.quantity || 0) + Number(currentSale.quantity || 0),
      feeCents: (holding.feeCents || 0) + (currentSale.buyFeeCents || 0),
      archivedAt: null,
      updatedAt: timestamp,
    }, timestamp);
    const currentCashflow = get().portfolioCashflows.find((item) => item.linkedSaleId === currentSale.id);
    const currentIncome = currentSale.linkedIncomeId
      ? get().incomes.find((item) => item.id === currentSale.linkedIncomeId)
      : get().incomes.find((item) => item.linkedSaleId === currentSale.id);
    const { nextHolding, nextSale: nativeRawSale, nextCashflow: nativeNextCashflow } = buildSaleUpdate({
      holding: restoredHolding,
      sale: currentSale,
      percent,
      salePriceCents,
      feeCents,
      date,
      timestamp,
      cashflowId: currentCashflow?.id,
      bankAccountId: destinationBankAccountId,
    });
    const baseCurrencyUpd = get().settings.baseCurrency || 'EUR';
    const { sale: rawSale, cashflow: nextCashflow } = applySaleFx(
      nativeRawSale, nativeNextCashflow,
      holding.currency, get().fxRates || {}, baseCurrencyUpd,
    );
    const nextSale = ensureEntitySyncFields({ ...rawSale, linkedIncomeId: null, updatedAt: timestamp }, timestamp);
    const bankAccountAdjustments = new Map();
    if (currentSale.bankAccountId && currentSale.proceedsCents) {
      bankAccountAdjustments.set(
        currentSale.bankAccountId,
        (bankAccountAdjustments.get(currentSale.bankAccountId) || 0) - currentSale.proceedsCents,
      );
    }
    if (nextSale.bankAccountId && nextSale.proceedsCents) {
      bankAccountAdjustments.set(
        nextSale.bankAccountId,
        (bankAccountAdjustments.get(nextSale.bankAccountId) || 0) + nextSale.proceedsCents,
      );
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);

    await putRecord('holdings', nextHolding);
    await putRecord('portfolioSales', nextSale);
    await putRecord('portfolioCashflows', nextCashflow);
    if (currentIncome) await deleteRecord('incomes', currentIncome.id);
    await Promise.all(
      adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    );

    set((state) => {
      const nextHoldings = upsertItem(state.holdings, nextHolding);
      const nextPortfolioSales = upsertItem(state.portfolioSales, nextSale);
      const nextPortfolioCashflows = upsertItem(state.portfolioCashflows, nextCashflow);
      const nextIncomes = currentIncome
        ? state.incomes.filter((item) => item.id !== currentIncome.id)
        : state.incomes;
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        holdings: (state.syncMeta.deletedRecords.holdings || []).filter((item) => item.id !== nextHolding.id),
        portfolioSales: (state.syncMeta.deletedRecords.portfolioSales || []).filter((item) => item.id !== nextSale.id),
        portfolioCashflows: (state.syncMeta.deletedRecords.portfolioCashflows || []).filter((item) => item.id !== nextCashflow.id),
        incomes: currentIncome
          ? [
              ...(state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== currentIncome.id),
              { id: currentIncome.id, updatedAt: timestamp, deletedAt: timestamp },
            ]
          : state.syncMeta.deletedRecords.incomes || [],
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `holdings:${nextHolding.id}` &&
            item.id !== `portfolioSales:${nextSale.id}` &&
            item.id !== `portfolioCashflows:${nextCashflow.id}` &&
            item.id !== `incomes:${currentIncome?.id}` &&
            (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))),
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = {
        ...state,
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        bankAccounts: nextBankAccounts,
      };
      return {
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        bankAccounts: nextBankAccounts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    await persistActivityLogs(set, [
      buildActivityLog({ storeName: 'holdings', action: 'update', before: holding, after: nextHolding }),
      buildActivityLog({ storeName: 'portfolioSales', action: 'update', before: currentSale, after: nextSale }),
      buildActivityLog({ storeName: 'portfolioCashflows', action: currentCashflow ? 'update' : 'create', before: currentCashflow || null, after: nextCashflow }),
      ...(currentIncome ? [buildActivityLog({ storeName: 'incomes', action: 'delete', before: currentIncome, after: null })] : []),
    ]);
    get().triggerAutoPush();
    return nextSale;
  },

  removePortfolioSale: async (saleId) => {
    const sale = get().portfolioSales.find((item) => item.id === saleId);
    if (!sale) return;

    const holding = get().holdings.find((item) => item.id === sale.holdingId);
    const cashflow = get().portfolioCashflows.find((item) => item.linkedSaleId === sale.id);
    const income = sale.linkedIncomeId
      ? get().incomes.find((item) => item.id === sale.linkedIncomeId)
      : get().incomes.find((item) => item.linkedSaleId === sale.id);
    const timestamp = new Date().toISOString();
    const restoredHolding = holding
      ? ensureEntitySyncFields({
          ...holding,
          quantity: Number(holding.quantity || 0) + Number(sale.quantity || 0),
          feeCents: (holding.feeCents || 0) + (sale.buyFeeCents || 0),
          archivedAt: null,
          updatedAt: timestamp,
        }, timestamp)
      : null;

    if (restoredHolding) await putRecord('holdings', restoredHolding);
    await deleteRecord('portfolioSales', sale.id);
    if (cashflow) await deleteRecord('portfolioCashflows', cashflow.id);
    if (income) await deleteRecord('incomes', income.id);
    const bankAccountAdjustments = new Map();
    if (sale.bankAccountId && sale.proceedsCents) {
      bankAccountAdjustments.set(sale.bankAccountId, -sale.proceedsCents);
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);
    await Promise.all(
      adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    );

    set((state) => {
      const nextHoldings = restoredHolding ? upsertItem(state.holdings, restoredHolding) : state.holdings;
      const nextPortfolioSales = state.portfolioSales.filter((item) => item.id !== sale.id);
      const nextPortfolioCashflows = cashflow
        ? state.portfolioCashflows.filter((item) => item.id !== cashflow.id)
        : state.portfolioCashflows;
      const nextIncomes = income ? state.incomes.filter((item) => item.id !== income.id) : state.incomes;
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        portfolioSales: [
          ...(state.syncMeta.deletedRecords.portfolioSales || []).filter((item) => item.id !== sale.id),
          { id: sale.id, updatedAt: timestamp, deletedAt: timestamp },
        ],
        portfolioCashflows: cashflow
          ? [
              ...(state.syncMeta.deletedRecords.portfolioCashflows || []).filter((item) => item.id !== cashflow.id),
              { id: cashflow.id, updatedAt: timestamp, deletedAt: timestamp },
            ]
          : state.syncMeta.deletedRecords.portfolioCashflows || [],
        incomes: income
          ? [
              ...(state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== income.id),
              { id: income.id, updatedAt: timestamp, deletedAt: timestamp },
            ]
          : state.syncMeta.deletedRecords.incomes || [],
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
      };
      if (restoredHolding) {
        nextDeletedRecords.holdings = (state.syncMeta.deletedRecords.holdings || []).filter((item) => item.id !== restoredHolding.id);
      }
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `portfolioSales:${sale.id}` &&
            item.id !== `portfolioCashflows:${cashflow?.id}` &&
            item.id !== `holdings:${restoredHolding?.id}` &&
            item.id !== `incomes:${income?.id}` &&
            (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))),
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = {
        ...state,
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        bankAccounts: nextBankAccounts,
      };
      return {
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        bankAccounts: nextBankAccounts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    await persistActivityLogs(set, [
      ...(restoredHolding ? [buildActivityLog({ storeName: 'holdings', action: 'update', before: holding, after: restoredHolding })] : []),
      buildActivityLog({ storeName: 'portfolioSales', action: 'delete', before: sale, after: null }),
      ...(cashflow ? [buildActivityLog({ storeName: 'portfolioCashflows', action: 'delete', before: cashflow, after: null })] : []),
      ...(income ? [buildActivityLog({ storeName: 'incomes', action: 'delete', before: income, after: null })] : []),
    ]);
    get().triggerAutoPush();
  },

  cleanupGeneratedPortfolioIncomes: async () => {
    await cleanupGeneratedPortfolioIncomesForState(get, set);
  },

  saveFixedExpense: async (entity) => get().saveEntity('fixedExpenses', entity),

  toggleFixedExpenseStatus: async (id) => {
    const current = get().fixedExpenses.find((item) => item.id === id);
    if (!current) return;
    await get().saveEntity('fixedExpenses', { ...current, active: !current.active });
  },

  // Auto-create expense entries for fixed expenses whose charge day has arrived
  // this month but don't yet have a corresponding expense entry.
  autoCreateFixedExpenses: async () => {
    const { fixedExpenses, expenses, settings } = get();
    const today = new Date();
    const todayDay = today.getDate();
    const currentMonth = today.toISOString().slice(0, 7);
    // Last day of current month (handles short months like Feb)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const toCreate = [];

    for (const fe of fixedExpenses) {
      if (!fe.active) continue;
      if (fe.chargeDay > todayDay) continue; // not charged yet this month

      // Dedup: check by fixedExpenseId (new entries) or fuzzy match for entries
      // that pre-date the fixedExpenseId link. Scope the fuzzy match to entries
      // WITHOUT a fixedExpenseId so two distinct fixed expenses sharing
      // amount+category don't shadow each other's auto-creation.
      const alreadyExists = expenses.some(
        (e) =>
          e.date?.startsWith(currentMonth) &&
          (e.fixedExpenseId === fe.id ||
            (!e.fixedExpenseId &&
              e.isRecurring &&
              e.amountCents === fe.amountCents &&
              e.category === fe.category)),
      );
      if (alreadyExists) continue;

      const chargeDay = Math.min(fe.chargeDay, daysInMonth);
      const dateStr = `${currentMonth}-${String(chargeDay).padStart(2, '0')}`;

      const expense = ensureEntitySyncFields({
        id: makeId('exp'),
        date: dateStr,
        amountCents: fe.amountCents,
        currency: fe.currency || settings.baseCurrency,
        category: fe.category || 'Other',
        description: fe.name,
        isRecurring: true,
        fixedExpenseId: fe.id,
        bankAccountId: fe.bankAccountId || null,
      }, new Date().toISOString());

      toCreate.push(expense);
    }

    if (!toCreate.length) return;

    const timestamp = new Date().toISOString();
    const bankAccountAdjustments = toCreate.reduce((adjustments, expense) => {
      const adjustment = accountDeltaForRecord('expenses', expense);
      if (!adjustment?.accountId || !adjustment.deltaCents) return adjustments;
      adjustments.set(
        adjustment.accountId,
        (adjustments.get(adjustment.accountId) || 0) + adjustment.deltaCents,
      );
      return adjustments;
    }, new Map());
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);
    await Promise.all([
      ...toCreate.map((e) => putRecord('expenses', e)),
      ...adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    ]);
    set((state) => {
      const nextExpenses = [...state.expenses, ...toCreate];
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextState = { ...state, expenses: nextExpenses, bankAccounts: nextBankAccounts };
      return { expenses: nextExpenses, bankAccounts: nextBankAccounts, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
  },

  saveDividend: async (entity) => {
    const prefix = 'div';
    const current = entity.id ? get().dividends.find((item) => item.id === entity.id) : null;
    const currentIncome = current?.linkedIncomeId ? get().incomes.find((item) => item.id === current.linkedIncomeId) : null;
    if ((get().bankAccounts || []).length && !entity.bankAccountId) {
      throw new Error('Select a destination bank account for this dividend.');
    }
    const timestamp = new Date().toISOString();
    const normalizedEntity = entity.accountingMonth
      ? entity
      : { ...entity, accountingMonth: entity.date?.slice(0, 7) };
    const portfolioId = normalizedEntity.portfolioId ||
      inferPortfolioIdFromTicker(normalizedEntity.ticker, get().holdings, get().investmentPortfolios?.[0]?.id);
    const record = ensureEntitySyncFields({
      ...normalizedEntity,
      portfolioId,
      id: normalizedEntity.id || makeId(prefix),
      linkedIncomeId: null,
    }, timestamp);
    const bankAccountAdjustments = new Map();
    if (current?.bankAccountId && current.amountCents) {
      bankAccountAdjustments.set(current.bankAccountId, -Math.abs(current.amountCents || 0));
    }
    if (record.bankAccountId && record.amountCents) {
      bankAccountAdjustments.set(
        record.bankAccountId,
        (bankAccountAdjustments.get(record.bankAccountId) || 0) + Math.abs(record.amountCents || 0),
      );
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);

    await putRecord('dividends', record);
    if (currentIncome) await deleteRecord('incomes', currentIncome.id);
    await Promise.all(
      adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    );

    set((state) => {
      const nextDividends = upsertItem(state.dividends, record);
      const nextIncomes = currentIncome
        ? state.incomes.filter((income) => income.id !== currentIncome.id)
        : state.incomes;
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        dividends: (state.syncMeta.deletedRecords.dividends || []).filter((item) => item.id !== record.id),
        incomes: currentIncome
          ? [
              ...(state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== currentIncome.id),
              { id: currentIncome.id, updatedAt: timestamp, deletedAt: timestamp },
            ]
          : state.syncMeta.deletedRecords.incomes || [],
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `dividends:${record.id}` &&
            item.id !== `incomes:${currentIncome?.id}` &&
            (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))),
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, dividends: nextDividends, incomes: nextIncomes, bankAccounts: nextBankAccounts };
      return {
        dividends: nextDividends,
        incomes: nextIncomes,
        bankAccounts: nextBankAccounts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    await persistActivityLogs(set, [
      buildActivityLog({ storeName: 'dividends', action: current ? 'update' : 'create', before: current, after: record }),
      ...(currentIncome ? [buildActivityLog({ storeName: 'incomes', action: 'delete', before: currentIncome, after: null })] : []),
    ]);
    get().triggerAutoPush();
    return record;
  },

  recordPortfolioSnapshot: async ({ force = false, source = 'hourly', portfolioId = null } = {}) => {
    const state = get();
    const baseCurrency = state.settings?.baseCurrency || 'EUR';
    const activeHoldings = (state.holdings || [])
      .filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0).length;
    const targetPortfolios = portfolioId
      ? (state.investmentPortfolios || []).filter((portfolio) => portfolio.id === portfolioId)
      : (state.investmentPortfolios || []);
    const snapshotRecords = [];
    if (!activeHoldings) return null;

    const timestamp = new Date().toISOString();
    const globalRecord = ensureEntitySyncFields({
      id: force ? `psn-${timestamp}` : portfolioSnapshotId(timestamp),
      capturedAt: timestamp,
      valueCents: state.derived?.portfolio?.currentValueCents || 0,
      costCents: state.derived?.portfolio?.investedCents || 0,
      currency: baseCurrency,
      holdingsCount: activeHoldings,
      source,
    }, timestamp);
    if (!portfolioId) snapshotRecords.push(globalRecord);

    for (const portfolio of targetPortfolios) {
      const scopedHoldings = (state.holdings || []).filter((holding) => holding.portfolioId === portfolio.id);
      const scopedActiveCount = scopedHoldings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0).length;
      if (!scopedActiveCount) continue;
      const metrics = computePortfolioMetrics(
        scopedHoldings,
        (state.dividends || []).filter((dividend) => dividend.portfolioId === portfolio.id),
        (state.portfolioCashflows || []).filter((flow) => flow.portfolioId === portfolio.id),
        state.settings.allocationTargets,
        state.fxRates || {},
        baseCurrency,
      );
      snapshotRecords.push(ensureEntitySyncFields({
        id: force ? `psn-${portfolio.id}-${timestamp}` : portfolioScopedSnapshotId(portfolio.id, timestamp),
        portfolioId: portfolio.id,
        capturedAt: timestamp,
        valueCents: metrics.currentValueCents,
        costCents: metrics.investedCents,
        currency: baseCurrency,
        holdingsCount: scopedActiveCount,
        source,
      }, timestamp));
    }
    if (!snapshotRecords.length) return null;

    await Promise.all(snapshotRecords.map((record) => putRecord('portfolioSnapshots', record)));
    set((current) => {
      const nextDeletedRecords = {
        ...current.syncMeta.deletedRecords,
        portfolioSnapshots: (current.syncMeta.deletedRecords.portfolioSnapshots || [])
          .filter((item) => !snapshotRecords.some((record) => record.id === item.id)),
      };
      const nextSyncMeta = { ...current.syncMeta, deletedRecords: nextDeletedRecords };
      saveSyncMeta(nextSyncMeta);
      return {
        portfolioSnapshots: snapshotRecords.reduce(
          (items, record) => upsertItem(items, record),
          current.portfolioSnapshots || [],
        ),
        syncMeta: nextSyncMeta,
      };
    });
    get().triggerAutoPush();
    return portfolioId ? snapshotRecords.find((record) => record.portfolioId === portfolioId) || null : globalRecord;
  },

  removeDividend: async (id) => {
    const current = get().dividends.find((item) => item.id === id);
    if (!current) return;
    const linkedIncome = current.linkedIncomeId ? get().incomes.find((item) => item.id === current.linkedIncomeId) : null;
    await deleteRecord('dividends', id);
    if (current.linkedIncomeId) {
      await deleteRecord('incomes', current.linkedIncomeId);
    }
    const timestamp = new Date().toISOString();
    const bankAccountAdjustments = new Map();
    if (current.bankAccountId && current.amountCents) {
      bankAccountAdjustments.set(current.bankAccountId, -Math.abs(current.amountCents || 0));
    }
    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);
    await Promise.all(
      adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    );
    set((state) => {
      const nextDividends = state.dividends.filter((item) => item.id !== id);
      const nextIncomes = current.linkedIncomeId ? state.incomes.filter((item) => item.id !== current.linkedIncomeId) : state.incomes;
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        dividends: [...(state.syncMeta.deletedRecords.dividends || []).filter((item) => item.id !== id), { id, updatedAt: timestamp, deletedAt: timestamp }],
        incomes: current.linkedIncomeId
          ? [...(state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== current.linkedIncomeId), { id: current.linkedIncomeId, updatedAt: timestamp, deletedAt: timestamp }]
          : state.syncMeta.deletedRecords.incomes || [],
        ...(bankAccountAdjustments.size
          ? { bankAccounts: (state.syncMeta.deletedRecords.bankAccounts || []).filter((item) => !bankAccountAdjustments.has(item.id)) }
          : {}),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `dividends:${id}` &&
            item.id !== `incomes:${current.linkedIncomeId}` &&
            (!bankAccountAdjustments.size || !bankAccountAdjustments.has(item.id?.replace('bankAccounts:', ''))),
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, dividends: nextDividends, incomes: nextIncomes, bankAccounts: nextBankAccounts };
      return {
        dividends: nextDividends,
        incomes: nextIncomes,
        bankAccounts: nextBankAccounts,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });
    await persistActivityLogs(set, [
      buildActivityLog({ storeName: 'dividends', action: 'delete', before: current, after: null }),
      ...(current.linkedIncomeId
        ? [buildActivityLog({
            storeName: 'incomes',
            action: 'delete',
            before: linkedIncome || { id: current.linkedIncomeId },
            after: null,
          })]
        : []),
    ]);
    get().triggerAutoPush();
  },

  addPortfolioBuy: async (spec) => {
    const { date, holdingId, ticker, amountCents, fundingSource, bankAccountId } = spec;
    const amount = Math.abs(amountCents || 0);
    if (!amount) return null;
    const source = fundingSource === 'savings' ? 'savings' : 'cashflow';
    assertSourceHasFunds(get(), source === 'savings' ? 'savings' : 'cashflow', amount);
    const timestamp = new Date().toISOString();
    const portfolioId = spec.portfolioId || get().holdings.find((holding) => holding.id === holdingId)?.portfolioId || null;

    const cashflow = ensureEntitySyncFields({
      id: makeId('pcf'),
      date,
      amountCents: -amount, // negative = capital deposit
      ticker: ticker || null,
      holdingId: holdingId || null,
      portfolioId,
      kind: 'buy',
      source,
      bankAccountId: source === 'cashflow' ? (bankAccountId || null) : null,
    }, timestamp);

    const toPut = [{ storeName: 'portfolioCashflows', record: cashflow }];
    const bankAccountAdjustments = new Map();

    if (source === 'cashflow' && bankAccountId) {
      bankAccountAdjustments.set(bankAccountId, -amount);
    }

    let savingsEntry = null;
    if (source === 'savings') {
      savingsEntry = ensureEntitySyncFields({
        id: makeId('sav'),
        date,
        amountCents: -amount,
        note: ticker ? `Portfolio buy: ${ticker}` : 'Portfolio buy',
        kind: 'portfolio_buy',
        cashflowId: cashflow.id,
      }, timestamp);
      toPut.push({ storeName: 'savingsEntries', record: savingsEntry });
    }

    const adjustedBankAccounts = applyBankAccountAdjustments(get().bankAccounts || [], bankAccountAdjustments, timestamp);

    await Promise.all([
      ...toPut.map(({ storeName, record }) => putRecord(storeName, record)),
      ...adjustedBankAccounts
        .filter((account) => bankAccountAdjustments.has(account.id))
        .map((account) => putRecord('bankAccounts', account)),
    ]);

    set((state) => {
      let nextState = { ...state };
      for (const { storeName, record } of toPut) {
        nextState = { ...nextState, [storeName]: upsertItem(nextState[storeName] || [], record) };
      }
      const nextBankAccounts = applyBankAccountAdjustments(state.bankAccounts || [], bankAccountAdjustments, timestamp);
      nextState = { ...nextState, bankAccounts: nextBankAccounts };
      return { ...nextState, derived: buildDerived(nextState) };
    });

    await persistActivityLogs(set, toPut.map(({ storeName, record }) =>
      buildActivityLog({ storeName, action: 'create', before: null, after: record }),
    ));
    get().triggerAutoPush();
    return cashflow;
  },

  withdrawSavings: async (spec) => {
    const { date, amountCents, description, bankAccountId, goalId } = spec;
    const amount = Math.abs(amountCents || 0);
    if (!amount) return null;
    assertSourceHasFunds(get(), 'savings', amount);
    return get().saveSavingsEntry({
      date,
      amountCents: -amount,
      note: description || 'Withdrawal',
      kind: 'withdrawal',
      bankAccountId: bankAccountId || null,
      goalId: goalId || null,
    });
  },

  spendFromSavings: async (spec) => {
    const { date, amountCents, description, category, goalId } = spec;
    const amount = Math.abs(amountCents || 0);
    if (!amount) return null;
    assertSourceHasFunds(get(), 'savings', amount);
    const timestamp = new Date().toISOString();
    const currency = get().settings.baseCurrency;

    const expense = ensureEntitySyncFields({
      id: makeId('exp'),
      date,
      amountCents: amount,
      currency,
      category: category || 'Other',
      description: description || 'Bucket spend',
      isRecurring: false,
    }, timestamp);

    const savingsEntry = ensureEntitySyncFields({
      id: makeId('sav'),
      date,
      amountCents: -amount,
      note: description || 'Bucket spend',
      kind: 'expense',
      expenseId: expense.id,
      goalId: goalId || null,
    }, timestamp);

    const toPut = [
      { storeName: 'expenses', record: expense },
      { storeName: 'savingsEntries', record: savingsEntry },
    ];

    await Promise.all(toPut.map(({ storeName, record }) => putRecord(storeName, record)));

    set((state) => {
      let nextState = { ...state };
      for (const { storeName, record } of toPut) {
        nextState = { ...nextState, [storeName]: upsertItem(nextState[storeName] || [], record) };
      }
      return { ...nextState, derived: buildDerived(nextState) };
    });

    await persistActivityLogs(set, toPut.map(({ storeName, record }) =>
      buildActivityLog({ storeName, action: 'create', before: null, after: record }),
    ));
    get().triggerAutoPush();
    return { expense, savingsEntry };
  },

  markFixedIncomeReceived: async (fixedIncomeId, accountingMonth, receivedDate) => {
    const schedule = get().incomes.find((income) => income.id === fixedIncomeId && isFixedIncomeSchedule(income));
    if (!schedule) throw new Error('Fixed income schedule not found.');
    const month = accountingMonth || new Date().toISOString().slice(0, 7);
    const existing = get().incomes.find((income) =>
      income.incomeKind === 'fixed_payment' &&
      income.fixedIncomeId === fixedIncomeId &&
      income.accountingMonth === month
    );
    if (existing) return existing;

    const date = fixedIncomePaymentDate(schedule, month, receivedDate);
    return get().saveEntity('incomes', {
      date,
      accountingMonth: month,
      amountCents: schedule.amountCents,
      currency: schedule.currency || get().settings.baseCurrency,
      bankAccountId: schedule.bankAccountId || null,
      incomeKind: 'fixed_payment',
      fixedIncomeId,
      source: schedule.source || 'Fixed income',
      frequency: schedule.frequency || 'monthly',
      payDay: schedule.payDay || 1,
    });
  },

  refreshPrices: async () => {
    const { holdings, settings } = get();
    const refreshableHoldings = holdings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0);
    const refreshableTickers = [...new Set(refreshableHoldings.map((holding) => holding.ticker))];
    const apiKey = settings.finnhubApiKey || '';
    const baseCurrency = settings.baseCurrency || 'EUR';

    // Finnhub free tier = 60 req/min — no delay needed between requests.
    // Yahoo fallback is also parallel-safe for small portfolios.
    const DELAY_MS = 0;

    // Step 1: fetch { priceCents, currency } once per ticker, then apply it to
    // every operation/lot with that ticker.
    const results = [];
    for (let i = 0; i < refreshableTickers.length; i++) {
      if (i > 0 && DELAY_MS) await new Promise((r) => setTimeout(r, DELAY_MS));
      results.push(await Promise.allSettled([fetchTickerPrice(refreshableTickers[i], apiKey)]).then((r) => r[0]));
    }
    const resultsByTicker = new Map(refreshableTickers.map((ticker, index) => [ticker, results[index]]));

    // Step 2: collect unique foreign currencies that need FX conversion
    const foreignCurrencies = [
      ...new Set(
        results
          .filter((r) => r.status === 'fulfilled' && r.value.currency !== baseCurrency)
          .map((r) => r.value.currency),
      ),
    ];

    // Step 3: fetch FX rates (FROM/TO format works with both AV and Yahoo)
    // Result: { USD: 0.92, GBP: 1.17, ... } — multiply priceCents by this to get baseCurrency cents
    const fxRates = {};
    for (const foreignCurrency of foreignCurrencies) {
      if (DELAY_MS) await new Promise((r) => setTimeout(r, DELAY_MS));
      try {
        const { priceCents } = await fetchTickerPrice(`${foreignCurrency}/${baseCurrency}`, apiKey);
        fxRates[foreignCurrency] = priceCents / 100;
      } catch {
        // FX fetch failed — prices in this currency will be stored unconverted (best effort)
      }
    }

    // Step 4: build refreshed holdings in NATIVE currency.
    // Prices are stored as-is (no FX conversion); the FX rates are stored in
    // the Zustand state and applied at display time so P&L is always in baseCurrency.
    const failures = [];
    const refreshedActive = refreshableHoldings.map((holding) => {
      const result = resultsByTicker.get(holding.ticker);
      if (result.status === 'fulfilled') {
        const { priceCents, currency } = result.value;
        return { ...holding, currentPriceCents: priceCents, currency };
      }
      return holding;
    });
    for (const ticker of refreshableTickers) {
      const result = resultsByTicker.get(ticker);
      if (result?.status === 'rejected') {
        failures.push({ ticker, message: result.reason?.message || 'unknown error' });
      }
    }
    const refreshedById = new Map(refreshedActive.map((holding) => [holding.id, holding]));
    const refreshed = holdings.map((holding) => refreshedById.get(holding.id) || holding);

    const updated = refreshedActive.filter((holding) => resultsByTicker.get(holding.ticker)?.status === 'fulfilled');
    await Promise.all(updated.map((holding) => putRecord('holdings', holding)));
    set((state) => {
      const nextState = { ...state, holdings: refreshed, fxRates };
      return { holdings: refreshed, fxRates, derived: buildDerived(nextState) };
    });
    await persistActivityLogs(set, updated.map((holding) =>
      buildActivityLog({
        storeName: 'holdings',
        action: 'update',
        before: holdings.find((item) => item.id === holding.id) || null,
        after: holding,
        summary: `Refreshed price for "${getRecordLabel('holdings', holding)}"`,
      }),
    ));

    if (failures.length === refreshableTickers.length && refreshableTickers.length > 0) {
      throw new Error(`Price refresh failed for all tickers: ${failures.map((f) => f.ticker).join(', ')}`);
    }
    if (failures.length) {
      throw new Error(
        `Updated ${refreshableTickers.length - failures.length}/${refreshableTickers.length}. Failed: ${failures
          .map((f) => `${f.ticker} (${f.message})`)
          .join(', ')}`,
      );
    }
  },

  exportBackup: async (storeFilter = null) => exportDatabaseSnapshot(get().settings, storeFilter),

  wipeAllData: async ({ resetAccountSetup = false } = {}) => {
    const timestamp = new Date().toISOString();
    const state = get();
    const nextDeletedRecords = { ...state.syncMeta.deletedRecords };
    for (const storeName of STORE_KEYS) {
      const records = getStateRecords(state, storeName);
      nextDeletedRecords[storeName] = [
        ...(nextDeletedRecords[storeName] || []).filter((item) => !records.some((record) => record.id === item.id)),
        ...records.map((record) => ({ id: record.id, updatedAt: timestamp, deletedAt: timestamp })),
      ];
    }
    const nextSyncMeta = {
      ...state.syncMeta,
      deletedRecords: nextDeletedRecords,
      conflicts: [],
    };
    saveSyncMeta(nextSyncMeta);
    await clearAllStores();
    localStorage.setItem('pft-seeded', 'true');
    // Keep settings (currency, locale, theme, API keys) — reset financial fields only
    const current = state.settings;
    const resetSetupFields = resetAccountSetup
      ? {
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          onboardingTutorialCompleted: false,
          startTutorialAfterSetup: true,
          initialSetupCompleted: false,
          initialSetupCompletedAt: null,
          categories: DEFAULT_SETTINGS.categories,
          setupIntent: {
            buckets: false,
            budgets: false,
            recurringIncome: false,
            recurringBills: false,
          },
          modules: {
            ...(current.modules || {}),
            portfolio: false,
          },
        }
      : {};
    const nextSettings = { ...current, initialCashBalanceCents: 0, ...resetSetupFields };
    saveSettings(nextSettings);
    set((currentState) => {
      const nextState = {
        ...currentState,
        settings: nextSettings,
        syncMeta: nextSyncMeta,
        expenses: [],
        fixedExpenses: [],
        incomes: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: SAVINGS_DEFAULT,
        savingsEntries: [],
        savingsGoals: [],
        budgets: [],
        rollovers: [],
        transfers: [],
        bankAccounts: [],
        debts: [],
        attachments: [],
        activityLog: [],
        portfolioSnapshots: [],
      };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'settings',
      action: 'wipe',
      before: null,
      after: { id: 'wipe-all-data' },
      undoable: false,
      summary: 'Erased all local financial records',
    })]);
    if (get().supabaseUser) {
      await get().pushToSupabase();
    } else {
      get().triggerAutoPush();
    }
  },

  importBackup: async (snapshot) => {
    await importDatabaseSnapshot(snapshot);
    await get().bootstrap();
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'settings',
      action: 'import',
      before: null,
      after: { id: 'import-backup' },
      undoable: false,
      summary: 'Imported backup data',
    })]);
    get().triggerAutoPush();
  },

  undoActivityLog: async (logId) => {
    const log = get().activityLog.find((item) => item.id === logId);
    if (!log || !log.undoable || log.undoneAt) return null;

    const timestamp = new Date().toISOString();
    const storeName = log.recordType;
    const stateKey = getStoreStateKey(storeName);
    const isSettings = storeName === 'settings';
    const isSavingsConfig = storeName === 'savings';

    if (isSettings) {
      const nextSettings = { ...get().settings, ...(log.before || {}) };
      delete nextSettings.id;
      saveSettings(nextSettings);
      set((state) => ({ settings: nextSettings, derived: buildDerived({ ...state, settings: nextSettings }) }));
    } else if (log.action === 'create') {
      await deleteRecord(storeName, log.recordId);
      set((state) => {
        const nextDeletedRecords = {
          ...state.syncMeta.deletedRecords,
          [storeName]: [
            ...(state.syncMeta.deletedRecords[storeName] || []).filter((item) => item.id !== log.recordId),
            { id: log.recordId, updatedAt: timestamp, deletedAt: timestamp },
          ],
        };
        const nextSyncMeta = { ...state.syncMeta, deletedRecords: nextDeletedRecords };
        saveSyncMeta(nextSyncMeta);
        const nextValue = isSavingsConfig
          ? SAVINGS_DEFAULT
          : (state[stateKey] || []).filter((item) => item.id !== log.recordId);
        const nextState = { ...state, [stateKey]: nextValue, syncMeta: nextSyncMeta };
        return { [stateKey]: nextValue, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
      });
    } else if (log.action === 'update' || log.action === 'delete') {
      const restored = ensureEntitySyncFields({ ...(log.before || {}), updatedAt: timestamp }, timestamp);
      await putRecord(storeName, restored);
      set((state) => {
        const nextDeletedRecords = {
          ...state.syncMeta.deletedRecords,
          [storeName]: (state.syncMeta.deletedRecords[storeName] || []).filter((item) => item.id !== restored.id),
        };
        const nextSyncMeta = { ...state.syncMeta, deletedRecords: nextDeletedRecords };
        saveSyncMeta(nextSyncMeta);
        const nextValue = isSavingsConfig ? restored : upsertItem(state[stateKey] || [], restored);
        const nextState = { ...state, [stateKey]: nextValue, syncMeta: nextSyncMeta };
        return { [stateKey]: nextValue, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
      });
    } else {
      return null;
    }

    const undoLog = buildActivityLog({
      storeName,
      action: 'undo',
      before: log.after,
      after: log.before,
      undoable: false,
      summary: `Undid: ${log.summary}`,
    });
    const updatedLog = ensureEntitySyncFields({
      ...log,
      undoneAt: timestamp,
      undoneByLogId: undoLog.id,
      updatedAt: timestamp,
    }, timestamp);
    await putRecord('activityLog', updatedLog);
    await putRecord('activityLog', undoLog);
    set((state) => ({
      activityLog: [
        undoLog,
        ...state.activityLog.map((item) => (item.id === log.id ? updatedLog : item)),
      ],
    }));
    get().triggerAutoPush();
    return updatedLog;
  },

  sendMagicLink: async (email) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'auth-pending', supabaseError: '' });
    const { error } = await client.auth.signInWithOtp({ email });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
    set({ supabaseSyncStatus: 'auth-email-sent' });
  },

  signInWithGoogle: async () => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'auth-pending', supabaseError: '' });
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Land on /login so its <Navigate to="/dashboard" /> guard kicks in
        // once the session is parsed from the URL hash. Returning to '/'
        // gets immediately rerouted to '/landing' (public) and the user
        // appears stuck even though they're authenticated.
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
  },

  resetAuthStatus: () => {
    const status = get().supabaseSyncStatus;
    if (status === 'auth-pending' || status === 'error') {
      set({ supabaseSyncStatus: 'idle', supabaseError: '' });
    }
  },

  signUpWithPassword: async (email, password) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'auth-pending', supabaseError: '' });
    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
    set({ supabaseSyncStatus: 'auth-signup-pending' });
  },

  signInWithPassword: async (email, password) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'auth-pending', supabaseError: '' });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
    // Session arrives via onAuthStateChange — supabaseUser populates automatically
  },

  sendPasswordReset: async (email) => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'auth-pending', supabaseError: '' });
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
    set({ supabaseSyncStatus: 'auth-reset-pending' });
  },

  signOutSupabase: async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
    set({
      supabaseSession: null,
      supabaseUser: null,
      supabaseSyncStatus: 'idle',
      supabaseError: '',
      profile: null,
      friends: [],
      pendingIncoming: [],
      pendingOutgoing: [],
      profileStatus: 'idle',
      profileError: '',
      activityFeed: [],
      activityPrivacy: null,
      sharedGoals: [],
      goalInvitations: [],
      friendLedger: [],
      socialStatus: 'idle',
      socialError: '',
    });
  },

  // ── Profile & friends ─────────────────────────────────────────────────────

  loadProfile: async () => {
    const user = get().supabaseUser;
    if (!user) return null;
    set({ profileStatus: 'loading', profileError: '' });
    try {
      let profile = await fetchOwnProfile(user.id);
      if (!profile) {
        profile = await createOwnProfile(user.id, user.email);
      }
      set({ profile, profileStatus: 'idle' });
      return profile;
    } catch (error) {
      set({ profileStatus: 'error', profileError: error.message || 'Failed to load profile' });
      throw error;
    }
  },

  updateProfile: async (patch) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    if (patch.username !== undefined) {
      const err = validateUsername(patch.username);
      if (err) throw new Error(err);
    }
    const profile = await updateOwnProfile(user.id, patch);
    set({ profile });
    return profile;
  },

  loadFriendships: async () => {
    const user = get().supabaseUser;
    if (!user) return;
    const rows = await fetchFriendships(user.id);
    const otherIds = Array.from(new Set(
      rows.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id)),
    ));
    const profiles = otherIds.length ? await fetchProfilesByIds(otherIds) : [];
    const profileById = new Map(profiles.map((p) => [p.user_id, p]));

    const friends = [];
    const pendingIncoming = [];
    const pendingOutgoing = [];
    for (const row of rows) {
      const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
      const entry = {
        requesterId: row.requester_id,
        addresseeId: row.addressee_id,
        otherId,
        status: row.status,
        createdAt: row.created_at,
        profile: profileById.get(otherId) || null,
      };
      if (entry.profile?.social_enabled === false) continue;
      if (row.status === 'accepted') friends.push(entry);
      else if (row.addressee_id === user.id) pendingIncoming.push(entry);
      else pendingOutgoing.push(entry);
    }
    set({ friends, pendingIncoming, pendingOutgoing });
  },

  searchUsersByUsername: async (query) => {
    const user = get().supabaseUser;
    if (!user) return [];
    return searchProfilesByUsername(query, user.id);
  },

  searchUserByEmail: async (email) => {
    const user = get().supabaseUser;
    if (!user) return null;
    return searchProfileByEmail(email, user.id);
  },

  sendFriendRequest: async (targetUserId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    if (targetUserId === user.id) throw new Error('Cannot friend yourself');
    await insertFriendRequest(user.id, targetUserId);
    await get().loadFriendships();
  },

  acceptFriendRequest: async (requesterId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    await apiAcceptFriendRequest(requesterId, user.id);
    await get().loadFriendships();
  },

  declineFriendRequest: async (requesterId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    await deleteFriendship(requesterId, user.id);
    await get().loadFriendships();
  },

  cancelFriendRequest: async (addresseeId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    await deleteFriendship(user.id, addresseeId);
    await get().loadFriendships();
  },

  setAvatar: async (file) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const previous = get().profile;
    const { publicUrl } = await uploadAvatar(user.id, file);
    const profile = await updateOwnProfile(user.id, { avatar_url: publicUrl });
    set({ profile });
    const oldPath = avatarPathFromUrl(previous?.avatar_url);
    if (oldPath) {
      await removeAvatarObject(oldPath).catch(() => {});
    }
    return profile;
  },

  clearAvatar: async () => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const previous = get().profile;
    const profile = await updateOwnProfile(user.id, { avatar_url: null });
    set({ profile });
    const oldPath = avatarPathFromUrl(previous?.avatar_url);
    if (oldPath) {
      await removeAvatarObject(oldPath).catch(() => {});
    }
    return profile;
  },

  removeFriend: async (otherUserId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    // Delete whichever direction exists.
    await deleteFriendship(user.id, otherUserId).catch(() => {});
    await deleteFriendship(otherUserId, user.id).catch(() => {});
    await get().loadFriendships();
  },

  // ── Attachments ───────────────────────────────────────────────────────────

  uploadAttachment: async (expenseId, file) => {
    const id = makeId('att');
    const attachment = ensureEntitySyncFields({
      id,
      expenseId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      storagePath: null,
    });

    // Cache blob locally
    await putRecord('attachmentBlobs', { id, blob: file });
    await putRecord('attachments', attachment);
    set((state) => ({ attachments: upsertItem(state.attachments, attachment) }));
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'attachments',
      action: 'create',
      before: null,
      after: attachment,
    })]);

    // Upload to Supabase Storage and push metadata directly (bypass full-push race conditions)
    const client = getSupabaseBrowserClient();
    if (client) {
      const { data: authData } = await client.auth.getUser();
      const userId = authData?.user?.id;
      if (userId) {
        const path = `${userId}/${id}`;
        const { error: uploadError } = await client.storage
          .from('expense-attachments')
          .upload(path, file, { contentType: file.type, upsert: true });

        const synced = uploadError
          ? attachment
          : { ...attachment, storagePath: path, updatedAt: new Date().toISOString() };

        if (!uploadError) {
          await putRecord('attachments', synced);
          set((state) => ({ attachments: upsertItem(state.attachments, synced) }));
        }

        // Directly upsert just this attachment record — avoids being blocked by
        // a concurrent pushToSupabase that's already syncing the expense save
        await upsertRemoteRecords(client, [buildSyncRecord(userId, 'attachments', synced)]);
        return synced;
      }
    }

    return attachment;
  },

  removeAttachment: async (id) => {
    const attachment = get().attachments.find((a) => a.id === id);
    if (!attachment) return;

    await deleteRecord('attachmentBlobs', id);

    const client = getSupabaseBrowserClient();
    if (client && attachment.storagePath) {
      await client.storage.from('expense-attachments').remove([attachment.storagePath]);
    }

    await deleteRecord('attachments', id);
    const timestamp = new Date().toISOString();
    const tombstone = { id, updatedAt: timestamp, deletedAt: timestamp };

    set((state) => {
      const nextAttachments = state.attachments.filter((a) => a.id !== id);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        attachments: [...(state.syncMeta.deletedRecords.attachments || []).filter((t) => t.id !== id), tombstone],
      };
      const nextSyncMeta = { ...state.syncMeta, deletedRecords: nextDeletedRecords };
      saveSyncMeta(nextSyncMeta);
      return { attachments: nextAttachments, syncMeta: nextSyncMeta };
    });

    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'attachments',
      action: 'delete',
      before: attachment,
      after: null,
    })]);
    get().triggerAutoPush();
  },

  // Returns an object URL (from local blob) or a signed Supabase Storage URL.
  // Caller should revoke object URLs when done if they persist.
  getAttachmentUrl: async (attachment) => {
    const blobRecord = await getRecord('attachmentBlobs', attachment.id);
    if (blobRecord?.blob) {
      return URL.createObjectURL(blobRecord.blob);
    }

    const client = getSupabaseBrowserClient();
    if (client && attachment.storagePath) {
      const { data, error } = await client.storage
        .from('expense-attachments')
        .createSignedUrl(attachment.storagePath, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    }

    return null;
  },

  pushToSupabase: async () => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'syncing-up', supabaseError: '' });
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('No authenticated Supabase user');
      const state = get();
      const rows = [
        ...STORE_KEYS.flatMap((storeName) => {
          const tombstones = state.syncMeta.deletedRecords[storeName] || [];
          return getStateRecords(state, storeName)
            .filter((record) => !tombstones.some((tombstone) => tombstone.id === record.id))
            .map((record) => buildSyncRecord(userId, storeName, record));
        }),
        ...STORE_KEYS.flatMap((storeName) => (state.syncMeta.deletedRecords[storeName] || []).map((tombstone) => buildDeleteTombstone(userId, storeName, tombstone))),
      ];
      await upsertRemoteRecords(client, rows);

      // Upload any attachment files not yet in Supabase Storage
      const unsynced = get().attachments.filter((a) => !a.storagePath);
      for (const att of unsynced) {
        const blobRecord = await getRecord('attachmentBlobs', att.id);
        if (!blobRecord?.blob) continue;
        const path = `${userId}/${att.id}`;
        const { error: uploadError } = await client.storage
          .from('expense-attachments')
          .upload(path, blobRecord.blob, { contentType: att.mimeType, upsert: true });
        if (!uploadError) {
          const synced = { ...att, storagePath: path, updatedAt: new Date().toISOString() };
          await putRecord('attachments', synced);
          await upsertRemoteRecords(client, [buildSyncRecord(userId, 'attachments', synced)]);
          set((state) => ({ attachments: upsertItem(state.attachments, synced) }));
        }
      }

      set({
        supabaseSyncStatus: 'synced',
        supabaseLastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
  },

  pullFromSupabase: async () => {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase is not configured');
    set({ supabaseSyncStatus: 'syncing-down', supabaseError: '' });
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('No authenticated Supabase user');
      const state = get();
      const since = Object.values(state.syncMeta.lastPulledAt || {}).sort().at(-1);
      const changes = await fetchRemoteChanges(client, userId, since);
      const nextDeletedRecords = { ...state.syncMeta.deletedRecords };
      let nextConflicts = [...state.syncMeta.conflicts];

      for (const change of changes) {
        if (!STORE_KEYS.includes(change.store_name)) continue;
        const localRecord = getStateRecords(state, change.store_name).find((item) => item.id === change.record_id);
        const localTombstone = (state.syncMeta.deletedRecords[change.store_name] || []).find((item) => item.id === change.record_id);
        if (detectConflict({ localRecord, localTombstone, remoteChange: change, lastPulledAt: since })) {
          nextConflicts = upsertConflict(
            nextConflicts,
            buildConflict({
              storeName: change.store_name,
              remoteChange: change,
              localRecord,
              localTombstone,
            }),
          );
          continue;
        }

        if (change.deleted_at) {
          await deleteRecord(change.store_name, change.record_id);
          nextDeletedRecords[change.store_name] = (nextDeletedRecords[change.store_name] || []).filter((item) => item.id !== change.record_id);
        } else if (change.payload) {
          await putRecord(change.store_name, ensureEntitySyncFields(change.payload, change.updated_at));
          nextDeletedRecords[change.store_name] = (nextDeletedRecords[change.store_name] || []).filter((item) => item.id !== change.record_id);
        }
        nextConflicts = removeConflict(nextConflicts, `${change.store_name}:${change.record_id}`);
      }

      const latestTimestamp = changes.at(-1)?.updated_at;
      const nextSyncMeta = {
        lastPulledAt: latestTimestamp
          ? Object.fromEntries(STORE_KEYS.map((storeName) => [storeName, latestTimestamp]))
          : state.syncMeta.lastPulledAt,
        deletedRecords: nextDeletedRecords,
        conflicts: nextConflicts,
      };
      saveSyncMeta(nextSyncMeta);
      set({
        supabaseSyncStatus: 'synced',
        supabaseLastSyncedAt: latestTimestamp || get().supabaseLastSyncedAt,
        supabaseError: '',
        syncMeta: nextSyncMeta,
      });
      await get().reloadStoreData();
    } catch (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
  },

  resolveConflictUseRemote: async (conflictId) => {
    const conflict = get().syncMeta.conflicts.find((item) => item.id === conflictId);
    if (!conflict) return;

    if (conflict.remoteDeletedAt) {
      await deleteRecord(conflict.storeName, conflict.recordId);
      set((state) => {
        const nextList = state[conflict.storeName].filter((item) => item.id !== conflict.recordId);
        const nextDeletedRecords = {
          ...state.syncMeta.deletedRecords,
          [conflict.storeName]: (state.syncMeta.deletedRecords[conflict.storeName] || []).filter((item) => item.id !== conflict.recordId),
        };
        const nextSyncMeta = {
          ...state.syncMeta,
          deletedRecords: nextDeletedRecords,
          conflicts: removeConflict(state.syncMeta.conflicts, conflictId),
        };
        saveSyncMeta(nextSyncMeta);
        const nextState = { ...state, [conflict.storeName]: nextList };
        return { [conflict.storeName]: nextList, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
      });
      return;
    }

    const remoteRecord = ensureEntitySyncFields(conflict.remoteRecord, conflict.remoteUpdatedAt);
    await putRecord(conflict.storeName, remoteRecord);
    set((state) => {
      const nextList = upsertItem(state[conflict.storeName], remoteRecord);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        [conflict.storeName]: (state.syncMeta.deletedRecords[conflict.storeName] || []).filter((item) => item.id !== conflict.recordId),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: removeConflict(state.syncMeta.conflicts, conflictId),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, [conflict.storeName]: nextList };
      return { [conflict.storeName]: nextList, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
    });
  },

  resolveConflictKeepLocal: async (conflictId) => {
    const client = getSupabaseBrowserClient();
    const conflict = get().syncMeta.conflicts.find((item) => item.id === conflictId);
    if (!client || !conflict) return;
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error('No authenticated Supabase user');

    const localRecord = get()[conflict.storeName].find((item) => item.id === conflict.recordId);
    const localTombstone = (get().syncMeta.deletedRecords[conflict.storeName] || []).find((item) => item.id === conflict.recordId);

    if (localTombstone && !localRecord) {
      await upsertRemoteRecords(client, [buildDeleteTombstone(userId, conflict.storeName, localTombstone)]);
    } else if (localRecord) {
      await upsertRemoteRecords(client, [buildSyncRecord(userId, conflict.storeName, localRecord)]);
    }

    set((state) => {
      const nextSyncMeta = {
        ...state.syncMeta,
        conflicts: removeConflict(state.syncMeta.conflicts, conflictId),
      };
      saveSyncMeta(nextSyncMeta);
      return { syncMeta: nextSyncMeta };
    });
  },

  // ── Social: activity feed ─────────────────────────────────────────────────

  loadActivityFeed: async () => {
    const user = get().supabaseUser;
    if (!user) return;
    set({ socialStatus: 'loading', socialError: '' });
    try {
      await get().loadFriendships();
      const friendIds = get().friends.map((f) => f.otherId);
      const [feed, privacy] = await Promise.all([
        fetchFeedForUser(user.id, friendIds),
        fetchActivityPrivacy(user.id),
      ]);
      set({ activityFeed: feed, activityPrivacy: privacy, socialStatus: 'idle' });
    } catch (err) {
      set({ socialStatus: 'error', socialError: err.message || 'Failed to load feed' });
    }
  },

  postActivity: async (type, payload = {}) => {
    const user = get().supabaseUser;
    if (!user) return;
    try {
      const item = await insertActivity(user.id, type, payload);
      set((state) => ({ activityFeed: [item, ...state.activityFeed] }));
    } catch {
      // non-critical — don't surface to user
    }
  },

  deleteActivity: async (activityId) => {
    await apiDeleteActivity(activityId);
    set((state) => ({ activityFeed: state.activityFeed.filter((a) => a.id !== activityId) }));
  },

  updateActivityPrivacy: async (patch) => {
    const user = get().supabaseUser;
    if (!user) return;
    const updated = await upsertActivityPrivacy(user.id, patch);
    set({ activityPrivacy: updated });
  },

  addReaction: async (activityId, emoji) => {
    const user = get().supabaseUser;
    if (!user) return;
    const existing = get().activityFeed
      .find((a) => a.id === activityId)
      ?.activity_reactions?.find((r) => r.user_id === user.id);
    if (existing) await apiRemoveReaction(activityId, user.id);
    const reaction = await apiAddReaction(activityId, user.id, emoji);
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_reactions: [
            ...(a.activity_reactions || []).filter((r) => r.user_id !== user.id),
            reaction,
          ],
        }
      ),
    }));
  },

  removeReaction: async (activityId) => {
    const user = get().supabaseUser;
    if (!user) return;
    await apiRemoveReaction(activityId, user.id);
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_reactions: (a.activity_reactions || []).filter((r) => r.user_id !== user.id),
        }
      ),
    }));
  },

  addComment: async (activityId, body) => {
    const user = get().supabaseUser;
    if (!user) return;
    const comment = await apiAddComment(activityId, user.id, body);
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_comments: [...(a.activity_comments || []), comment],
        }
      ),
    }));
  },

  deleteComment: async (activityId, commentId) => {
    await apiDeleteComment(commentId);
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_comments: (a.activity_comments || []).filter((c) => c.id !== commentId),
        }
      ),
    }));
  },

  // ── Social: shared goals ──────────────────────────────────────────────────

  loadSharedGoals: async () => {
    const user = get().supabaseUser;
    if (!user) return;
    set({ socialStatus: 'loading', socialError: '' });
    try {
      const [goals, invitations] = await Promise.all([
        fetchSharedGoals(user.id),
        fetchGoalInvitations(user.id),
      ]);
      set({ sharedGoals: goals, goalInvitations: invitations, socialStatus: 'idle' });
    } catch (err) {
      set({ socialStatus: 'error', socialError: err.message || 'Failed to load goals' });
    }
  },

  acceptGoalInvitation: async (goalId) => {
    const user = get().supabaseUser;
    if (!user) return;
    await apiAcceptGoalInvitation(goalId, user.id);
    await get().loadSharedGoals();
  },

  declineGoalInvitation: async (goalId) => {
    const user = get().supabaseUser;
    if (!user) return;
    await removeGoalParticipant(goalId, user.id);
    set((state) => ({ goalInvitations: state.goalInvitations.filter((g) => g.id !== goalId) }));
  },

  createSharedGoal: async ({ name, targetCents, currency, description, emoji, inviteIds = [] }) => {
    const user = get().supabaseUser;
    if (!user) return;
    const goal = await apiCreateSharedGoal(user.id, { name, targetCents, currency, description, emoji, inviteIds });
    await get().postActivity('shared_goal_created', { goalId: goal.id, goalName: name });
    await get().loadSharedGoals();
    return goal;
  },

  updateSharedGoal: async (goalId, patch) => {
    await apiUpdateSharedGoal(goalId, patch);
    await get().loadSharedGoals();
  },

  deleteSharedGoal: async (goalId) => {
    await apiDeleteSharedGoal(goalId);
    set((state) => ({ sharedGoals: state.sharedGoals.filter((g) => g.id !== goalId) }));
  },

  addGoalParticipant: async (goalId, userId) => {
    await addGoalParticipant(goalId, userId);
    await get().loadSharedGoals();
  },

  removeGoalParticipant: async (goalId, userId) => {
    await removeGoalParticipant(goalId, userId);
    await get().loadSharedGoals();
  },

  addContribution: async (goalId, amountCents, note = '') => {
    const user = get().supabaseUser;
    if (!user) return;
    await apiAddContribution(goalId, user.id, amountCents, note);
    const goals = await fetchSharedGoals(user.id);
    const goal = goals.find((g) => g.id === goalId);
    if (goal) {
      const totalCents = (goal.shared_goal_contributions || []).reduce((s, c) => s + c.amount_cents, 0);
      if (totalCents >= goal.target_cents && !goal.completed_at) {
        await apiUpdateSharedGoal(goalId, { completedAt: new Date().toISOString() });
        await get().postActivity('shared_goal_reached', { goalId, goalName: goal.name, targetCents: goal.target_cents });
      }
    }
    set({ sharedGoals: goals });
  },

  deleteContribution: async (goalId, contributionId) => {
    await apiDeleteContribution(contributionId);
    await get().loadSharedGoals();
  },

  // ── Social: friend ledger ─────────────────────────────────────────────────

  loadFriendLedger: async () => {
    const user = get().supabaseUser;
    if (!user) return;
    try {
      const entries = await fetchFriendLedger(user.id);
      set({ friendLedger: entries });
    } catch (err) {
      console.error('loadFriendLedger:', err);
    }
  },

  createManualIOU: async ({ friendId, amountCents, currency = 'EUR', note = '', iOweTheme = false }) => {
    const user = get().supabaseUser;
    if (!user) return;
    const creditorId = iOweTheme ? friendId : user.id;
    const debtorId  = iOweTheme ? user.id   : friendId;
    const entry = await apiCreateLedgerEntry({
      creditorId,
      debtorId,
      amountCents,
      currency,
      kind: 'manual',
      note,
      createdBy: user.id,
    });
    set((state) => ({ friendLedger: [entry, ...state.friendLedger] }));
    return entry;
  },

  settleLedgerEntry: async (entryId, { bankAccountId } = {}) => {
    const user = get().supabaseUser;
    if (!user) return;
    const entry = get().friendLedger.find((e) => e.id === entryId);
    if (bankAccountId && entry && entry.debtor_id === user.id) {
      const today = new Date().toISOString().slice(0, 10);
      await get().saveEntity('expenses', {
        date: today,
        amountCents: entry.amount_cents,
        currency: entry.currency,
        category: 'Other',
        description: entry.note || 'IOU settlement',
        isRecurring: false,
        bankAccountId,
      });
    }
    const updated = await apiSettleLedgerEntry(entryId, user.id);
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
    }));
  },

  cancelLedgerEntry: async (entryId) => {
    const updated = await apiCancelLedgerEntry(entryId);
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
    }));
  },

  sendPayment: async ({ friendId, amountCents, currency = 'EUR', note = '', parentIouId = null, bankAccountId = null }) => {
    const user = get().supabaseUser;
    if (!user) return;
    if (bankAccountId) {
      const today = new Date().toISOString().slice(0, 10);
      await get().saveEntity('expenses', {
        date: today,
        amountCents,
        currency,
        category: 'Other',
        description: note || 'Payment to friend',
        isRecurring: false,
        bankAccountId,
      });
    }
    const entry = await apiCreateLedgerEntry({
      creditorId: friendId,
      debtorId: user.id,
      amountCents,
      currency,
      kind: 'payment',
      note,
      createdBy: user.id,
      parentIouId,
    });
    set((state) => ({ friendLedger: [entry, ...state.friendLedger] }));
    return entry;
  },

  acceptPayment: async (entryId, { bankAccountId, senderName = '' } = {}) => {
    const user = get().supabaseUser;
    if (!user) return;
    const entry = get().friendLedger.find((e) => e.id === entryId);

    if (entry && bankAccountId) {
      const today = new Date().toISOString().slice(0, 10);
      await get().saveEntity('incomes', {
        date: today,
        amountCents: entry.amount_cents,
        currency: entry.currency,
        bankAccountId,
        source: senderName ? `Payment from ${senderName}` : 'Friend payment',
      });
    }

    const updatedPayment = await apiSettleLedgerEntry(entryId, user.id);

    // If this payment was linked to an IOU, reduce or settle it
    const linkedIouId = entry?.parent_expense_id;
    const linkedIou = linkedIouId ? get().friendLedger.find((e) => e.id === linkedIouId && e.status === 'pending') : null;

    let updatedIou = null;
    if (linkedIou) {
      const remaining = linkedIou.amount_cents - entry.amount_cents;
      if (remaining <= 0) {
        updatedIou = await apiSettleLedgerEntry(linkedIou.id, user.id);
      } else {
        updatedIou = await apiUpdateLedgerEntry(linkedIou.id, { amountCents: remaining });
      }
    }

    set((state) => ({
      friendLedger: state.friendLedger.map((e) => {
        if (e.id === entryId) return updatedPayment;
        if (updatedIou && e.id === linkedIou.id) return updatedIou;
        return e;
      }),
    }));
  },

  declinePayment: async (entryId) => {
    const updated = await apiRejectLedgerEntry(entryId);
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
    }));
  },

}));

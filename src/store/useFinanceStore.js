import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../data/defaults';
import {
  cacheSettingsLocally,
  cleanupLegacyIndexedDB,
  clearAllStores,
  clearActiveUserId,
  deleteRecord,
  ensureEntitySyncFields,
  exportDatabaseSnapshot,
  fetchAllStoresForCurrentUser,
  getActiveUserId,
  getAllRecords,
  getRecord,
  importDatabaseSnapshot,
  loadSettings,
  putRecord,
  saveSettings,
  saveSyncMeta,
  setActiveUserId,
} from '../utils/storage';
import {
  assignedPortfolioHoldings,
  assignedPortfolioRecords,
  computeDashboardData,
  computePortfolioMetrics,
  isFixedIncomeSchedule,
  validPortfolioIds,
} from '../utils/finance';
import {
  clearSupabaseBrowserClient,
  createSupabaseBrowserClient,
  getSupabaseBrowserClient,
  getSupabaseConfig,
} from '../utils/supabase';
import { fetchTickerPrice } from '../utils/yahoo';
import { loadAppMode, saveAppMode } from '../utils/appMode';
import { makeId } from '../utils/makeId';
import { toast } from './useToastStore';
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
  completeSharedGoalIfReached as apiCompleteSharedGoalIfReached,
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
  acceptLedgerEntry as apiAcceptLedgerEntry,
  applyPartialIouPayment as apiApplyPartialIouPayment,
  cancelLedgerEntry as apiCancelLedgerEntry,
  createLedgerEntry as apiCreateLedgerEntry,
  fetchFriendLedger,
  rejectLedgerEntry as apiRejectLedgerEntry,
  settleLedgerEntry as apiSettleLedgerEntry,
  updateLedgerEntry as apiUpdateLedgerEntry,
} from '../utils/friendsMoneyApi';
import {
  buyCoin as apiBuyCoin,
  claimDaily as apiClaimDaily,
  createCoin as apiCreateCoin,
  ensureWallet,
  fetchCasinoState as apiFetchCasinoState,
  fetchWallet,
  addAdminUser as apiAddCoingameAdminUser,
  fetchAdminUsers as apiFetchCoingameAdminUsers,
  fetchBotConfig as apiFetchBotConfig,
  fetchBotLogs as apiFetchBotLogs,
  fetchCoinByOwner,
  fetchCoingameAdminStatus as apiFetchCoingameAdminStatus,
  fetchEconomy,
  fetchGamblingRecent as apiFetchGamblingRecent,
  fetchHoldings as apiFetchHoldings,
  fetchMarketHealth as apiFetchMarketHealth,
  fetchTransactions as apiFetchTransactions,
  fetchTrending,
  fetchWeeklyLeaderboard,
  gambleCoinflip as apiGambleCoinflip,
  gambleDice as apiGambleDice,
  removeAdminUser as apiRemoveCoingameAdminUser,
  sellCoin as apiSellCoin,
  setCasinoHouseBalance as apiSetCasinoHouseBalance,
  setBotCoinEnabled as apiSetBotCoinEnabled,
  setBotReserve as apiSetBotReserve,
  triggerBotTick as apiTriggerBotTick,
  updateBotGlobalConfig as apiUpdateBotGlobalConfig,
} from '../utils/coingameApi';

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
const PORTFOLIO_SNAPSHOT_SCOPE_VERSION = 'assigned-only-v1';
let authSubscription = null;
let autoPushTimer = null;

function appSetTimeout(handler, ms) {
  return (typeof window !== 'undefined' ? window : globalThis).setTimeout(handler, ms);
}

function appClearTimeout(timeoutId) {
  return (typeof window !== 'undefined' ? window : globalThis).clearTimeout(timeoutId);
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = appSetTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => appClearTimeout(timeoutId));
}

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
let realtimeChannel = null;
let realtimePullTimer = null;

function teardownRealtime() {
  if (realtimePullTimer) {
    clearTimeout(realtimePullTimer);
    realtimePullTimer = null;
  }
  if (realtimeChannel) {
    try { realtimeChannel.unsubscribe(); } catch { /* ignore */ }
    realtimeChannel = null;
  }
}

// Subscribe to postgres_changes on finance_records for this user and patch
// zustand state directly when other devices write. Our own writes echo back
// here too, but the updatedAt comparison below dedupes them.
function subscribeRealtime(client, userId, applyChange) {
  realtimeChannel = client
    .channel(`finance-records-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'finance_records',
      filter: `user_id=eq.${userId}`,
    }, (msg) => {
      const row = msg.new && Object.keys(msg.new).length ? msg.new : msg.old;
      if (!row) return;
      applyChange({
        event: msg.eventType,
        storeName: row.store_name,
        recordId: row.record_id,
        payload: msg.new?.payload ?? null,
        updatedAt: msg.new?.updated_at ?? null,
      });
    })
    .subscribe();
}

// Patch zustand state from a Supabase realtime event. Skips changes that the
// current device has already applied locally (the row's updatedAt is <= the
// one we already have), which is what dedupes our own writes echoing back.
function applyRealtimeChange(get, set, { event, storeName, recordId, payload }) {
  if (!storeName) return;

  if (storeName === 'settings') {
    if (event === 'DELETE') return; // settings is never hard-deleted
    if (!payload) return;
    const current = get().settings;
    const currentTs = new Date(current.updatedAt || 0).getTime();
    const incomingTs = new Date(payload.updatedAt || 0).getTime();
    if (incomingTs <= currentTs) return;
    const next = { ...DEFAULT_SETTINGS, ...payload, theme: current.theme, locale: current.locale };
    cacheSettingsLocally(next);
    set((state) => ({ settings: next, derived: buildDerived({ ...state, settings: next }) }));
    return;
  }

  if (storeName === 'savings') {
    if (event === 'DELETE') {
      const current = get().savingsConfig;
      if (!current || current.id !== recordId) return;
      set((state) => ({ savingsConfig: SAVINGS_DEFAULT, derived: buildDerived({ ...state, savingsConfig: SAVINGS_DEFAULT }) }));
      return;
    }
    if (!payload) return;
    const current = get().savingsConfig;
    const currentTs = new Date(current?.updatedAt || 0).getTime();
    const incomingTs = new Date(payload.updatedAt || 0).getTime();
    if (incomingTs <= currentTs) return;
    set((state) => ({ savingsConfig: payload, derived: buildDerived({ ...state, savingsConfig: payload }) }));
    return;
  }

  if (!STORE_KEYS.includes(storeName)) return;

  if (event === 'DELETE') {
    const list = get()[storeName] || [];
    if (!list.some((item) => item.id === recordId)) return;
    set((state) => {
      const nextList = (state[storeName] || []).filter((item) => item.id !== recordId);
      const nextState = { ...state, [storeName]: nextList };
      return { [storeName]: nextList, derived: buildDerived(nextState) };
    });
    return;
  }

  if (!payload) return;
  const list = get()[storeName] || [];
  const existing = list.find((item) => item.id === recordId);
  const currentTs = new Date(existing?.updatedAt || 0).getTime();
  const incomingTs = new Date(payload.updatedAt || 0).getTime();
  if (existing && incomingTs <= currentTs) return;
  const incoming = ensureEntitySyncFields(payload, payload.updatedAt);
  set((state) => {
    const next = upsertItem(state[storeName] || [], incoming);
    const nextState = { ...state, [storeName]: next };
    return { [storeName]: next, derived: buildDerived(nextState) };
  });
}

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
  const portfolioHoldings = assignedPortfolioHoldings(state.holdings, state.investmentPortfolios);
  const portfolioDividends = assignedPortfolioRecords(state.dividends, state.investmentPortfolios);
  const portfolioCashflows = assignedPortfolioRecords(state.portfolioCashflows, state.investmentPortfolios);
  return {
    dashboard: computeDashboardData({ ...state, fxRates }),
    portfolio: computePortfolioMetrics(
      portfolioHoldings,
      portfolioDividends,
      portfolioCashflows,
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

function resolveHoldingPurchaseDate(holding, cashflows = []) {
  if (holding?.purchaseDate) return holding.purchaseDate;
  const linkedBuy = (cashflows || []).find((flow) => flow.kind === 'buy' && flow.holdingId === holding?.id && flow.date);
  if (linkedBuy?.date) return linkedBuy.date;
  if (holding?.createdAt) return holding.createdAt.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function normalizeInvestmentPortfolioRecords(records, settings) {
  const timestamp = new Date().toISOString();
  const portfolios = [...(records.investmentPortfolios || [])];
  if (!portfolios.length && (records.holdings || []).length) {
    portfolios.push(defaultInvestmentPortfolio(timestamp));
  }
  const fallbackPortfolioId = portfolios[0]?.id || null;
  const normalizedHoldings = (records.holdings || []).map((holding) => {
    const patch = {};
    if (!Object.prototype.hasOwnProperty.call(holding, 'portfolioId') && fallbackPortfolioId) {
      patch.portfolioId = fallbackPortfolioId;
    }
    if (!holding.purchaseDate) patch.purchaseDate = resolveHoldingPurchaseDate(holding, records.portfolioCashflows);
    return Object.keys(patch).length ? { ...holding, ...patch, updatedAt: timestamp } : holding;
  });
  const holdingsById = new Map(normalizedHoldings.map((holding) => [holding.id, holding]));
  const normalizedSales = (records.portfolioSales || []).map((sale) => {
    const hasPortfolioId = Object.prototype.hasOwnProperty.call(sale, 'portfolioId');
    const portfolioId = sale.portfolioId || holdingsById.get(sale.holdingId)?.portfolioId || fallbackPortfolioId;
    return portfolioId && !hasPortfolioId ? { ...sale, portfolioId, updatedAt: timestamp } : sale;
  });
  const normalizedCashflows = (records.portfolioCashflows || []).map((cashflow) => {
    const hasPortfolioId = Object.prototype.hasOwnProperty.call(cashflow, 'portfolioId');
    const portfolioId = cashflow.portfolioId || holdingsById.get(cashflow.holdingId)?.portfolioId || fallbackPortfolioId;
    return portfolioId && !hasPortfolioId ? { ...cashflow, portfolioId, updatedAt: timestamp } : cashflow;
  });
  const normalizedDividends = (records.dividends || []).map((dividend) => {
    const hasPortfolioId = Object.prototype.hasOwnProperty.call(dividend, 'portfolioId');
    const portfolioId = dividend.portfolioId || inferPortfolioIdFromTicker(dividend.ticker, normalizedHoldings, fallbackPortfolioId);
    return portfolioId && !hasPortfolioId ? { ...dividend, portfolioId, updatedAt: timestamp } : dividend;
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
  const sensitive = new Set(['finnhubApiKey', 'alphaVantageApiKey']);
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
  hideAmounts: typeof localStorage !== 'undefined' && localStorage.getItem('pft-dashboard-hide-kpis') === 'true',
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
  coingameWallet: null,
  coingameOwnCoin: null,
  coingameHoldings: [],
  coingameTransactions: [],
  coingameTrending: [],
  coingameLeaderboard: [],
  coingameLeaderboardMetric: 'gains_fc',
  coingameEconomy: null,
  coingameCasino: null,
  coingameGamblingBets: [],
  coingameLastGambleResult: null,
  coingameStatus: 'idle',
  coingameError: '',
  coingameNeedsCoinSetup: false,
  coingameBotConfig: null,
  coingameBotLogs: [],
  coingameMarketHealth: null,
  coingameAdminUsers: [],
  coingameIsAdmin: false,
  coingameAdminStatus: 'idle',
  coingameAdminError: '',
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
    const buckets = await fetchAllStoresForCurrentUser();

    // Cloud settings win over the localStorage cache for fields that DO sync;
    // the bootstrap-cached version is just there for fast theme paint.
    const cachedSettings = loadSettings();
    const cloudSettings = buckets.settings?.[0];
    const settings = cloudSettings
      ? { ...DEFAULT_SETTINGS, ...cloudSettings, theme: cachedSettings.theme, locale: cachedSettings.locale }
      : cachedSettings;
    cacheSettingsLocally(settings);

    const lists = STORE_KEYS.map((key) => (buckets[key] || []).map((item) => ensureEntitySyncFields(item)));
    lists[14] = await migrateInitialCashToBankAccounts(lists[14], settings);
    const portfolioRecords = await normalizeInvestmentPortfolioRecords({
      investmentPortfolios: lists[3],
      holdings: lists[4],
      dividends: lists[5],
      portfolioCashflows: lists[6],
      portfolioSales: lists[7],
    }, settings);

    set((state) => {
      const nextState = {
        ...state,
        settings,
        expenses: lists[0],
        fixedExpenses: lists[1],
        incomes: lists[2],
        investmentPortfolios: portfolioRecords.investmentPortfolios,
        holdings: portfolioRecords.holdings,
        dividends: portfolioRecords.dividends,
        portfolioCashflows: portfolioRecords.portfolioCashflows,
        portfolioSales: portfolioRecords.portfolioSales,
        savingsConfig: lists[8][0] || SAVINGS_DEFAULT,
        savingsEntries: lists[9],
        savingsGoals: lists[10],
        budgets: lists[11],
        rollovers: lists[12],
        transfers: lists[13],
        bankAccounts: lists[14],
        debts: lists[15],
        attachments: lists[16],
        activityLog: lists[17],
        portfolioSnapshots: lists[18],
      };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    await cleanupGeneratedPortfolioIncomesForState(get, set);
  },

  bootstrap: async () => {
    const hydrationWatchdog = appSetTimeout(() => {
      set((state) => state.hydrated ? state : {
        hydrated: true,
        supabaseSyncStatus: 'error',
        supabaseError: state.supabaseError || 'Startup took too long.',
      });
    }, 8_000);
    try {
      // One-time best-effort cleanup of the legacy IndexedDB database. Runs
      // before anything else so we don't race the first cloud write.
      cleanupLegacyIndexedDB();

      // Paint with cached settings immediately (theme/locale) so the UI isn't
      // a flash of white while we wait for the first Supabase round-trip.
      const cachedSettings = loadSettings();
      set({
        settings: cachedSettings,
        supabaseConfigured: Boolean(getSupabaseConfig().url && getSupabaseConfig().anonKey),
      });

      // Open the Supabase client and resolve the session before touching any
      // data layer — cloud is the only source of truth now.
      await get().initializeSupabase();

      const { supabaseUser } = get();
      if (!supabaseUser) {
        // Not signed in: nothing to hydrate. The router lands the user on
        // the public landing/login page.
        set({ hydrated: true });
        return;
      }

      await get().reloadStoreData();
      await cleanupGeneratedPortfolioIncomesForState(get, set);
      await get().autoCreateFixedExpenses();
    } catch (error) {
      set({
        supabaseSyncStatus: 'error',
        supabaseError: error?.message || 'Unable to load the finance workspace.',
      });
    } finally {
      appClearTimeout(hydrationWatchdog);
      set({ hydrated: true });
    }
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
      teardownRealtime();
      set({
        supabaseConfigured: false,
        supabaseSession: null,
        supabaseUser: null,
        supabaseSyncStatus: 'idle',
        supabaseError: '',
      });
      return;
    }

    const { data, error } = await withTimeout(
      client.auth.getSession(),
      4_000,
      'Supabase session check timed out. Continuing in local mode.',
    );
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

    // Already signed in on app load — kick off the social-side fetches.
    // Finance data is hydrated by bootstrap (reloadStoreData) which now reads
    // straight from Supabase, so no separate pull is needed.
    if (data.session) {
      window.setTimeout(() => {
        get().loadProfile().catch(() => {});
        get().loadFriendships().catch(() => {});
      }, 0);
    }

    // Polling + focus pulls are gone in cloud-only mode. Realtime is the only
    // cross-device sync channel and patches zustand state directly.
    teardownRealtime();
    if (focusHandler) {
      window.removeEventListener('focus', focusHandler);
      focusHandler = null;
    }
    if (autoPullInterval) {
      clearInterval(autoPullInterval);
      autoPullInterval = null;
    }
    if (data.session?.user?.id) {
      subscribeRealtime(client, data.session.user.id, (change) => applyRealtimeChange(get, set, change));
    }

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
          if (newUserId) setActiveUserId(newUserId);
          // Cloud is truth — hydrate zustand from the just-signed-in user's
          // rows. No local wipe needed: Supabase RLS already scopes reads to
          // the active user.
          await get().reloadStoreData().catch(() => {});
          get().loadProfile().catch(() => {});
          get().loadFriendships().catch(() => {});
          teardownRealtime();
          if (newUserId) {
            subscribeRealtime(client, newUserId, (change) => applyRealtimeChange(get, set, change));
          }
        }, 0);
      }
      if (event === 'SIGNED_OUT') {
        teardownRealtime();
        clearActiveUserId();
        // Drop in-memory caches; leave Supabase rows untouched.
        set({
          profile: null,
          friends: [],
          pendingIncoming: [],
          pendingOutgoing: [],
          profileStatus: 'idle',
          profileError: '',
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

  toggleHideAmounts: () => set((state) => {
    const next = !state.hideAmounts;
    localStorage.setItem('pft-dashboard-hide-kpis', String(next));
    return { hideAmounts: next };
  }),

  setAppMode: (mode) => {
    const next = mode === 'lite' ? 'lite' : 'pro';
    saveAppMode(next);
    set({ appMode: next });
  },

  updateSettings: async (partial) => {
    const previousSettings = get().settings;
    const settings = { ...previousSettings, ...partial, updatedAt: new Date().toISOString() };
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
      { ...entryToSave, id: entryToSave.id || makeId('sav') },
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

  // Writes go to Supabase directly inside putRecord/deleteRecord (see
  // src/utils/storage.js); kept as a no-op for any lingering callers.
  triggerAutoPush: () => {},

  saveEntity: async (storeName, entity, { skipAutoCreate = false, skipAccountAdjustment = false, allowUnassignedPortfolio = false } = {}) => {
    let value = entity;
    const previous = entity.id ? get()[storeName]?.find((item) => item.id === entity.id) : null;

    // When an expense is flagged recurring, mirror it into the Recurring bills store
    // and keep a back-reference so repeat saves don't spawn duplicates.
    if (storeName === 'expenses' && value.isRecurring && !value.fixedExpenseId) {
      const chargeDay = value.chargeDay || Number((value.date || '').slice(-2)) || 1;
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
        active: value.hasOwnProperty('active') ? value.active : true,
        alerts: value.hasOwnProperty('alerts') ? value.alerts : true,
        lastSkippedMonth: value.lastSkippedMonth || null,
      }, { skipAutoCreate: true });
      value = { ...value, fixedExpenseId: fixed.id };
    }
    if (storeName === 'incomes' && !value.accountingMonth) {
      value = { ...value, accountingMonth: value.date?.slice(0, 7) };
    }
    if (storeName === 'holdings' && !value.portfolioId && !allowUnassignedPortfolio) {
      const fallbackPortfolioId = get().investmentPortfolios?.[0]?.id;
      if (!fallbackPortfolioId) throw new Error('Create a portfolio before adding holdings.');
      value = { ...value, portfolioId: fallbackPortfolioId };
    }
    if (storeName === 'holdings' && !value.purchaseDate) {
      value = { ...value, purchaseDate: resolveHoldingPurchaseDate(value, get().portfolioCashflows) };
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
      const hasLinkedData =
        get().holdings.some((item) => item.portfolioId === id) ||
        get().portfolioSales.some((item) => item.portfolioId === id) ||
        get().portfolioCashflows.some((item) => item.portfolioId === id) ||
        get().dividends.some((item) => item.portfolioId === id) ||
        get().portfolioSnapshots.some((item) => item.portfolioId === id);
      if (hasLinkedData) {
        throw new Error('This portfolio has holdings or history. Move or remove its data before deleting it.');
      }
    }
    if (storeName === 'bankAccounts') {
      const linkedStores = ['expenses', 'incomes', 'savingsEntries', 'transfers', 'portfolioCashflows'];
      const hasLinkedData = linkedStores.some((s) => (get()[s] || []).some((item) => item.bankAccountId === id));
      if (hasLinkedData) {
        throw new Error('This account has linked transactions. Reassign or remove them before deleting the account.');
      }
    }
    // Cascade: deleting a holding must remove its cost-basis cashflows and dividends,
    // otherwise XIRR/TWRR keep seeing phantom flows against a ticker that no longer exists.
    if (storeName === 'holdings') {
      const holding = get().holdings.find((h) => h.id === id);
      const cashflows = get().portfolioCashflows.filter((c) => c.holdingId === id);
      for (const cf of cashflows) {
        await get().removeEntity('portfolioCashflows', cf.id);
      }
      const sales = get().portfolioSales.filter((s) => s.holdingId === id);
      for (const sale of sales) {
        await get().removeEntity('portfolioSales', sale.id);
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
    try {
      await deleteRecord(storeName, id);
    } catch (error) {
      console.error(`Failed to delete ${storeName} record ${id}:`, error);
      throw error;
    }
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

    // When deleting a current-month expense created from a recurring bill, mark the
    // fixed expense so autoCreateFixedExpenses doesn't immediately recreate it.
    if (storeName === 'expenses' && previous?.fixedExpenseId) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (previous.date?.startsWith(currentMonth)) {
        const fixed = get().fixedExpenses.find((f) => f.id === previous.fixedExpenseId);
        if (fixed && fixed.lastSkippedMonth !== currentMonth) {
          const updatedFixed = { ...fixed, lastSkippedMonth: currentMonth, updatedAt: new Date().toISOString() };
          await putRecord('fixedExpenses', updatedFixed);
          set((state) => ({
            fixedExpenses: state.fixedExpenses.map((f) => (f.id === updatedFixed.id ? updatedFixed : f)),
          }));
        }
      }
    }

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
    // Preserve the FX rate implied by the original sale so bank delta doesn't
    // drift when today's rate differs from the rate at the time of the sale.
    let fxRatesForUpdate = get().fxRates || {};
    if (holding.currency && holding.currency !== baseCurrencyUpd) {
      const nativeGross = (currentSale.quantity || 0) * (currentSale.salePriceCents || 0);
      if (nativeGross > 0 && currentSale.grossProceedsCents) {
        fxRatesForUpdate = { ...fxRatesForUpdate, [holding.currency]: currentSale.grossProceedsCents / nativeGross };
      }
    }
    const { sale: rawSale, cashflow: nextCashflow } = applySaleFx(
      nativeRawSale, nativeNextCashflow,
      holding.currency, fxRatesForUpdate, baseCurrencyUpd,
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

  saveFixedExpense: async (entity, options) => get().saveEntity('fixedExpenses', entity, options),

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
      if (fe.lastSkippedMonth === currentMonth) continue;
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

  recordPortfolioSnapshot: async ({ force = false, source = 'hourly', portfolioId = null, includeGlobal = false, includeScoped = true } = {}) => {
    const state = get();
    const baseCurrency = state.settings?.baseCurrency || 'EUR';
    const portfolioIds = validPortfolioIds(state.investmentPortfolios || []);
    const assignedHoldings = (state.holdings || []).filter((holding) => (
      holding.portfolioId &&
      portfolioIds.has(holding.portfolioId)
    ));
    const assignedDividends = assignedPortfolioRecords(state.dividends || [], state.investmentPortfolios || []);
    const assignedCashflows = assignedPortfolioRecords(state.portfolioCashflows || [], state.investmentPortfolios || []);
    const activeHoldings = assignedHoldings
      .filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0).length;
    const targetPortfolios = !includeScoped
      ? []
      : portfolioId
        ? (state.investmentPortfolios || []).filter((portfolio) => portfolio.id === portfolioId)
        : (state.investmentPortfolios || []);
    const snapshotRecords = [];
    if (!activeHoldings && !force) return null;

    const timestamp = new Date().toISOString();
    const globalMetrics = computePortfolioMetrics(
      assignedHoldings,
      assignedDividends,
      assignedCashflows,
      state.settings.allocationTargets,
      state.fxRates || {},
      baseCurrency,
    );
    const globalRecord = ensureEntitySyncFields({
      id: force ? `psn-${timestamp}` : portfolioSnapshotId(timestamp),
      capturedAt: timestamp,
      valueCents: globalMetrics.currentValueCents,
      costCents: globalMetrics.investedCents,
      currency: baseCurrency,
      holdingsCount: activeHoldings,
      source,
      scopeVersion: PORTFOLIO_SNAPSHOT_SCOPE_VERSION,
    }, timestamp);
    if (!portfolioId || includeGlobal) snapshotRecords.push(globalRecord);

    for (const portfolio of targetPortfolios) {
      const scopedHoldings = assignedHoldings.filter((holding) => holding.portfolioId === portfolio.id);
      const scopedActiveCount = scopedHoldings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0).length;
      if (!scopedActiveCount && !force) continue;
      const metrics = computePortfolioMetrics(
        scopedHoldings,
        assignedDividends.filter((dividend) => dividend.portfolioId === portfolio.id),
        assignedCashflows.filter((flow) => flow.portfolioId === portfolio.id),
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
        scopeVersion: PORTFOLIO_SNAPSHOT_SCOPE_VERSION,
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
      const mergedFxRates = { ...state.fxRates, ...fxRates };
      const nextState = { ...state, holdings: refreshed, fxRates: mergedFxRates };
      return { holdings: refreshed, fxRates: mergedFxRates, derived: buildDerived(nextState) };
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
    await clearAllStores();
    _cascadingDeletes.clear();
    saveSyncMeta(nextSyncMeta);
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
          holdingPlatforms: DEFAULT_SETTINGS.holdingPlatforms,
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
      };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    await persistActivityLogs(set, [buildActivityLog({
      storeName: 'settings',
      action: 'wipe',
      before: null,
      after: { id: 'wipe-all-data' },
      undoable: false,
      summary: 'Erased all financial records',
    })]);
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
        redirectTo: `${window.location.origin}/auth/callback`,
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
    _cascadingDeletes.clear();
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
    const previous = get().profile;
    set({ profile: { ...(previous || {}), ...patch } });
    try {
      const profile = await updateOwnProfile(user.id, patch);
      set({ profile });
      return profile;
    } catch (err) {
      set({ profile: previous });
      toast.error(err.message || 'Could not update profile');
      throw err;
    }
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
    try {
      await insertFriendRequest(user.id, targetUserId);
      get().loadFriendships().catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Could not send friend request');
      throw err;
    }
  },

  acceptFriendRequest: async (requesterId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const prevIncoming = get().pendingIncoming;
    const prevFriends = get().friends;
    const moved = prevIncoming.find((e) => e.requesterId === requesterId);
    set((state) => ({
      pendingIncoming: state.pendingIncoming.filter((e) => e.requesterId !== requesterId),
      friends: moved ? [...state.friends, { ...moved, status: 'accepted' }] : state.friends,
    }));
    try {
      await apiAcceptFriendRequest(requesterId, user.id);
      get().loadFriendships().catch(() => {});
    } catch (err) {
      set({ pendingIncoming: prevIncoming, friends: prevFriends });
      toast.error(err.message || 'Could not accept request');
      throw err;
    }
  },

  declineFriendRequest: async (requesterId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const prevIncoming = get().pendingIncoming;
    set((state) => ({
      pendingIncoming: state.pendingIncoming.filter((e) => e.requesterId !== requesterId),
    }));
    try {
      await deleteFriendship(requesterId, user.id);
      get().loadFriendships().catch(() => {});
    } catch (err) {
      set({ pendingIncoming: prevIncoming });
      toast.error(err.message || 'Could not decline request');
      throw err;
    }
  },

  cancelFriendRequest: async (addresseeId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const prevOutgoing = get().pendingOutgoing;
    set((state) => ({
      pendingOutgoing: state.pendingOutgoing.filter((e) => e.addresseeId !== addresseeId),
    }));
    try {
      await deleteFriendship(user.id, addresseeId);
      get().loadFriendships().catch(() => {});
    } catch (err) {
      set({ pendingOutgoing: prevOutgoing });
      toast.error(err.message || 'Could not cancel request');
      throw err;
    }
  },

  setAvatar: async (file) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const previous = get().profile;
    const previewUrl = URL.createObjectURL(file);
    set({ profile: { ...(previous || {}), avatar_url: previewUrl } });
    try {
      const { publicUrl } = await uploadAvatar(user.id, file);
      const profile = await updateOwnProfile(user.id, { avatar_url: publicUrl });
      set({ profile });
      URL.revokeObjectURL(previewUrl);
      const oldPath = avatarPathFromUrl(previous?.avatar_url);
      if (oldPath) {
        await removeAvatarObject(oldPath).catch(() => {});
      }
      return profile;
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      set({ profile: previous });
      toast.error(err.message || 'Avatar upload failed');
      throw err;
    }
  },

  clearAvatar: async () => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const previous = get().profile;
    set({ profile: { ...(previous || {}), avatar_url: null } });
    try {
      const profile = await updateOwnProfile(user.id, { avatar_url: null });
      set({ profile });
      const oldPath = avatarPathFromUrl(previous?.avatar_url);
      if (oldPath) {
        await removeAvatarObject(oldPath).catch(() => {});
      }
      return profile;
    } catch (err) {
      set({ profile: previous });
      toast.error(err.message || 'Could not remove avatar');
      throw err;
    }
  },

  removeFriend: async (otherUserId) => {
    const user = get().supabaseUser;
    if (!user) throw new Error('Not signed in');
    const prevFriends = get().friends;
    const prevLedger = get().friendLedger;
    // Cancel active IOUs between the two users so they don't dangle after the friendship ends.
    const toCancel = prevLedger.filter(
      (e) => ['pending', 'accepted'].includes(e.status) &&
        ((e.creditor_id === user.id && e.debtor_id === otherUserId) ||
         (e.creditor_id === otherUserId && e.debtor_id === user.id)),
    );
    set((state) => ({
      friends: state.friends.filter((f) => f.otherId !== otherUserId),
      friendLedger: state.friendLedger.map((e) =>
        toCancel.some((c) => c.id === e.id) ? { ...e, status: 'cancelled' } : e,
      ),
    }));
    try {
      await Promise.all(toCancel.map((e) => apiCancelLedgerEntry(e.id).catch(() => {})));
      await deleteFriendship(user.id, otherUserId).catch(() => {});
      await deleteFriendship(otherUserId, user.id).catch(() => {});
      get().loadFriendships().catch(() => {});
    } catch (err) {
      set({ friends: prevFriends, friendLedger: prevLedger });
      toast.error(err.message || 'Could not remove friend');
      throw err;
    }
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
    const prev = get().activityFeed;
    set((state) => ({ activityFeed: state.activityFeed.filter((a) => a.id !== activityId) }));
    try {
      await apiDeleteActivity(activityId);
    } catch (err) {
      set({ activityFeed: prev });
      toast.error(err.message || 'Could not delete activity');
      throw err;
    }
  },

  updateActivityPrivacy: async (patch) => {
    const user = get().supabaseUser;
    if (!user) return;
    const previous = get().activityPrivacy;
    set({ activityPrivacy: { ...(previous || {}), ...patch } });
    try {
      const updated = await upsertActivityPrivacy(user.id, patch);
      set({ activityPrivacy: updated });
    } catch (err) {
      set({ activityPrivacy: previous });
      toast.error(err.message || 'Could not save privacy setting');
      throw err;
    }
  },

  addReaction: async (activityId, emoji) => {
    const user = get().supabaseUser;
    if (!user) return;
    const prev = get().activityFeed;
    const tempReaction = { activity_id: activityId, user_id: user.id, emoji, created_at: new Date().toISOString() };
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_reactions: [
            ...(a.activity_reactions || []).filter((r) => r.user_id !== user.id),
            tempReaction,
          ],
        }
      ),
    }));
    try {
      const existing = prev
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
    } catch (err) {
      set({ activityFeed: prev });
      toast.error(err.message || 'Could not save reaction');
      throw err;
    }
  },

  removeReaction: async (activityId) => {
    const user = get().supabaseUser;
    if (!user) return;
    const prev = get().activityFeed;
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_reactions: (a.activity_reactions || []).filter((r) => r.user_id !== user.id),
        }
      ),
    }));
    try {
      await apiRemoveReaction(activityId, user.id);
    } catch (err) {
      set({ activityFeed: prev });
      toast.error(err.message || 'Could not remove reaction');
      throw err;
    }
  },

  addComment: async (activityId, body) => {
    const user = get().supabaseUser;
    if (!user) return;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempComment = {
      id: tempId,
      activity_id: activityId,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_comments: [...(a.activity_comments || []), tempComment],
        }
      ),
    }));
    try {
      const comment = await apiAddComment(activityId, user.id, body);
      set((state) => ({
        activityFeed: state.activityFeed.map((a) =>
          a.id !== activityId ? a : {
            ...a,
            activity_comments: (a.activity_comments || []).map((c) => (c.id === tempId ? comment : c)),
          }
        ),
      }));
    } catch (err) {
      set((state) => ({
        activityFeed: state.activityFeed.map((a) =>
          a.id !== activityId ? a : {
            ...a,
            activity_comments: (a.activity_comments || []).filter((c) => c.id !== tempId),
          }
        ),
      }));
      toast.error(err.message || 'Could not post comment');
      throw err;
    }
  },

  deleteComment: async (activityId, commentId) => {
    const prev = get().activityFeed;
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id !== activityId ? a : {
          ...a,
          activity_comments: (a.activity_comments || []).filter((c) => c.id !== commentId),
        }
      ),
    }));
    try {
      await apiDeleteComment(commentId);
    } catch (err) {
      set({ activityFeed: prev });
      toast.error(err.message || 'Could not delete comment');
      throw err;
    }
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
    const prevInvitations = get().goalInvitations;
    set((state) => ({ goalInvitations: state.goalInvitations.filter((g) => g.id !== goalId) }));
    try {
      await apiAcceptGoalInvitation(goalId, user.id);
      get().loadSharedGoals().catch(() => {});
    } catch (err) {
      set({ goalInvitations: prevInvitations });
      toast.error(err.message || 'Could not accept invitation');
      throw err;
    }
  },

  declineGoalInvitation: async (goalId) => {
    const user = get().supabaseUser;
    if (!user) return;
    const prevInvitations = get().goalInvitations;
    set((state) => ({ goalInvitations: state.goalInvitations.filter((g) => g.id !== goalId) }));
    try {
      await removeGoalParticipant(goalId, user.id);
    } catch (err) {
      set({ goalInvitations: prevInvitations });
      toast.error(err.message || 'Could not decline invitation');
      throw err;
    }
  },

  createSharedGoal: async ({ name, targetCents, currency, description, emoji, inviteIds = [] }) => {
    const user = get().supabaseUser;
    if (!user) return;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempGoal = {
      id: tempId,
      name,
      target_cents: targetCents,
      currency,
      description,
      emoji,
      owner_id: user.id,
      created_at: new Date().toISOString(),
      contributions: [],
      participants: [],
    };
    set((state) => ({ sharedGoals: [tempGoal, ...state.sharedGoals] }));
    try {
      const goal = await apiCreateSharedGoal(user.id, { name, targetCents, currency, description, emoji, inviteIds });
      get().postActivity('shared_goal_created', { goalId: goal.id, goalName: name }).catch(() => {});
      get().loadSharedGoals().catch(() => {});
      return goal;
    } catch (err) {
      set((state) => ({ sharedGoals: state.sharedGoals.filter((g) => g.id !== tempId) }));
      toast.error(err.message || 'Could not create goal');
      throw err;
    }
  },

  updateSharedGoal: async (goalId, patch) => {
    const prev = get().sharedGoals;
    set((state) => ({
      sharedGoals: state.sharedGoals.map((g) => (g.id === goalId ? { ...g, ...patch } : g)),
    }));
    try {
      await apiUpdateSharedGoal(goalId, patch);
      get().loadSharedGoals().catch(() => {});
    } catch (err) {
      set({ sharedGoals: prev });
      toast.error(err.message || 'Could not update goal');
      throw err;
    }
  },

  deleteSharedGoal: async (goalId) => {
    const prev = get().sharedGoals;
    set((state) => ({ sharedGoals: state.sharedGoals.filter((g) => g.id !== goalId) }));
    try {
      await apiDeleteSharedGoal(goalId);
    } catch (err) {
      set({ sharedGoals: prev });
      toast.error(err.message || 'Could not delete goal');
      throw err;
    }
  },

  addGoalParticipant: async (goalId, userId) => {
    const prev = get().sharedGoals;
    set((state) => ({
      sharedGoals: state.sharedGoals.map((g) => (
        g.id === goalId
          ? { ...g, shared_goal_participants: [...(g.shared_goal_participants || []), { user_id: userId, profiles: null }] }
          : g
      )),
    }));
    try {
      await addGoalParticipant(goalId, userId);
      get().loadSharedGoals().catch(() => {});
    } catch (err) {
      set({ sharedGoals: prev });
      toast.error(err.message || 'Could not add participant');
      throw err;
    }
  },

  removeGoalParticipant: async (goalId, userId) => {
    const prev = get().sharedGoals;
    set((state) => ({
      sharedGoals: state.sharedGoals.map((g) => (
        g.id === goalId
          ? { ...g, shared_goal_participants: (g.shared_goal_participants || []).filter((p) => p.user_id !== userId) }
          : g
      )),
    }));
    try {
      await removeGoalParticipant(goalId, userId);
      get().loadSharedGoals().catch(() => {});
    } catch (err) {
      set({ sharedGoals: prev });
      toast.error(err.message || 'Could not remove participant');
      throw err;
    }
  },

  addContribution: async (goalId, amountCents, note = '') => {
    const user = get().supabaseUser;
    if (!user) return;
    const prev = get().sharedGoals;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempContribution = {
      id: tempId,
      goal_id: goalId,
      user_id: user.id,
      amount_cents: amountCents,
      note,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      sharedGoals: state.sharedGoals.map((g) => (
        g.id === goalId
          ? { ...g, contributions: [...(g.contributions || []), tempContribution] }
          : g
      )),
    }));
    try {
      await apiAddContribution(goalId, user.id, amountCents, note);
      // Atomic DB check: only the call that actually flips completed_at returns true,
      // so exactly one "goal reached" activity fires even with simultaneous contributions.
      const wasNewlyCompleted = await apiCompleteSharedGoalIfReached(goalId);
      const goals = await fetchSharedGoals(user.id);
      if (wasNewlyCompleted) {
        const goal = goals.find((g) => g.id === goalId);
        if (goal) {
          get().postActivity('shared_goal_reached', { goalId, goalName: goal.name, targetCents: goal.target_cents }).catch(() => {});
        }
      }
      set({ sharedGoals: goals });
    } catch (err) {
      set({ sharedGoals: prev });
      toast.error(err.message || 'Could not add contribution');
      throw err;
    }
  },

  deleteContribution: async (goalId, contributionId) => {
    const prev = get().sharedGoals;
    set((state) => ({
      sharedGoals: state.sharedGoals.map((g) => (
        g.id === goalId
          ? { ...g, contributions: (g.contributions || []).filter((c) => c.id !== contributionId) }
          : g
      )),
    }));
    try {
      await apiDeleteContribution(contributionId);
      get().loadSharedGoals().catch(() => {});
    } catch (err) {
      set({ sharedGoals: prev });
      toast.error(err.message || 'Could not delete contribution');
      throw err;
    }
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
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempEntry = {
      id: tempId,
      creditor_id: creditorId,
      debtor_id: debtorId,
      amount_cents: amountCents,
      currency,
      kind: 'manual',
      note,
      created_by: user.id,
      status: 'accepted',
      created_at: new Date().toISOString(),
    };
    set((state) => ({ friendLedger: [tempEntry, ...state.friendLedger] }));
    try {
      const entry = await apiCreateLedgerEntry({
        creditorId,
        debtorId,
        amountCents,
        currency,
        kind: 'manual',
        note,
        createdBy: user.id,
      });
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === tempId ? entry : e)),
      }));
      get().loadFriendLedger().catch(() => {});
      return entry;
    } catch (err) {
      set((state) => ({ friendLedger: state.friendLedger.filter((e) => e.id !== tempId) }));
      toast.error(err.message || 'Could not create IOU');
      throw err;
    }
  },

  settleLedgerEntry: async (entryId, { bankAccountId } = {}) => {
    const user = get().supabaseUser;
    if (!user) return;
    const prevLedger = get().friendLedger;
    const entry = prevLedger.find((e) => e.id === entryId);
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? { ...e, status: 'settled' } : e)),
    }));
    try {
      // Ledger op first — if this fails, no orphan expense is created
      const updated = await apiSettleLedgerEntry(entryId, user.id);
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
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
      }));
    } catch (err) {
      set({ friendLedger: prevLedger });
      toast.error(err.message || 'Could not settle entry');
      throw err;
    }
  },

  cancelLedgerEntry: async (entryId) => {
    const prevLedger = get().friendLedger;
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? { ...e, status: 'cancelled' } : e)),
    }));
    try {
      const updated = await apiCancelLedgerEntry(entryId);
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
      }));
    } catch (err) {
      set({ friendLedger: prevLedger });
      toast.error(err.message || 'Could not cancel entry');
      throw err;
    }
  },

  sendPayment: async ({ friendId, amountCents, currency = 'EUR', note = '', parentIouId = null, bankAccountId = null }) => {
    const user = get().supabaseUser;
    if (!user) return;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempEntry = {
      id: tempId,
      creditor_id: friendId,
      debtor_id: user.id,
      amount_cents: amountCents,
      currency,
      kind: 'payment',
      note,
      created_by: user.id,
      parent_expense_id: parentIouId,
      status: 'accepted',
      created_at: new Date().toISOString(),
    };
    set((state) => ({ friendLedger: [tempEntry, ...state.friendLedger] }));
    try {
      // Ledger op first — if this fails, no orphan expense is created
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
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === tempId ? entry : e)),
      }));
      get().loadFriendLedger().catch(() => {});
      return entry;
    } catch (err) {
      set((state) => ({ friendLedger: state.friendLedger.filter((e) => e.id !== tempId) }));
      toast.error(err.message || 'Could not send payment');
      throw err;
    }
    return entry;
  },

  acceptPayment: async (entryId, { bankAccountId, senderName = '' } = {}) => {
    const user = get().supabaseUser;
    if (!user) return;
    const prevLedger = get().friendLedger;
    const entry = prevLedger.find((e) => e.id === entryId);
    const linkedIouId = entry?.parent_expense_id;
    const linkedIou = linkedIouId
      ? prevLedger.find((e) => e.id === linkedIouId && ['accepted', 'pending'].includes(e.status))
      : null;

    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? { ...e, status: 'settled' } : e)),
    }));
    try {
      // Ledger op first — atomic RPC handles payment + IOU reduction in one transaction,
      // eliminating the race condition when two partial payments land simultaneously.
      if (linkedIou) {
        await apiApplyPartialIouPayment(entryId, linkedIou.id, entry.amount_cents, user.id);
      } else {
        await apiSettleLedgerEntry(entryId, user.id);
      }

      // Income record second — ledger is already committed, so this is recoverable if it fails
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

      // Reload ledger to reflect DB-side changes rather than recomputing locally
      get().loadFriendLedger().catch(() => {});
    } catch (err) {
      set({ friendLedger: prevLedger });
      toast.error(err.message || 'Could not accept payment');
      throw err;
    }
  },

  declinePayment: async (entryId) => {
    const prevLedger = get().friendLedger;
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? { ...e, status: 'rejected' } : e)),
    }));
    try {
      const updated = await apiRejectLedgerEntry(entryId);
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
      }));
    } catch (err) {
      set({ friendLedger: prevLedger });
      toast.error(err.message || 'Could not decline payment');
      throw err;
    }
  },

  createMoneyRequest: async ({ friendId, amountCents, currency = 'EUR', note = '' }) => {
    const user = get().supabaseUser;
    if (!user) return;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempEntry = {
      id: tempId,
      creditor_id: user.id,
      debtor_id: friendId,
      amount_cents: amountCents,
      currency,
      kind: 'request',
      note,
      created_by: user.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    set((state) => ({ friendLedger: [tempEntry, ...state.friendLedger] }));
    try {
      const entry = await apiCreateLedgerEntry({
        creditorId: user.id,
        debtorId: friendId,
        amountCents,
        currency,
        kind: 'request',
        note,
        createdBy: user.id,
      });
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === tempId ? entry : e)),
      }));
      get().loadFriendLedger().catch(() => {});
      return entry;
    } catch (err) {
      set((state) => ({ friendLedger: state.friendLedger.filter((e) => e.id !== tempId) }));
      toast.error(err.message || 'Could not create request');
      throw err;
    }
  },

  acceptLedgerEntry: async (entryId) => {
    const prevLedger = get().friendLedger;
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? { ...e, status: 'accepted' } : e)),
    }));
    try {
      const updated = await apiAcceptLedgerEntry(entryId);
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
      }));
    } catch (err) {
      set({ friendLedger: prevLedger });
      toast.error(err.message || 'Could not accept request');
      throw err;
    }
  },

  rejectRequest: async (entryId) => {
    const prevLedger = get().friendLedger;
    set((state) => ({
      friendLedger: state.friendLedger.map((e) => (e.id === entryId ? { ...e, status: 'rejected' } : e)),
    }));
    try {
      const updated = await apiRejectLedgerEntry(entryId);
      set((state) => ({
        friendLedger: state.friendLedger.map((e) => (e.id === entryId ? updated : e)),
      }));
    } catch (err) {
      set({ friendLedger: prevLedger });
      toast.error(err.message || 'Could not reject request');
      throw err;
    }
  },

  // ── Coingame ──────────────────────────────────────────────────────────────

  triggerBotTick: async () => {
    try {
      const key = 'coingame.lastBotTickAttempt';
      const now = Date.now();
      const last = Number(localStorage.getItem(key) || 0);
      if (last && now - last < 5 * 1000) return false;
      localStorage.setItem(key, String(now));
      await apiTriggerBotTick();
      return true;
    } catch {
      // Bot ticks are opportunistic; user-facing Coingame loading should not fail.
      return false;
    }
  },

  loadCoingameAdminStatus: async () => {
    try {
      const isAdmin = await apiFetchCoingameAdminStatus();
      set({ coingameIsAdmin: Boolean(isAdmin) });
      return Boolean(isAdmin);
    } catch {
      set({ coingameIsAdmin: false });
      return false;
    }
  },

  loadCoingame: async () => {
    const user = get().supabaseUser;
    if (!user) return;
    set({ coingameStatus: 'loading', coingameError: '' });
    try {
      if (!get().profile) {
        await get().loadProfile();
      }
      await ensureWallet();
      await get().triggerBotTick();
      const [wallet, ownCoin, holdings, transactions, trending, leaderboard, economy, casino, gamblingBets] = await Promise.all([
        fetchWallet(user.id),
        fetchCoinByOwner(user.id),
        apiFetchHoldings(user.id),
        apiFetchTransactions(user.id),
        fetchTrending(),
        fetchWeeklyLeaderboard(get().coingameLeaderboardMetric),
        fetchEconomy(),
        apiFetchCasinoState(),
        apiFetchGamblingRecent(25),
      ]);
      set({
        coingameWallet: wallet,
        coingameOwnCoin: ownCoin,
        coingameHoldings: holdings,
        coingameTransactions: transactions,
        coingameTrending: trending,
        coingameLeaderboard: leaderboard,
        coingameEconomy: economy,
        coingameCasino: casino,
        coingameGamblingBets: gamblingBets,
        coingameStatus: 'idle',
        coingameNeedsCoinSetup: !ownCoin,
      });
      get().loadCoingameAdminStatus();
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message || 'Failed to load Coingame' });
    }
  },

  loadCoingameAdmin: async () => {
    set({ coingameAdminStatus: 'loading', coingameAdminError: '' });
    try {
      const [config, health, logs, admins, casino] = await Promise.all([
        apiFetchBotConfig(),
        apiFetchMarketHealth(),
        apiFetchBotLogs(50),
        apiFetchCoingameAdminUsers(),
        apiFetchCasinoState(),
      ]);
      set({
        coingameBotConfig: config,
        coingameMarketHealth: health,
        coingameBotLogs: logs,
        coingameAdminUsers: admins,
        coingameCasino: casino,
        coingameIsAdmin: true,
        coingameAdminStatus: 'idle',
      });
    } catch (err) {
      set({
        coingameIsAdmin: false,
        coingameAdminStatus: 'error',
        coingameAdminError: err.message || 'Failed to load Coingame admin',
      });
    }
  },

  updateBotConfig: async (params) => {
    await apiUpdateBotGlobalConfig(params);
    await get().loadCoingameAdmin();
  },

  toggleBotCoin: async (coinId, enabled) => {
    await apiSetBotCoinEnabled(coinId, enabled);
    await get().loadCoingameAdmin();
  },

  refreshBotLogs: async (coinId = null, limit = 50) => {
    try {
      const logs = await apiFetchBotLogs(limit, coinId);
      set({ coingameBotLogs: logs });
    } catch (err) {
      set({ coingameAdminError: err.message || 'Failed to load bot logs' });
    }
  },

  refreshMarketHealth: async () => {
    try {
      const health = await apiFetchMarketHealth();
      set({ coingameMarketHealth: health });
    } catch (err) {
      set({ coingameAdminError: err.message || 'Failed to load market health' });
    }
  },

  setBotReserve: async (amount) => {
    await apiSetBotReserve(amount);
    await get().loadCoingameAdmin();
  },

  runBotTickNow: async () => {
    set({ coingameAdminError: '' });
    try {
      localStorage.removeItem('coingame.lastBotTickAttempt');
      await apiTriggerBotTick();
      await get().loadCoingameAdmin();
      const user = get().supabaseUser;
      if (user) {
        const [wallet, ownCoin, holdings, transactions, trending, leaderboard, economy] = await Promise.all([
          fetchWallet(user.id),
          fetchCoinByOwner(user.id),
          apiFetchHoldings(user.id),
          apiFetchTransactions(user.id),
          fetchTrending(),
          fetchWeeklyLeaderboard(get().coingameLeaderboardMetric),
          fetchEconomy(),
        ]);
        set({
          coingameWallet: wallet,
          coingameOwnCoin: ownCoin,
          coingameHoldings: holdings,
          coingameTransactions: transactions,
          coingameTrending: trending,
          coingameLeaderboard: leaderboard,
          coingameEconomy: economy,
        });
      }
    } catch (err) {
      set({ coingameAdminError: err.message || 'Failed to run bot tick' });
      throw err;
    }
  },

  setCasinoHouseBalance: async (amount) => {
    const casino = await apiSetCasinoHouseBalance(amount);
    set({ coingameCasino: casino });
    await get().loadCoingameAdmin();
    return casino;
  },

  addCoingameAdmin: async (userId) => {
    await apiAddCoingameAdminUser(userId);
    await get().loadCoingameAdmin();
  },

  removeCoingameAdmin: async (userId) => {
    await apiRemoveCoingameAdminUser(userId);
    await get().loadCoingameAdmin();
  },

  coingameCreateCoin: async (coinName) => {
    const user = get().supabaseUser;
    if (!user) return null;
    set({ coingameStatus: 'loading', coingameError: '' });
    try {
      const ownCoin = await apiCreateCoin(coinName);
      const [wallet, holdings, transactions, trending, leaderboard, economy] = await Promise.all([
        fetchWallet(user.id),
        apiFetchHoldings(user.id),
        apiFetchTransactions(user.id),
        fetchTrending(),
        fetchWeeklyLeaderboard(get().coingameLeaderboardMetric),
        fetchEconomy(),
      ]);
      set({
        coingameWallet: wallet ?? get().coingameWallet,
        coingameOwnCoin: ownCoin,
        coingameHoldings: holdings,
        coingameTransactions: transactions,
        coingameTrending: trending,
        coingameLeaderboard: leaderboard,
        coingameEconomy: economy,
        coingameStatus: 'idle',
        coingameNeedsCoinSetup: false,
      });
      return ownCoin;
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message || 'Failed to create coin' });
      throw err;
    }
  },

  coingameBuy: async (coinId, tokens) => {
    const user = get().supabaseUser;
    if (!user) return;
    set({ coingameStatus: 'loading', coingameError: '' });
    try {
      const result = await apiBuyCoin(coinId, tokens);
      const [holdings, trending, transactions] = await Promise.all([
        apiFetchHoldings(user.id),
        fetchTrending(),
        apiFetchTransactions(user.id),
      ]);
      set((state) => ({
        coingameWallet: state.coingameWallet
          ? { ...state.coingameWallet, fc_balance: result.new_balance }
          : state.coingameWallet,
        coingameHoldings: holdings,
        coingameTrending: trending,
        coingameTransactions: transactions,
        coingameStatus: 'idle',
      }));
      return result;
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message });
      throw err;
    }
  },

  coingameSell: async (coinId, tokens) => {
    const user = get().supabaseUser;
    if (!user) return;
    set({ coingameStatus: 'loading', coingameError: '' });
    try {
      const result = await apiSellCoin(coinId, tokens);
      const [holdings, trending, transactions] = await Promise.all([
        apiFetchHoldings(user.id),
        fetchTrending(),
        apiFetchTransactions(user.id),
      ]);
      set((state) => ({
        coingameWallet: state.coingameWallet
          ? { ...state.coingameWallet, fc_balance: (state.coingameWallet.fc_balance ?? 0) + result.net_proceeds }
          : state.coingameWallet,
        coingameHoldings: holdings,
        coingameTrending: trending,
        coingameTransactions: transactions,
        coingameStatus: 'idle',
      }));
      return result;
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message });
      throw err;
    }
  },

  coingameClaimDaily: async () => {
    set({ coingameStatus: 'loading', coingameError: '' });
    try {
      const result = await apiClaimDaily();
      set((state) => ({
        coingameWallet: state.coingameWallet
          ? { ...state.coingameWallet, fc_balance: result.new_balance, login_streak: result.streak }
          : state.coingameWallet,
        coingameStatus: 'idle',
      }));
      return result;
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message });
      throw err;
    }
  },

  loadCoingameCasino: async () => {
    try {
      const [casino, gamblingBets] = await Promise.all([
        apiFetchCasinoState(),
        apiFetchGamblingRecent(25),
      ]);
      set({ coingameCasino: casino, coingameGamblingBets: gamblingBets });
    } catch (err) {
      set({ coingameError: err.message });
    }
  },

  coingameGambleCoinflip: async (choice, wager) => {
    const user = get().supabaseUser;
    if (!user) return null;
    set({ coingameStatus: 'loading', coingameError: '', coingameLastGambleResult: null });
    try {
      const result = await apiGambleCoinflip(choice, wager);
      const [wallet, transactions, casino, gamblingBets] = await Promise.all([
        fetchWallet(user.id),
        apiFetchTransactions(user.id),
        apiFetchCasinoState(),
        apiFetchGamblingRecent(25),
      ]);
      set({
        coingameWallet: wallet,
        coingameTransactions: transactions,
        coingameCasino: casino,
        coingameGamblingBets: gamblingBets,
        coingameLastGambleResult: result,
        coingameStatus: 'idle',
      });
      return result;
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message });
      throw err;
    }
  },

  coingameGambleDice: async (target, wager) => {
    const user = get().supabaseUser;
    if (!user) return null;
    set({ coingameStatus: 'loading', coingameError: '', coingameLastGambleResult: null });
    try {
      const result = await apiGambleDice(target, wager);
      const [wallet, transactions, casino, gamblingBets] = await Promise.all([
        fetchWallet(user.id),
        apiFetchTransactions(user.id),
        apiFetchCasinoState(),
        apiFetchGamblingRecent(25),
      ]);
      set({
        coingameWallet: wallet,
        coingameTransactions: transactions,
        coingameCasino: casino,
        coingameGamblingBets: gamblingBets,
        coingameLastGambleResult: result,
        coingameStatus: 'idle',
      });
      return result;
    } catch (err) {
      set({ coingameStatus: 'error', coingameError: err.message });
      throw err;
    }
  },

  loadCoingameLeaderboard: async (metric = 'gains_fc') => {
    try {
      const leaderboard = await fetchWeeklyLeaderboard(metric);
      set({ coingameLeaderboard: leaderboard, coingameLeaderboardMetric: metric });
    } catch (err) {
      set({ coingameError: err.message });
    }
  },

  loadCoingameTransactions: async () => {
    const user = get().supabaseUser;
    if (!user) return;
    try {
      const transactions = await apiFetchTransactions(user.id);
      set({ coingameTransactions: transactions });
    } catch (err) {
      set({ coingameError: err.message });
    }
  },

}));

import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../data/defaults';
import {
  clearAllStores,
  deleteRecord,
  ensureEntitySyncFields,
  ensureSeedData,
  exportDatabaseSnapshot,
  getAllRecords,
  getRecord,
  importDatabaseSnapshot,
  loadSyncMeta,
  loadSettings,
  putRecord,
  saveSettings,
  saveSyncMeta,
  sanitizeSettingsForSync,
} from '../utils/storage';
import { computeDashboardData, computePortfolioMetrics } from '../utils/finance';
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

const STORE_KEYS = ['expenses', 'fixedExpenses', 'incomes', 'holdings', 'dividends', 'portfolioCashflows', 'portfolioSales', 'savings', 'savingsEntries', 'budgets', 'rollovers', 'transfers', 'attachments'];
let authSubscription = null;
let autoPushTimer = null;
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
  return {
    dashboard: computeDashboardData(state),
    portfolio: computePortfolioMetrics(
      state.holdings,
      state.dividends,
      state.portfolioCashflows,
      state.settings.allocationTargets,
    ),
  };
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildDividendIncome(dividend, existingIncomeId) {
  return {
    id: existingIncomeId || dividend.linkedIncomeId || makeId('inc'),
    date: dividend.date,
    amountCents: dividend.amountCents,
    currency: dividend.currency || 'EUR',
    incomeKind: 'dividend',
    source: `${dividend.ticker} dividend`,
    assetTicker: dividend.ticker,
  };
}

function buildPortfolioSaleIncome(sale, existingIncomeId, currency = 'EUR') {
  const gainCents = Math.max(sale.realizedPnlCents || 0, 0);
  return {
    id: existingIncomeId || sale.linkedIncomeId || makeId('inc'),
    date: sale.date,
    amountCents: gainCents,
    currency,
    incomeKind: 'portfolio_sale',
    source: `${sale.name || sale.ticker} sale`,
    assetTicker: sale.ticker,
    linkedSaleId: sale.id,
    realizedPnlCents: sale.realizedPnlCents || 0,
  };
}

function portfolioSaleCashflowCents(sale) {
  return Math.max(sale.proceedsCents || 0, 0);
}

function upsertItem(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  return index >= 0 ? items.map((item) => (item.id === nextItem.id ? nextItem : item)) : [nextItem, ...items];
}

function buildSaleUpdate({ holding, sale, percent, salePriceCents, feeCents, date, timestamp, cashflowId }) {
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
    linkedIncomeId: sale?.linkedIncomeId || null,
    updatedAt: timestamp,
  }, timestamp);
  const nextCashflow = ensureEntitySyncFields({
    id: cashflowId || makeId('pcf'),
    date: saleDate,
    amountCents: proceedsCents,
    holdingId: holding.id,
    ticker: holding.ticker,
    kind: 'sell',
    linkedSaleId: nextSale.id,
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

export const useFinanceStore = create((set, get) => ({
  hydrated: false,
  settings: DEFAULT_SETTINGS,
  supabaseConfigured: false,
  supabaseSession: null,
  supabaseUser: null,
  supabaseSyncStatus: 'idle',
  supabaseLastSyncedAt: null,
  supabaseError: '',
  syncMeta: {
    lastPulledAt: {},
    deletedRecords: {},
    conflicts: [],
  },
  expenses: [],
  fixedExpenses: [],
  incomes: [],
  holdings: [],
  dividends: [],
  portfolioCashflows: [],
  portfolioSales: [],
  savingsConfig: SAVINGS_DEFAULT,
  savingsEntries: [],
  budgets: [],
  rollovers: [],
  transfers: [],
  attachments: [],
  derived: {
    dashboard: {
      netWorthCents: 0,
      cashflowCents: 0,
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
    set((state) => {
      const nextState = {
        ...state,
        settings,
        syncMeta,
        expenses: normalizedRecords[0],
        fixedExpenses: normalizedRecords[1],
        incomes: normalizedRecords[2],
        holdings: normalizedRecords[3],
        dividends: normalizedRecords[4],
        portfolioCashflows: normalizedRecords[5],
        portfolioSales: normalizedRecords[6],
        savingsConfig: normalizedRecords[7][0] || SAVINGS_DEFAULT,
        savingsEntries: normalizedRecords[8],
        budgets: normalizedRecords[9],
        rollovers: normalizedRecords[10],
        transfers: normalizedRecords[11],
        attachments: normalizedRecords[12],
      };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    await get().ensurePortfolioSaleIncomes();
  },

  bootstrap: async () => {
    await ensureSeedData();
    const settings = loadSettings();
    const syncMeta = loadSyncMeta();
    const records = await Promise.all(STORE_KEYS.map((storeName) => getAllRecords(storeName)));
    const normalizedRecords = records.map((list) => list.map((item) => ensureEntitySyncFields(item)));
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
      holdings: normalizedRecords[3],
      dividends: normalizedRecords[4],
      portfolioCashflows: normalizedRecords[5],
      portfolioSales: normalizedRecords[6],
      savingsConfig: normalizedRecords[7][0] || SAVINGS_DEFAULT,
      savingsEntries: normalizedRecords[8],
      budgets: normalizedRecords[9],
      rollovers: normalizedRecords[10],
      transfers: normalizedRecords[11],
      attachments: normalizedRecords[12],
      hydrated: false,
      supabaseConfigured: Boolean(getSupabaseConfig(settings).url && getSupabaseConfig(settings).anonKey),
      syncMeta,
    };
    set({ ...nextState, derived: buildDerived(nextState) });
    await get().ensurePortfolioSaleIncomes();
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
        window.setTimeout(() => {
          get().pullFromSupabase().catch(() => {});
        }, 0);
      }
    });

    authSubscription = subscription;
  },

  toggleTheme: () => {
    const nextTheme = get().settings.theme === 'light' ? 'dark' : 'light';
    const settings = { ...get().settings, theme: nextTheme };
    saveSettings(settings);
    set((state) => ({ settings, derived: buildDerived({ ...state, settings }) }));
  },

  setTheme: (theme) => {
    const settings = { ...get().settings, theme };
    saveSettings(settings);
    set((state) => ({ settings, derived: buildDerived({ ...state, settings }) }));
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    saveSettings(settings);
    set((state) => ({ settings, derived: buildDerived({ ...state, settings }) }));
  },

  saveSavingsConfig: async (config) => {
    const record = ensureEntitySyncFields(
      { ...SAVINGS_DEFAULT, ...config, id: 'savings-config' },
      new Date().toISOString(),
    );
    await putRecord('savings', record);
    set({ savingsConfig: record });
    get().triggerAutoPush();
  },

  saveSavingsEntry: async (entry) => {
    const record = ensureEntitySyncFields(
      { ...entry, id: entry.id || `sav-${crypto.randomUUID()}` },
      new Date().toISOString(),
    );
    await putRecord('savingsEntries', record);
    set((state) => {
      const nextState = { ...state, savingsEntries: upsertItem(state.savingsEntries, record) };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
    return record;
  },

  removeSavingsEntry: async (id) => {
    await deleteRecord('savingsEntries', id);
    set((state) => {
      const nextState = { ...state, savingsEntries: state.savingsEntries.filter((e) => e.id !== id) };
      return { ...nextState, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
  },

  saveSupabaseSettings: async (partial) => {
    const settings = { ...get().settings, ...partial };
    saveSettings(settings);
    set((state) => ({
      settings,
      supabaseConfigured: Boolean(getSupabaseConfig(settings).url && getSupabaseConfig(settings).anonKey),
      derived: buildDerived({ ...state, settings }),
    }));
    await get().initializeSupabase();
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

  saveEntity: async (storeName, entity, { skipAutoCreate = false } = {}) => {
    let value = entity;

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
        active: true,
        alerts: true,
      }, { skipAutoCreate: true });
      value = { ...value, fixedExpenseId: fixed.id };
    }

    const prefix = storeName.slice(0, 3);
    // Always stamp a fresh updatedAt — existing records carry their old timestamp which
    // would make ensureEntitySyncFields keep it, causing other devices to miss the edit.
    const record = { ...ensureEntitySyncFields({ ...value, id: value.id || makeId(prefix) }), updatedAt: new Date().toISOString() };
    await putRecord(storeName, record);
    set((state) => {
      const nextList = upsertItem(state[storeName], record);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        [storeName]: (state.syncMeta.deletedRecords[storeName] || []).filter((item) => item.id !== record.id),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => item.id !== `${storeName}:${record.id}`),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, [storeName]: nextList };
      return { [storeName]: nextList, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
    // When a fixed expense is saved, immediately check if it needs an expense entry this month
    if (storeName === 'fixedExpenses' && !skipAutoCreate) {
      await get().autoCreateFixedExpenses();
    }
    return record;
  },

  removeEntity: async (storeName, id) => {
    // Cascade: deleting a holding must remove its cost-basis cashflows and dividends,
    // otherwise XIRR/TWRR keep seeing phantom flows against a ticker that no longer exists.
    if (storeName === 'holdings') {
      const holding = get().holdings.find((h) => h.id === id);
      const cashflows = get().portfolioCashflows.filter((c) => c.holdingId === id);
      for (const cf of cashflows) {
        if (cf.transferId) {
          await get().removeTransfer(cf.transferId);
        } else {
          await get().removeEntity('portfolioCashflows', cf.id);
        }
      }
      if (holding?.ticker) {
        const dividends = get().dividends.filter((d) => d.ticker === holding.ticker);
        for (const div of dividends) {
          await get().removeDividend(div.id);
        }
      }
    }

    await deleteRecord(storeName, id);
    set((state) => {
      const nextList = state[storeName].filter((item) => item.id !== id);
      const timestamp = new Date().toISOString();
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        [storeName]: [
          ...(state.syncMeta.deletedRecords[storeName] || []).filter((item) => item.id !== id),
          { id, updatedAt: timestamp, deletedAt: timestamp },
        ],
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter((item) => item.id !== `${storeName}:${id}`),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, [storeName]: nextList };
      return { [storeName]: nextList, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
  },

  sellHolding: async ({ holdingId, percent, salePriceCents, feeCents, date }) => {
    const holding = get().holdings.find((item) => item.id === holdingId);
    if (!holding) throw new Error('Holding not found');

    const timestamp = new Date().toISOString();
    const { nextHolding, nextSale: rawSale, nextCashflow: cashflow } = buildSaleUpdate({
      holding,
      percent,
      salePriceCents,
      feeCents,
      date,
      timestamp,
    });
    const income = ensureEntitySyncFields(buildPortfolioSaleIncome(rawSale, null, get().settings.baseCurrency), timestamp);
    const sale = ensureEntitySyncFields({ ...rawSale, linkedIncomeId: income.id, updatedAt: timestamp }, timestamp);

    await putRecord('holdings', nextHolding);
    await putRecord('portfolioSales', sale);
    await putRecord('portfolioCashflows', cashflow);
    await putRecord('incomes', income);

    set((state) => {
      const nextHoldings = upsertItem(state.holdings, nextHolding);
      const nextPortfolioSales = upsertItem(state.portfolioSales, sale);
      const nextPortfolioCashflows = upsertItem(state.portfolioCashflows, cashflow);
      const nextIncomes = upsertItem(state.incomes, income);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        holdings: (state.syncMeta.deletedRecords.holdings || []).filter((item) => item.id !== nextHolding.id),
        portfolioSales: (state.syncMeta.deletedRecords.portfolioSales || []).filter((item) => item.id !== sale.id),
        portfolioCashflows: (state.syncMeta.deletedRecords.portfolioCashflows || []).filter((item) => item.id !== cashflow.id),
        incomes: (state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== income.id),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `holdings:${nextHolding.id}` &&
            item.id !== `portfolioSales:${sale.id}` &&
            item.id !== `portfolioCashflows:${cashflow.id}` &&
            item.id !== `incomes:${income.id}`,
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = {
        ...state,
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
      };
      return {
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    get().triggerAutoPush();
    return sale;
  },

  updatePortfolioSale: async ({ saleId, percent, salePriceCents, feeCents, date }) => {
    const currentSale = get().portfolioSales.find((item) => item.id === saleId);
    if (!currentSale) throw new Error('Sale not found');

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
    const { nextHolding, nextSale: rawSale, nextCashflow } = buildSaleUpdate({
      holding: restoredHolding,
      sale: currentSale,
      percent,
      salePriceCents,
      feeCents,
      date,
      timestamp,
      cashflowId: currentCashflow?.id,
    });
    const income = ensureEntitySyncFields(
      buildPortfolioSaleIncome(rawSale, currentSale.linkedIncomeId, get().settings.baseCurrency),
      timestamp,
    );
    const nextSale = ensureEntitySyncFields({ ...rawSale, linkedIncomeId: income.id, updatedAt: timestamp }, timestamp);

    await putRecord('holdings', nextHolding);
    await putRecord('portfolioSales', nextSale);
    await putRecord('portfolioCashflows', nextCashflow);
    await putRecord('incomes', income);

    set((state) => {
      const nextHoldings = upsertItem(state.holdings, nextHolding);
      const nextPortfolioSales = upsertItem(state.portfolioSales, nextSale);
      const nextPortfolioCashflows = upsertItem(state.portfolioCashflows, nextCashflow);
      const nextIncomes = upsertItem(state.incomes, income);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        holdings: (state.syncMeta.deletedRecords.holdings || []).filter((item) => item.id !== nextHolding.id),
        portfolioSales: (state.syncMeta.deletedRecords.portfolioSales || []).filter((item) => item.id !== nextSale.id),
        portfolioCashflows: (state.syncMeta.deletedRecords.portfolioCashflows || []).filter((item) => item.id !== nextCashflow.id),
        incomes: (state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== income.id),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) =>
            item.id !== `holdings:${nextHolding.id}` &&
            item.id !== `portfolioSales:${nextSale.id}` &&
            item.id !== `portfolioCashflows:${nextCashflow.id}` &&
            item.id !== `incomes:${income.id}`,
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = {
        ...state,
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
      };
      return {
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

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

    set((state) => {
      const nextHoldings = restoredHolding ? upsertItem(state.holdings, restoredHolding) : state.holdings;
      const nextPortfolioSales = state.portfolioSales.filter((item) => item.id !== sale.id);
      const nextPortfolioCashflows = cashflow
        ? state.portfolioCashflows.filter((item) => item.id !== cashflow.id)
        : state.portfolioCashflows;
      const nextIncomes = income ? state.incomes.filter((item) => item.id !== income.id) : state.incomes;
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
            item.id !== `incomes:${income?.id}`,
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = {
        ...state,
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
      };
      return {
        holdings: nextHoldings,
        portfolioSales: nextPortfolioSales,
        portfolioCashflows: nextPortfolioCashflows,
        incomes: nextIncomes,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    get().triggerAutoPush();
  },

  ensurePortfolioSaleIncomes: async () => {
    const { portfolioSales, incomes, settings } = get();
    const timestamp = new Date().toISOString();
    const toPut = [];

    for (const sale of portfolioSales) {
      const saleWithCashflow = {
        ...sale,
        cashflowCents: portfolioSaleCashflowCents(sale),
      };
      const existingIncome = sale.linkedIncomeId
        ? incomes.find((item) => item.id === sale.linkedIncomeId)
        : incomes.find((item) => item.linkedSaleId === sale.id);
      if (existingIncome) {
        const updatedIncome = ensureEntitySyncFields(
          buildPortfolioSaleIncome(saleWithCashflow, existingIncome.id, settings.baseCurrency),
          timestamp,
        );
        if (
          existingIncome.amountCents !== updatedIncome.amountCents ||
          existingIncome.date !== updatedIncome.date ||
          existingIncome.currency !== updatedIncome.currency ||
          existingIncome.incomeKind !== updatedIncome.incomeKind ||
          existingIncome.source !== updatedIncome.source ||
          existingIncome.linkedSaleId !== updatedIncome.linkedSaleId ||
          existingIncome.realizedPnlCents !== updatedIncome.realizedPnlCents
        ) {
          toPut.push({ storeName: 'incomes', record: updatedIncome });
        }
        if (sale.linkedIncomeId !== existingIncome.id || sale.cashflowCents !== saleWithCashflow.cashflowCents) {
          toPut.push({
            storeName: 'portfolioSales',
            record: ensureEntitySyncFields({
              ...saleWithCashflow,
              linkedIncomeId: existingIncome.id,
              updatedAt: timestamp,
            }, timestamp),
          });
        }
        continue;
      }

      const income = ensureEntitySyncFields(
        buildPortfolioSaleIncome(saleWithCashflow, null, settings.baseCurrency),
        timestamp,
      );
      toPut.push({ storeName: 'incomes', record: income });
      toPut.push({
        storeName: 'portfolioSales',
        record: ensureEntitySyncFields({ ...saleWithCashflow, linkedIncomeId: income.id, updatedAt: timestamp }, timestamp),
      });
    }

    if (!toPut.length) return;

    await Promise.all(toPut.map(({ storeName, record }) => putRecord(storeName, record)));
    set((state) => {
      let nextState = { ...state };
      const nextDeletedRecords = { ...state.syncMeta.deletedRecords };
      let nextConflicts = state.syncMeta.conflicts;
      for (const { storeName, record } of toPut) {
        nextState = { ...nextState, [storeName]: upsertItem(nextState[storeName] || [], record) };
        nextDeletedRecords[storeName] = (nextDeletedRecords[storeName] || []).filter((item) => item.id !== record.id);
        nextConflicts = nextConflicts.filter((item) => item.id !== `${storeName}:${record.id}`);
      }
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: nextConflicts,
      };
      saveSyncMeta(nextSyncMeta);
      return { ...nextState, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
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
        category: fe.category || 'Otros',
        description: fe.name,
        isRecurring: true,
        fixedExpenseId: fe.id,
      }, new Date().toISOString());

      toCreate.push(expense);
    }

    if (!toCreate.length) return;

    await Promise.all(toCreate.map((e) => putRecord('expenses', e)));
    set((state) => {
      const nextExpenses = [...state.expenses, ...toCreate];
      const nextState = { ...state, expenses: nextExpenses };
      return { expenses: nextExpenses, derived: buildDerived(nextState) };
    });
    get().triggerAutoPush();
  },

  saveDividend: async (entity) => {
    const prefix = 'div';
    const current = entity.id ? get().dividends.find((item) => item.id === entity.id) : null;
    const linkedIncome = buildDividendIncome(entity, current?.linkedIncomeId);
    const timestamp = new Date().toISOString();
    const record = ensureEntitySyncFields({
      ...entity,
      id: entity.id || makeId(prefix),
      linkedIncomeId: linkedIncome.id,
    }, timestamp);
    const syncedIncome = ensureEntitySyncFields(linkedIncome, timestamp);

    await putRecord('dividends', record);
    await putRecord('incomes', syncedIncome);

    set((state) => {
      const nextDividends = upsertItem(state.dividends, record);
      const nextIncomes = upsertItem(state.incomes, syncedIncome);
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        dividends: (state.syncMeta.deletedRecords.dividends || []).filter((item) => item.id !== record.id),
        incomes: (state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== syncedIncome.id),
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) => item.id !== `dividends:${record.id}` && item.id !== `incomes:${syncedIncome.id}`,
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, dividends: nextDividends, incomes: nextIncomes };
      return {
        dividends: nextDividends,
        incomes: nextIncomes,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });

    get().triggerAutoPush();
    return record;
  },

  removeDividend: async (id) => {
    const current = get().dividends.find((item) => item.id === id);
    if (!current) return;
    await deleteRecord('dividends', id);
    if (current.linkedIncomeId) {
      await deleteRecord('incomes', current.linkedIncomeId);
    }
    set((state) => {
      const nextDividends = state.dividends.filter((item) => item.id !== id);
      const nextIncomes = current.linkedIncomeId ? state.incomes.filter((item) => item.id !== current.linkedIncomeId) : state.incomes;
      const timestamp = new Date().toISOString();
      const nextDeletedRecords = {
        ...state.syncMeta.deletedRecords,
        dividends: [...(state.syncMeta.deletedRecords.dividends || []).filter((item) => item.id !== id), { id, updatedAt: timestamp, deletedAt: timestamp }],
        incomes: current.linkedIncomeId
          ? [...(state.syncMeta.deletedRecords.incomes || []).filter((item) => item.id !== current.linkedIncomeId), { id: current.linkedIncomeId, updatedAt: timestamp, deletedAt: timestamp }]
          : state.syncMeta.deletedRecords.incomes || [],
      };
      const nextSyncMeta = {
        ...state.syncMeta,
        deletedRecords: nextDeletedRecords,
        conflicts: state.syncMeta.conflicts.filter(
          (item) => item.id !== `dividends:${id}` && item.id !== `incomes:${current.linkedIncomeId}`,
        ),
      };
      saveSyncMeta(nextSyncMeta);
      const nextState = { ...state, dividends: nextDividends, incomes: nextIncomes };
      return {
        dividends: nextDividends,
        incomes: nextIncomes,
        syncMeta: nextSyncMeta,
        derived: buildDerived(nextState),
      };
    });
    get().triggerAutoPush();
  },

  executeTransfer: async (spec) => {
    const { date, amountCents, fromModule, fromId, toModule, description, category, ticker, holdingId } = spec;
    const timestamp = new Date().toISOString();
    const currency = get().settings.baseCurrency;
    const trfId = `trf-${crypto.randomUUID()}`;
    const toPut = []; // { storeName, record }

    let linkedSavingsEntryId = null;
    let linkedExpenseId = null;
    let linkedCashflowId = null;

    // Source side — what leaves
    if (fromModule === 'savings') {
      const entry = ensureEntitySyncFields({
        id: `sav-${crypto.randomUUID()}`,
        date,
        amountCents: -Math.abs(amountCents),
        note: description || 'Transfer out',
        transferId: trfId,
      }, timestamp);
      toPut.push({ storeName: 'savingsEntries', record: entry });
      linkedSavingsEntryId = entry.id;
    }

    // Destination side — what arrives
    if (toModule === 'expenses') {
      const expense = ensureEntitySyncFields({
        id: `exp-${crypto.randomUUID()}`,
        date,
        amountCents: Math.abs(amountCents),
        currency,
        category: category || 'Otros',
        description: description || 'Transfer expense',
        isRecurring: false,
        transferId: trfId,
      }, timestamp);
      toPut.push({ storeName: 'expenses', record: expense });
      linkedExpenseId = expense.id;
    } else if (toModule === 'portfolio') {
      const cashflow = ensureEntitySyncFields({
        id: `pcf-${crypto.randomUUID()}`,
        date,
        amountCents: -Math.abs(amountCents), // negative = capital deposit
        ticker: ticker || null,
        holdingId: holdingId || null,
        kind: 'transfer_in',
        transferId: trfId,
      }, timestamp);
      toPut.push({ storeName: 'portfolioCashflows', record: cashflow });
      linkedCashflowId = cashflow.id;
    } else if (toModule === 'savings') {
      const entry = ensureEntitySyncFields({
        id: `sav-${crypto.randomUUID()}`,
        date,
        amountCents: Math.abs(amountCents),
        note: description || 'Transfer in',
        transferId: trfId,
      }, timestamp);
      toPut.push({ storeName: 'savingsEntries', record: entry });
      linkedSavingsEntryId = entry.id;
    }

    const trf = ensureEntitySyncFields({
      id: trfId,
      date,
      amountCents: Math.abs(amountCents),
      fromModule,
      fromId: fromId || null,
      toModule,
      description: description || '',
      category: category || null,
      ticker: ticker || null,
      linkedSavingsEntryId,
      linkedExpenseId,
      linkedCashflowId,
    }, timestamp);
    toPut.push({ storeName: 'transfers', record: trf });

    await Promise.all(toPut.map(({ storeName, record }) => putRecord(storeName, record)));

    set((state) => {
      let nextState = { ...state };
      for (const { storeName, record } of toPut) {
        nextState = { ...nextState, [storeName]: upsertItem(nextState[storeName] || [], record) };
      }
      return { ...nextState, derived: buildDerived(nextState) };
    });

    get().triggerAutoPush();
    return trf;
  },

  removeTransfer: async (id) => {
    const trf = get().transfers.find((t) => t.id === id);
    if (!trf) return;
    const timestamp = new Date().toISOString();

    const toDelete = [];
    if (trf.linkedSavingsEntryId) toDelete.push({ storeName: 'savingsEntries', id: trf.linkedSavingsEntryId });
    if (trf.linkedExpenseId) toDelete.push({ storeName: 'expenses', id: trf.linkedExpenseId });
    if (trf.linkedCashflowId) toDelete.push({ storeName: 'portfolioCashflows', id: trf.linkedCashflowId });
    toDelete.push({ storeName: 'transfers', id });

    await Promise.all(toDelete.map(({ storeName, id: recId }) => deleteRecord(storeName, recId)));

    set((state) => {
      let nextState = { ...state };
      const nextDeletedRecords = { ...state.syncMeta.deletedRecords };
      for (const { storeName, id: recId } of toDelete) {
        nextState = {
          ...nextState,
          [storeName]: storeName === 'savings'
            ? nextState[storeName]
            : (nextState[storeName] || []).filter((item) => item.id !== recId),
        };
        nextDeletedRecords[storeName] = [
          ...(nextDeletedRecords[storeName] || []).filter((item) => item.id !== recId),
          { id: recId, updatedAt: timestamp, deletedAt: timestamp },
        ];
      }
      const nextSyncMeta = { ...state.syncMeta, deletedRecords: nextDeletedRecords };
      saveSyncMeta(nextSyncMeta);
      return { ...nextState, syncMeta: nextSyncMeta, derived: buildDerived(nextState) };
    });

    get().triggerAutoPush();
  },

  refreshPrices: async () => {
    const { holdings, settings } = get();
    const refreshableHoldings = holdings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0);
    const refreshableTickers = [...new Set(refreshableHoldings.map((holding) => holding.ticker))];
    const apiKey = settings.alphaVantageApiKey || '';
    const baseCurrency = settings.baseCurrency || 'EUR';

    // Alpha Vantage free tier = 5 req/min. Fetch sequentially with a gap to avoid
    // rate-limiting when the user has many holdings.
    const DELAY_MS = apiKey ? 13000 : 0; // 13 s between requests when using AV

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

    // Step 4: build refreshed holdings, converting prices to baseCurrency where possible
    const failures = [];
    const refreshedActive = refreshableHoldings.map((holding) => {
      const result = resultsByTicker.get(holding.ticker);
      if (result.status === 'fulfilled') {
        const { priceCents, currency } = result.value;
        let convertedPriceCents = priceCents;
        if (currency !== baseCurrency && fxRates[currency] != null) {
          convertedPriceCents = Math.round(priceCents * fxRates[currency]);
        }
        return { ...holding, currentPriceCents: convertedPriceCents };
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
      const nextState = { ...state, holdings: refreshed };
      return { holdings: refreshed, derived: buildDerived(nextState) };
    });

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

  wipeAllData: async () => {
    await clearAllStores();
    localStorage.removeItem('pft-seeded');
    localStorage.removeItem('pft-sync-meta');
    // Keep settings (currency, locale, API keys) — only nuke financial records
    await get().bootstrap();
  },

  importBackup: async (snapshot) => {
    await importDatabaseSnapshot(snapshot);
    await get().bootstrap();
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
        redirectTo: 'https://www.finges.xyz',
      },
    });
    if (error) {
      set({ supabaseSyncStatus: 'error', supabaseError: error.message });
      throw error;
    }
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
    });
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
        ...STORE_KEYS.flatMap((storeName) => getStateRecords(state, storeName).map((record) => buildSyncRecord(userId, storeName, record))),
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
}));
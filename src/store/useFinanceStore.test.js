import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/storage', () => ({
  clearAllStores: vi.fn(async () => {}),
  deleteRecord: vi.fn(async () => {}),
  ensureEntitySyncFields: vi.fn((entity, fallbackTimestamp = new Date().toISOString()) => ({
    ...entity,
    updatedAt: entity.updatedAt || fallbackTimestamp,
  })),
  ensureSeedData: vi.fn(async () => {}),
  exportDatabaseSnapshot: vi.fn(async () => ({})),
  getAllRecords: vi.fn(async () => []),
  getRecord: vi.fn(async () => null),
  importDatabaseSnapshot: vi.fn(async () => {}),
  loadSettings: vi.fn(() => ({
    baseCurrency: 'EUR',
    locale: 'en-GB',
    allocationTargets: [],
    modules: { portfolio: true },
  })),
  loadSyncMeta: vi.fn(() => ({ lastPulledAt: {}, deletedRecords: {}, conflicts: [] })),
  putRecord: vi.fn(async () => {}),
  saveSettings: vi.fn(() => {}),
  saveSyncMeta: vi.fn(() => {}),
  sanitizeSettingsForSync: vi.fn((settings) => settings),
}));

vi.mock('../utils/supabase', () => ({
  clearSupabaseBrowserClient: vi.fn(),
  createSupabaseBrowserClient: vi.fn(() => null),
  fetchRemoteChanges: vi.fn(async () => []),
  getSupabaseBrowserClient: vi.fn(() => null),
  getSupabaseConfig: vi.fn(() => ({ url: '', anonKey: '' })),
  upsertRemoteRecords: vi.fn(async () => {}),
}));

vi.mock('../utils/yahoo', () => ({
  fetchTickerPrice: vi.fn(async () => ({ priceCents: 0, currency: 'EUR' })),
}));

const { fetchTickerPrice } = await import('../utils/yahoo');
const { useFinanceStore } = await import('./useFinanceStore');

function resetStore(accounts = [{ id: 'bank-a', name: 'Main', balanceCents: 10000, currency: 'EUR' }]) {
  useFinanceStore.setState((state) => ({
    ...state,
    settings: {
      ...state.settings,
      baseCurrency: 'EUR',
      locale: 'en-GB',
      allocationTargets: [],
      modules: { portfolio: true },
    },
    syncMeta: { lastPulledAt: {}, deletedRecords: {}, conflicts: [] },
    expenses: [],
    fixedExpenses: [],
    incomes: [],
    holdings: [],
    dividends: [],
    portfolioCashflows: [],
    portfolioSales: [],
    savingsConfig: { id: 'savings-config', currentBalanceCents: 0, monthlyOverrideCents: 0, annualReturnRate: 0, goalCents: 0, projectionYears: 30 },
    savingsEntries: [],
    savingsGoals: [],
    transfers: [],
    bankAccounts: accounts,
    attachments: [],
    activityLog: [],
    portfolioSnapshots: [],
  }));
}

describe('account-backed transaction saves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    resetStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('decreases the selected account when creating an expense', async () => {
    await useFinanceStore.getState().saveEntity('expenses', {
      date: '2026-05-01',
      amountCents: 2500,
      currency: 'EUR',
      category: 'Food',
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(7500);
  });

  it('blocks expenses that would make a bank account negative', async () => {
    await expect(useFinanceStore.getState().saveEntity('expenses', {
      date: '2026-05-01',
      amountCents: 12500,
      currency: 'EUR',
      category: 'Food',
      bankAccountId: 'bank-a',
    })).rejects.toThrow('Not enough balance in Main.');

    expect(useFinanceStore.getState().expenses).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('increases the selected account when creating income', async () => {
    await useFinanceStore.getState().saveEntity('incomes', {
      date: '2026-05-01',
      amountCents: 4000,
      currency: 'EUR',
      incomeKind: 'variable',
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(14000);
  });

  it('reverses the old account delta and applies the new one when editing', async () => {
    resetStore([
      { id: 'bank-a', name: 'Main', balanceCents: 10000, currency: 'EUR' },
      { id: 'bank-b', name: 'Backup', balanceCents: 5000, currency: 'EUR' },
    ]);

    const saved = await useFinanceStore.getState().saveEntity('expenses', {
      date: '2026-05-01',
      amountCents: 2000,
      currency: 'EUR',
      category: 'Food',
      bankAccountId: 'bank-a',
    });

    await useFinanceStore.getState().saveEntity('expenses', {
      ...saved,
      amountCents: 3000,
      bankAccountId: 'bank-b',
    });

    expect(useFinanceStore.getState().bankAccounts.map((account) => account.balanceCents)).toEqual([10000, 2000]);
  });

  it('reverses the transaction delta when deleting', async () => {
    const saved = await useFinanceStore.getState().saveEntity('incomes', {
      date: '2026-05-01',
      amountCents: 5000,
      currency: 'EUR',
      incomeKind: 'variable',
      bankAccountId: 'bank-a',
    });

    await useFinanceStore.getState().removeEntity('incomes', saved.id);

    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('does not adjust account balances when CSV import asks to skip adjustments', async () => {
    await useFinanceStore.getState().saveEntity('expenses', {
      date: '2026-05-01',
      amountCents: 2500,
      currency: 'EUR',
      category: 'Food',
      bankAccountId: 'bank-a',
    }, { skipAccountAdjustment: true });

    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('updates bank account records in memory immediately', async () => {
    await useFinanceStore.getState().saveEntity('bankAccounts', {
      id: 'bank-a',
      name: 'Main renamed',
      balanceCents: 12345,
      currency: 'EUR',
      isMain: true,
    });

    expect(useFinanceStore.getState().bankAccounts[0]).toMatchObject({
      name: 'Main renamed',
      balanceCents: 12345,
      isMain: true,
    });
  });

  it('releases goal savings back to unallocated savings without changing total savings or bank balance', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [
        { id: 'sav-goal', date: '2026-05-01', amountCents: 5000, goalId: 'goal-a', source: undefined },
      ],
    }));

    await useFinanceStore.getState().saveSavingsEntry({
      date: '2026-05-02',
      amountCents: -2000,
      goalId: 'goal-a',
      source: 'allocation',
      note: 'Released from bucket',
    });

    const entries = useFinanceStore.getState().savingsEntries;
    const totalSavings = entries
      .filter((entry) => entry.source !== 'allocation')
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const goalBalance = entries
      .filter((entry) => entry.goalId === 'goal-a')
      .reduce((sum, entry) => sum + entry.amountCents, 0);

    expect(totalSavings).toBe(5000);
    expect(goalBalance).toBe(3000);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('keeps savings withdrawal to bank as a real transfer', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [{ id: 'sav-a', date: '2026-05-01', amountCents: 5000 }],
    }));

    await useFinanceStore.getState().executeTransfer({
      date: '2026-05-02',
      amountCents: 2000,
      fromModule: 'savings',
      toModule: 'cashflow',
      bankAccountId: 'bank-a',
      description: 'Withdrawal',
    });

    const totalSavings = useFinanceStore.getState().savingsEntries
      .filter((entry) => entry.source !== 'allocation')
      .reduce((sum, entry) => sum + entry.amountCents, 0);

    expect(totalSavings).toBe(3000);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(12000);
  });

  it('does not adjust bank balance when creating a fixed income schedule', async () => {
    await useFinanceStore.getState().saveEntity('incomes', {
      date: '2026-05-01',
      accountingMonth: '2026-05',
      amountCents: 300000,
      currency: 'EUR',
      incomeKind: 'fixed',
      isRecurringSchedule: true,
      source: 'Salary',
      bankAccountId: 'bank-a',
      payDay: 5,
    });

    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('marks fixed income received once for the month', async () => {
    const schedule = await useFinanceStore.getState().saveEntity('incomes', {
      date: '2026-05-01',
      accountingMonth: '2026-05',
      amountCents: 300000,
      currency: 'EUR',
      incomeKind: 'fixed',
      isRecurringSchedule: true,
      source: 'Salary',
      bankAccountId: 'bank-a',
      payDay: 5,
    });

    const first = await useFinanceStore.getState().markFixedIncomeReceived(schedule.id, '2026-05');
    const second = await useFinanceStore.getState().markFixedIncomeReceived(schedule.id, '2026-05');

    expect(first.id).toBe(second.id);
    expect(useFinanceStore.getState().incomes.filter((income) => income.incomeKind === 'fixed_payment')).toHaveLength(1);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(310000);
  });

  it('keeps legacy fixed income counted as a received entry', async () => {
    await useFinanceStore.getState().saveEntity('incomes', {
      date: '2026-05-01',
      accountingMonth: '2026-05',
      amountCents: 100000,
      currency: 'EUR',
      incomeKind: 'fixed',
      source: 'Legacy salary',
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().derived.dashboard.totalIncomeCents).toBe(100000);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(110000);
  });

  it('sells a holding without creating hidden income and preserves realized losses', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      holdings: [{
        id: 'hold-loss',
        ticker: 'LOSS',
        name: 'Loss Co',
        quantity: 1,
        averageBuyPriceCents: 10000,
        currentPriceCents: 8000,
        feeCents: 0,
        currency: 'EUR',
      }],
    }));

    const sale = await useFinanceStore.getState().sellHolding({
      holdingId: 'hold-loss',
      percent: 100,
      salePriceCents: 8000,
      feeCents: 0,
      date: '2026-05-02',
      bankAccountId: 'bank-a',
    });

    expect(sale.realizedPnlCents).toBe(-2000);
    expect(useFinanceStore.getState().portfolioSales).toHaveLength(1);
    expect(useFinanceStore.getState().portfolioCashflows).toHaveLength(1);
    expect(useFinanceStore.getState().incomes).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(18000);
  });

  it('edits and deletes portfolio sales without leaving income records behind', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      holdings: [{
        id: 'hold-sale',
        ticker: 'EDIT',
        name: 'Edit Co',
        quantity: 2,
        averageBuyPriceCents: 10000,
        currentPriceCents: 10000,
        feeCents: 0,
        currency: 'EUR',
      }],
    }));

    const sale = await useFinanceStore.getState().sellHolding({
      holdingId: 'hold-sale',
      percent: 50,
      salePriceCents: 12000,
      feeCents: 0,
      date: '2026-05-02',
      bankAccountId: 'bank-a',
    });

    await useFinanceStore.getState().updatePortfolioSale({
      saleId: sale.id,
      percent: 50,
      salePriceCents: 9000,
      feeCents: 0,
      date: '2026-05-03',
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().portfolioSales[0].realizedPnlCents).toBe(-1000);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(19000);
    expect(useFinanceStore.getState().incomes).toEqual([]);

    await useFinanceStore.getState().removePortfolioSale(sale.id);

    expect(useFinanceStore.getState().portfolioSales).toEqual([]);
    expect(useFinanceStore.getState().portfolioCashflows).toEqual([]);
    expect(useFinanceStore.getState().incomes).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('saves, edits, and deletes dividends as bank-backed portfolio records without income mirrors', async () => {
    const dividend = await useFinanceStore.getState().saveDividend({
      date: '2026-05-02',
      amountCents: 1000,
      currency: 'EUR',
      ticker: 'DIV',
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().dividends).toHaveLength(1);
    expect(useFinanceStore.getState().incomes).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(11000);

    await useFinanceStore.getState().saveDividend({
      ...dividend,
      amountCents: 1500,
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().incomes).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(11500);

    await useFinanceStore.getState().removeDividend(dividend.id);

    expect(useFinanceStore.getState().dividends).toEqual([]);
    expect(useFinanceStore.getState().incomes).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(10000);
  });

  it('cleans up only generated portfolio income mirrors', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      dividends: [{ id: 'div-a', date: '2026-05-01', amountCents: 500, ticker: 'DIV', linkedIncomeId: 'inc-div' }],
      portfolioSales: [{ id: 'sale-a', date: '2026-05-01', proceedsCents: 4000, realizedPnlCents: -1000, linkedIncomeId: 'inc-sale' }],
      incomes: [
        { id: 'inc-div', date: '2026-05-01', amountCents: 500, incomeKind: 'dividend' },
        { id: 'inc-sale', date: '2026-05-01', amountCents: 0, incomeKind: 'portfolio_sale', linkedSaleId: 'sale-a' },
        { id: 'inc-manual', date: '2026-05-01', amountCents: 700, incomeKind: 'variable', source: 'Manual' },
      ],
    }));

    await useFinanceStore.getState().cleanupGeneratedPortfolioIncomes();

    expect(useFinanceStore.getState().incomes).toEqual([
      { id: 'inc-manual', date: '2026-05-01', amountCents: 700, incomeKind: 'variable', source: 'Manual' },
    ]);
    expect(useFinanceStore.getState().dividends[0].linkedIncomeId).toBeNull();
    expect(useFinanceStore.getState().portfolioSales[0]).toMatchObject({
      linkedIncomeId: null,
      cashflowCents: 4000,
      realizedPnlCents: -1000,
    });
  });
});

describe('portfolio price refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    resetStore();
    fetchTickerPrice.mockResolvedValue({ priceCents: 12500, currency: 'EUR' });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('updates current price without changing average buy price', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      holdings: [{
        id: 'holding-a',
        ticker: 'VWCE.DE',
        name: 'Vanguard FTSE All-World',
        quantity: 2,
        averageBuyPriceCents: 10000,
        currentPriceCents: 11000,
        currency: 'EUR',
      }],
    }));

    await useFinanceStore.getState().refreshPrices();

    expect(useFinanceStore.getState().holdings[0]).toMatchObject({
      averageBuyPriceCents: 10000,
      currentPriceCents: 12500,
    });
  });

  it('records one floating portfolio value snapshot per hour', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      holdings: [{
        id: 'holding-a',
        ticker: 'VWCE.DE',
        name: 'Vanguard FTSE All-World',
        quantity: 2,
        averageBuyPriceCents: 10000,
        currentPriceCents: 12500,
        currency: 'EUR',
      }],
      derived: {
        ...state.derived,
        portfolio: {
          ...state.derived.portfolio,
          currentValueCents: 25000,
        },
      },
    }));

    await useFinanceStore.getState().recordPortfolioSnapshot();
    useFinanceStore.setState((state) => ({
      ...state,
      derived: {
        ...state.derived,
        portfolio: {
          ...state.derived.portfolio,
          currentValueCents: 26000,
        },
      },
    }));
    await useFinanceStore.getState().recordPortfolioSnapshot();

    expect(useFinanceStore.getState().portfolioSnapshots).toHaveLength(1);
    expect(useFinanceStore.getState().portfolioSnapshots[0]).toMatchObject({
      id: 'psn-2026-05-01T12',
      valueCents: 26000,
      currency: 'EUR',
      holdingsCount: 1,
      source: 'hourly',
    });
  });

  it('can force an event snapshot inside an existing hour', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      holdings: [{
        id: 'holding-a',
        ticker: 'VWCE.DE',
        name: 'Vanguard FTSE All-World',
        quantity: 2,
        averageBuyPriceCents: 10000,
        currentPriceCents: 12500,
        currency: 'EUR',
      }],
      derived: {
        ...state.derived,
        portfolio: {
          ...state.derived.portfolio,
          currentValueCents: 25000,
        },
      },
    }));

    await useFinanceStore.getState().recordPortfolioSnapshot();
    await useFinanceStore.getState().recordPortfolioSnapshot({ force: true, source: 'holding_added' });

    expect(useFinanceStore.getState().portfolioSnapshots).toHaveLength(2);
    expect(useFinanceStore.getState().portfolioSnapshots.map((snapshot) => snapshot.source)).toEqual([
      'holding_added',
      'hourly',
    ]);
  });
});

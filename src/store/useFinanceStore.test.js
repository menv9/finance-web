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
  mergeRemoteSettings: vi.fn((local, remote) => ({ ...local, ...remote })),
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
const { getAllRecords, putRecord } = await import('../utils/storage');
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
    investmentPortfolios: [],
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
    vi.mocked(getAllRecords).mockResolvedValue([]);
    vi.mocked(putRecord).mockClear();
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

  it('withdrawSavings: moves money to bank without creating income or transfer rows', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [{ id: 'sav-a', date: '2026-05-01', amountCents: 5000 }],
    }));

    await useFinanceStore.getState().withdrawSavings({
      date: '2026-05-02',
      amountCents: 2000,
      bankAccountId: 'bank-a',
      description: 'Withdrawal',
    });

    const state = useFinanceStore.getState();
    const totalSavings = state.savingsEntries
      .filter((entry) => entry.source !== 'allocation')
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const newEntry = state.savingsEntries.find((e) => e.id !== 'sav-a');

    expect(totalSavings).toBe(3000);
    expect(state.bankAccounts[0].balanceCents).toBe(12000);
    expect(newEntry.kind).toBe('withdrawal');
    expect(newEntry.amountCents).toBe(-2000);
    expect(state.transfers).toHaveLength(0);
    expect(state.incomes.filter((i) => i.incomeKind === 'transfer')).toHaveLength(0);
  });

  it('addPortfolioBuy (cashflow): deducts bank, no savings entry, no transfer', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      bankAccounts: [{ id: 'bank-a', name: 'Main', balanceCents: 50000, currency: 'EUR' }],
    }));

    await useFinanceStore.getState().addPortfolioBuy({
      date: '2026-05-02',
      holdingId: 'hld-1',
      ticker: 'VWCE',
      amountCents: 10000,
      fundingSource: 'cashflow',
      bankAccountId: 'bank-a',
    });

    const state = useFinanceStore.getState();
    const cashflow = state.portfolioCashflows[0];

    expect(cashflow.kind).toBe('buy');
    expect(cashflow.source).toBe('cashflow');
    expect(cashflow.amountCents).toBe(-10000);
    expect(state.bankAccounts[0].balanceCents).toBe(40000);
    expect(state.savingsEntries).toHaveLength(0);
    expect(state.transfers).toHaveLength(0);
  });

  it('addPortfolioBuy (savings): reduces savings, leaves bank, links savings entry to cashflow', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [{ id: 'sav-seed', date: '2026-05-01', amountCents: 50000 }],
    }));

    await useFinanceStore.getState().addPortfolioBuy({
      date: '2026-05-02',
      holdingId: 'hld-1',
      ticker: 'VWCE',
      amountCents: 10000,
      fundingSource: 'savings',
    });

    const state = useFinanceStore.getState();
    const cashflow = state.portfolioCashflows[0];
    const newEntry = state.savingsEntries.find((e) => e.id !== 'sav-seed');

    expect(cashflow.kind).toBe('buy');
    expect(cashflow.source).toBe('savings');
    expect(cashflow.bankAccountId).toBe(null);
    expect(state.bankAccounts[0].balanceCents).toBe(10000);
    expect(newEntry.kind).toBe('portfolio_buy');
    expect(newEntry.cashflowId).toBe(cashflow.id);
    expect(newEntry.amountCents).toBe(-10000);
    expect(state.transfers).toHaveLength(0);
  });

  it('spendFromSavings: creates expense + savings entry; deletion cascades expense', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [{ id: 'sav-seed', date: '2026-05-01', amountCents: 50000 }],
    }));

    await useFinanceStore.getState().spendFromSavings({
      date: '2026-05-02',
      amountCents: 1500,
      description: 'Vacation gear',
      category: 'Travel',
    });

    let state = useFinanceStore.getState();
    const expense = state.expenses[0];
    const linkedEntry = state.savingsEntries.find((e) => e.id !== 'sav-seed');

    expect(expense.amountCents).toBe(1500);
    expect(expense.bankAccountId).toBeFalsy();
    expect(linkedEntry.kind).toBe('expense');
    expect(linkedEntry.expenseId).toBe(expense.id);
    expect(linkedEntry.amountCents).toBe(-1500);
    expect(state.bankAccounts[0].balanceCents).toBe(10000);
    expect(state.transfers).toHaveLength(0);

    await useFinanceStore.getState().removeEntity('savingsEntries', linkedEntry.id);
    state = useFinanceStore.getState();
    expect(state.expenses.find((e) => e.id === expense.id)).toBeUndefined();
    expect(state.savingsEntries.find((e) => e.id === linkedEntry.id)).toBeUndefined();
  });

  it('allows metadata-only edits on typed savings entries without changing amount or links', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [{ id: 'sav-seed', date: '2026-05-01', amountCents: 50000 }],
    }));

    await useFinanceStore.getState().spendFromSavings({
      date: '2026-05-02',
      amountCents: 1500,
      description: 'Vacation gear',
      category: 'Travel',
    });

    const stateBefore = useFinanceStore.getState();
    const linkedEntry = stateBefore.savingsEntries.find((e) => e.id !== 'sav-seed');
    const linkedExpense = stateBefore.expenses[0];

    await useFinanceStore.getState().saveSavingsEntry({
      ...linkedEntry,
      date: '2026-05-03',
      note: 'Beach gear',
      amountCents: -999999,
      expenseId: 'tampered',
      kind: 'withdrawal',
    });

    const state = useFinanceStore.getState();
    const editedEntry = state.savingsEntries.find((e) => e.id === linkedEntry.id);
    const editedExpense = state.expenses.find((e) => e.id === linkedExpense.id);

    expect(editedEntry.date).toBe('2026-05-03');
    expect(editedEntry.note).toBe('Beach gear');
    expect(editedEntry.amountCents).toBe(-1500);
    expect(editedEntry.expenseId).toBe(linkedExpense.id);
    expect(editedEntry.kind).toBe('expense');
    expect(editedExpense.date).toBe('2026-05-03');
    expect(editedExpense.description).toBe('Beach gear');
    expect(state.bankAccounts[0].balanceCents).toBe(10000);
  });

  it('reverse cascade: deleting the expense also removes the linked savings entry', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      savingsEntries: [{ id: 'sav-seed', date: '2026-05-01', amountCents: 50000 }],
    }));

    await useFinanceStore.getState().spendFromSavings({
      date: '2026-05-02',
      amountCents: 1500,
      description: 'Vacation gear',
      category: 'Travel',
    });

    let state = useFinanceStore.getState();
    const expense = state.expenses[0];
    const linkedEntry = state.savingsEntries.find((e) => e.id !== 'sav-seed');

    await useFinanceStore.getState().removeEntity('expenses', expense.id);
    state = useFinanceStore.getState();
    expect(state.expenses.find((e) => e.id === expense.id)).toBeUndefined();
    expect(state.savingsEntries.find((e) => e.id === linkedEntry.id)).toBeUndefined();
  });

  it('deleting a savings-funded holding refunds savings and reverts the cashflow', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      holdings: [{ id: 'hld-1', ticker: 'VWCE', name: 'VWCE', quantity: 10, averageBuyPriceCents: 100000, currency: 'EUR' }],
      savingsEntries: [{ id: 'sav-seed', date: '2026-05-01', amountCents: 50000 }],
    }));

    await useFinanceStore.getState().addPortfolioBuy({
      date: '2026-05-02',
      holdingId: 'hld-1',
      ticker: 'VWCE',
      amountCents: 10000,
      fundingSource: 'savings',
    });

    expect(useFinanceStore.getState().portfolioCashflows).toHaveLength(1);
    expect(useFinanceStore.getState().savingsEntries.filter((e) => e.kind === 'portfolio_buy')).toHaveLength(1);

    await useFinanceStore.getState().removeEntity('holdings', 'hld-1');

    const state = useFinanceStore.getState();
    expect(state.holdings).toHaveLength(0);
    expect(state.portfolioCashflows).toHaveLength(0);
    expect(state.savingsEntries.filter((e) => e.kind === 'portfolio_buy')).toHaveLength(0);
    // Savings balance restored: only the seed remains.
    const totalSavings = state.savingsEntries
      .filter((e) => e.source !== 'allocation')
      .reduce((s, e) => s + e.amountCents, 0);
    expect(totalSavings).toBe(50000);
  });

  it('deleting a cashflow-funded holding refunds the bank account', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      bankAccounts: [{ id: 'bank-a', name: 'Main', balanceCents: 50000, currency: 'EUR' }],
      holdings: [{ id: 'hld-1', ticker: 'VWCE', name: 'VWCE', quantity: 10, averageBuyPriceCents: 100000, currency: 'EUR' }],
    }));

    await useFinanceStore.getState().addPortfolioBuy({
      date: '2026-05-02',
      holdingId: 'hld-1',
      ticker: 'VWCE',
      amountCents: 10000,
      fundingSource: 'cashflow',
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(40000);

    await useFinanceStore.getState().removeEntity('holdings', 'hld-1');

    const state = useFinanceStore.getState();
    expect(state.bankAccounts[0].balanceCents).toBe(50000);
    expect(state.portfolioCashflows).toHaveLength(0);
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

  it('preserves fixed income accrual month offsets when marking received', async () => {
    const schedule = await useFinanceStore.getState().saveEntity('incomes', {
      date: '2026-01-01',
      accountingMonth: '2025-12',
      amountCents: 300000,
      currency: 'EUR',
      incomeKind: 'fixed',
      isRecurringSchedule: true,
      source: 'Salary',
      bankAccountId: 'bank-a',
      payDay: 1,
    });

    const payment = await useFinanceStore.getState().markFixedIncomeReceived(schedule.id, '2026-05');

    expect(payment.date).toBe('2026-06-01');
    expect(payment.accountingMonth).toBe('2026-05');
    expect(payment.incomeKind).toBe('fixed_payment');
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
    expect(useFinanceStore.getState().dividends[0].accountingMonth).toBe('2026-05');
    expect(useFinanceStore.getState().incomes).toEqual([]);
    expect(useFinanceStore.getState().bankAccounts[0].balanceCents).toBe(11000);

    await useFinanceStore.getState().saveDividend({
      ...dividend,
      accountingMonth: '2026-06',
      amountCents: 1500,
      bankAccountId: 'bank-a',
    });

    expect(useFinanceStore.getState().dividends[0].accountingMonth).toBe('2026-06');
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

describe('investment portfolios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    resetStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.mocked(getAllRecords).mockResolvedValue([]);
    vi.mocked(putRecord).mockClear();
  });

  it('requires a portfolio before adding holdings', async () => {
    await expect(useFinanceStore.getState().saveEntity('holdings', {
      ticker: 'VWCE',
      name: 'VWCE',
      quantity: 1,
      averageBuyPriceCents: 10000,
      currentPriceCents: 11000,
      currency: 'EUR',
    })).rejects.toThrow('Create a portfolio before adding holdings.');
  });

  it('assigns new holdings to the existing portfolio when no portfolioId is provided', async () => {
    await useFinanceStore.getState().saveEntity('investmentPortfolios', {
      id: 'ipr-main',
      name: 'Main Portfolio',
    });

    const holding = await useFinanceStore.getState().saveEntity('holdings', {
      ticker: 'VWCE',
      name: 'VWCE',
      quantity: 1,
      averageBuyPriceCents: 10000,
      currentPriceCents: 11000,
      currency: 'EUR',
    });

    expect(holding.portfolioId).toBe('ipr-main');
    expect(holding.purchaseDate).toBe('2026-05-01');
    expect(useFinanceStore.getState().holdings[0].portfolioId).toBe('ipr-main');
  });

  it('saves historical broker holdings without creating portfolio cashflows or bank movements', async () => {
    await useFinanceStore.getState().saveEntity('investmentPortfolios', {
      id: 'ipr-main',
      name: 'Main Portfolio',
    });
    useFinanceStore.setState((state) => ({
      ...state,
      bankAccounts: [{ id: 'bank-a', name: 'Main', balanceCents: 50000, currency: 'EUR' }],
    }));

    const holding = await useFinanceStore.getState().saveEntity('holdings', {
      portfolioId: 'ipr-main',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      platform: 'IBKR',
      purchaseDate: '2024-01-15',
      quantity: 2,
      averageBuyPriceCents: 10000,
      currentPriceCents: 12000,
      currency: 'EUR',
    });

    const state = useFinanceStore.getState();
    expect(holding.purchaseDate).toBe('2024-01-15');
    expect(state.portfolioCashflows).toEqual([]);
    expect(state.savingsEntries.filter((entry) => entry.kind === 'portfolio_buy')).toEqual([]);
    expect(state.bankAccounts[0].balanceCents).toBe(50000);
  });

  it('blocks deleting a portfolio with linked data and allows deleting an empty one', async () => {
    await useFinanceStore.getState().saveEntity('investmentPortfolios', { id: 'ipr-main', name: 'Main Portfolio' });
    await useFinanceStore.getState().saveEntity('investmentPortfolios', { id: 'ipr-empty', name: 'Empty' });
    await useFinanceStore.getState().saveEntity('holdings', {
      id: 'hld-1',
      portfolioId: 'ipr-main',
      ticker: 'VWCE',
      name: 'VWCE',
      quantity: 1,
      averageBuyPriceCents: 10000,
      currentPriceCents: 11000,
      currency: 'EUR',
    });

    await expect(useFinanceStore.getState().removeEntity('investmentPortfolios', 'ipr-main'))
      .rejects.toThrow('This portfolio has holdings or history.');
    await useFinanceStore.getState().removeEntity('investmentPortfolios', 'ipr-empty');

    expect(useFinanceStore.getState().investmentPortfolios.map((item) => item.id)).toEqual(['ipr-main']);
  });

  it('records a global snapshot and scoped snapshots for portfolios with holdings', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      investmentPortfolios: [
        { id: 'ipr-a', name: 'A' },
        { id: 'ipr-b', name: 'B' },
      ],
      holdings: [
        { id: 'hld-a', portfolioId: 'ipr-a', ticker: 'AAA', quantity: 2, averageBuyPriceCents: 10000, currentPriceCents: 12000, currency: 'EUR' },
        { id: 'hld-b', portfolioId: 'ipr-b', ticker: 'BBB', quantity: 1, averageBuyPriceCents: 5000, currentPriceCents: 6000, currency: 'EUR' },
      ],
      derived: {
        ...state.derived,
        portfolio: {
          ...state.derived.portfolio,
          currentValueCents: 30000,
        },
      },
    }));

    await useFinanceStore.getState().recordPortfolioSnapshot();

    const snapshots = useFinanceStore.getState().portfolioSnapshots;
    expect(snapshots).toHaveLength(3);
    expect(snapshots.find((snapshot) => !snapshot.portfolioId)).toMatchObject({ valueCents: 30000, holdingsCount: 2, scopeVersion: 'assigned-only-v1' });
    expect(snapshots.find((snapshot) => snapshot.portfolioId === 'ipr-a')).toMatchObject({ valueCents: 24000, holdingsCount: 1, scopeVersion: 'assigned-only-v1' });
    expect(snapshots.find((snapshot) => snapshot.portfolioId === 'ipr-b')).toMatchObject({ valueCents: 6000, holdingsCount: 1, scopeVersion: 'assigned-only-v1' });
  });

  it('excludes unassigned holdings from derived portfolio metrics and snapshots', async () => {
    await useFinanceStore.getState().saveEntity('investmentPortfolios', { id: 'ipr-main', name: 'Main' });
    await useFinanceStore.getState().saveEntity('holdings', {
      id: 'hld-main',
      portfolioId: 'ipr-main',
      ticker: 'AAA',
      quantity: 2,
      averageBuyPriceCents: 10000,
      currentPriceCents: 12000,
      currency: 'EUR',
    });
    await useFinanceStore.getState().saveEntity('holdings', {
      id: 'hld-unassigned',
      portfolioId: '',
      ticker: 'BBB',
      quantity: 10,
      averageBuyPriceCents: 5000,
      currentPriceCents: 9000,
      currency: 'EUR',
    }, { allowUnassignedPortfolio: true });

    await useFinanceStore.getState().recordPortfolioSnapshot();

    const state = useFinanceStore.getState();
    expect(state.derived.portfolio.currentValueCents).toBe(24000);
    expect(state.derived.portfolio.investedCents).toBe(20000);
    expect(state.portfolioSnapshots.find((snapshot) => !snapshot.portfolioId)).toMatchObject({
      valueCents: 24000,
      costCents: 20000,
      holdingsCount: 1,
      scopeVersion: 'assigned-only-v1',
    });
  });

  it('backfills legacy holdings into a default portfolio during bootstrap', async () => {
    const storeData = {
      expenses: [],
      fixedExpenses: [],
      incomes: [],
      investmentPortfolios: [],
      holdings: [{ id: 'hld-legacy', ticker: 'VWCE', name: 'VWCE', quantity: 1, averageBuyPriceCents: 10000, currentPriceCents: 11000, currency: 'EUR' }],
      dividends: [{ id: 'div-legacy', ticker: 'VWCE', date: '2026-05-01', amountCents: 100 }],
      portfolioCashflows: [{ id: 'pcf-legacy', holdingId: 'hld-legacy', date: '2026-05-01', amountCents: -10000 }],
      portfolioSales: [{ id: 'psl-legacy', holdingId: 'hld-legacy', ticker: 'VWCE', date: '2026-05-02', proceedsCents: 12000 }],
      savings: [],
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
    const order = [
      'expenses', 'fixedExpenses', 'incomes', 'investmentPortfolios', 'holdings',
      'dividends', 'portfolioCashflows', 'portfolioSales', 'savings', 'savingsEntries',
      'savingsGoals', 'budgets', 'rollovers', 'transfers', 'bankAccounts', 'debts',
      'attachments', 'activityLog', 'portfolioSnapshots',
    ];
    vi.mocked(getAllRecords).mockImplementation(async (storeName) => storeData[storeName] || []);

    await useFinanceStore.getState().bootstrap();

    const state = useFinanceStore.getState();
    expect(state.investmentPortfolios).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'ipr-main', name: 'Main Portfolio' })]));
    expect(state.holdings[0].portfolioId).toBe('ipr-main');
    expect(state.holdings[0].purchaseDate).toBe('2026-05-01');
    expect(state.dividends[0].portfolioId).toBe('ipr-main');
    expect(state.portfolioCashflows[0].portfolioId).toBe('ipr-main');
    expect(state.portfolioSales[0].portfolioId).toBe('ipr-main');
    expect(vi.mocked(putRecord)).toHaveBeenCalledWith('investmentPortfolios', expect.objectContaining({ id: 'ipr-main' }));
    expect(order).toContain('investmentPortfolios');
  });

  it('keeps explicitly unassigned holdings unassigned during bootstrap', async () => {
    const storeData = {
      expenses: [],
      fixedExpenses: [],
      incomes: [],
      investmentPortfolios: [{ id: 'ipr-main', name: 'Main Portfolio' }],
      holdings: [{ id: 'hld-unassigned', portfolioId: '', ticker: 'VWCE', name: 'VWCE', quantity: 1, averageBuyPriceCents: 10000, currentPriceCents: 11000, currency: 'EUR' }],
      dividends: [],
      portfolioCashflows: [],
      portfolioSales: [],
      savings: [],
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
    vi.mocked(getAllRecords).mockImplementation(async (storeName) => storeData[storeName] || []);

    await useFinanceStore.getState().bootstrap();

    const state = useFinanceStore.getState();
    expect(state.holdings[0].portfolioId).toBe('');
    expect(state.derived.portfolio.currentValueCents).toBe(0);
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
      investmentPortfolios: [{ id: 'ipr-main', name: 'Main' }],
      holdings: [{
        id: 'holding-a',
        portfolioId: 'ipr-main',
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
      investmentPortfolios: [{ id: 'ipr-main', name: 'Main' }],
      holdings: [{
        id: 'holding-a',
        portfolioId: 'ipr-main',
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
      holdings: state.holdings.map((holding) => (
        holding.id === 'holding-a' ? { ...holding, currentPriceCents: 13000 } : holding
      )),
    }));
    await useFinanceStore.getState().recordPortfolioSnapshot();

    const snapshots = useFinanceStore.getState().portfolioSnapshots;
    expect(snapshots).toHaveLength(2);
    expect(snapshots.find((snapshot) => !snapshot.portfolioId)).toMatchObject({
      id: 'psn-2026-05-01T12',
      valueCents: 26000,
      currency: 'EUR',
      holdingsCount: 1,
      source: 'hourly',
      scopeVersion: 'assigned-only-v1',
    });
  });

  it('can force an event snapshot inside an existing hour', async () => {
    useFinanceStore.setState((state) => ({
      ...state,
      investmentPortfolios: [{ id: 'ipr-main', name: 'Main' }],
      holdings: [{
        id: 'holding-a',
        portfolioId: 'ipr-main',
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

    expect(useFinanceStore.getState().portfolioSnapshots).toHaveLength(4);
    expect(useFinanceStore.getState().portfolioSnapshots.filter((snapshot) => snapshot.source === 'holding_added')).toHaveLength(2);
    expect(useFinanceStore.getState().portfolioSnapshots.filter((snapshot) => snapshot.source === 'hourly')).toHaveLength(2);
  });
});

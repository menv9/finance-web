import { describe, expect, it, vi } from 'vitest';
import { buildDividendIncomeRows, computeDashboardData, computeIncomeSeries, computePortfolioMetrics, yearlySideIncome } from './finance';

describe('finance metrics', () => {
  it('computes portfolio totals and allocation weights', () => {
    const metrics = computePortfolioMetrics(
      [
        {
          id: 'hold-1',
          ticker: 'VWCE.DE',
          name: 'VWCE',
          quantity: 10,
          averageBuyPriceCents: 10000,
          currentPriceCents: 12000,
        },
      ],
      [{ id: 'div-1', amountCents: 1000, ticker: 'VWCE.DE' }],
      [{ id: 'cf-1', amountCents: -100000, date: '2026-04-01', ticker: 'VWCE.DE' }],
      [{ ticker: 'VWCE.DE', targetWeight: 100 }],
    );

    expect(metrics.currentValueCents).toBe(120000);
    expect(metrics.investedCents).toBe(100000);
    expect(metrics.pnlCents).toBe(20000);
    expect(metrics.allocationActual[0].actualWeight).toBe(100);
  });

  it('uses the full holding quantity precision when computing value', () => {
    const metrics = computePortfolioMetrics(
      [
        {
          id: 'hold-precise',
          ticker: 'BTC',
          name: 'Bitcoin',
          quantity: 0.12345678,
          quantityDecimals: 8,
          averageBuyPriceCents: 1000000,
          currentPriceCents: 1234567,
        },
      ],
      [],
      [],
      [],
    );

    expect(metrics.currentValueCents).toBe(Math.round(0.12345678 * 1234567));
    expect(metrics.allocationActual[0].valueCents).toBe(Math.round(0.12345678 * 1234567));
  });

  it('counts only variable income in side income ytd', () => {
    const result = yearlySideIncome([
      { incomeKind: 'variable', amountCents: 20000, date: '2026-01-02' },
      { incomeKind: 'fixed', amountCents: 30000, date: '2026-01-05' },
      { incomeKind: 'variable', amountCents: 15000, date: '2026-03-11' },
      { incomeKind: 'variable', amountCents: 9000, date: '2025-12-31' },
    ]);

    expect(result).toBe(35000);
  });

  it('excludes future expenses from current dashboard totals', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [
          { id: 'exp-past', amountCents: 1000, date: '2026-04-20' },
          { id: 'exp-future', amountCents: 2000, date: '2026-04-30' },
          { id: 'exp-next-month', amountCents: 3000, date: '2026-05-01' },
        ],
        incomes: [{ id: 'inc-1', amountCents: 5000, date: '2026-04-01' }],
        fixedExpenses: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
      });

      expect(result.cashflowCents).toBe(4000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses bank accounts as total balance while keeping monthly cashflow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [
          { id: 'exp-apr', amountCents: 90000, date: '2026-04-20' },
          { id: 'exp-may', amountCents: 3000, date: '2026-05-01' },
        ],
        incomes: [{ id: 'inc-apr', amountCents: 100000, date: '2026-04-01' }],
        fixedExpenses: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
        bankAccounts: [{ id: 'bank-main', balanceCents: 7000 }],
      });

      expect(result.cashflowCents).toBe(-3000);
      expect(result.availableBalanceCents).toBe(7000);
      expect(result.bankBalanceCents).toBe(7000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses accounting month for monthly income while counting received cash immediately', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [],
        incomes: [{ id: 'inc-may-salary', amountCents: 100000, date: '2026-04-28', accountingMonth: '2026-05' }],
        fixedExpenses: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
        bankAccounts: [{ id: 'bank-main', balanceCents: 100000 }],
      });

      expect(result.cashflowCents).toBe(0);
      expect(result.availableBalanceCents).toBe(100000);
      expect(result.incomeSeries.at(-1).amountCents).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores unassigned legacy cashflow for total balance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [{ id: 'exp-legacy', amountCents: 2000, date: '2026-05-01' }],
        incomes: [{ id: 'inc-legacy', amountCents: 50000, date: '2026-05-01' }],
        fixedExpenses: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
        bankAccounts: [{ id: 'bank-main', balanceCents: 12000 }],
      });

      expect(result.availableBalanceCents).toBe(12000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves received income into cashflow when its accounting month arrives', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [],
        incomes: [{ id: 'inc-may-salary', amountCents: 100000, date: '2026-04-28', accountingMonth: '2026-05' }],
        fixedExpenses: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
        bankAccounts: [{ id: 'bank-main', balanceCents: 100000 }],
      });

      expect(result.cashflowCents).toBe(100000);
      expect(result.availableBalanceCents).toBe(100000);
      expect(result.incomeSeries.at(-1).amountCents).toBe(100000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('excludes fixed income schedules but counts fixed payments and legacy fixed income', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [],
        incomes: [
          {
            id: 'schedule',
            amountCents: 300000,
            date: '2026-05-01',
            accountingMonth: '2026-05',
            incomeKind: 'fixed',
            isRecurringSchedule: true,
          },
          {
            id: 'payment',
            amountCents: 300000,
            date: '2026-05-05',
            accountingMonth: '2026-05',
            incomeKind: 'fixed_payment',
            fixedIncomeId: 'schedule',
          },
          {
            id: 'legacy-fixed',
            amountCents: 100000,
            date: '2026-05-02',
            accountingMonth: '2026-05',
            incomeKind: 'fixed',
          },
        ],
        fixedExpenses: [],
        holdings: [],
        dividends: [],
        portfolioCashflows: [],
        portfolioSales: [],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
        bankAccounts: [{ id: 'bank-main', balanceCents: 400000 }],
      });

      expect(result.totalIncomeCents).toBe(400000);
      expect(result.incomeSeries.at(-1).amountCents).toBe(400000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts portfolio dividends as derived income without counting portfolio sale proceeds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T12:00:00'));

    try {
      const result = computeDashboardData({
        expenses: [],
        incomes: [],
        fixedExpenses: [],
        holdings: [],
        dividends: [{ id: 'div-a', amountCents: 1200, date: '2026-05-02', ticker: 'DIV', bankAccountId: 'bank-main' }],
        portfolioCashflows: [],
        portfolioSales: [{ id: 'sale-a', date: '2026-05-02', proceedsCents: 100000, realizedPnlCents: -5000 }],
        savingsConfig: [],
        savingsEntries: [],
        transfers: [],
        bankAccounts: [{ id: 'bank-main', balanceCents: 101200 }],
      });

      expect(result.totalIncomeCents).toBe(1200);
      expect(result.cashflowCents).toBe(1200);
      expect(result.portfolioSaleCashflowCents).toBe(0);
      expect(result.incomeSeries.at(-1).amountCents).toBe(1200);
      expect(result.cashflowSeries.at(-1).incomeCents).toBe(1200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds read-only income rows from dividends for the income UI', () => {
    const rows = buildDividendIncomeRows([
      { id: 'div-a', amountCents: 1200, date: '2026-05-02', ticker: 'DIV', currency: 'EUR', bankAccountId: 'bank-a' },
    ]);

    expect(rows[0]).toMatchObject({
      id: 'portfolio-dividend-div-a',
      sourceId: 'div-a',
      incomeKind: 'dividend',
      ledgerType: 'portfolio-dividend',
      accountingMonth: '2026-05',
      amountCents: 1200,
      bankAccountId: 'bank-a',
      readOnly: true,
    });
    expect(computeIncomeSeries([], rows).at(-1).amountCents).toBe(1200);
  });
});

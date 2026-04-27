import { describe, expect, it, vi } from 'vitest';
import { computeDashboardData, computePortfolioMetrics, yearlySideIncome } from './finance';

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
});

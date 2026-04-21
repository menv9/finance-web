import { describe, expect, it } from 'vitest';
import { computePortfolioMetrics, yearlySideIncome } from './finance';

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

  it('counts only variable income in side income ytd', () => {
    const result = yearlySideIncome([
      { incomeKind: 'variable', amountCents: 20000, date: '2026-01-02' },
      { incomeKind: 'fixed', amountCents: 30000, date: '2026-01-05' },
      { incomeKind: 'variable', amountCents: 15000, date: '2026-03-11' },
      { incomeKind: 'variable', amountCents: 9000, date: '2025-12-31' },
    ]);

    expect(result).toBe(35000);
  });
});

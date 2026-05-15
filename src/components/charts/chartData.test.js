import { describe, expect, it } from 'vitest';
import { cleanChartData, normalizeChartTime } from './chartData';

describe('chart data normalization', () => {
  it('keeps intraday timestamps distinct for portfolio value charts', () => {
    const first = normalizeChartTime('2026-05-01T10:00:00.000Z');
    const second = normalizeChartTime('2026-05-01T16:00:00.000Z');

    expect(first).toBe(1777629600);
    expect(second).toBe(1777651200);
    expect(first).not.toBe(second);
  });

  it('deduplicates only exact chart times, not all points on the same day', () => {
    const points = cleanChartData([
      { time: '2026-05-01T10:00:00.000Z', value: 100 },
      { time: '2026-05-01T16:00:00.000Z', value: 120 },
      { time: '2026-05-01T16:00:00.000Z', value: 125 },
    ]);

    expect(points).toEqual([
      { time: 1777629600, value: 100 },
      { time: 1777651200, value: 125 },
    ]);
  });

  it('keeps date-only chart points as business-day strings', () => {
    expect(cleanChartData([{ time: '2026-05-01', value: 100 }])).toEqual([
      { time: '2026-05-01', value: 100 },
    ]);
  });
});

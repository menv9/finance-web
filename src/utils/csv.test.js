import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvDate } from './csv';

describe('parseCsvDate', () => {
  it('keeps ISO dates and normalizes common European CSV dates', () => {
    expect(parseCsvDate('2026-04-25')).toBe('2026-04-25');
    expect(parseCsvDate('2026/04/25')).toBe('2026-04-25');
    expect(parseCsvDate('25/04/2026')).toBe('2026-04-25');
    expect(parseCsvDate('25.04.2026')).toBe('2026-04-25');
    expect(parseCsvDate('25-04-26')).toBe('2026-04-25');
    expect(parseCsvDate('25.04.2026, 00:00')).toBe('2026-04-25');
    expect(parseCsvDate('04/25/2026')).toBe('2026-04-25');
    expect(parseCsvDate('46137')).toBe('2026-04-25');
  });

  it('rejects impossible or ambiguous dates instead of rolling them over', () => {
    expect(parseCsvDate('31/02/2026')).toBe('');
    expect(parseCsvDate('2026-13-01')).toBe('');
  });
});

describe('parseCsv', () => {
  it('removes an Excel BOM from the first header', () => {
    const parsed = parseCsv('\uFEFFFecha;Importe\n25.04.2026;12,50');

    expect(parsed.headers).toEqual(['Fecha', 'Importe']);
    expect(parsed.rows[0].Fecha).toBe('25.04.2026');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTickerPrice, searchAssets } from './yahoo';

function jsonResponse(data, ok = true) {
  return {
    ok,
    json: vi.fn(async () => data),
  };
}

function mockSessionStorage() {
  const store = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, value) => store.set(key, value)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('yahoo asset helpers', () => {
  it('normalizes Finnhub search results when an API key is available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      result: [
        {
          symbol: 'vwce.de',
          description: 'Vanguard FTSE All-World UCITS ETF',
          mic: 'XETR',
          type: 'ETF',
        },
      ],
    })));

    const results = await searchAssets('vwce', 'key');

    expect(results).toEqual([
      {
        ticker: 'VWCE.DE',
        name: 'Vanguard FTSE All-World UCITS ETF',
        exchange: 'XETR',
        type: 'ETF',
        currency: 'EUR',
      },
    ]);
  });

  it('falls back to Yahoo search when Finnhub is unavailable', async () => {
    vi.stubGlobal('fetch', vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Invalid token' }))
      .mockResolvedValueOnce(jsonResponse({
        quotes: [
          {
            symbol: 'AAPL',
            longname: 'Apple Inc.',
            exchDisp: 'NASDAQ',
            quoteType: 'EQUITY',
            currency: 'USD',
          },
        ],
      })));

    const results = await searchAssets('apple', 'bad-key');

    expect(results[0]).toMatchObject({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      type: 'EQUITY',
      currency: 'USD',
    });
  });

  it('does not search empty or one-character queries', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(searchAssets('')).resolves.toEqual([]);
    await expect(searchAssets('v')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches the selected ticker price and currency', async () => {
    mockSessionStorage();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      c: 123.45,
    })));

    const result = await fetchTickerPrice(' aapl ', 'key');

    expect(result).toEqual({ priceCents: 12345, currency: 'USD' });
  });
});

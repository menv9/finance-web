const TTL_MS = 15 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Detect crypto/FX pairs like BTC/EUR, ETH/USD
function parseCurrencyPair(ticker) {
  const match = ticker.match(/^([A-Z0-9]+)\/([A-Z]+)$/);
  return match ? { from: match[1], to: match[2] } : null;
}

// Infer price currency from ticker exchange suffix.
const SUFFIX_CURRENCY = {
  DE: 'EUR', VI: 'EUR', PA: 'EUR', AS: 'EUR', MI: 'EUR', BR: 'EUR', LS: 'EUR',
  L: 'GBP',
  TO: 'CAD', V: 'CAD',
  AX: 'AUD',
  HK: 'HKD',
  T: 'JPY',
  SW: 'CHF',
  SG: 'SGD',
  NS: 'INR', BO: 'INR',
};

function inferCurrencyFromTicker(ticker) {
  const suffix = ticker.match(/\.([A-Z]+)$/)?.[1];
  return (suffix && SUFFIX_CURRENCY[suffix]) || 'USD';
}

// Well-known crypto exchange prefixes to try in order
const CRYPTO_EXCHANGES = ['BINANCE', 'COINBASE', 'KRAKEN'];

// ── Finnhub ───────────────────────────────────────────────────────────────────

async function finnhubGet(path, apiKey) {
  const res = await fetch(`https://finnhub.io/api/v1${path}`, {
    headers: { 'X-Finnhub-Token': apiKey },
  });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Finnhub: ${data.error}`);
  return data;
}

async function fetchFromFinnhub(ticker, apiKey) {
  const pair = parseCurrencyPair(ticker);

  // ── Forex pair (e.g. USD/EUR) ──────────────────────────────────────────────
  if (pair) {
    const isCrypto = pair.from.length > 4 ||
      ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOT', 'LTC', 'BNB', 'DOGE', 'AVAX',
       'MATIC', 'LINK', 'UNI', 'ATOM', 'XLM', 'ALGO', 'FTM'].includes(pair.from);

    if (isCrypto) {
      // Try common exchanges until one returns a price
      for (const exchange of CRYPTO_EXCHANGES) {
        const symbol = `${exchange}:${pair.from}${pair.to}`;
        try {
          const data = await finnhubGet(`/quote?symbol=${encodeURIComponent(symbol)}`, apiKey);
          const price = data.c;
          if (price && price > 0) {
            return { priceCents: Math.round(price * 100), currency: pair.to };
          }
        } catch {
          // try next exchange
        }
      }
      throw new Error(`No crypto price from Finnhub for ${ticker}`);
    }

    // Forex: use /forex/rates which returns all rates relative to a base
    const data = await finnhubGet(`/forex/rates?base=${pair.from}`, apiKey);
    const rate = data?.quote?.[pair.to];
    if (!rate) throw new Error(`No FX rate from Finnhub for ${ticker}`);
    return { priceCents: Math.round(rate * 100), currency: pair.to };
  }

  // ── Stock / ETF / Future ───────────────────────────────────────────────────
  const data = await finnhubGet(`/quote?symbol=${encodeURIComponent(ticker)}`, apiKey);
  const price = data.c;
  if (!price || price === 0) throw new Error(`No price from Finnhub for ${ticker}`);
  return { priceCents: Math.round(price * 100), currency: inferCurrencyFromTicker(ticker) };
}

// ── Yahoo Finance fallback ────────────────────────────────────────────────────

const YAHOO_URLS = (ticker) => [
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
  `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
];

const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

function parseYahooPriceData(payload) {
  const meta = payload?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (!price) return null;
  return {
    priceCents: Math.round(price * 100),
    currency: meta?.currency || 'USD',
  };
}

async function tryFetch(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return res;
  } catch {
    // swallow — try next candidate
  }
  return null;
}

async function fetchFromYahoo(ticker) {
  const pair = parseCurrencyPair(ticker);
  const yahooTicker = pair ? `${pair.from}${pair.to}=X` : ticker;
  const directUrls = YAHOO_URLS(yahooTicker);

  for (const url of directUrls) {
    const res = await tryFetch(url);
    if (res) {
      const data = await res.json();
      const priceData = parseYahooPriceData(data);
      if (priceData) return priceData;
    }
  }

  for (const makeProxy of PROXIES) {
    for (const url of directUrls) {
      const res = await tryFetch(makeProxy(url));
      if (res) {
        const data = await res.json();
        const priceData = parseYahooPriceData(data);
        if (priceData) return priceData;
      }
    }
  }

  throw new Error(`All price sources failed for ${ticker}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

// Returns { priceCents, currency } — price in the ticker's native currency.
export async function fetchTickerPrice(ticker, finnhubApiKey = '') {
  const cacheKey = `price-cache:${ticker}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < TTL_MS) {
      return { priceCents: parsed.priceCents, currency: parsed.currency };
    }
  }

  const result = finnhubApiKey
    ? await fetchFromFinnhub(ticker, finnhubApiKey)
    : await fetchFromYahoo(ticker);

  sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), ...result }));
  return result;
}

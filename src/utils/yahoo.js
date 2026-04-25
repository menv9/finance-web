const TTL_MS = 15 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Detect crypto/FX pairs like BTC/EUR, ETH/USD
function parseCurrencyPair(ticker) {
  const match = ticker.match(/^([A-Z]+)\/([A-Z]+)$/);
  return match ? { from: match[1], to: match[2] } : null;
}

// Infer price currency from ticker exchange suffix.
// Alpha Vantage GLOBAL_QUOTE doesn't return currency in the response,
// so we derive it from the exchange code appended to the symbol.
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

// ── Alpha Vantage ─────────────────────────────────────────────────────────────

async function fetchFromAlphaVantage(ticker, apiKey) {
  const pair = parseCurrencyPair(ticker);

  let url;
  if (pair) {
    url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${pair.from}&to_currency=${pair.to}&apikey=${encodeURIComponent(apiKey)}`;
  } else {
    url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data = await res.json();

  if (data.Note || data.Information) {
    throw new Error('Alpha Vantage rate limit reached — try again later');
  }

  let price;
  let currency;
  if (pair) {
    price = parseFloat(data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'] || '0');
    currency = pair.to;
  } else {
    price = parseFloat(data?.['Global Quote']?.['05. price'] || '0');
    currency = inferCurrencyFromTicker(ticker);
  }

  if (!price) throw new Error(`No price data from Alpha Vantage for ${ticker}`);
  return { priceCents: Math.round(price * 100), currency };
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
  // Translate FX pair format (USD/EUR) → Yahoo ticker (USDEUR=X)
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
export async function fetchTickerPrice(ticker, alphaVantageApiKey = '') {
  const cacheKey = `price-cache:${ticker}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < TTL_MS) {
      return { priceCents: parsed.priceCents, currency: parsed.currency };
    }
  }

  const result = alphaVantageApiKey
    ? await fetchFromAlphaVantage(ticker, alphaVantageApiKey)
    : await fetchFromYahoo(ticker);

  sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), ...result }));
  return result;
}

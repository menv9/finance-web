const TTL_MS = 15 * 60 * 1000;

// ── Alpha Vantage ─────────────────────────────────────────────────────────────

// Detect crypto/FX pairs like BTC/EUR, ETH/USD
function parseCurrencyPair(ticker) {
  const match = ticker.match(/^([A-Z]+)\/([A-Z]+)$/);
  return match ? { from: match[1], to: match[2] } : null;
}

async function fetchFromAlphaVantage(ticker, apiKey) {
  const pair = parseCurrencyPair(ticker);

  let url;
  if (pair) {
    // Crypto/FX pair — use exchange rate endpoint
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
  if (pair) {
    price = parseFloat(data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'] || '0');
  } else {
    price = parseFloat(data?.['Global Quote']?.['05. price'] || '0');
  }

  if (!price) throw new Error(`No price data from Alpha Vantage for ${ticker}`);
  return Math.round(price * 100);
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

function parseYahooPriceCents(payload) {
  const price = payload?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return price ? Math.round(price * 100) : 0;
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
  const directUrls = YAHOO_URLS(ticker);

  for (const url of directUrls) {
    const res = await tryFetch(url);
    if (res) {
      const data = await res.json();
      const priceCents = parseYahooPriceCents(data);
      if (priceCents) return priceCents;
    }
  }

  for (const makeProxy of PROXIES) {
    for (const url of directUrls) {
      const res = await tryFetch(makeProxy(url));
      if (res) {
        const data = await res.json();
        const priceCents = parseYahooPriceCents(data);
        if (priceCents) return priceCents;
      }
    }
  }

  throw new Error(`All price sources failed for ${ticker}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchTickerPriceCents(ticker, alphaVantageApiKey = '') {
  const cacheKey = `price-cache:${ticker}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < TTL_MS) {
      return parsed.priceCents;
    }
  }

  const priceCents = alphaVantageApiKey
    ? await fetchFromAlphaVantage(ticker, alphaVantageApiKey)
    : await fetchFromYahoo(ticker);

  sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), priceCents }));
  return priceCents;
}

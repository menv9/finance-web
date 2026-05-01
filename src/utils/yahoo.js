const TTL_MS = 15 * 60 * 1000;
const SEARCH_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const SEARCH_TIMEOUT_MS = 3500;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Detect crypto/FX pairs like BTC/EUR, ETH/USD
function parseCurrencyPair(ticker) {
  const match = ticker.match(/^([A-Z0-9]+)\/([A-Z]+)$/);
  return match ? { from: match[1], to: match[2] } : null;
}

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase();
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
  const symbolTicker = normalizeTicker(ticker);
  const pair = parseCurrencyPair(symbolTicker);

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
      throw new Error(`No crypto price from Finnhub for ${symbolTicker}`);
    }

    // Forex: use /forex/rates which returns all rates relative to a base
    const data = await finnhubGet(`/forex/rates?base=${pair.from}`, apiKey);
    const rate = data?.quote?.[pair.to];
    if (!rate) throw new Error(`No FX rate from Finnhub for ${symbolTicker}`);
    return { priceCents: Math.round(rate * 100), currency: pair.to };
  }

  // ── Stock / ETF / Future ───────────────────────────────────────────────────
  const data = await finnhubGet(`/quote?symbol=${encodeURIComponent(symbolTicker)}`, apiKey);
  const price = data.c;
  if (!price || price === 0) throw new Error(`No price from Finnhub for ${symbolTicker}`);
  return { priceCents: Math.round(price * 100), currency: inferCurrencyFromTicker(symbolTicker) };
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

const YAHOO_SEARCH_URLS = (query) => [
  `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
  `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
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
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller
    ? globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (res.ok) return res;
  } catch {
    // swallow — try next candidate
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
  }
  return null;
}

async function tryFetchJson(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
  }
}

async function firstJsonFromUrls(urls, timeoutMs = FETCH_TIMEOUT_MS) {
  const attempts = urls.map((url) => tryFetchJson(url, timeoutMs));
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

async function fetchFromYahoo(ticker) {
  const symbolTicker = normalizeTicker(ticker);
  const pair = parseCurrencyPair(symbolTicker);
  const yahooTicker = pair ? `${pair.from}${pair.to}=X` : symbolTicker;
  const directUrls = YAHOO_URLS(yahooTicker);
  const candidateUrls = [
    ...directUrls,
    ...PROXIES.flatMap((makeProxy) => directUrls.map((url) => makeProxy(url))),
  ];
  const data = await firstJsonFromUrls(candidateUrls);
  const priceData = parseYahooPriceData(data);
  if (priceData) return priceData;

  throw new Error(`Yahoo fallback failed for ${symbolTicker}`);
}

function uniqueAssets(results) {
  const seen = new Set();
  return results.filter((asset) => {
    if (!asset.ticker || seen.has(asset.ticker)) return false;
    seen.add(asset.ticker);
    return true;
  });
}

function normalizeFinnhubAsset(item) {
  const ticker = normalizeTicker(item?.symbol || item?.displaySymbol);
  if (!ticker) return null;
  return {
    ticker,
    name: item?.description || item?.displaySymbol || ticker,
    exchange: item?.mic || '',
    type: item?.type || '',
    currency: inferCurrencyFromTicker(ticker),
  };
}

function normalizeYahooAsset(item) {
  const ticker = normalizeTicker(item?.symbol);
  if (!ticker) return null;
  return {
    ticker,
    name: item?.longname || item?.shortname || item?.name || ticker,
    exchange: item?.exchDisp || item?.exchange || '',
    type: item?.quoteType || item?.typeDisp || '',
    currency: item?.currency || inferCurrencyFromTicker(ticker),
    priceCents: item?.regularMarketPrice ? Math.round(item.regularMarketPrice * 100) : null,
  };
}

async function searchFinnhubAssets(query, apiKey) {
  if (!apiKey) return [];
  const data = await finnhubGet(`/search?q=${encodeURIComponent(query)}`, apiKey);
  return uniqueAssets((data?.result || []).map(normalizeFinnhubAsset).filter(Boolean));
}

async function searchYahooAssets(query) {
  const directUrls = YAHOO_SEARCH_URLS(query);
  const candidateUrls = [
    ...directUrls,
    ...PROXIES.flatMap((makeProxy) => directUrls.map((url) => makeProxy(url))),
  ];
  const data = await firstJsonFromUrls(candidateUrls, SEARCH_TIMEOUT_MS);
  const assets = uniqueAssets((data?.quotes || []).map(normalizeYahooAsset).filter(Boolean));
  if (assets.length) return assets;

  return [];
}

function readSearchCache(cacheKey) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < SEARCH_TTL_MS) return parsed.results || [];
  } catch {
    return null;
  }
  return null;
}

function writeSearchCache(cacheKey, results) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), results }));
  } catch {
    // Ignore cache write failures.
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Returns { priceCents, currency } — price in the ticker's native currency.
export async function fetchTickerPrice(ticker, finnhubApiKey = '') {
  const symbolTicker = normalizeTicker(ticker);
  if (!symbolTicker) throw new Error('Missing ticker symbol');
  const cacheKey = `price-cache:${symbolTicker}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < TTL_MS) {
      return { priceCents: parsed.priceCents, currency: parsed.currency };
    }
  }

  let result;
  if (finnhubApiKey) {
    try {
      result = await fetchFromFinnhub(symbolTicker, finnhubApiKey);
    } catch (finnhubError) {
      try {
        result = await fetchFromYahoo(symbolTicker);
      } catch (fallbackError) {
        throw new Error(
          `${symbolTicker}: ${finnhubError.message}; ${fallbackError.message}. Check your Finnhub API key and ticker format.`,
        );
      }
    }
  } else {
    try {
      result = await fetchFromYahoo(symbolTicker);
    } catch (error) {
      throw new Error(`${symbolTicker}: ${error.message}. Add a Finnhub API key in Settings for more reliable refreshes.`);
    }
  }

  sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), ...result }));
  return result;
}

export async function searchAssets(query, finnhubApiKey = '') {
  const searchQuery = String(query || '').trim();
  if (searchQuery.length < 2) return [];
  const cacheKey = `asset-search:${searchQuery.toLowerCase()}:${finnhubApiKey ? 'fh' : 'yh'}`;
  const cached = readSearchCache(cacheKey);
  if (cached) return cached;

  if (finnhubApiKey) {
    try {
      const results = await searchFinnhubAssets(searchQuery, finnhubApiKey);
      if (results.length) {
        writeSearchCache(cacheKey, results);
        return results;
      }
    } catch {
      // Fall through to Yahoo search.
    }
  }

  const results = await searchYahooAssets(searchQuery);
  writeSearchCache(cacheKey, results);
  return results;
}

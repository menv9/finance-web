const TTL_MS = 15 * 60 * 1000;

const YAHOO_URL = (ticker) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

// Attempt a fetch directly; if blocked by CORS fall back to a proxy.
async function fetchWithCORSFallback(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return res;
  } catch {
    // CORS or network error — fall through to proxy
  }
  const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  return fetch(proxy);
}

function parsePriceCents(payload) {
  const result = payload?.chart?.result?.[0];
  const price = result?.meta?.regularMarketPrice;
  return Math.round((price || 0) * 100);
}

export async function fetchTickerPriceCents(ticker) {
  const cacheKey = `price-cache:${ticker}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < TTL_MS) {
      return parsed.priceCents;
    }
  }

  const response = await fetchWithCORSFallback(YAHOO_URL(ticker));

  if (!response.ok) {
    throw new Error(`Unable to refresh ${ticker} (HTTP ${response.status})`);
  }

  const payload = await response.json();
  const priceCents = parsePriceCents(payload);

  if (!priceCents) {
    throw new Error(`No price data returned for ${ticker}`);
  }

  sessionStorage.setItem(
    cacheKey,
    JSON.stringify({ timestamp: Date.now(), priceCents }),
  );

  return priceCents;
}

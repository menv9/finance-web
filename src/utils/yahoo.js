const TTL_MS = 15 * 60 * 1000;

export async function fetchTickerPriceCents(ticker) {
  const cacheKey = `price-cache:${ticker}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < TTL_MS) {
      return parsed.priceCents;
    }
  }

  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`);
  if (!response.ok) {
    throw new Error(`Unable to refresh ${ticker}`);
  }

  const payload = await response.json();
  const quote = payload?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const currency = payload?.chart?.result?.[0]?.meta?.currency || 'EUR';
  const priceCents = Math.round((quote || 0) * 100);

  sessionStorage.setItem(
    cacheKey,
    JSON.stringify({
      timestamp: Date.now(),
      priceCents,
      currency,
    }),
  );

  return priceCents;
}

// Compact formatter for chart Y-axes — keeps labels short on mobile
// e.g. € 1.400,00 → € 1,4K
export function formatCurrencyCompact(amountCents, currency = 'EUR', locale = 'en-GB') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format((amountCents || 0) / 100);
}

export function formatCurrency(amountCents, currency = 'EUR', locale = 'en-GB') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format((amountCents || 0) / 100);
}

export function formatPercent(value, locale = 'en-GB', digits = 1) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format((value || 0) / 100);
}

export function formatNumber(value, locale = 'en-GB', digits = 2) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

// Robustly parse a user-entered monetary amount into whole cents.
// Returns null for empty, non-numeric, Infinity, or NaN inputs.
export function parseMoneyCents(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

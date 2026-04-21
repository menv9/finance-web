export function formatCurrency(amountCents, currency = 'EUR', locale = 'de-AT') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format((amountCents || 0) / 100);
}

export function formatPercent(value, locale = 'de-AT', digits = 1) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format((value || 0) / 100);
}

export function formatNumber(value, locale = 'de-AT', digits = 2) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

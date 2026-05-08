import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPortfolioNews, clearNewsCache } from '../utils/yahoo';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import LWAreaChart from '../components/charts/LWAreaChart';
import LWGroupedHistogram from '../components/charts/LWGroupedHistogram';
import LWSalesChart from '../components/charts/LWSalesChart';
import { PageHeader } from '../components/PageHeader';
import { DividendForm } from '../components/forms/DividendForm';
import { HoldingForm } from '../components/forms/HoldingForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatCurrencyCompact, formatNumber } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { assignedPortfolioHoldings, assignedPortfolioRecords, computePortfolioMetrics } from '../utils/finance';
import { Card, Button, Stat, Table, EmptyState, Modal, FormField, Input, Select, cn } from '../components/ui';
import { rise } from '../utils/motion';
import { useTranslation } from '../i18n/useTranslation';
import { ChevronDown } from 'lucide-react';

const COLORS = [
  'var(--accent)',
  '#8FB97E',
  '#C9A96E',
  '#7A9CC6',
  '#B48EAD',
  '#6E8E8A',
  'var(--danger)',
];

function quantityDigits(holding) {
  if (Number.isInteger(holding.quantityDecimals)) {
    return Math.min(Math.max(holding.quantityDecimals, 0), 20);
  }
  const [, decimals = ''] = `${holding.quantity ?? ''}`.split('.');
  return Math.min(decimals.length, 20);
}

// Convert native-currency cents to base currency using FX rates.
// Falls back to 1:1 if rates are not available yet.
function applyFx(cents, currency, fxRates, baseCurrency) {
  if (!cents || !currency || currency === baseCurrency) return cents || 0;
  const rate = fxRates[currency];
  return rate != null ? Math.round(cents * rate) : cents;
}

function formatHourlyLabel(timestamp, locale) {
  return new Intl.DateTimeFormat(locale || 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
  }).format(new Date(timestamp));
}

function formatPortfolioPeriodLabel(timestamp, period, locale) {
  const date = new Date(timestamp);
  if (period === '1d') {
    return new Intl.DateTimeFormat(locale || 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  if (period === '1w') {
    return new Intl.DateTimeFormat(locale || 'en-GB', { weekday: 'short', day: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(locale || 'en-GB', { month: 'short', day: 'numeric' }).format(date);
}

function getPortfolioPeriodWindow(period, now = Date.now()) {
  const end = now;
  const startDate = new Date(now);
  if (period === '1d') {
    startDate.setDate(startDate.getDate() - 1);
  } else if (period === '1w') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '6m') {
    startDate.setMonth(startDate.getMonth() - 6);
  } else if (period === '1y') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }
  return [startDate.getTime(), end];
}

function buildCostAtDateFn(cashflows, portfolioSales, holdings = [], fxRates = {}, baseCurrency = 'EUR') {
  const buyHoldingIds = new Set((cashflows || [])
    .filter((cf) => cf.kind === 'buy' && cf.holdingId)
    .map((cf) => cf.holdingId));
  const events = [
    ...(cashflows || [])
      .filter((cf) => cf.kind === 'buy' && cf.date)
      .map((cf) => ({ date: cf.date, delta: Math.abs(cf.amountCents || 0) })),
    ...(holdings || [])
      .filter((holding) => !buyHoldingIds.has(holding.id))
      .map((holding) => {
        const date = holding.purchaseDate || holding.createdAt?.slice(0, 10);
        if (!date) return null;
        const nativeCost = Math.round(Number(holding.quantity || 0) * (holding.averageBuyPriceCents || 0));
        const baseCost = applyFx(nativeCost, holding.currency, fxRates, baseCurrency);
        const fee = applyFx(holding.feeCents || 0, holding.feeCurrency || holding.currency, fxRates, baseCurrency);
        return { date, delta: baseCost + fee };
      })
      .filter(Boolean),
    ...(portfolioSales || [])
      .filter((sale) => sale.date && sale.costBasisCents)
      .map((sale) => ({ date: sale.date, delta: -(sale.costBasisCents || 0) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (isoTimestamp) => {
    const day = isoTimestamp.slice(0, 10);
    let cost = 0;
    for (const event of events) {
      if (event.date <= day) cost += event.delta;
      else break;
    }
    return Math.max(0, cost);
  };
}

function buildPortfolioValueSeries(snapshots, currentValueCents, locale, period = '1m', investedCents = 0, cashflows = [], portfolioSales = [], holdings = [], fxRates = {}, baseCurrency = 'EUR') {
  const costAtDate = buildCostAtDateFn(cashflows, portfolioSales, holdings, fxRates, baseCurrency);
  const sorted = (snapshots || [])
    .filter((snapshot) => snapshot?.capturedAt)
    .slice()
    .sort((a, b) => (a.capturedAt || '').localeCompare(b.capturedAt || ''));
  const recent = period === 'all'
    ? sorted
    : (() => {
        const [windowStart] = getPortfolioPeriodWindow(period);
        const inWindow = sorted.filter((s) => new Date(s.capturedAt).getTime() >= windowStart);
        if (inWindow.length && inWindow[0] !== sorted[0]) {
          const priorIdx = sorted.indexOf(inWindow[0]) - 1;
          if (priorIdx >= 0) return [sorted[priorIdx], ...inWindow];
        }
        return inWindow;
      })();
  const series = recent.map((snapshot) => {
    const historicalCost = snapshot.costCents > 0 ? snapshot.costCents : costAtDate(snapshot.capturedAt);
    return {
      ...snapshot,
      costCents: snapshot.valueCents > 0 ? (historicalCost || null) : null,
      label: formatHourlyLabel(snapshot.capturedAt, locale),
    };
  });
  // Prepend a purchase-start point at cost basis level so the green line starts
  // at the same height as the red cost line on the first purchase date
  if (series.length > 0 && investedCents > 0) {
    const firstTs = new Date(series[0].capturedAt).getTime() - 1000;
    const startCost = series[0].costCents || investedCents;
    series.unshift({
      id: 'purchase-start',
      capturedAt: new Date(firstTs).toISOString(),
      valueCents: startCost,
      costCents: startCost,
      label: formatHourlyLabel(new Date(firstTs).toISOString(), locale),
    });
  }
  if (currentValueCents > 0) {
    const capturedAt = new Date().toISOString();
    const liveCost = costAtDate(capturedAt) || investedCents || null;
    const livePoint = {
      id: 'live',
      capturedAt,
      valueCents: currentValueCents,
      costCents: liveCost,
      label: formatHourlyLabel(capturedAt, locale),
    };
    if (!series.length) return [livePoint];

    const last = series[series.length - 1];
    const lastCapturedAt = new Date(last.capturedAt).getTime();
    const liveCapturedAt = new Date(capturedAt).getTime();
    const lastIsCurrentHour = last.id === `psn-${capturedAt.slice(0, 13)}` || Math.abs(liveCapturedAt - lastCapturedAt) < 60_000;
    if (lastIsCurrentHour) {
      return [...series.slice(0, -1), { ...last, valueCents: currentValueCents, costCents: liveCost || last.costCents }];
    }
    return [...series, livePoint];
  }
  return series;
}

function filterPortfolioValueSeries(series, period, locale) {
  const mapped = (series || []).map((point) => ({
    ...point,
    capturedAtMs: new Date(point.capturedAt).getTime(),
    label: formatPortfolioPeriodLabel(point.capturedAt, period, locale),
  }));

  if (period === 'all') return mapped;

  const [start, end] = getPortfolioPeriodWindow(period);
  const points = mapped.filter((point) => point.capturedAtMs >= start && point.capturedAtMs <= end);
  if (!points.length) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const boundedPoints = [...points];
  if (first.capturedAtMs > start) {
    const prior = mapped.filter((p) => p.capturedAtMs < start);
    const priorPoint = prior.length > 0 ? prior[prior.length - 1] : null;
    if (priorPoint) {
      // Interpolate from the last known value before this period
      boundedPoints.unshift({
        ...first,
        id: first.id + '-period-start',
        capturedAt: new Date(start).toISOString(),
        capturedAtMs: start,
        valueCents: priorPoint.valueCents,
        costCents: priorPoint.costCents,
        label: formatPortfolioPeriodLabel(start, period, locale),
      });
    }
    // No prior data → don't add a phantom 0-point; domain clamping hides the empty gap
  }
  if (last.capturedAtMs < end) {
    boundedPoints.push({
      ...last,
      id: last.id + '-period-end',
      capturedAt: new Date(end).toISOString(),
      capturedAtMs: end,
      label: formatPortfolioPeriodLabel(end, period, locale),
    });
  }
  return boundedPoints;
}

function groupHoldingsByTicker(holdings, fxRates = {}, baseCurrency = 'EUR') {
  const groups = new Map();
  for (const holding of holdings) {
    const key = holding.ticker;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(holding);
  }
  return [...groups.entries()].map(([ticker, lots]) => {
    const quantity = lots.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
    // Native-currency totals (for per-unit price display)
    const nativeValueCents = lots.reduce(
      (sum, h) => sum + Math.round(Number(h.quantity || 0) * (h.currentPriceCents || 0)), 0,
    );
    const nativePriceCostCents = lots.reduce(
      (sum, h) => sum + Math.round(Number(h.quantity || 0) * (h.averageBuyPriceCents || 0)), 0,
    );
    // Base-currency totals (for value & P&L display)
    const valueCents = lots.reduce((sum, h) => {
      const native = Math.round(Number(h.quantity || 0) * (h.currentPriceCents || 0));
      return sum + applyFx(native, h.currency, fxRates, baseCurrency);
    }, 0);
    const costCents = lots.reduce((sum, h) => {
      const nativeCost = Math.round(Number(h.quantity || 0) * (h.averageBuyPriceCents || 0));
      const baseCost = applyFx(nativeCost, h.currency, fxRates, baseCurrency);
      const feeCurr = h.feeCurrency || h.currency;
      const baseFee = applyFx(h.feeCents || 0, feeCurr, fxRates, baseCurrency);
      return sum + baseCost + baseFee;
    }, 0);
    // Group-level fee total in base currency (for display)
    const feeCents = lots.reduce((sum, h) => {
      const feeCurr = h.feeCurrency || h.currency;
      return sum + applyFx(h.feeCents || 0, feeCurr, fxRates, baseCurrency);
    }, 0);
    const quantityDecimals = Math.max(...lots.map((holding) => quantityDigits(holding)), 0);
    // Native per-unit prices for display (in the holding's own currency)
    const currency = lots[0]?.currency || baseCurrency;
    return {
      id: `group-${ticker}`,
      rowType: 'group',
      ticker,
      name: lots[0]?.name || ticker,
      platform: lots.length > 1 ? `${lots.length} operations` : lots[0]?.platform,
      quantity,
      quantityDecimals,
      currency,
      // Prices in native currency (for display)
      averageBuyPriceCents: quantity ? Math.round(nativePriceCostCents / quantity) : 0,
      currentPriceCents: quantity ? Math.round(nativeValueCents / quantity) : 0,
      // Values in base currency (for P&L and sorting)
      valueCents,
      costCents,
      feeCents,
      pnlCents: valueCents - costCents,
      pnlPct: costCents ? ((valueCents - costCents) / costCents) * 100 : 0,
      rowClassName: 'bg-surface-raised',
      lots: lots.slice().sort((a, b) => (a.createdAt || a.id || '').localeCompare(b.createdAt || b.id || '')),
    };
  }).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function buildLotMetrics(holding, fxRates, baseCurrency) {
  const native = Math.round(Number(holding.quantity || 0) * (holding.currentPriceCents || 0));
  const nativeCost = Math.round(Number(holding.quantity || 0) * (holding.averageBuyPriceCents || 0));
  const valueCents = applyFx(native, holding.currency, fxRates, baseCurrency);
  const costCents = applyFx(nativeCost, holding.currency, fxRates, baseCurrency)
    + applyFx(holding.feeCents || 0, holding.feeCurrency || holding.currency, fxRates, baseCurrency);
  const pnlCents = valueCents - costCents;
  return { valueCents, costCents, pnlCents, pnlPct: costCents ? (pnlCents / costCents) * 100 : 0 };
}

function groupSalesByTicker(sales) {
  const groups = new Map();
  for (const sale of sales) {
    const key = sale.ticker;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sale);
  }
  return [...groups.entries()].map(([ticker, lots]) => {
    const quantity = lots.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
    const proceedsCents = lots.reduce((sum, sale) => sum + (sale.proceedsCents || 0), 0);
    const feeCents = lots.reduce((sum, sale) => sum + (sale.feeCents || 0), 0);
    const grossProceedsCents = lots.reduce((sum, sale) => sum + (sale.grossProceedsCents || sale.proceedsCents || 0), 0);
    const costBasisCents = lots.reduce((sum, sale) => sum + (sale.costBasisCents || 0), 0);
    const realizedPnlCents = lots.reduce((sum, sale) => sum + (sale.realizedPnlCents || 0), 0);
    const quantityDecimals = Math.max(...lots.map((sale) => quantityDigits(sale)), 0);
    const sortedLots = lots.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return {
      id: `sales-group-${ticker}`,
      rowType: 'group',
      date: sortedLots[0]?.date || '',
      ticker,
      name: sortedLots[0]?.name || ticker,
      quantity,
      quantityDecimals,
      percent: sortedLots.length,
      salePriceCents: quantity ? Math.round(grossProceedsCents / quantity) : 0,
      proceedsCents,
      feeCents,
      costBasisCents,
      realizedPnlCents,
      realizedPnlPct: costBasisCents ? (realizedPnlCents / costBasisCents) * 100 : 0,
      rowClassName: 'bg-surface-raised',
      lots: sortedLots,
    };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.ticker.localeCompare(b.ticker));
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M9.8 3.2 12.8 6 6 12.8l-3.4.7.7-3.4 6.5-6.9Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.7 4.4 2.9 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M3.5 4.5h9M6.5 2.5h3l.5 2M5 4.5l.5 9h5l.5-9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7v4M9 7v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SellIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M3 8h9M9 5l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12.5h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PortfolioHoldingList({
  groups,
  currency,
  locale,
  fxRates,
  openEditHoldingGroup,
  openAddHoldingOperation,
  openEditHolding,
  openSellHolding,
  sellAllHoldingGroup,
  onDeleteHolding,
}) {
  const { t } = useTranslation();
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const toggleGroup = (ticker) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const gainClass = (value) =>
    value > 0 ? 'text-positive' : value < 0 ? 'text-danger' : 'text-ink-muted';
  const signedCurrency = (valueCents) => {
    const sign = valueCents > 0 ? '+' : valueCents < 0 ? '-' : '';
    return sign + formatCurrency(Math.abs(valueCents || 0), currency, locale).replace(/^-/, '');
  };
  const signedPercent = (value) => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return sign + formatNumber(Math.abs(value || 0), locale, 2) + '%';
  };
  const currencySymbol =
    new Intl.NumberFormat(locale || 'en-GB', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value || currency;

  const rows = groups.flatMap((group) => {
    const isOpen = openGroups.has(group.ticker);
    const groupRow = {
      ...group,
      id: group.id,
      rowType: 'group',
      symbol: group.ticker,
      lastPriceCents: group.currentPriceCents,
      priceCurrency: group.currency || currency,
      totalCostCents: group.costCents,
      marketValueCents: group.valueCents,
      dayGainPct: 0,
      dayGainCents: 0,
      totalGainPct: group.pnlPct,
      totalGainCents: group.pnlCents,
      isOpen,
      rowClassName: 'bg-surface-raised',
    };
    if (!isOpen) return [groupRow];
    return [
      groupRow,
      ...group.lots.map((holding, index) => {
        const { valueCents, costCents, pnlCents, pnlPct } = buildLotMetrics(holding, fxRates, currency);
        return {
          ...holding,
          id: holding.id,
          rowType: 'lot',
          parentTicker: group.ticker,
          operationNumber: index + 1,
          symbol: t('portfolio.tableHeaders.operation', { num: index + 1 }),
          lastPriceCents: holding.currentPriceCents || 0,
          priceCurrency: holding.currency || currency,
          totalCostCents: costCents,
          marketValueCents: valueCents,
          dayGainPct: 0,
          dayGainCents: 0,
          totalGainPct: pnlPct,
          totalGainCents: pnlCents,
          rowClassName: 'bg-surface',
        };
      }),
    ];
  });

  const columns = [
    {
      key: 'symbol',
      header: 'Symbol',
      width: 150,
      noTruncate: true,
      cellText: (row) => row.rowType === 'group'
        ? [row.ticker, row.name].filter(Boolean).join(' - ')
        : [row.symbol, row.platform].filter(Boolean).join(' - '),
      render: (row) => (
        <div className={cn('flex min-w-0 items-center gap-2', row.rowType === 'lot' && 'pl-8')}>
          {row.rowType === 'group' ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
              aria-label={(row.isOpen ? 'Hide' : 'Show') + ' ' + row.ticker + ' trades'}
              title={(row.isOpen ? 'Hide' : 'Show') + ' trades'}
              aria-expanded={row.isOpen}
              onClick={() => toggleGroup(row.ticker)}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-150', row.isOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="h-7 w-7 shrink-0" />
          )}
          <div className="min-w-0 text-left">
            <p className={cn('truncate font-mono text-sm font-semibold', row.rowType === 'group' ? 'text-accent' : 'text-ink-muted')}>
              {row.rowType === 'group' ? row.ticker : row.symbol}
            </p>
            <p className="truncate text-xs text-ink-faint">
              {row.rowType === 'group' ? row.name : row.platform || t('common.none')}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Shares',
      numeric: true,
      width: 76,
      cellText: (row) => formatNumber(row.quantity, locale, quantityDigits(row)),
      render: (row) => (
        <>
          <span className="sm:hidden">{formatNumber(row.quantity, locale, Math.min(quantityDigits(row), 2))}</span>
          <span className="hidden sm:inline">{formatNumber(row.quantity, locale, Math.min(quantityDigits(row), 5))}</span>
        </>
      ),
    },
    {
      key: 'lastPriceCents',
      header: 'Last Price',
      numeric: true,
      width: 94,
      cellText: (row) => formatCurrency(row.lastPriceCents, row.priceCurrency, locale),
      render: (row) => formatCurrency(row.lastPriceCents, row.priceCurrency, locale),
    },
    {
      key: 'totalCostCents',
      header: 'Total Cost (' + currencySymbol + ')',
      numeric: true,
      width: 104,
      cellText: (row) => formatCurrency(row.totalCostCents, currency, locale),
      render: (row) => formatCurrency(row.totalCostCents, currency, locale),
    },
    {
      key: 'marketValueCents',
      header: 'Market Value (' + currencySymbol + ')',
      numeric: true,
      width: 112,
      cellText: (row) => formatCurrency(row.marketValueCents, currency, locale),
      render: (row) => formatCurrency(row.marketValueCents, currency, locale),
    },
    {
      key: 'dayGainPct',
      header: 'Day Gain UNRL (%)',
      numeric: true,
      width: 106,
      cellText: (row) => signedPercent(row.dayGainPct),
      render: (row) => <span className={gainClass(row.dayGainPct)}>{signedPercent(row.dayGainPct)}</span>,
    },
    {
      key: 'dayGainCents',
      header: 'Day Gain UNRL (' + currencySymbol + ')',
      numeric: true,
      width: 112,
      cellText: (row) => signedCurrency(row.dayGainCents),
      render: (row) => <span className={gainClass(row.dayGainCents)}>{signedCurrency(row.dayGainCents)}</span>,
    },
    {
      key: 'totalGainPct',
      header: 'Tot Gain UNRL (%)',
      numeric: true,
      width: 108,
      cellText: (row) => signedPercent(row.totalGainPct),
      render: (row) => <span className={gainClass(row.totalGainPct)}>{signedPercent(row.totalGainPct)}</span>,
    },
    {
      key: 'totalGainCents',
      header: 'Tot Gain UNRL (' + currencySymbol + ')',
      numeric: true,
      width: 112,
      cellText: (row) => signedCurrency(row.totalGainCents),
      render: (row) => <span className={gainClass(row.totalGainCents)}>{signedCurrency(row.totalGainCents)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 104,
      noTruncate: true,
      render: (row) => (
        row.rowType === 'group' ? (
          <div className="inline-flex shrink-0 items-center justify-end gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-accent"
              aria-label={t('portfolio.holdingsCard.ariaAddOperation', { ticker: row.ticker })}
              title={t('portfolio.addHolding')}
              onClick={() => openAddHoldingOperation(row)}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
              aria-label={t('portfolio.holdingsCard.ariaEdit', { ticker: row.ticker })}
              title={t('common.edit')}
              onClick={() => openEditHoldingGroup(row.ticker)}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-accent"
              aria-label={t('portfolio.holdingsCard.ariaSellAll', { ticker: row.ticker })}
              title={t('portfolio.sellAll')}
              onClick={() => sellAllHoldingGroup(row)}
            >
              <SellIcon />
            </button>
          </div>
        ) : (
          <div className="inline-flex shrink-0 items-center justify-end gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
              aria-label={t('portfolio.holdingsCard.ariaEditOperation', { ticker: row.ticker, num: row.operationNumber })}
              title={t('common.edit')}
              onClick={() => openEditHolding(row.id)}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-accent"
              aria-label={t('portfolio.holdingsCard.ariaSellOperation', { ticker: row.ticker, num: row.operationNumber })}
              title={t('portfolio.sellAll')}
              onClick={() => openSellHolding(row.id)}
            >
              <SellIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
              aria-label={t('portfolio.holdingsCard.ariaDeleteOperation', { ticker: row.ticker, num: row.operationNumber })}
              title={t('common.delete')}
              onClick={() => onDeleteHolding(row)}
            >
              <TrashIcon />
            </button>
          </div>
        )
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      density="compact"
      className="rounded-lg"
      allowHorizontalScroll
      stickyFirstColumn
      caption={t('portfolio.holdingsCard.title')}
    />
  );
}

function PortfolioForm({ initialValue, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initialValue?.name || '',
    description: initialValue?.description || '',
    color: initialValue?.color || '#0f5132',
  });
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...initialValue, ...form, name: form.name.trim() || 'Portfolio' });
      }}
    >
      <FormField label="Portfolio name" htmlFor="portfolio-name" required>
        {(props) => <Input {...props} value={form.name} onChange={set('name')} placeholder="Main Portfolio" required />}
      </FormField>
      <FormField label="Description" htmlFor="portfolio-description">
        {(props) => <Input {...props} value={form.description} onChange={set('description')} placeholder="Long-term holdings, broker, strategy..." />}
      </FormField>
      <FormField label="Color" htmlFor="portfolio-color">
        {(props) => <Input {...props} type="color" value={form.color} onChange={set('color')} />}
      </FormField>
      <div className="flex justify-end gap-2 border-t border-rule pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">{initialValue?.id ? 'Save changes' : 'Create portfolio'}</Button>
      </div>
    </form>
  );
}

function SellHoldingForm({ holding, sale, currency, locale, fxRates, bankAccounts = [], onSubmit, onCancel }) {
  const { t } = useTranslation();
  const holdingCurrency = holding?.currency || currency;
  const rawFxRate = holdingCurrency !== currency
    ? (fxRates[holdingCurrency] ?? 1)
    : 1;
  const fxRate = Number.isFinite(rawFxRate) && rawFxRate > 0 ? rawFxRate : 1;
  const defaultBankAccountId = sale?.bankAccountId || bankAccounts.find((account) => account.isMain)?.id || bankAccounts[0]?.id || '';

  const [form, setForm] = useState({
    percent: sale?.percent != null ? `${sale.percent}` : '100',
    salePrice: sale?.salePriceCents != null
      ? `${sale.salePriceCents / 100}`
      : holding?.currentPriceCents
        ? `${holding.currentPriceCents / 100}`
        : '',
    fee: sale?.feeCents ? `${sale.feeCents / 100}` : '',
    date: sale?.date || normalizeDateInput(new Date()),
    bankAccountId: defaultBankAccountId,
  });

  const percent = Math.min(Math.max(Number(form.percent || 0), 0), 100);
  // Sale price is entered in holding's native currency
  const salePriceCents = Math.round(Number(form.salePrice || 0) * 100);
  const feeCents = Math.round(Number(form.fee || 0) * 100);
  const soldQuantity = (holding?.quantity || 0) * (percent / 100);
  // Proceeds in native currency, then convert to base for P&L display
  const grossProceedsNative = Math.round(soldQuantity * salePriceCents);
  const proceedsNative = Math.max(0, grossProceedsNative - feeCents);
  const holdingFeeCents = Math.round((holding?.feeCents || 0) * (percent / 100));
  const costBasisNative = Math.round(soldQuantity * (holding?.averageBuyPriceCents || 0)) + holdingFeeCents;
  // Convert to base currency for display
  const proceedsCents = Math.round(proceedsNative * fxRate);
  const costBasisCents = Math.round(costBasisNative * fxRate);
  const realizedPnlCents = proceedsCents - costBasisCents;
  const realizedPnlPct = costBasisCents ? (realizedPnlCents / costBasisCents) * 100 : 0;

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          holdingId: holding.id,
          saleId: sale?.id,
          percent,
          salePriceCents,
          feeCents,
          date: form.date,
          bankAccountId: bankAccounts.length ? form.bankAccountId || defaultBankAccountId : null,
        });
      }}
    >
      <FormField label={t('portfolio.sellModal.holdingLabel')} className="md:col-span-2">
        <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-sm text-ink">
          <span className="font-mono">{holding.ticker}</span>
          <span className="ml-2 text-ink-muted">{holding.name}</span>
        </div>
      </FormField>

      <FormField label={t('portfolio.sellModal.sellPercentLabel')} htmlFor="sell-percent" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={form.percent}
            onChange={set('percent')}
          />
        )}
      </FormField>

      <FormField label={t('portfolio.sellModal.salePriceLabel', { currency: holdingCurrency })} htmlFor="sell-price" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            min="0"
            step="0.01"
            value={form.salePrice}
            onChange={set('salePrice')}
          />
        )}
      </FormField>

      <FormField label={t('portfolio.sellModal.saleDateLabel')} htmlFor="sell-date" required>
        {(props) => (
          <Input
            {...props}
            type="date"
            value={form.date}
            onChange={set('date')}
          />
        )}
      </FormField>

      <FormField label={t('portfolio.sellModal.commissionLabel')} htmlFor="sell-fee">
        {(props) => (
          <Input
            {...props}
            type="number"
            min="0"
            step="0.01"
            value={form.fee}
            onChange={set('fee')}
            placeholder="0.00"
          />
        )}
      </FormField>

      {bankAccounts.length ? (
        <FormField label={t('portfolio.sellModal.destinationBank')} htmlFor="sell-bank" required className="md:col-span-2">
          {(props) => (
            <Select
              {...props}
              value={form.bankAccountId || defaultBankAccountId}
              onChange={set('bankAccountId')}
              required
            >
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isMain ? t('portfolio.sellModal.mainSuffix') : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-sm">
        <p className="eyebrow text-ink-muted">{t('portfolio.sellModal.estimatedResult')}</p>
        <p className="mt-1 font-mono text-ink">
          {formatNumber(soldQuantity, locale, quantityDigits(holding))} qty
          {' — '}
          {formatCurrency(proceedsNative, holdingCurrency, locale)}
          {holdingCurrency !== currency && (
            <span className="ml-1 text-ink-muted">≈ {formatCurrency(proceedsCents, currency, locale)}</span>
          )}
        </p>
        <p className={realizedPnlCents >= 0 ? 'mt-1 text-positive' : 'mt-1 text-danger'}>
          {formatCurrency(realizedPnlCents, currency, locale)}
          <span className="ml-1 text-xs text-ink-muted">({formatNumber(realizedPnlPct, locale, 2)}%)</span>
        </p>
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {sale ? t('portfolio.sellModal.saveSale') : t('portfolio.sellModal.sellHolding')}
        </Button>
      </div>
    </form>
  );
}

function SellAllHoldingsForm({ group, bankAccounts = [], onSubmit, onCancel }) {
  const { t } = useTranslation();
  const defaultBankAccountId = bankAccounts.find((account) => account.isMain)?.id || bankAccounts[0]?.id || '';
  const [form, setForm] = useState({
    date: normalizeDateInput(new Date()),
    bankAccountId: defaultBankAccountId,
  });
  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          date: form.date,
          bankAccountId: bankAccounts.length ? form.bankAccountId || defaultBankAccountId : null,
        });
      }}
    >
      <FormField label={t('portfolio.sellAllModal.holdingLabel')} className="md:col-span-2">
        <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-sm text-ink">
          <span className="font-mono">{group.ticker}</span>
          <span className="ml-2 text-ink-muted">{group.name}</span>
        </div>
      </FormField>

      <FormField label={t('portfolio.sellAllModal.saleDateLabel')} htmlFor="sell-all-date" required>
        {(props) => (
          <Input {...props} type="date" value={form.date} onChange={set('date')} required />
        )}
      </FormField>

      {bankAccounts.length ? (
        <FormField label={t('portfolio.sellAllModal.destinationBank')} htmlFor="sell-all-bank" required>
          {(props) => (
            <Select
              {...props}
              value={form.bankAccountId || defaultBankAccountId}
              onChange={set('bankAccountId')}
              required
            >
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isMain ? t('portfolio.sellAllModal.mainSuffix') : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      <p className="md:col-span-2 rounded-md border border-rule bg-surface-raised px-3 py-2 text-xs text-ink-muted">
        {t('portfolio.sellAllModal.notice')}
      </p>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('portfolio.sellAllModal.sellAll')}
        </Button>
      </div>
    </form>
  );
}

const PRICE_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD',
  'SEK', 'NOK', 'DKK', 'HKD', 'SGD', 'INR', 'CNY',
  'MXN', 'BRL', 'PLN', 'CZK', 'HUF', 'TRY',
];

function HoldingGroupForm({ group, baseCurrency, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const currencies = PRICE_CURRENCIES.includes(baseCurrency)
    ? PRICE_CURRENCIES
    : [baseCurrency, ...PRICE_CURRENCIES];

  const [form, setForm] = useState({
    name: group?.name || '',
    platform: group?.lots?.[0]?.platform || '',
    currentPrice: group?.currentPriceCents ? `${group.currentPriceCents / 100}` : '',
    currency: group?.currency || baseCurrency,
  });

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ticker: group.ticker,
          name: form.name,
          platform: form.platform,
          currentPriceCents: Math.round(Number(form.currentPrice || 0) * 100),
          currency: form.currency,
        });
      }}
    >
      <FormField label={t('portfolio.holdingGroupModal.tickerLabel')} className="md:col-span-2">
        <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 font-mono text-sm text-ink">
          {group.ticker}
        </div>
      </FormField>

      <FormField label={t('portfolio.holdingGroupModal.nameLabel')} htmlFor="holding-group-name">
        {(props) => (
          <Input {...props} value={form.name} onChange={set('name')} placeholder={t('portfolio.holdingGroupModal.namePlaceholder')} />
        )}
      </FormField>

      <FormField label={t('portfolio.holdingGroupModal.platformLabel')} htmlFor="holding-group-platform">
        {(props) => (
          <Input {...props} value={form.platform} onChange={set('platform')} placeholder={t('portfolio.holdingGroupModal.platformPlaceholder')} />
        )}
      </FormField>

      <FormField label={t('portfolio.holdingGroupModal.currentPriceLabel', { currency: form.currency })} htmlFor="holding-group-current-price" className="md:col-span-2">
        {() => (
          <div className="flex rounded-md overflow-hidden border border-rule bg-surface focus-within:ring-1 focus-within:ring-accent">
            <input
              id="holding-group-current-price"
              type="number"
              step="0.01"
              min="0"
              value={form.currentPrice}
              onChange={set('currentPrice')}
              placeholder="0.00"
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none"
            />
            <select
              value={form.currency}
              onChange={set('currency')}
              aria-label={t('portfolio.holdingGroupModal.currencyAriaLabel')}
              className="shrink-0 border-l border-rule bg-surface-raised text-xs font-mono text-ink-muted px-2 outline-none cursor-pointer hover:bg-surface-sunken"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </FormField>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('portfolio.holdingGroupModal.saveChanges')}
        </Button>
      </div>
    </form>
  );
}

function timeAgo(unixSeconds, t, locale) {
  if (!unixSeconds) return '';
  const diffMs = Date.now() - unixSeconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('portfolio.timeAgo.justNow');
  if (minutes < 60) return t('portfolio.timeAgo.minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('portfolio.timeAgo.hoursAgo', { hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('portfolio.timeAgo.daysAgo', { days });
  return new Date(unixSeconds * 1000).toLocaleDateString(locale);
}

const NEWS_PAGE_SIZE = 5;

function newsTickerStripped(ticker) {
  return String(ticker || '').trim().toUpperCase().replace(/\.[A-Z]+$/, '');
}

function PortfolioNews({ tickers, apiKey }) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set()); // empty = all
  const [page, setPage] = useState(0);

  const tickerKey = tickers.join(',');

  // Map raw holding ticker -> the symbol Finnhub gets (suffix stripped),
  // since news items are tagged with the stripped form.
  const filterChips = useMemo(() => {
    const seen = new Set();
    const chips = [];
    for (const ticker of tickers) {
      const symbol = newsTickerStripped(ticker);
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      chips.push({ symbol, label: ticker });
    }
    return chips;
  }, [tickerKey]);

  const load = async ({ force = false } = {}) => {
    if (!apiKey || !tickers.length) return;
    if (force) clearNewsCache();
    setStatus('loading');
    setError('');
    try {
      const news = await fetchPortfolioNews(tickers, apiKey, { days: 14, max: 100 });
      setItems(news);
      setStatus('ready');
    } catch (err) {
      setError(err?.message || 'Could not load news');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (apiKey && tickers.length) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, apiKey]);

  // Reset to first page when filter or item list changes
  useEffect(() => { setPage(0); }, [selected, items]);

  const filtered = useMemo(() => {
    if (!selected.size) return items;
    return items.filter((item) => selected.has(item.ticker));
  }, [items, selected]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / NEWS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * NEWS_PAGE_SIZE;
  const paged = filtered.slice(start, start + NEWS_PAGE_SIZE);

  const toggleTicker = (symbol) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  return (
    <Card
      eyebrow={t('portfolio.newsCard.eyebrow')}
      title={t('portfolio.newsCard.title')}
      description={t('portfolio.newsCard.description')}
      action={
        apiKey && tickers.length ? (
          <Button variant="secondary" size="sm" onClick={() => load({ force: true })} loading={status === 'loading'}>
            {t('portfolio.newsCard.refresh')}
          </Button>
        ) : null
      }
      className={rise(4)}
    >
      {!apiKey ? (
        <EmptyState
          title={t('portfolio.newsCard.emptyNoApiKey.title')}
          description={t('portfolio.newsCard.emptyNoApiKey.description')}
        />
      ) : !tickers.length ? (
        <EmptyState title={t('portfolio.newsCard.emptyNoHoldings.title')} description={t('portfolio.newsCard.emptyNoHoldings.description')} />
      ) : status === 'loading' && !items.length ? (
        <p className="text-sm text-ink-muted">{t('portfolio.newsCard.loading')}</p>
      ) : status === 'error' ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !items.length ? (
        <EmptyState
          title={t('portfolio.newsCard.emptyNoHeadlines.title')}
          description={t('portfolio.newsCard.emptyNoHeadlines.description')}
        />
      ) : (
        <div className="grid gap-4">
          {filterChips.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className={cn(
                  'inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors duration-150',
                  selected.size === 0
                    ? 'border-accent bg-accent-soft text-ink'
                    : 'border-rule text-ink-muted hover:border-rule-strong hover:text-ink',
                )}
              >
                {t('portfolio.newsCard.filterAll')}
              </button>
              {filterChips.map((chip) => {
                const active = selected.has(chip.symbol);
                return (
                  <button
                    key={chip.symbol}
                    type="button"
                    onClick={() => toggleTicker(chip.symbol)}
                    className={cn(
                      'inline-flex h-7 items-center rounded-full border px-3 font-mono text-[0.7rem] transition-colors duration-150',
                      active
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-rule text-ink-muted hover:border-rule-strong hover:text-ink',
                    )}
                    title={chip.label}
                  >
                    {chip.symbol}
                  </button>
                );
              })}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('portfolio.newsCard.noMatchingTickers')}</p>
          ) : (
            <ul className="grid gap-3">
              {paged.map((item) => (
                <li key={item.id} className="border-b border-rule pb-3 last:border-b-0 last:pb-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        className="hidden sm:block h-14 w-20 shrink-0 rounded-md border border-rule object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink leading-snug group-hover:text-accent transition-colors duration-150">
                        {item.headline}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <span className="font-mono text-ink-faint">{item.ticker}</span>
                        {item.source ? <span className="text-ink-faint">·</span> : null}
                        {item.source ? <span>{item.source}</span> : null}
                        <span className="text-ink-faint">·</span>
                        <span>{timeAgo(item.datetime, t, locale)}</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {filtered.length > NEWS_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-ink-muted">
                {t('portfolio.newsCard.showing', { from: start + 1, to: Math.min(start + NEWS_PAGE_SIZE, filtered.length), total: filtered.length })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  {t('portfolio.newsCard.prev')}
                </Button>
                <span className="text-xs text-ink-faint tabular">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                >
                  {t('portfolio.newsCard.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}



const PORTFOLIO_PERIOD_OPTIONS = ['1d', '1w', '1m', '6m', '1y', 'all'];
const PORTFOLIO_SNAPSHOT_SCOPE_VERSION = 'assigned-only-v1';

function chooseCanonicalSnapshots(snapshots) {
  const canonical = (snapshots || []).filter((snapshot) => snapshot.scopeVersion === PORTFOLIO_SNAPSHOT_SCOPE_VERSION);
  return canonical.length ? canonical : (snapshots || []).filter((snapshot) => !snapshot.scopeVersion);
}

export default function PortfolioPage() {
  const { t, locale } = useTranslation();
  const investmentPortfolios = useFinanceStore((state) => state.investmentPortfolios || []);
  const holdings = useFinanceStore((state) => state.holdings);
  const dividends = useFinanceStore((state) => state.dividends);
  const portfolioCashflows = useFinanceStore((state) => state.portfolioCashflows);
  const portfolioSales = useFinanceStore((state) => state.portfolioSales);
  const portfolioSnapshots = useFinanceStore((state) => state.portfolioSnapshots);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const availableBalanceCents = useFinanceStore((state) => state.derived.dashboard.availableBalanceCents);
  const savingsBalanceCents = useFinanceStore((state) =>
    (state.savingsConfig?.currentBalanceCents || 0) +
    state.savingsEntries
      .filter((entry) => entry.source !== 'allocation')
      .reduce((sum, entry) => sum + (entry.amountCents || 0), 0),
  );
  const bankAccounts = useFinanceStore((state) => state.bankAccounts || []);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const sellHolding = useFinanceStore((state) => state.sellHolding);
  const updatePortfolioSale = useFinanceStore((state) => state.updatePortfolioSale);
  const removePortfolioSale = useFinanceStore((state) => state.removePortfolioSale);
  const addPortfolioBuy = useFinanceStore((state) => state.addPortfolioBuy);
  const saveDividend = useFinanceStore((state) => state.saveDividend);
  const removeDividend = useFinanceStore((state) => state.removeDividend);
  const refreshPrices = useFinanceStore((state) => state.refreshPrices);
  const recordPortfolioSnapshot = useFinanceStore((state) => state.recordPortfolioSnapshot);
  const confirm = useConfirm();
  const alert = useAlert();
  const [holdingModal, setHoldingModal] = useState({ open: false, id: null, initialValue: null });
  const [holdingGroupModal, setHoldingGroupModal] = useState({ open: false, ticker: null });
  const [dividendModal, setDividendModal] = useState({ open: false, id: null });
  const [sellModal, setSellModal] = useState({ open: false, holdingId: null, saleId: null });
  const [sellAllModal, setSellAllModal] = useState({ open: false, ticker: null });
  const [portfolioModal, setPortfolioModal] = useState({ open: false, id: null });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [activePortfolioId, setActivePortfolioId] = useState('all');
  const [activeView, setActiveView] = useState('holdings');
  const [portfolioValuePeriod, setPortfolioValuePeriod] = useState('1m');
  const activePortfolio = investmentPortfolios.find((item) => item.id === activePortfolioId) || null;
  const editingPortfolio = investmentPortfolios.find((item) => item.id === portfolioModal.id) || null;
  const isAllPortfoliosView = activePortfolioId === 'all';
  const editingHolding = holdings.find((item) => item.id === holdingModal.id);
  const editingDividend = dividends.find((item) => item.id === dividendModal.id);
  const editingSale = portfolioSales.find((item) => item.id === sellModal.saleId);
  const modalHolding = holdings.find((item) => item.id === (sellModal.holdingId || editingSale?.holdingId));
  const sellingHolding = editingSale && modalHolding
    ? {
        ...modalHolding,
        quantity: Number(modalHolding.quantity || 0) + Number(editingSale.quantity || 0),
        archivedAt: null,
      }
    : modalHolding;
  const fxRates = useFinanceStore((state) => state.fxRates);
  const currency = settings.baseCurrency;
  const assignedHoldings = useMemo(
    () => assignedPortfolioHoldings(holdings, investmentPortfolios),
    [holdings, investmentPortfolios],
  );
  const assignedDividends = useMemo(
    () => assignedPortfolioRecords(dividends, investmentPortfolios),
    [dividends, investmentPortfolios],
  );
  const assignedPortfolioSales = useMemo(
    () => assignedPortfolioRecords(portfolioSales, investmentPortfolios),
    [portfolioSales, investmentPortfolios],
  );
  const assignedPortfolioCashflows = useMemo(
    () => assignedPortfolioRecords(portfolioCashflows, investmentPortfolios),
    [portfolioCashflows, investmentPortfolios],
  );
  const visibleHoldings = isAllPortfoliosView ? assignedHoldings : assignedHoldings.filter((item) => item.portfolioId === activePortfolioId);
  const visibleDividends = isAllPortfoliosView ? assignedDividends : assignedDividends.filter((item) => item.portfolioId === activePortfolioId);
  const visiblePortfolioSales = isAllPortfoliosView ? assignedPortfolioSales : assignedPortfolioSales.filter((item) => item.portfolioId === activePortfolioId);
  const visiblePortfolioCashflows = isAllPortfoliosView ? assignedPortfolioCashflows : assignedPortfolioCashflows.filter((item) => item.portfolioId === activePortfolioId);
  const visiblePortfolioMetrics = isAllPortfoliosView
    ? portfolio
    : computePortfolioMetrics(
        visibleHoldings,
        visibleDividends,
        visiblePortfolioCashflows,
        settings.allocationTargets,
        fxRates,
        currency,
      );
  const activeHoldings = visibleHoldings.filter((item) => !item.archivedAt && (item.quantity || 0) > 0);
  const holdingGroups = groupHoldingsByTicker(activeHoldings, fxRates, currency);
  const newsTickers = useMemo(
    () => Array.from(new Set(activeHoldings.map((h) => h.ticker).filter(Boolean))),
    [activeHoldings],
  );
  const scopedSnapshots = isAllPortfoliosView
    ? portfolioSnapshots.filter((snapshot) => !snapshot.portfolioId)
    : portfolioSnapshots.filter((snapshot) => snapshot.portfolioId === activePortfolioId);
  const visibleSnapshots = chooseCanonicalSnapshots(scopedSnapshots);
  const portfolioValueSeries = buildPortfolioValueSeries(
    visibleSnapshots,
    visiblePortfolioMetrics.currentValueCents,
    locale,
    portfolioValuePeriod,
    visiblePortfolioMetrics.investedCents,
    visiblePortfolioCashflows,
    visiblePortfolioSales,
    visibleHoldings,
    fxRates,
    currency,
  );
  const visiblePortfolioValueSeries = useMemo(
    () => filterPortfolioValueSeries(portfolioValueSeries, portfolioValuePeriod, locale),
    [portfolioValueSeries, portfolioValuePeriod, locale],
  );
  const lwPortfolioValueData = useMemo(() => ({
    main: visiblePortfolioValueSeries.map((p) => ({ time: p.capturedAt?.slice(0, 10), value: p.valueCents })),
    cost: visiblePortfolioValueSeries.filter((p) => p.costCents != null).map((p) => ({ time: p.capturedAt?.slice(0, 10), value: p.costCents })),
  }), [visiblePortfolioValueSeries]);

  const lwRebalanceData = useMemo(() => {
    const items = visiblePortfolioMetrics.allocationActual || [];
    return {
      seriesA: items.map((item, i) => {
        const year = 2024 + Math.floor(i / 12);
        const month = String((i % 12) + 1).padStart(2, '0');
        return { time: `${year}-${month}-01`, value: item.actualWeight };
      }),
      seriesB: items.map((item, i) => {
        const year = 2024 + Math.floor(i / 12);
        const month = String((i % 12) + 1).padStart(2, '0');
        return { time: `${year}-${month}-01`, value: item.targetWeight };
      }),
      tickers: items.map((item) => item.ticker),
    };
  }, [visiblePortfolioMetrics.allocationActual]);


  const editingHoldingGroup = holdingGroups.find((group) => group.ticker === holdingGroupModal.ticker);
  const sellingAllGroup = holdingGroups.find((group) => group.ticker === sellAllModal.ticker);

  useEffect(() => {
    if (assignedHoldings.some((holding) => !holding.archivedAt && (holding.quantity || 0) > 0) && portfolio.currentValueCents > 0) {
      recordPortfolioSnapshot();
    }
  }, [assignedHoldings, portfolio.currentValueCents, recordPortfolioSnapshot]);

  useEffect(() => {
    if (activePortfolioId !== 'all' && !investmentPortfolios.some((portfolio) => portfolio.id === activePortfolioId)) {
      setActivePortfolioId('all');
      setActiveView('holdings');
    }
  }, [activePortfolioId, investmentPortfolios]);

  const openNewHolding = (initialValue = null) => {
    if (!activePortfolio) return;
    const nextInitialValue = initialValue && !initialValue.nativeEvent ? initialValue : null;
    setHoldingModal({
      open: true,
      id: null,
      initialValue: { ...(nextInitialValue || {}), portfolioId: activePortfolio.id },
    });
  };
  const openAddHoldingOperation = (group) => openNewHolding({
    ticker: group.ticker,
    name: group.name,
    currency: group.currency,
    averageBuyPriceCents: group.averageBuyPriceCents,
    currentPriceCents: group.currentPriceCents,
  });
  const openEditHolding = (id) => setHoldingModal({ open: true, id, initialValue: null });
  const closeHolding = () => setHoldingModal({ open: false, id: null, initialValue: null });
  const openEditHoldingGroup = (ticker) => setHoldingGroupModal({ open: true, ticker });
  const closeHoldingGroup = () => setHoldingGroupModal({ open: false, ticker: null });
  const openSellHolding = (id) => setSellModal({ open: true, holdingId: id, saleId: null });
  const openEditSale = (saleId) => setSellModal({ open: true, holdingId: null, saleId });
  const closeSellHolding = () => setSellModal({ open: false, holdingId: null, saleId: null });
  const openNewPortfolio = () => setPortfolioModal({ open: true, id: null });
  const openEditPortfolio = (id) => setPortfolioModal({ open: true, id });
  const closePortfolio = () => setPortfolioModal({ open: false, id: null });

  const openNewDividend = () => {
    if (!activePortfolio) return;
    setDividendModal({ open: true, id: null });
  };
  const openEditDividend = (id) => setDividendModal({ open: true, id });
  const closeDividend = () => setDividendModal({ open: false, id: null });

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshError('');
    try {
      await refreshPrices();
    } catch (err) {
      setRefreshError(err.message || t('portfolio.priceRefreshError'));
    } finally {
      setRefreshing(false);
    }
  };

  const dividendColumns = [
    { key: 'date', header: t('portfolio.tableHeaders.date'), width: 110 },
    { key: 'ticker', header: t('portfolio.tableHeaders.ticker') },
    {
      key: 'amountCents',
      header: t('portfolio.tableHeaders.amount'),
      numeric: true,
      render: (r) => formatCurrency(r.amountCents, r.currency, locale),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditDividend(r.id)}>{t('common.edit')}</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: t('portfolio.confirmDeleteDividend.title'), description: t('portfolio.confirmDeleteDividend.description', { ticker: r.ticker }) }))
              removeDividend(r.id);
          }}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  const holdingRows = holdingGroups.flatMap((group) => {
    const lotRows = group.lots.map((holding, index) => {
      const { valueCents, costCents, pnlCents, pnlPct } = buildLotMetrics(holding, fxRates, currency);
      return {
        ...holding,
        rowType: 'lot',
        operationNumber: index + 1,
        valueCents,
        costCents,
        pnlCents,
        pnlPct,
        rowClassName: 'bg-surface',
      };
    });
    return [group, ...lotRows];
  });

  const openSellAllHoldingGroup = (group) => {
    if (!group) return;
    setSellAllModal({ open: true, ticker: group.ticker });
  };
  const closeSellAllHoldingGroup = () => setSellAllModal({ open: false, ticker: null });

  const sellAllHoldingGroup = async (group, { date, bankAccountId }) => {
    if (!group) return;
    const missingPrice = group.lots.some((lot) => !(lot.currentPriceCents || group.currentPriceCents));
    if (missingPrice) throw new Error('Cannot sell: one or more lots have no current price. Refresh prices first.');
    for (const lot of group.lots) {
      await sellHolding({
        holdingId: lot.id,
        percent: 100,
        salePriceCents: lot.currentPriceCents || group.currentPriceCents || 0,
        feeCents: 0,
        date,
        bankAccountId,
      });
    }
  };

  const holdingColumns = [
    {
      key: 'ticker',
      header: t('portfolio.tableHeaders.ticker'),
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-mono text-sm font-semibold text-ink' : 'pl-5 font-mono text-sm text-ink-muted'}>
          {r.rowType === 'group' ? r.ticker : t('portfolio.tableHeaders.operation', { num: r.operationNumber })}
        </span>
      ),
    },
    {
      key: 'name',
      header: t('portfolio.tableHeaders.name'),
      hideOnMobile: true,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-medium text-ink' : 'text-ink-muted'}>
          {r.rowType === 'group' ? r.name : r.ticker}
        </span>
      ),
    },
    {
      key: 'platform',
      header: t('portfolio.tableHeaders.platform'),
      hideOnMobile: true,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'text-xs text-ink' : 'text-xs text-ink-muted'}>
          {r.platform}
        </span>
      ),
    },
    { key: 'quantity', header: t('portfolio.tableHeaders.qty'), numeric: true, hideOnMobile: true, render: (r) => formatNumber(r.quantity, locale, quantityDigits(r)) },
    {
      key: 'avg',
      header: t('portfolio.tableHeaders.avgBuy'),
      numeric: true,
      hideOnMobile: true,
      render: (r) => (
        <span>
          {formatCurrency(r.averageBuyPriceCents, r.currency || currency, locale)}
          {r.currency && r.currency !== currency && (
            <span className="ml-1 font-mono text-[10px] text-ink-faint">{r.currency}</span>
          )}
        </span>
      ),
    },
    {
      key: 'price',
      header: t('portfolio.tableHeaders.price'),
      numeric: true,
      hideOnMobile: true,
      render: (r) => (
        <span>
          {formatCurrency(r.currentPriceCents, r.currency || currency, locale)}
          {r.currency && r.currency !== currency && (
            <span className="ml-1 font-mono text-[10px] text-ink-faint">{r.currency}</span>
          )}
        </span>
      ),
    },
    { key: 'fee', header: t('portfolio.tableHeaders.fees', { currency }), numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.feeCents || 0, currency, locale) },
    { key: 'value', header: t('portfolio.tableHeaders.value', { currency }), numeric: true, render: (r) => formatCurrency(r.valueCents, currency, locale) },
    {
      key: 'pnl',
      header: t('portfolio.tableHeaders.pnl', { currency }),
      numeric: true,
      render: (r) => (
        <span className={r.pnlCents >= 0 ? 'text-positive' : 'text-danger'}>
          {formatCurrency(r.pnlCents, currency, locale)}
          <span className="ml-1 text-ink-muted text-xs">({formatNumber(r.pnlPct, locale, 2)}%)</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      render: (r) => r.rowType === 'group' ? (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditHoldingGroup(r.ticker)}>{t('common.edit')}</Button>
          <Button variant="ghost" size="sm" onClick={() => openSellAllHoldingGroup(r)}>{t('portfolio.sellAll')}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditHolding(r.id)}>{t('common.edit')}</Button>
          <Button variant="ghost" size="sm" onClick={() => openSellHolding(r.id)}>{t('portfolio.sellModal.titleSell')}</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: t('portfolio.confirmDeleteHolding.title'), description: t('portfolio.confirmDeleteHolding.description', { ticker: r.ticker }) }))
              removeEntity('holdings', r.id);
          }}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  const historicalSaleRows = (visiblePortfolioSales || [])
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map((sale) => ({
      ...sale,
      realizedPnlPct: sale.costBasisCents ? (sale.realizedPnlCents / sale.costBasisCents) * 100 : 0,
    }));
  const historicalRows = groupSalesByTicker(historicalSaleRows).flatMap((group) => {
    const lotRows = group.lots.map((sale, index) => ({
      ...sale,
      rowType: 'lot',
      operationNumber: index + 1,
      rowClassName: 'bg-surface',
    }));
    return [group, ...lotRows];
  });

  const salesPerformanceSeries = historicalSaleRows
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .reduce((series, sale) => {
      const previous = series.at(-1)?.cumulativePnlCents || 0;
      series.push({
        id: sale.id,
        date: sale.date,
        label: sale.date,
        ticker: sale.ticker,
        realizedPnlCents: sale.realizedPnlCents || 0,
        proceedsCents: sale.proceedsCents || 0,
        cumulativePnlCents: previous + (sale.realizedPnlCents || 0),
      });
      return series;
    }, []);
  const salesPerformanceTotalCents = salesPerformanceSeries.at(-1)?.cumulativePnlCents || 0;
  const lwSalesData = useMemo(() =>
    salesPerformanceSeries.map((p) => ({ time: p.date, value: p.cumulativePnlCents })),
    [salesPerformanceSeries],
  );
  const portfolioViews = [
    { id: 'holdings', label: t('portfolio.views.holdings') },
    { id: 'activity', label: t('portfolio.views.activity') },
    { id: 'performance', label: t('portfolio.views.performance') },
  ];
  const portfolioSummaryRows = investmentPortfolios.map((portfolioItem) => {
    const scopedHoldings = holdings.filter((holding) => holding.portfolioId === portfolioItem.id);
    const scopedActiveHoldings = scopedHoldings.filter((holding) => !holding.archivedAt && (holding.quantity || 0) > 0);
    const metrics = computePortfolioMetrics(
      scopedHoldings,
      dividends.filter((dividend) => dividend.portfolioId === portfolioItem.id),
      portfolioCashflows.filter((flow) => flow.portfolioId === portfolioItem.id),
      settings.allocationTargets,
      fxRates,
      currency,
    );
    return {
      ...portfolioItem,
      symbols: new Set(scopedActiveHoldings.map((holding) => holding.ticker).filter(Boolean)).size,
      holdingsCount: scopedActiveHoldings.length,
      investedCents: metrics.investedCents,
      marketValueCents: metrics.currentValueCents,
      dayChangeCents: 0,
      dayChangePct: 0,
      unrealizedCents: metrics.pnlCents,
      unrealizedPct: metrics.pnlPercent,
    };
  });
  const portfolioSummaryColumns = [
    {
      key: 'name',
      header: 'Portfolio Name',
      noTruncate: true,
      render: (row) => (
        <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => { setActivePortfolioId(row.id); setActiveView('holdings'); }}>
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: row.color || 'var(--accent)' }} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{row.name}</span>
            {row.description ? <span className="block truncate text-xs text-ink-faint">{row.description}</span> : null}
          </span>
        </button>
      ),
    },
    { key: 'symbols', header: 'Symbols', numeric: true, width: 84 },
    { key: 'investedCents', header: 'Cost Basis', numeric: true, width: 120, render: (row) => formatCurrency(row.investedCents, currency, locale) },
    { key: 'marketValueCents', header: 'Market Value', numeric: true, width: 130, render: (row) => formatCurrency(row.marketValueCents, currency, locale) },
    {
      key: 'dayChangeCents',
      header: 'Day Change',
      numeric: true,
      width: 112,
      hideBelow: 'lg',
      render: (row) => (
        <span className="text-ink-muted">
          {formatCurrency(row.dayChangeCents, currency, locale)} ({formatNumber(row.dayChangePct, locale, 2)}%)
        </span>
      ),
    },
    {
      key: 'unrealizedCents',
      header: 'Unrealized Gain/Loss',
      numeric: true,
      width: 150,
      render: (row) => (
        <span className={row.unrealizedCents >= 0 ? 'text-positive' : 'text-danger'}>
          {formatCurrency(row.unrealizedCents, currency, locale)}
          <span className="ml-1 text-xs text-ink-muted">({formatNumber(row.unrealizedPct, locale, 2)}%)</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 108,
      noTruncate: true,
      render: (row) => (
        <div className="inline-flex justify-end gap-1">
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken" title="Edit portfolio" onClick={() => openEditPortfolio(row.id)}>
            <EditIcon />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
            title="Delete portfolio"
            onClick={async () => {
              try {
                if (await confirm({ title: 'Delete portfolio?', description: 'Only empty portfolios can be deleted.', danger: true }))
                  await removeEntity('investmentPortfolios', row.id);
              } catch (error) {
                await alert({ title: 'Cannot delete portfolio', description: error.message });
              }
            }}
          >
            <TrashIcon />
          </button>
        </div>
      ),
    },
  ];

  const historicalColumns = [
    {
      key: 'date',
      header: t('portfolio.tableHeaders.date'),
      width: 110,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-medium text-ink' : 'text-ink-muted'}>
          {r.rowType === 'group' ? t('portfolio.tableHeaders.total') : r.date}
        </span>
      ),
    },
    {
      key: 'ticker',
      header: t('portfolio.tableHeaders.ticker'),
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-mono text-sm font-semibold text-ink' : 'pl-5 font-mono text-sm text-ink-muted'}>
          {r.rowType === 'group' ? r.ticker : t('portfolio.tableHeaders.operation', { num: r.operationNumber })}
        </span>
      ),
    },
    {
      key: 'name',
      header: t('portfolio.tableHeaders.name'),
      hideOnMobile: true,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-medium text-ink' : 'text-ink-muted'}>
          {r.rowType === 'group' ? r.name : r.ticker}
        </span>
      ),
    },
    { key: 'quantity', header: t('portfolio.tableHeaders.qtySold'), numeric: true, hideOnMobile: true, render: (r) => formatNumber(r.quantity, locale, quantityDigits(r)) },
    {
      key: 'percent',
      header: t('portfolio.tableHeaders.sold'),
      numeric: true,
      hideOnMobile: true,
      render: (r) => r.rowType === 'group' ? t('portfolio.holdingsCard.operations', { count: r.percent }) : `${formatNumber(r.percent, locale, 2)}%`,
    },
    { key: 'salePrice', header: t('portfolio.tableHeaders.salePrice'), numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.salePriceCents, currency, locale) },
    { key: 'fee', header: t('portfolio.tableHeaders.fees', { currency }), numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.feeCents || 0, currency, locale) },
    { key: 'proceeds', header: t('portfolio.tableHeaders.proceeds'), numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.proceedsCents, currency, locale) },
    {
      key: 'realizedPnl',
      header: t('portfolio.tableHeaders.realizedPnl'),
      numeric: true,
      render: (r) => (
        <span className={r.realizedPnlCents >= 0 ? 'text-positive' : 'text-danger'}>
          {formatCurrency(r.realizedPnlCents, currency, locale)}
          <span className="ml-1 text-ink-muted text-xs">({formatNumber(r.realizedPnlPct, locale, 2)}%)</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      render: (r) => r.rowType === 'group' ? (
        <span className="eyebrow text-ink-faint">{t('portfolio.tableHeaders.total')}</span>
      ) : (
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditSale(r.id)}>{t('common.edit')}</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: t('portfolio.confirmDeleteSale.title'), description: t('portfolio.confirmDeleteSale.description', { ticker: r.ticker }) }))
              removePortfolioSale(r.id);
          }}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="04"
        eyebrow={t('portfolio.eyebrow')}
        title={t('portfolio.title')}
        description={t('portfolio.description')}
        actions={
          <>
            {refreshError && (
              <span className="text-xs text-danger">{refreshError}</span>
            )}
            <Button variant="secondary" size="sm" loading={refreshing} onClick={onRefresh}>
              {refreshing ? t('portfolio.refreshing', { count: activeHoldings.length, mins: Math.ceil(activeHoldings.length * 13 / 60) }) : t('portfolio.refreshPrices')}
            </Button>
            <Button variant="secondary" size="sm" onClick={openNewPortfolio}>
              <PlusIcon /> Create portfolio
            </Button>
            {activePortfolio ? (
            <Button variant="primary" size="sm" onClick={() => openNewHolding()}>
              <PlusIcon /> {t('portfolio.newHolding')}
            </Button>
            ) : null}
          </>
        }
      />

      {/* KPIs */}
      <section data-tour="portfolio-stats" className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('portfolio.kpiMarketValue.label'), value: visiblePortfolioMetrics.currentValueCents, mode: 'currency', hint: t('portfolio.kpiMarketValue.hintHoldings', { count: activeHoldings.length }), info: t('portfolio.kpiMarketValue.info') },
          { label: t('portfolio.kpiTwrr.label'), value: visiblePortfolioMetrics.twrr, mode: 'percent', hint: t('portfolio.kpiTwrr.hint'), info: t('portfolio.kpiTwrr.info') },
          { label: t('portfolio.kpiXirr.label'), value: visiblePortfolioMetrics.xirr, mode: 'percent', hint: t('portfolio.kpiXirr.hint'), info: t('portfolio.kpiXirr.info') },
          { label: t('portfolio.kpiDividendYield.label'), value: visiblePortfolioMetrics.dividendYield, mode: 'percent', hint: t('portfolio.kpiDividendYield.hint'), info: t('portfolio.kpiDividendYield.info') },
        ].map((k, i) => (
          <div key={k.label} className={'min-w-0 bg-surface p-6 ' + rise(i + 1)}>
            <Stat label={k.label} value={k.value} mode={k.mode} currency={currency} locale={locale} hint={k.hint} info={k.info} />
          </div>
        ))}
      </section>

      <Card
        eyebrow="Investing portfolios"
        title={isAllPortfoliosView ? 'All portfolios' : activePortfolio?.name || 'Portfolio'}
        description={isAllPortfoliosView ? 'Combined view across every investment portfolio.' : activePortfolio?.description || 'Portfolio-specific holdings and performance.'}
        density="compact"
        action={<Button variant="secondary" size="sm" onClick={openNewPortfolio}><PlusIcon /> Create portfolio</Button>}
      >
        {investmentPortfolios.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                isAllPortfoliosView ? 'border-accent bg-accent text-accent-contrast' : 'border-rule bg-surface-raised text-ink-muted hover:text-ink',
              )}
              onClick={() => { setActivePortfolioId('all'); setActiveView('holdings'); }}
            >
              All portfolios
            </button>
            {investmentPortfolios.map((portfolioItem) => (
              <button
                key={portfolioItem.id}
                type="button"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  activePortfolioId === portfolioItem.id ? 'border-accent bg-accent text-accent-contrast' : 'border-rule bg-surface-raised text-ink-muted hover:text-ink',
                )}
                onClick={() => { setActivePortfolioId(portfolioItem.id); setActiveView('holdings'); }}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: portfolioItem.color || 'currentColor' }} />
                {portfolioItem.name}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No portfolios yet"
            description="Create a portfolio before adding holdings."
            action={<Button variant="primary" size="sm" onClick={openNewPortfolio}><PlusIcon /> Create portfolio</Button>}
          />
        )}
      </Card>

      {activePortfolio ? (
      <div className="flex flex-wrap items-center gap-2 border-b border-rule">
        {portfolioViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeView === view.id
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>
      ) : null}

      {activeView === 'holdings' ? (
      <>
      <Card
        data-tour="portfolio-value-history"
        eyebrow={t('portfolio.valueChart.eyebrow')}
        title={t('portfolio.valueChart.title')}
        description={t('portfolio.valueChart.description')}
        variant="chart"
        className={rise(2)}
      >
        {/* Period selector */}
        <div className="flex items-center gap-0.5 px-1 pb-3">
          {PORTFOLIO_PERIOD_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPortfolioValuePeriod(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                portfolioValuePeriod === p
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-raised'
              }`}
            >
              {p === 'all' ? t('common.all') : p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* P&L summary row */}
        {visiblePortfolioMetrics.investedCents > 0 && (() => {
          const pnlCents = visiblePortfolioMetrics.currentValueCents - visiblePortfolioMetrics.investedCents;
          const pnlPct   = (pnlCents / visiblePortfolioMetrics.investedCents) * 100;
          const isUp     = pnlCents >= 0;
          return (
            <div className="flex items-center gap-6 px-1 pb-4">
              <div className="flex flex-col gap-0.5">
                <p className="eyebrow text-[0.6rem] text-ink-muted">{t('portfolio.valueChart.value')}</p>
                <p className="text-base font-semibold tabular-nums text-ink">
                  {formatCurrency(visiblePortfolioMetrics.currentValueCents, currency, locale)}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="eyebrow text-[0.6rem] text-ink-muted">{t('portfolio.valueChart.invested')}</p>
                <p className="text-base font-semibold tabular-nums text-ink">
                  {formatCurrency(visiblePortfolioMetrics.investedCents, currency, locale)}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="eyebrow text-[0.6rem] text-ink-muted">P&amp;L</p>
                <p className={`text-base font-semibold tabular-nums ${isUp ? 'text-positive' : 'text-danger'}`}>
                  {isUp ? '+' : ''}{formatCurrency(pnlCents, currency, locale)}
                  <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full ${isUp ? 'bg-[var(--positive-soft)] text-positive' : 'bg-[var(--danger-soft)] text-danger'}`}>
                    {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                </p>
              </div>
            </div>
          );
        })()}

        {lwPortfolioValueData.main.length ? (
          <div style={{ height: 280 }}>
            <LWAreaChart
              data={lwPortfolioValueData.main}
              color="var(--accent)"
              topOpacity={0.22}
              secondSeries={{ data: lwPortfolioValueData.cost, color: 'var(--danger)', topOpacity: 0.06, bottomOpacity: 0.06, dashed: true }}
              priceFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
            />
          </div>
        ) : (
          <EmptyState title={t('portfolio.valueChart.emptyTitle')} description={t('portfolio.valueChart.emptyDescription')} />
        )}
      </Card>

      {isAllPortfoliosView ? (
      <Card
        eyebrow="Portfolios"
        title="Portfolio holdings"
        description="Summary of every portfolio inside Investing."
        density="compact"
        action={<Button variant="primary" size="sm" onClick={openNewPortfolio}><PlusIcon /> Create portfolio</Button>}
        className={rise(3)}
      >
        {portfolioSummaryRows.length ? (
          <>
            <div className="grid gap-2 sm:hidden">
              {portfolioSummaryRows.map((row) => (
                <div key={row.id} className="rounded-md border border-rule bg-surface px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => { setActivePortfolioId(row.id); setActiveView('holdings'); }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: row.color || 'var(--accent)' }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{row.name}</span>
                        {row.description ? <span className="block truncate text-xs text-ink-faint">{row.description}</span> : null}
                      </span>
                    </button>
                    <div className="inline-flex shrink-0 gap-1">
                      <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken" title="Edit portfolio" onClick={() => openEditPortfolio(row.id)}>
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                        title="Delete portfolio"
                        onClick={async () => {
                          try {
                            if (await confirm({ title: 'Delete portfolio?', description: 'Only empty portfolios can be deleted.', danger: true }))
                              await removeEntity('investmentPortfolios', row.id);
                          } catch (error) {
                            await alert({ title: 'Cannot delete portfolio', description: error.message });
                          }
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-rule pt-3">
                    <div className="min-w-0">
                      <p className="eyebrow text-ink-faint">Symbols</p>
                      <p className="mt-1 font-mono text-sm text-ink">{row.symbols}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="eyebrow text-ink-faint">Cost basis</p>
                      <p className="mt-1 truncate font-mono text-sm text-ink">{formatCurrency(row.investedCents, currency, locale)}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="eyebrow text-ink-faint">Market value</p>
                      <p className="mt-1 truncate font-mono text-sm text-ink">{formatCurrency(row.marketValueCents, currency, locale)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
              <Table
                columns={portfolioSummaryColumns}
                rows={portfolioSummaryRows}
                density="compact"
                allowHorizontalScroll={false}
                caption="All portfolios"
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="No portfolios yet"
            description="Create a portfolio first, then add holdings inside it."
            action={<Button variant="primary" size="sm" onClick={openNewPortfolio}><PlusIcon /> Create portfolio</Button>}
          />
        )}
      </Card>
      ) : (
      <>
      {/* holdings */}
      <Card
        data-tour="portfolio-holdings"
        eyebrow={t('portfolio.holdingsCard.eyebrow')}
        title={t('portfolio.holdingsCard.title')}
        description={t('portfolio.holdingsCard.description')}
        density="compact"
        action={
          <Button variant="primary" size="sm" onClick={() => openNewHolding()}>
            <PlusIcon /> {t('portfolio.addHolding')}
          </Button>
        }
        className={rise(3)}
      >
        {holdingGroups.length ? (
          <PortfolioHoldingList
            groups={holdingGroups}
            currency={currency}
            locale={locale}
            fxRates={fxRates}
            openEditHoldingGroup={openEditHoldingGroup}
            openAddHoldingOperation={openAddHoldingOperation}
            openEditHolding={openEditHolding}
            openSellHolding={openSellHolding}
            sellAllHoldingGroup={openSellAllHoldingGroup}
            onDeleteHolding={async (holding) => {
              if (await confirm({ title: t('portfolio.confirmDeleteHolding.title'), description: t('portfolio.confirmDeleteHolding.description', { ticker: holding.ticker }) }))
                removeEntity('holdings', holding.id);
            }}
          />
        ) : (
          <EmptyState
            title={t('portfolio.holdingsCard.emptyTitle')}
            description={t('portfolio.holdingsCard.emptyDescription')}
            action={
              <Button variant="secondary" size="sm" onClick={() => openNewHolding()}>
                <PlusIcon /> {t('portfolio.addHolding')}
              </Button>
            }
          />
        )}
      </Card>

      {/* allocation */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card data-tour="portfolio-allocation" eyebrow={t('portfolio.allocationCard.eyebrow')} title={t('portfolio.allocationCard.title')} className={'order-2 lg:col-span-5 ' + rise(2)}>
          {visiblePortfolioMetrics.allocationActual?.length ? (
            <div className="flex flex-col gap-5">
              <div className="relative mx-auto h-[190px] w-full max-w-[190px] sm:h-[220px] sm:max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={visiblePortfolioMetrics.allocationActual}
                      dataKey="valueCents"
                      nameKey="ticker"
                      innerRadius="58%"
                      outerRadius="95%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {visiblePortfolioMetrics.allocationActual.map((item, index) => (
                        <Cell key={item.ticker} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, entry) => [
                        `${formatCurrency(value, currency, locale)} · actual ${entry.payload.actualWeight.toFixed(1)}% / target ${entry.payload.targetWeight.toFixed(1)}%`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex flex-col gap-2">
                {visiblePortfolioMetrics.allocationActual
                  .slice()
                  .sort((a, b) => b.valueCents - a.valueCents)
                  .map((item) => {
                    const originalIndex = visiblePortfolioMetrics.allocationActual.findIndex((s) => s.ticker === item.ticker);
                    const color = COLORS[originalIndex % COLORS.length];
                    return (
                      <li key={item.ticker} className="flex items-center gap-2 min-w-0">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                        <span className="w-16 shrink-0 font-mono text-xs font-medium text-ink">{item.ticker}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{item.name}</span>
                        <span className="hidden w-20 shrink-0 font-mono tabular text-xs text-ink-muted sm:inline">{formatCurrency(item.valueCents, currency, locale)}</span>
                        <span className="w-9 shrink-0 font-mono tabular text-xs text-ink-faint text-right">{item.actualWeight.toFixed(1)}%</span>
                        <div className="hidden w-16 shrink-0 h-1 rounded-full bg-rule overflow-hidden sm:block">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${item.actualWeight}%`, background: color }} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : (
            <EmptyState title={t('portfolio.allocationCard.emptyTitle')} description={t('portfolio.allocationCard.emptyDescription')} />
          )}
        </Card>

        <Card eyebrow={t('portfolio.rebalanceCard.eyebrow')} title={t('portfolio.rebalanceCard.title')} variant="chart" className={'order-1 lg:col-span-7 ' + rise(3)}>
          {lwRebalanceData.tickers.length ? (
            <LWGroupedHistogram
              seriesA={{ data: lwRebalanceData.seriesA, color: 'var(--accent)' }}
              seriesB={{ data: lwRebalanceData.seriesB, color: 'var(--ink-muted)' }}
              offsetDays={7}
              xLabels={lwRebalanceData.tickers}
              priceFormatter={(v) => `${Number(v || 0).toFixed(1)}%`}
            />
          ) : (
            <EmptyState title={t('portfolio.rebalanceCard.emptyTitle')} description={t('portfolio.rebalanceCard.emptyDescription')} />
          )}
        </Card>
      </section>
      </>
      )}
      </>
      ) : null}

      {/*
          <EmptyState
            title="No holdings yet"
            description="Add your first position — Trade Republic, IBKR, anywhere."
            action={
              <Button variant="secondary" size="sm" onClick={() => openNewHolding()}>
                <PlusIcon /> Add holding
              </Button>
            }
          />
        )}
      */}

      {/* historical performance */}
      {activeView === 'activity' ? (
      <Card
        eyebrow={t('portfolio.historicalCard.eyebrow')}
        title={t('portfolio.historicalCard.title')}
        description={t('portfolio.historicalCard.description')}
        className={rise(5)}
      >
        {historicalRows.length ? (
          <Table columns={historicalColumns} rows={historicalRows} density="compact" />
        ) : (
          <EmptyState
            title={t('portfolio.historicalCard.emptyTitle')}
            description={t('portfolio.historicalCard.emptyDescription')}
          />
        )}
      </Card>
      ) : null}

      {activeView === 'performance' ? (
      <Card
        eyebrow={t('portfolio.salesPerformanceCard.eyebrow')}
        title={t('portfolio.salesPerformanceCard.title')}
        description={t('portfolio.salesPerformanceCard.description')}
        action={
          salesPerformanceSeries.length ? (
            <div className="text-right">
              <p className="eyebrow text-ink-muted">{t('portfolio.salesPerformanceCard.totalPnl')}</p>
              <p className={salesPerformanceTotalCents >= 0 ? 'mt-1 font-mono text-lg text-positive' : 'mt-1 font-mono text-lg text-danger'}>
                {formatCurrency(salesPerformanceTotalCents, currency, locale)}
              </p>
            </div>
          ) : null
        }
        variant="chart"
        className={rise(6)}
      >
        {lwSalesData.length ? (
          <LWSalesChart data={lwSalesData} priceFormatter={(v) => formatCurrencyCompact(v, currency, locale)} />
        ) : (
          <EmptyState title={t('portfolio.salesPerformanceCard.emptyTitle')} description={t('portfolio.salesPerformanceCard.emptyDescription')} />
        )}
      </Card>
      ) : null}

      {/* dividends */}
      {activeView === 'activity' ? (
      <Card
        eyebrow={t('portfolio.dividendsCard.eyebrow')}
        title={t('portfolio.dividendsCard.title')}
        description={t('portfolio.dividendsCard.description')}
        action={
          <Button variant="primary" size="sm" onClick={openNewDividend}>
            <PlusIcon /> {t('portfolio.addDividend')}
          </Button>
        }
        className={rise(7)}
      >
        {visibleDividends.length ? (
          <Table columns={dividendColumns} rows={visibleDividends} density="compact" />
        ) : (
          <EmptyState
            title={t('portfolio.dividendsCard.emptyTitle')}
            description={t('portfolio.dividendsCard.emptyDescription')}
            action={
              <Button variant="secondary" size="sm" onClick={openNewDividend}>
                <PlusIcon /> {t('portfolio.addDividend')}
              </Button>
            }
          />
        )}
      </Card>
      ) : null}

      {/* news */}
      <PortfolioNews tickers={newsTickers} apiKey={settings.finnhubApiKey || ''} />

      <Modal
        open={portfolioModal.open}
        onClose={closePortfolio}
        eyebrow="Portfolio"
        title={editingPortfolio ? 'Edit portfolio' : 'Create portfolio'}
        description="Group holdings, dividends, activity and performance under one investment portfolio."
        size="md"
      >
        <PortfolioForm
          initialValue={editingPortfolio}
          onSubmit={async (value) => {
            const saved = await saveEntity('investmentPortfolios', value);
            setActivePortfolioId(saved.id);
            setActiveView('holdings');
            closePortfolio();
          }}
          onCancel={closePortfolio}
        />
      </Modal>

      <Modal
        open={holdingModal.open}
        onClose={closeHolding}
        eyebrow={t('portfolio.holdingModal.eyebrow')}
        title={editingHolding ? t('portfolio.holdingModal.titleEdit') : t('portfolio.holdingModal.titleNew')}
        description={t('portfolio.holdingModal.description')}
        size="lg"
      >
        <HoldingForm
          initialValue={editingHolding || holdingModal.initialValue}
          finnhubApiKey={settings.finnhubApiKey || ''}
          bankAccounts={bankAccounts}
          onSubmit={async (value) => {
            try {
              const isNew = !value.id;
              const { fundingSource, purchaseAmountCents, bankAccountId, ...holdingValue } = value;
              const priceCurr = holdingValue.currency || currency;
              const feeCurr = holdingValue.feeCurrency || priceCurr;
              const priceFx = applyFx(1_00, priceCurr, fxRates, currency) / 100;  // rate: foreign → base
              const feeFx = applyFx(1_00, feeCurr, fxRates, currency) / 100;
              // Convert purchase cost to base currency for the cashflow transfer
              const rawBaseCost = purchaseAmountCents > 0
                ? Math.round(purchaseAmountCents * priceFx)
                : Math.round(holdingValue.quantity * holdingValue.averageBuyPriceCents * priceFx);
              const cost = rawBaseCost + Math.round((holdingValue.feeCents || 0) * feeFx);
              if (isNew && cost > 0) {
                const sourceBalance = fundingSource === 'savings' ? savingsBalanceCents : availableBalanceCents;
                if (cost > sourceBalance) {
                  throw new Error(
                    fundingSource === 'savings'
                      ? t('portfolio.holdingModal.errorNotEnoughSavings')
                      : t('portfolio.holdingModal.errorNotEnoughCashflow'),
                  );
                }
              }
              const saved = await saveEntity('holdings', holdingValue);
              if (isNew) {
                const purchaseDate = normalizeDateInput(new Date());
                if (cost > 0) {
                  await addPortfolioBuy({
                    date: purchaseDate,
                    amountCents: cost,
                    fundingSource: fundingSource === 'savings' ? 'savings' : 'cashflow',
                    holdingId: saved.id,
                    portfolioId: saved.portfolioId,
                    ticker: saved.ticker,
                    bankAccountId: fundingSource === 'cashflow' ? bankAccountId : null,
                  });
                }
                await recordPortfolioSnapshot({ force: true, source: 'holding_added' });
              }
              closeHolding();
            } catch (error) {
              await alert({ title: t('portfolio.holdingModal.errorSave.title'), description: error.message || t('portfolio.holdingModal.errorSave.description') });
            }
          }}
          onCancel={closeHolding}
        />
      </Modal>

      <Modal
        open={holdingGroupModal.open}
        onClose={closeHoldingGroup}
        eyebrow={t('portfolio.holdingGroupModal.eyebrow')}
        title={editingHoldingGroup ? t('portfolio.holdingGroupModal.titleEdit', { ticker: editingHoldingGroup.ticker }) : t('portfolio.holdingGroupModal.titleFallback')}
        description={t('portfolio.holdingGroupModal.description')}
        size="md"
      >
        {editingHoldingGroup ? (
          <HoldingGroupForm
            group={editingHoldingGroup}
            baseCurrency={currency}
            onSubmit={async (value) => {
              for (const lot of editingHoldingGroup.lots) {
                await saveEntity('holdings', {
                  ...lot,
                  name: value.name,
                  platform: value.platform,
                  currentPriceCents: value.currentPriceCents,
                  currency: value.currency,
                });
              }
              closeHoldingGroup();
            }}
            onCancel={closeHoldingGroup}
          />
        ) : null}
      </Modal>

      <Modal
        open={sellModal.open}
        onClose={closeSellHolding}
        eyebrow={t('portfolio.sellModal.eyebrow')}
        title={editingSale ? t('portfolio.sellModal.titleEdit') : t('portfolio.sellModal.titleSell')}
        description={editingSale ? t('portfolio.sellModal.descriptionEdit') : t('portfolio.sellModal.descriptionSell')}
        size="lg"
      >
        {sellingHolding ? (
          <SellHoldingForm
            holding={sellingHolding}
            sale={editingSale}
            currency={currency}
            locale={locale}
            fxRates={fxRates}
            bankAccounts={bankAccounts}
            onSubmit={async (value) => {
              if (value.saleId) {
                await updatePortfolioSale(value);
              } else {
                await sellHolding(value);
              }
              closeSellHolding();
            }}
            onCancel={closeSellHolding}
          />
        ) : null}
      </Modal>

      <Modal
        open={sellAllModal.open}
        onClose={closeSellAllHoldingGroup}
        eyebrow={t('portfolio.sellAllModal.eyebrow')}
        title={sellingAllGroup ? t('portfolio.sellAllModal.titlePrefix', { ticker: sellingAllGroup.ticker }) : t('portfolio.sellAllModal.titleFallback')}
        description={t('portfolio.sellAllModal.description')}
        size="md"
      >
        {sellingAllGroup ? (
          <SellAllHoldingsForm
            group={sellingAllGroup}
            bankAccounts={bankAccounts}
            onSubmit={async (value) => {
              try {
                await sellAllHoldingGroup(sellingAllGroup, value);
                closeSellAllHoldingGroup();
              } catch (error) {
                await alert({ title: t('portfolio.sellAllModal.errorSell.title'), description: error.message || t('portfolio.sellAllModal.errorSell.description') });
              }
            }}
            onCancel={closeSellAllHoldingGroup}
          />
        ) : null}
      </Modal>

      <Modal
        open={dividendModal.open}
        onClose={closeDividend}
        eyebrow={t('portfolio.dividendModal.eyebrow')}
        title={editingDividend ? t('portfolio.dividendModal.titleEdit') : t('portfolio.dividendModal.titleNew')}
        description={t('portfolio.dividendModal.description')}
        size="md"
      >
        <DividendForm
          holdings={activePortfolio ? holdings.filter((holding) => holding.portfolioId === activePortfolio.id) : holdings}
          bankAccounts={bankAccounts}
          initialValue={editingDividend || (activePortfolio ? { portfolioId: activePortfolio.id } : null)}
          onSubmit={async (value) => {
            await saveDividend({ ...value, portfolioId: value.portfolioId || activePortfolio?.id });
            closeDividend();
          }}
          onCancel={closeDividend}
        />
      </Modal>
    </div>
  );
}

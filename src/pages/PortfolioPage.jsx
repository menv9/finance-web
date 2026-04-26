import { useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { DividendForm } from '../components/forms/DividendForm';
import { HoldingForm } from '../components/forms/HoldingForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatCurrencyCompact, formatNumber } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { Card, Button, Stat, Table, EmptyState, Modal, FormField, Input } from '../components/ui';
import { rise } from '../utils/motion';

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

function groupHoldingsByTicker(holdings) {
  const groups = new Map();
  for (const holding of holdings) {
    const key = holding.ticker;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(holding);
  }
  return [...groups.entries()].map(([ticker, lots]) => {
    const quantity = lots.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
    const valueCents = lots.reduce(
      (sum, holding) => sum + Math.round(Number(holding.quantity || 0) * (holding.currentPriceCents || 0)),
      0,
    );
    const costCents = lots.reduce(
      (sum, holding) => sum + Math.round(Number(holding.quantity || 0) * (holding.averageBuyPriceCents || 0)) + (holding.feeCents || 0),
      0,
    );
    const feeCents = lots.reduce((sum, holding) => sum + (holding.feeCents || 0), 0);
    const quantityDecimals = Math.max(...lots.map((holding) => quantityDigits(holding)), 0);
    return {
      id: `group-${ticker}`,
      rowType: 'group',
      ticker,
      name: lots[0]?.name || ticker,
      platform: lots.length > 1 ? `${lots.length} operations` : lots[0]?.platform,
      quantity,
      quantityDecimals,
      averageBuyPriceCents: quantity ? Math.round(costCents / quantity) : 0,
      currentPriceCents: quantity ? Math.round(valueCents / quantity) : 0,
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

function buildHoldingRows(holdings) {
  return groupHoldingsByTicker(holdings).flatMap((group) => {
    const lotRows = group.lots.map((holding, index) => {
      const valueCents = Math.round(Number(holding.quantity || 0) * (holding.currentPriceCents || 0));
      const costCents = Math.round(Number(holding.quantity || 0) * (holding.averageBuyPriceCents || 0)) + (holding.feeCents || 0);
      const pnlCents = valueCents - costCents;
      return {
        ...holding,
        rowType: 'lot',
        operationNumber: index + 1,
        valueCents,
        costCents,
        pnlCents,
        pnlPct: costCents ? (pnlCents / costCents) * 100 : 0,
        rowClassName: 'bg-surface',
      };
    });
    return [group, ...lotRows];
  });
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

function SellHoldingForm({ holding, sale, currency, locale, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    percent: sale?.percent != null ? `${sale.percent}` : '100',
    salePrice: sale?.salePriceCents != null
      ? `${sale.salePriceCents / 100}`
      : holding?.currentPriceCents
        ? `${holding.currentPriceCents / 100}`
        : '',
    fee: sale?.feeCents ? `${sale.feeCents / 100}` : '',
    date: sale?.date || normalizeDateInput(new Date()),
  });

  const percent = Math.min(Math.max(Number(form.percent || 0), 0), 100);
  const salePriceCents = Math.round(Number(form.salePrice || 0) * 100);
  const feeCents = Math.round(Number(form.fee || 0) * 100);
  const soldQuantity = (holding?.quantity || 0) * (percent / 100);
  const grossProceedsCents = Math.round(soldQuantity * salePriceCents);
  const proceedsCents = Math.max(0, grossProceedsCents - feeCents);
  const holdingFeeCents = Math.round((holding?.feeCents || 0) * (percent / 100));
  const costBasisCents = Math.round(soldQuantity * (holding?.averageBuyPriceCents || 0)) + holdingFeeCents;
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
        });
      }}
    >
      <FormField label="Holding" className="md:col-span-2">
        <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-sm text-ink">
          <span className="font-mono">{holding.ticker}</span>
          <span className="ml-2 text-ink-muted">{holding.name}</span>
        </div>
      </FormField>

      <FormField label="Sell percentage" htmlFor="sell-percent" required>
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

      <FormField label="Sale price" htmlFor="sell-price" required>
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

      <FormField label="Sale date" htmlFor="sell-date" required>
        {(props) => (
          <Input
            {...props}
            type="date"
            value={form.date}
            onChange={set('date')}
          />
        )}
      </FormField>

      <FormField label="Commission" htmlFor="sell-fee">
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

      <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 text-sm">
        <p className="eyebrow text-ink-muted">Estimated result</p>
        <p className="mt-1 font-mono text-ink">
          {formatNumber(soldQuantity, locale, quantityDigits(holding))} qty - {formatCurrency(proceedsCents, currency, locale)}
        </p>
        <p className={realizedPnlCents >= 0 ? 'mt-1 text-positive' : 'mt-1 text-danger'}>
          {formatCurrency(realizedPnlCents, currency, locale)}
          <span className="ml-1 text-xs text-ink-muted">({formatNumber(realizedPnlPct, locale, 2)}%)</span>
        </p>
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {sale ? 'Save sale' : 'Sell holding'}
        </Button>
      </div>
    </form>
  );
}

function HoldingGroupForm({ group, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: group?.name || '',
    platform: group?.lots?.[0]?.platform || '',
    currentPrice: group?.currentPriceCents ? `${group.currentPriceCents / 100}` : '',
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
        });
      }}
    >
      <FormField label="Ticker" className="md:col-span-2">
        <div className="rounded-md border border-rule bg-surface-raised px-3 py-2.5 font-mono text-sm text-ink">
          {group.ticker}
        </div>
      </FormField>

      <FormField label="Name" htmlFor="holding-group-name">
        {(props) => (
          <Input {...props} value={form.name} onChange={set('name')} placeholder="Asset name" />
        )}
      </FormField>

      <FormField label="Platform" htmlFor="holding-group-platform">
        {(props) => (
          <Input {...props} value={form.platform} onChange={set('platform')} placeholder="Platform" />
        )}
      </FormField>

      <FormField label="Current price" htmlFor="holding-group-current-price" className="md:col-span-2">
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.01"
            min="0"
            value={form.currentPrice}
            onChange={set('currentPrice')}
            placeholder="0.00"
          />
        )}
      </FormField>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save changes
        </Button>
      </div>
    </form>
  );
}

export default function PortfolioPage() {
  const holdings = useFinanceStore((state) => state.holdings);
  const dividends = useFinanceStore((state) => state.dividends);
  const portfolioSales = useFinanceStore((state) => state.portfolioSales);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const sellHolding = useFinanceStore((state) => state.sellHolding);
  const updatePortfolioSale = useFinanceStore((state) => state.updatePortfolioSale);
  const removePortfolioSale = useFinanceStore((state) => state.removePortfolioSale);
  const executeTransfer = useFinanceStore((state) => state.executeTransfer);
  const saveDividend = useFinanceStore((state) => state.saveDividend);
  const removeDividend = useFinanceStore((state) => state.removeDividend);
  const refreshPrices = useFinanceStore((state) => state.refreshPrices);
  const confirm = useConfirm();
  const [holdingModal, setHoldingModal] = useState({ open: false, id: null });
  const [holdingGroupModal, setHoldingGroupModal] = useState({ open: false, ticker: null });
  const [dividendModal, setDividendModal] = useState({ open: false, id: null });
  const [sellModal, setSellModal] = useState({ open: false, holdingId: null, saleId: null });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
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
  const locale = settings.locale;
  const currency = settings.baseCurrency;
  const activeHoldings = holdings.filter((item) => !item.archivedAt && (item.quantity || 0) > 0);
  const holdingGroups = groupHoldingsByTicker(activeHoldings);
  const editingHoldingGroup = holdingGroups.find((group) => group.ticker === holdingGroupModal.ticker);

  const openNewHolding = () => setHoldingModal({ open: true, id: null });
  const openEditHolding = (id) => setHoldingModal({ open: true, id });
  const closeHolding = () => setHoldingModal({ open: false, id: null });
  const openEditHoldingGroup = (ticker) => setHoldingGroupModal({ open: true, ticker });
  const closeHoldingGroup = () => setHoldingGroupModal({ open: false, ticker: null });
  const openSellHolding = (id) => setSellModal({ open: true, holdingId: id, saleId: null });
  const openEditSale = (saleId) => setSellModal({ open: true, holdingId: null, saleId });
  const closeSellHolding = () => setSellModal({ open: false, holdingId: null, saleId: null });

  const openNewDividend = () => setDividendModal({ open: true, id: null });
  const openEditDividend = (id) => setDividendModal({ open: true, id });
  const closeDividend = () => setDividendModal({ open: false, id: null });

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshError('');
    try {
      await refreshPrices();
    } catch (err) {
      setRefreshError(err.message || 'Price refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const dividendColumns = [
    { key: 'date', header: 'Date', width: 110 },
    { key: 'ticker', header: 'Ticker' },
    {
      key: 'amountCents',
      header: 'Amount',
      numeric: true,
      render: (r) => formatCurrency(r.amountCents, r.currency, locale),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditDividend(r.id)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: 'Delete dividend', description: `Remove the ${r.ticker} dividend entry? This will also remove it from the income ledger.` }))
              removeDividend(r.id);
          }}>Delete</Button>
        </div>
      ),
    },
  ];

  const holdingRows = holdingGroups.flatMap((group) => {
    const lotRows = group.lots.map((holding, index) => {
      const valueCents = Math.round(Number(holding.quantity || 0) * (holding.currentPriceCents || 0));
      const costCents = Math.round(Number(holding.quantity || 0) * (holding.averageBuyPriceCents || 0)) + (holding.feeCents || 0);
      const pnlCents = valueCents - costCents;
      return {
        ...holding,
        rowType: 'lot',
        operationNumber: index + 1,
        valueCents,
        costCents,
        pnlCents,
        pnlPct: costCents ? (pnlCents / costCents) * 100 : 0,
        rowClassName: 'bg-surface',
      };
    });
    return [group, ...lotRows];
  });

  const sellAllHoldingGroup = async (group) => {
    if (!group) return;
    if (!(await confirm({
      title: 'Sell all operations',
      description: `Sell all ${group.ticker} operations at their current prices?`,
    }))) return;
    for (const lot of group.lots) {
      await sellHolding({
        holdingId: lot.id,
        percent: 100,
        salePriceCents: lot.currentPriceCents || group.currentPriceCents || 0,
        feeCents: 0,
        date: normalizeDateInput(new Date()),
      });
    }
  };

  const holdingColumns = [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-mono text-sm font-semibold text-ink' : 'pl-5 font-mono text-sm text-ink-muted'}>
          {r.rowType === 'group' ? r.ticker : `Operation ${r.operationNumber}`}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-medium text-ink' : 'text-ink-muted'}>
          {r.rowType === 'group' ? r.name : r.ticker}
        </span>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      hideOnMobile: true,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'text-xs text-ink' : 'text-xs text-ink-muted'}>
          {r.platform}
        </span>
      ),
    },
    { key: 'quantity', header: 'Qty', numeric: true, hideOnMobile: true, render: (r) => formatNumber(r.quantity, locale, quantityDigits(r)) },
    { key: 'avg', header: 'Avg buy', numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.averageBuyPriceCents, currency, locale) },
    { key: 'price', header: 'Price', numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.currentPriceCents, currency, locale) },
    { key: 'fee', header: 'Fees', numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.feeCents || 0, currency, locale) },
    { key: 'value', header: 'Value', numeric: true, render: (r) => formatCurrency(r.valueCents, currency, locale) },
    {
      key: 'pnl',
      header: 'P&L',
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
      hideOnMobile: true,
      render: (r) => r.rowType === 'group' ? (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditHoldingGroup(r.ticker)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => sellAllHoldingGroup(r)}>Sell all</Button>
        </div>
      ) : (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditHolding(r.id)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => openSellHolding(r.id)}>Sell</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: 'Delete holding', description: `Remove ${r.ticker} from your portfolio? This cannot be undone.` }))
              removeEntity('holdings', r.id);
          }}>Delete</Button>
        </div>
      ),
    },
  ];

  const historicalSaleRows = (portfolioSales || [])
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
  const salesPerformanceValues = salesPerformanceSeries.map((item) => item.cumulativePnlCents || 0);
  const salesPerformanceMin = Math.min(0, ...salesPerformanceValues);
  const salesPerformanceMax = Math.max(0, ...salesPerformanceValues);
  const salesPerformanceRange = salesPerformanceMax - salesPerformanceMin || 1;
  const salesPerformanceZeroOffset = ((salesPerformanceMax - 0) / salesPerformanceRange) * 100;
  const salesPerformanceTotalCents = salesPerformanceSeries.at(-1)?.cumulativePnlCents || 0;
  const salesPerformanceActiveColor =
    salesPerformanceTotalCents < 0 ? 'var(--danger)' : 'var(--positive)';

  const historicalColumns = [
    {
      key: 'date',
      header: 'Date',
      width: 110,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-medium text-ink' : 'text-ink-muted'}>
          {r.rowType === 'group' ? 'Total' : r.date}
        </span>
      ),
    },
    {
      key: 'ticker',
      header: 'Ticker',
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-mono text-sm font-semibold text-ink' : 'pl-5 font-mono text-sm text-ink-muted'}>
          {r.rowType === 'group' ? r.ticker : `Operation ${r.operationNumber}`}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      hideOnMobile: true,
      render: (r) => (
        <span className={r.rowType === 'group' ? 'font-medium text-ink' : 'text-ink-muted'}>
          {r.rowType === 'group' ? r.name : r.ticker}
        </span>
      ),
    },
    { key: 'quantity', header: 'Qty sold', numeric: true, hideOnMobile: true, render: (r) => formatNumber(r.quantity, locale, quantityDigits(r)) },
    {
      key: 'percent',
      header: 'Sold',
      numeric: true,
      hideOnMobile: true,
      render: (r) => r.rowType === 'group' ? `${r.percent} operations` : `${formatNumber(r.percent, locale, 2)}%`,
    },
    { key: 'salePrice', header: 'Sale price', numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.salePriceCents, currency, locale) },
    { key: 'fee', header: 'Fees', numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.feeCents || 0, currency, locale) },
    { key: 'proceeds', header: 'Proceeds', numeric: true, hideOnMobile: true, render: (r) => formatCurrency(r.proceedsCents, currency, locale) },
    {
      key: 'realizedPnl',
      header: 'Realized P&L',
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
      hideOnMobile: true,
      render: (r) => r.rowType === 'group' ? (
        <span className="eyebrow text-ink-faint">Total</span>
      ) : (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditSale(r.id)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: 'Delete sale', description: `Remove the ${r.ticker} sale and restore the sold quantity to the holding?` }))
              removePortfolioSale(r.id);
          }}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12">
      <PageHeader
        number="04"
        eyebrow="Module"
        title="Portfolio"
        description="Holdings, allocation, performance — and dividends that mirror into the income ledger automatically."
        actions={
          <>
            {refreshError && (
              <span className="text-xs text-danger">{refreshError}</span>
            )}
            <Button variant="secondary" size="sm" loading={refreshing} onClick={onRefresh}>
              {refreshing ? `Refreshing… (${activeHoldings.length} tickers, ~${Math.ceil(activeHoldings.length * 13 / 60)} min)` : 'Refresh prices'}
            </Button>
            <Button variant="primary" size="sm" onClick={openNewHolding}>
              <PlusIcon /> New holding
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Market value', value: portfolio.currentValueCents, mode: 'currency', hint: `${activeHoldings.length} holdings` },
          { label: 'TWRR', value: portfolio.twrr, mode: 'percent', hint: 'time-weighted' },
          { label: 'XIRR', value: portfolio.xirr, mode: 'percent', hint: 'cashflow-adjusted' },
          { label: 'Dividend yield', value: portfolio.dividendYield, mode: 'percent', hint: 'portfolio-wide' },
        ].map((k, i) => (
          <div key={k.label} className={'min-w-0 bg-surface p-6 ' + rise(i + 1)}>
            <Stat label={k.label} value={k.value} mode={k.mode} currency={currency} locale={locale} hint={k.hint} />
          </div>
        ))}
      </section>

      {/* allocation */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card eyebrow="Split" title="Allocation" className={'lg:col-span-5 ' + rise(2)}>
          {portfolio.allocationActual?.length ? (
            <div className="flex flex-col gap-5">
              <div className="relative mx-auto h-[190px] w-full max-w-[190px] sm:h-[220px] sm:max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolio.allocationActual}
                      dataKey="valueCents"
                      nameKey="ticker"
                      innerRadius="58%"
                      outerRadius="95%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {portfolio.allocationActual.map((item, index) => (
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
                {portfolio.allocationActual
                  .slice()
                  .sort((a, b) => b.valueCents - a.valueCents)
                  .map((item) => {
                    const originalIndex = portfolio.allocationActual.findIndex((s) => s.ticker === item.ticker);
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
            <EmptyState title="No holdings yet" description="Add a position to see the allocation." />
          )}
        </Card>

        <Card eyebrow="Rebalance" title="Target vs actual" variant="chart" className={'lg:col-span-7 ' + rise(3)}>
          {portfolio.allocationActual?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portfolio.allocationActual} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="ticker" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v) => `${formatNumber(v, locale, 1)}%`} />
                <Bar dataKey="actualWeight" fill="var(--accent)" radius={[3, 3, 0, 0]} name="Actual" />
                <Bar dataKey="targetWeight" fill="var(--ink-muted)" radius={[3, 3, 0, 0]} name="Target" opacity={0.45} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No targets set" description="Define target weights in Settings." />
          )}
        </Card>
      </section>

      {/* holdings */}
      <Card
        eyebrow="Register"
        title="Holdings"
        description="Refresh prices manually to fetch the latest market prices."
        action={
          <Button variant="primary" size="sm" onClick={openNewHolding}>
            <PlusIcon /> Add holding
          </Button>
        }
        className={rise(4)}
      >
        {holdingRows.length ? (
          <Table columns={holdingColumns} rows={holdingRows} density="compact" />
        ) : (
          <EmptyState
            title="No holdings yet"
            description="Add your first position — Trade Republic, IBKR, anywhere."
            action={
              <Button variant="secondary" size="sm" onClick={openNewHolding}>
                <PlusIcon /> Add holding
              </Button>
            }
          />
        )}
      </Card>

      {/* historical performance */}
      <Card
        eyebrow="History"
        title="Portfolio historical performance"
        description="Closed sale lots and realized performance from sold holdings."
        className={rise(5)}
      >
        {historicalRows.length ? (
          <Table columns={historicalColumns} rows={historicalRows} density="compact" />
        ) : (
          <EmptyState
            title="No sales yet"
            description="Sold holdings will appear here with realized P&L."
          />
        )}
      </Card>

      <Card
        eyebrow="Tracking"
        title="Sales performance"
        description="Cumulative realized P&L from sold holdings over time."
        action={
          salesPerformanceSeries.length ? (
            <div className="text-right">
              <p className="eyebrow text-ink-muted">Total P&L</p>
              <p className={salesPerformanceTotalCents >= 0 ? 'mt-1 font-mono text-lg text-positive' : 'mt-1 font-mono text-lg text-danger'}>
                {formatCurrency(salesPerformanceTotalCents, currency, locale)}
              </p>
            </div>
          ) : null
        }
        variant="chart"
        className={rise(6)}
      >
        {salesPerformanceSeries.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesPerformanceSeries} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesPnlStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--positive)" />
                  <stop offset={`${salesPerformanceZeroOffset}%`} stopColor="var(--positive)" />
                  <stop offset={`${salesPerformanceZeroOffset}%`} stopColor="var(--danger)" />
                  <stop offset="100%" stopColor="var(--danger)" />
                </linearGradient>
                <linearGradient id="salesPnlArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--positive)" stopOpacity={0.28} />
                  <stop offset={`${salesPerformanceZeroOffset}%`} stopColor="var(--positive)" stopOpacity={0.12} />
                  <stop offset={`${salesPerformanceZeroOffset}%`} stopColor="var(--danger)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.28} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis
                domain={[salesPerformanceMin, salesPerformanceMax]}
                tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(value, currency, locale),
                  name === 'cumulativePnlCents' ? 'Cumulative P&L' : 'Sale P&L',
                ]}
                labelFormatter={(_, payload) => {
                  const sale = payload?.[0]?.payload;
                  return sale ? `${sale.date} - ${sale.ticker}` : '';
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativePnlCents"
                stroke="url(#salesPnlStroke)"
                strokeWidth={1.75}
                fill="url(#salesPnlArea)"
                dot={false}
                baseValue={0}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--canvas)', fill: salesPerformanceActiveColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No sales performance yet" description="Sell a holding to start tracking realized performance." />
        )}
      </Card>

      {/* dividends */}
      <Card
        eyebrow="History"
        title="Dividends received"
        description="Linked to holdings; included in portfolio yield calculations. Mirrors into the income ledger automatically."
        action={
          <Button variant="primary" size="sm" onClick={openNewDividend}>
            <PlusIcon /> Add dividend
          </Button>
        }
        className={rise(7)}
      >
        {dividends.length ? (
          <Table columns={dividendColumns} rows={dividends} density="compact" />
        ) : (
          <EmptyState
            title="No dividends tracked yet"
            description="Log a payout — it will also appear in the income module."
            action={
              <Button variant="secondary" size="sm" onClick={openNewDividend}>
                <PlusIcon /> Add dividend
              </Button>
            }
          />
        )}
      </Card>

      <Modal
        open={holdingModal.open}
        onClose={closeHolding}
        eyebrow="Portfolio position"
        title={editingHolding ? 'Edit holding' : 'New holding'}
        description="Manual positions for any platform."
        size="lg"
      >
        <HoldingForm
          initialValue={editingHolding}
          onSubmit={async (value) => {
            const isNew = !value.id;
            const { fundingSource, purchaseAmountCents, ...holdingValue } = value;
            const saved = await saveEntity('holdings', holdingValue);
            if (isNew) {
              const baseCost = purchaseAmountCents > 0
                ? purchaseAmountCents
                : Math.round(saved.quantity * saved.averageBuyPriceCents);
              const cost = baseCost + (saved.feeCents || 0);
              if (cost > 0) {
                await executeTransfer({
                  date: normalizeDateInput(new Date()),
                  amountCents: cost,
                  fromModule: fundingSource === 'savings' ? 'savings' : 'cashflow',
                  fromId: null,
                  toModule: 'portfolio',
                  description: `${saved.ticker} purchase`,
                  holdingId: saved.id,
                  ticker: saved.ticker,
                });
              }
            }
            closeHolding();
          }}
          onCancel={closeHolding}
        />
      </Modal>

      <Modal
        open={holdingGroupModal.open}
        onClose={closeHoldingGroup}
        eyebrow="Portfolio ticker"
        title={editingHoldingGroup ? `Edit ${editingHoldingGroup.ticker}` : 'Edit ticker'}
        description="Update shared details across every operation for this ticker."
        size="md"
      >
        {editingHoldingGroup ? (
          <HoldingGroupForm
            group={editingHoldingGroup}
            onSubmit={async (value) => {
              for (const lot of editingHoldingGroup.lots) {
                await saveEntity('holdings', {
                  ...lot,
                  name: value.name,
                  platform: value.platform,
                  currentPriceCents: value.currentPriceCents,
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
        eyebrow="Portfolio sale"
        title={editingSale ? 'Edit sale' : 'Sell holding'}
        description={editingSale ? 'Update this historical sale and rebalance the holding quantity.' : 'Choose the percentage to sell and record the realized performance.'}
        size="lg"
      >
        {sellingHolding ? (
          <SellHoldingForm
            holding={sellingHolding}
            sale={editingSale}
            currency={currency}
            locale={locale}
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
        open={dividendModal.open}
        onClose={closeDividend}
        eyebrow="Dividend payout"
        title={editingDividend ? 'Edit dividend' : 'New dividend'}
        description="Logged payouts mirror into the income ledger and feed portfolio yield."
        size="md"
      >
        <DividendForm
          holdings={holdings}
          initialValue={editingDividend}
          onSubmit={async (value) => {
            await saveDividend(value);
            closeDividend();
          }}
          onCancel={closeDividend}
        />
      </Modal>
    </div>
  );
}

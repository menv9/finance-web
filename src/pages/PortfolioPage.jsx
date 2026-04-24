import { useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import {
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
import { formatCurrency, formatNumber } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { Card, Button, Stat, Table, EmptyState, Modal } from '../components/ui';
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function PortfolioPage() {
  const holdings = useFinanceStore((state) => state.holdings);
  const dividends = useFinanceStore((state) => state.dividends);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const saveDividend = useFinanceStore((state) => state.saveDividend);
  const removeDividend = useFinanceStore((state) => state.removeDividend);
  const refreshPrices = useFinanceStore((state) => state.refreshPrices);
  const confirm = useConfirm();
  const [holdingModal, setHoldingModal] = useState({ open: false, id: null });
  const [dividendModal, setDividendModal] = useState({ open: false, id: null });
  const [refreshing, setRefreshing] = useState(false);
  const editingHolding = holdings.find((item) => item.id === holdingModal.id);
  const editingDividend = dividends.find((item) => item.id === dividendModal.id);
  const locale = settings.locale;
  const currency = settings.baseCurrency;

  const openNewHolding = () => setHoldingModal({ open: true, id: null });
  const openEditHolding = (id) => setHoldingModal({ open: true, id });
  const closeHolding = () => setHoldingModal({ open: false, id: null });

  const openNewDividend = () => setDividendModal({ open: true, id: null });
  const openEditDividend = (id) => setDividendModal({ open: true, id });
  const closeDividend = () => setDividendModal({ open: false, id: null });

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refreshPrices(); } finally { setRefreshing(false); }
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

  const holdingRows = holdings.map((h) => {
    const valueCents = Math.round(h.quantity * h.currentPriceCents);
    const costCents = Math.round(h.quantity * h.averageBuyPriceCents);
    const pnlCents = valueCents - costCents;
    const pnlPct = costCents ? (pnlCents / costCents) * 100 : 0;
    return { ...h, valueCents, pnlCents, pnlPct };
  });

  const holdingColumns = [
    { key: 'ticker', header: 'Ticker', render: (r) => <span className="font-mono text-sm text-ink">{r.ticker}</span> },
    { key: 'name', header: 'Name' },
    { key: 'platform', header: 'Platform', render: (r) => <span className="text-xs text-ink-muted">{r.platform}</span> },
    { key: 'quantity', header: 'Qty', numeric: true, render: (r) => formatNumber(r.quantity, locale, 4) },
    { key: 'avg', header: 'Avg buy', numeric: true, render: (r) => formatCurrency(r.averageBuyPriceCents, currency, locale) },
    { key: 'price', header: 'Price', numeric: true, render: (r) => formatCurrency(r.currentPriceCents, currency, locale) },
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
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditHolding(r.id)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: 'Delete holding', description: `Remove ${r.ticker} from your portfolio? This cannot be undone.` }))
              removeEntity('holdings', r.id);
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
            <Button variant="secondary" size="sm" loading={refreshing} onClick={onRefresh}>
              Refresh prices
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
          { label: 'Market value', value: portfolio.currentValueCents, mode: 'currency', hint: `${holdings.length} holdings` },
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
              <div className="relative mx-auto h-[200px] w-full max-w-[220px] min-w-0">
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
                        `${formatCurrency(value, currency, locale)} · actual ${entry.payload.actualWeight.toFixed(
                          1,
                        )}% / target ${entry.payload.targetWeight.toFixed(1)}%`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-1.5">
                {portfolio.allocationActual
                  .slice()
                  .sort((a, b) => b.valueCents - a.valueCents)
                  .map((item) => {
                    const originalIndex = portfolio.allocationActual.findIndex(
                      (s) => s.ticker === item.ticker,
                    );
                    return (
                      <li key={item.ticker} className="flex items-baseline gap-3">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-sm"
                          style={{ background: COLORS[originalIndex % COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
                          <span className="truncate font-mono text-sm text-ink">{item.ticker}</span>
                          <span className="font-mono tabular text-xs text-ink-muted shrink-0">
                            {item.actualWeight.toFixed(1)}%
                          </span>
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
        description="Refresh prices manually to fetch the latest from Yahoo Finance."
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
        className={rise(5)}
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
            const saved = await saveEntity('holdings', value);
            if (isNew) {
              const cost = Math.round(saved.quantity * saved.averageBuyPriceCents);
              if (cost > 0) {
                await saveEntity('portfolioCashflows', {
                  date: normalizeDateInput(new Date()),
                  amountCents: cost,
                  holdingId: saved.id,
                  ticker: saved.ticker,
                  kind: 'buy',
                });
              }
            }
            closeHolding();
          }}
          onCancel={closeHolding}
        />
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

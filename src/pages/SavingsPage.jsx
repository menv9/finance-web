import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
import { TransferForm } from '../components/forms/TransferForm';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { SavingsEntryForm } from '../components/forms/SavingsEntryForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { chartMonthLabel, monthKey, normalizeDateInput } from '../utils/dates';
import { Card, Button, Stat, FormField, Input, Select, Modal, EmptyState, SectionDivider } from '../components/ui';
import { rise } from '../utils/motion';

// ── Helpers ─────────────────────────────────────────────────────────────────

function projectSavings(startCents, monthlyContributionCents, annualReturnRate, years) {
  const r = annualReturnRate / 100 / 12;
  const points = [];
  for (let y = 0; y <= years; y++) {
    const n = y * 12;
    const value =
      r === 0
        ? startCents + monthlyContributionCents * n
        : startCents * Math.pow(1 + r, n) +
          monthlyContributionCents * ((Math.pow(1 + r, n) - 1) / r);
    points.push({ year: y, label: y === 0 ? 'Now' : `${y}y`, valueCents: Math.round(value) });
  }
  return points;
}

function computeMonthlyAvg(entries) {
  if (!entries.length) return 0;
  const total = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = new Date(sorted[0].date);
  const now = new Date();
  const months = Math.max(
    1,
    (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1,
  );
  return Math.round(total / months);
}

function yearsToGoal(projection, goalCents) {
  if (!goalCents) return null;
  const hit = projection.find((p) => p.valueCents >= goalCents);
  return hit ? hit.year : null;
}

function monthKeyOffset(monthsBack) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return monthKey(date);
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
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5a2.121 2.121 0 0 1 3 3L5 15H2v-3L11.5 2.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" />
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function SavingsTooltip({ active, payload, label, currency, locale }) {
  if (!active || !payload?.length) return null;
  const amountCents = payload.find((item) => item.dataKey === 'amountCents')?.value ?? payload[0]?.payload?.amountCents;
  if (amountCents == null) return null;

  return (
    <div className="rounded-md border border-rule-strong bg-surface-raised px-3 py-2 shadow-card">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">
        Saved this month: {formatCurrency(amountCents, currency, locale)}
      </p>
    </div>
  );
}

export default function SavingsPage() {
  const savingsConfig      = useFinanceStore((state) => state.savingsConfig);
  const savingsEntries     = useFinanceStore((state) => state.savingsEntries);
  const saveSavingsConfig  = useFinanceStore((state) => state.saveSavingsConfig);
  const saveSavingsEntry   = useFinanceStore((state) => state.saveSavingsEntry);
  const removeSavingsEntry = useFinanceStore((state) => state.removeSavingsEntry);
  const executeTransfer    = useFinanceStore((state) => state.executeTransfer);
  const settings           = useFinanceStore((state) => state.settings);

  const confirm = useConfirm();
  const currency = settings.baseCurrency;
  const locale   = settings.locale;

  // ── Config form state ──
  const [config, setConfig] = useState({
    currentBalance:   savingsConfig.currentBalanceCents  ? (savingsConfig.currentBalanceCents  / 100).toFixed(2) : '',
    monthlySavings:   savingsConfig.monthlyOverrideCents ? (savingsConfig.monthlyOverrideCents / 100).toFixed(2) : '',
    annualReturnRate: savingsConfig.annualReturnRate ?? 0,
    goal:             savingsConfig.goalCents            ? (savingsConfig.goalCents            / 100).toFixed(2) : '',
    projectionYears:  savingsConfig.projectionYears ?? 30,
  });
  const [configDirty, setConfigDirty] = useState(false);

  const changeConfig = (field) => (e) => {
    setConfig((f) => ({ ...f, [field]: e.target.value }));
    setConfigDirty(true);
  };

  const saveConfig = async () => {
    await saveSavingsConfig({
      currentBalanceCents:  Math.round(parseFloat(config.currentBalance  || 0) * 100),
      monthlyOverrideCents: Math.round(parseFloat(config.monthlySavings  || 0) * 100),
      annualReturnRate:     parseFloat(config.annualReturnRate || 0),
      goalCents:            Math.round(parseFloat(config.goal            || 0) * 100),
      projectionYears:      Number(config.projectionYears),
    });
    setConfigDirty(false);
  };

  // ── Modal state ──
  const [modal, setModal] = useState({ open: false, id: null });
  const openNew  = () => setModal({ open: true,  id: null });
  const openEdit = (id) => setModal({ open: true, id });
  const close    = () => setModal({ open: false, id: null });
  const editingEntry = savingsEntries.find((e) => e.id === modal.id);
  const [transferOpen, setTransferOpen] = useState(false);
  const [savingsChartPeriod, setSavingsChartPeriod] = useState('12');

  // ── Derived values ──
  const currentBalanceCents  = savingsConfig.currentBalanceCents  || 0;
  const monthlySavingsCents  = savingsConfig.monthlyOverrideCents || 0;
  const annualReturnRate     = savingsConfig.annualReturnRate ?? 0;
  const goalCents            = savingsConfig.goalCents || 0;
  const projectionYears      = Number(config.projectionYears) || 30;
  const xAxisInterval        = projectionYears <= 10 ? 0 : projectionYears <= 20 ? 1 : 4;

  const totalEntriesCents = useMemo(
    () => savingsEntries.reduce((sum, e) => sum + e.amountCents, 0),
    [savingsEntries],
  );
  const totalSavedCents = currentBalanceCents + totalEntriesCents;

  const thisMonthKey = monthKey(new Date());
  const savedThisMonthCents = useMemo(
    () => savingsEntries
      .filter((e) => monthKey(e.date) === thisMonthKey)
      .reduce((sum, e) => sum + e.amountCents, 0),
    [savingsEntries, thisMonthKey],
  );

  const realAvgCents = useMemo(() => computeMonthlyAvg(savingsEntries), [savingsEntries]);

  const monthlyChartData = useMemo(() => {
    const map = {};
    savingsEntries.forEach((e) => {
      const key = monthKey(e.date);
      map[key] = (map[key] || 0) + e.amountCents;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amountCents]) => ({
        month,
        label: chartMonthLabel(month + '-15'),
        amountCents,
      }));
  }, [savingsEntries]);

  const visibleMonthlyChartData = useMemo(() => {
    const cutoffMonth = monthKeyOffset(Number(savingsChartPeriod) - 1);
    return monthlyChartData.filter((item) => item.month >= cutoffMonth);
  }, [monthlyChartData, savingsChartPeriod]);

  const monthlySavingSegments = useMemo(
    () =>
      visibleMonthlyChartData.slice(1).map((point, index) => {
        const previous = visibleMonthlyChartData[index];
        return {
          key: `${previous.month}-${point.month}`,
          color: point.amountCents >= previous.amountCents ? 'var(--accent)' : 'var(--danger)',
          data: visibleMonthlyChartData.map((item, itemIndex) => ({
            ...item,
            segmentAmountCents:
              itemIndex === index || itemIndex === index + 1 ? item.amountCents : null,
          })),
        };
      }),
    [visibleMonthlyChartData],
  );

  const savingsTrendData = useMemo(() => {
    const map = {};
    savingsEntries.forEach((e) => {
      const key = monthKey(e.date);
      map[key] = (map[key] || 0) + e.amountCents;
    });

    const months = Object.keys(map).sort((a, b) => a.localeCompare(b));
    if (!months.length) {
      return currentBalanceCents
        ? [{
            month: thisMonthKey,
            label: chartMonthLabel(thisMonthKey + '-15'),
            savedCents: currentBalanceCents,
          }]
        : [];
    }

    let runningTotal = currentBalanceCents;
    return months.map((month) => {
      runningTotal += map[month];
      return {
        month,
        label: chartMonthLabel(month + '-15'),
        savedCents: runningTotal,
      };
    });
  }, [currentBalanceCents, savingsEntries, thisMonthKey]);

  // Projection uses only explicitly set monthly savings — entries are historical records
  const projection = useMemo(
    () => projectSavings(totalSavedCents, monthlySavingsCents, annualReturnRate, projectionYears),
    [totalSavedCents, monthlySavingsCents, annualReturnRate, projectionYears],
  );

  const goalYear      = yearsToGoal(projection, goalCents);
  const goalProgress  = goalCents > 0 ? Math.min(100, (totalSavedCents / goalCents) * 100) : 0;

  // ── Filters ──
  const [filterMonth, setFilterMonth] = useState(normalizeDateInput(new Date()).slice(0, 7));
  const [filterType, setFilterType] = useState('all'); // 'all' | 'deposit' | 'withdrawal'

  const filteredEntries = useMemo(
    () =>
      savingsEntries.filter(
        (e) =>
          (!filterMonth || e.date.startsWith(filterMonth)) &&
          (filterType === 'all' ||
            (filterType === 'deposit' && e.amountCents >= 0) ||
            (filterType === 'withdrawal' && e.amountCents < 0)),
      ),
    [savingsEntries, filterMonth, filterType],
  );

  const { sortKey: savSortKey, sortDir: savSortDir, onSort: onSavSort } = useSortable('date', 'desc');
  const sortedEntries = useMemo(
    () => sortRows(filteredEntries, savSortKey, savSortDir),
    [filteredEntries, savSortKey, savSortDir],
  );

  // Transfer-linked entries can only be removed via the Transfers page
  const isEntrySelectable = (e) => !e.transferId;
  const batchSelect = useBatchSelect(sortedEntries, isEntrySelectable);

  useEffect(() => { batchSelect.cancel(); }, [filterMonth, filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBatchDeleteEntries = async () => {
    const ids = [...batchSelect.selectedIds];
    const ok = await confirm({
      title: `Delete ${ids.length} savings entr${ids.length !== 1 ? 'ies' : 'y'}`,
      description: 'These entries will be permanently removed from your log.',
    });
    if (!ok) return;
    for (const id of ids) await removeSavingsEntry(id);
    batchSelect.cancel();
  };

  // ── Entry list (card-list style matching Income / Expenses) ──
  function SavingsEntryList({ rows }) {
    if (!rows.length) {
      return (
        <EmptyState
          title="No results for this filter"
          description="Try a different month or type."
        />
      );
    }
    return (
      <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
        {rows.map((r) => (
          <li
            key={r.id}
            className={batchSelect.selecting && batchSelect.selectedIds.has(r.id) ? 'bg-accent-soft' : 'transition-colors duration-120 hover:bg-surface-raised'}
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              {batchSelect.selecting && (
                isEntrySelectable(r) ? (
                  <input
                    type="checkbox"
                    aria-label="Select entry"
                    checked={batchSelect.selectedIds.has(r.id)}
                    onChange={() => batchSelect.toggle(r.id)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[color:var(--accent)]"
                  />
                ) : (
                  <span className="mt-1 block h-4 w-4 shrink-0" />
                )
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {r.note || <span className="text-ink-faint">—</span>}
                  </p>
                  <span className={`numeric shrink-0 rounded px-1.5 py-0.5 text-sm tabular ${r.amountCents < 0 ? 'text-danger bg-danger-soft' : 'text-positive bg-positive-soft'}`}>
                    {r.amountCents < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(r.amountCents), currency, locale).replace(/^[−-]/, '')}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                  <p className="min-w-0 truncate eyebrow">
                    {r.amountCents < 0 ? 'withdrawal' : 'deposit'} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(r.date))}
                  </p>
                  {r.transferId ? (
                    <span className="shrink-0 text-xs text-ink-faint">via transfer</span>
                  ) : (
                    <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                        aria-label="Edit entry"
                        title="Edit"
                        onClick={() => openEdit(r.id)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                        aria-label="Delete entry"
                        title="Delete"
                        onClick={async () => {
                          if (await confirm({ title: 'Delete savings entry', description: 'This entry will be permanently removed from your log.' }))
                            removeSavingsEntry(r.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="05"
        eyebrow="Module"
        title="Savings"
        description="Log what you put aside and project how your money grows over time."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
              Transfer
            </Button>
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> Add saving
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <section className="flex w-full flex-col gap-5 md:h-[172px] md:flex-row md:items-stretch md:justify-center">
        <div className={'min-w-0 rounded-lg border border-rule bg-surface p-6 md:flex md:min-w-[360px] md:flex-col md:items-center md:justify-center ' + rise(1)}>
          <Stat
            label="Total saved"
            value={totalSavedCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="starting balance + logged entries"
            align="center"
            valueClassName="text-accent-strong"
          />
        </div>
        <div className={'min-w-0 overflow-hidden rounded-lg border border-rule bg-surface p-3 md:w-[420px] ' + rise(2)}>
          <p className="eyebrow mb-2 text-center">Savings evolution</p>
          <div className="flex min-h-28 items-center pt-3 md:h-[124px] md:min-h-0">
            {savingsTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={savingsTrendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="savingsKpiArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={false} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={false}
                    tickLine={false}
                    axisLine={false}
                    width={0}
                  />
                  <Tooltip formatter={(v) => [formatCurrency(v, currency, locale), 'Saved']} />
                  <Area
                    type="monotone"
                    dataKey="savedCents"
                    stroke="var(--accent)"
                    strokeWidth={1.75}
                    fill="url(#savingsKpiArea)"
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--canvas)', fill: 'var(--accent)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-ink-faint">
                Add savings to see the curve.
              </div>
            )}
          </div>
        </div>
        <div className="grid min-w-0 gap-px overflow-hidden rounded-lg border border-rule bg-rule md:grid-cols-2">
          <div className={'min-w-0 bg-surface p-4 md:flex md:min-w-[260px] md:flex-col md:items-center md:justify-center md:px-6 md:py-2 ' + rise(3)}>
            <Stat
              label="This month"
              value={savedThisMonthCents}
              mode="currency"
              currency={currency}
              locale={locale}
              hint="saved so far this month"
              size="compact"
              align="center"
              tone="muted"
            />
          </div>
          <div className={'min-w-0 bg-surface p-4 md:flex md:min-w-[260px] md:flex-col md:items-center md:justify-center md:px-6 md:py-2 ' + rise(4)}>
            <Stat
              label="Monthly avg"
              value={realAvgCents}
              mode="currency"
              currency={currency}
              locale={locale}
              hint="avg per month from your log"
              size="compact"
              align="center"
              tone="muted"
            />
          </div>
        </div>
      </section>

      {/* Entries chart */}
      <Card
        eyebrow="History"
        title="Savings over time"
        description="Monthly totals from your logged entries."
        variant="chart"
        className={rise(2)}
        action={
          <>
            <Select
              aria-label="Savings chart period"
              value={savingsChartPeriod}
              onChange={(e) => setSavingsChartPeriod(e.target.value)}
              className="h-10 min-w-[150px] py-2 text-sm"
            >
              <option value="6">Last 6 months</option>
              <option value="12">Last year</option>
              <option value="24">Last 2 years</option>
            </Select>
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> Add saving
            </Button>
          </>
        }
      >
        {visibleMonthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleMonthlyChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                type="category"
                allowDuplicatedCategory={false}
                interval={visibleMonthlyChartData.length <= 12 ? 0 : 'preserveStartEnd'}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                dataKey="amountCents"
                type="number"
                tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
                tickLine={false} axisLine={false} width={60}
              />
              <Tooltip
                content={(props) => (
                  <SavingsTooltip {...props} currency={currency} locale={locale} />
                )}
              />
              {monthlySavingSegments.map((segment) => (
                <Line
                  key={segment.key}
                  data={segment.data}
                  type="linear"
                  dataKey="segmentAmountCents"
                  stroke={segment.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              ))}
              <Line
                dataKey="amountCents"
                type="linear"
                stroke="transparent"
                strokeWidth={0}
                dot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--canvas)', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--canvas)', strokeWidth: 2 }}
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink-faint">No entries yet — add your first saving to see the chart.</p>
          </div>
        )}
      </Card>

      {/* ── SECTION 1: Savings history ─────────────────────────────────────── */}

      {/* Entries log */}
      <Card
        eyebrow="Log"
        title="Savings entries"
        description="Every time you put money aside, log it here."
        className={rise(3)}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {!batchSelect.selecting && (
              <Button variant="secondary" size="sm" onClick={batchSelect.start}>
                Select
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> Add saving
            </Button>
          </div>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label="Month" htmlFor="savings-month">
            <Input
              id="savings-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </FormField>
          <FormField label="Type" htmlFor="savings-type">
            <Select id="savings-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All entries</option>
              <option value="deposit">Deposits only</option>
              <option value="withdrawal">Withdrawals only</option>
            </Select>
          </FormField>
        </div>
        <BatchDeleteBar
          selecting={batchSelect.selecting}
          selectedCount={batchSelect.selectedIds.size}
          onDelete={handleBatchDeleteEntries}
          onCancel={batchSelect.cancel}
        />
        {savingsEntries.length ? (
          <SavingsEntryList rows={sortedEntries} />
        ) : (
          <EmptyState
            title="No savings logged yet"
            description="Start logging what you put aside each month."
            action={
              <Button variant="secondary" size="sm" onClick={openNew}>
                <PlusIcon /> Add saving
              </Button>
            }
          />
        )}
      </Card>

      {/* ── SECTION 2: Future projection ───────────────────────────────────── */}

      {/* Projection config */}
      <Card
        eyebrow="Projection"
        title="Future projection setup"
        description="Set your starting balance, how much you save each month, interest rate, and goal. Independent from your entry log."
        className={rise(4)}
        action={
          <Button variant={configDirty ? 'primary' : 'secondary'} size="sm" onClick={saveConfig} disabled={!configDirty}>
            {configDirty ? 'Save changes' : 'Saved'}
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            label={`Starting balance (${currency})`}
            hint="What you currently have saved"
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" step="0.01" numeric placeholder="0.00"
                value={config.currentBalance} onChange={changeConfig('currentBalance')} {...a11y} />
            )}
          </FormField>

          <FormField
            label={`Monthly savings (${currency})`}
            hint="How much you plan to save each month"
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" step="0.01" numeric placeholder="0.00"
                value={config.monthlySavings} onChange={changeConfig('monthlySavings')} {...a11y} />
            )}
          </FormField>

          <FormField
            label="Interest rate (%)"
            hint="0 for cash savings, or your account's rate"
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" max="100" step="0.1" numeric placeholder="0"
                value={config.annualReturnRate} onChange={changeConfig('annualReturnRate')} {...a11y} />
            )}
          </FormField>

          <FormField
            label={`Savings goal (${currency})`}
            hint="Optional target amount"
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" step="0.01" numeric placeholder="0.00"
                value={config.goal} onChange={changeConfig('goal')} {...a11y} />
            )}
          </FormField>
        </div>
      </Card>

      {/* Projection chart */}
      <Card
        eyebrow={`${projectionYears}-year projection`}
        title="Growth over time"
        variant="chart"
        className={rise(5)}
        action={
          <div className="relative inline-flex items-center">
            <select
              value={config.projectionYears}
              onChange={changeConfig('projectionYears')}
              aria-label="Projection period"
              className="appearance-none cursor-pointer rounded-md border border-rule-strong bg-surface-raised pl-3 pr-7 h-8 text-xs text-ink-muted hover:text-ink hover:border-ink-faint transition-colors duration-180 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-sans"
            >
              {[5, 10, 15, 20, 25, 30, 40, 50].map((y) => (
                <option key={y} value={y}>{y} years</option>
              ))}
            </select>
            <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-ink-faint">
              <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={projection} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={xAxisInterval} />
            <YAxis
              tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
              tickLine={false} axisLine={false} width={60}
            />
            <Tooltip formatter={(v) => [formatCurrency(v, currency, locale), 'Value']} />
            {goalCents > 0 && (
              <ReferenceLine
                y={goalCents}
                stroke="var(--positive)"
                strokeDasharray="4 4"
                label={{ value: 'Goal', position: 'insideTopRight', fill: 'var(--positive)', fontSize: 11 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="valueCents"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#savingsGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#fbbf24' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Goal progress */}
      {goalCents > 0 && (
        <Card eyebrow="Goal" title="Progress towards target" className={rise(6)}>
          <div className="grid gap-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-ink-muted">
                {formatCurrency(totalSavedCents, currency, locale)}{' '}
                <span className="text-ink-faint">of</span>{' '}
                {formatCurrency(goalCents, currency, locale)}
              </p>
              <p className="numeric text-sm font-medium text-ink">{goalProgress.toFixed(1)}%</p>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-sunken overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <p className="text-sm text-ink-muted">
              {goalYear === 0 ? (
                <span className="text-positive font-medium">You&apos;ve already reached your goal!</span>
              ) : goalYear !== null ? (
                <>
                  At your current rate you&apos;ll reach your goal in{' '}
                  <span className="text-ink font-medium">{goalYear} year{goalYear !== 1 ? 's' : ''}</span>.
                </>
              ) : (
                <span className="text-danger">
                  Your current savings rate won&apos;t reach the goal within {projectionYears} years.
                  Try increasing your monthly savings, interest rate, or projection period.
                </span>
              )}
            </p>
          </div>
        </Card>
      )}

      {/* Entry modal */}
      <Modal
        open={modal.open}
        onClose={close}
        eyebrow="Savings entry"
        title={editingEntry ? 'Edit entry' : 'Log a saving'}
        description="Record an amount you set aside."
      >
        <SavingsEntryForm
          initialValue={editingEntry}
          currency={currency}
          onSubmit={async (value) => {
            await saveSavingsEntry(value);
            close();
          }}
          onCancel={close}
        />
      </Modal>

      {/* Transfer modal */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        eyebrow="Money movement"
        title="New transfer from savings"
        description="Pay an expense from savings or move money to your portfolio."
        size="md"
      >
        <TransferForm
          defaultFromModule="savings"
          onSubmit={async (spec) => {
            await executeTransfer(spec);
            setTransferOpen(false);
          }}
          onCancel={() => setTransferOpen(false)}
        />
      </Modal>
    </div>
  );
}
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { TransferForm } from '../components/forms/TransferForm';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
import { monthKey } from '../utils/dates';
import { Card, Button, Stat, FormField, Input, Modal, EmptyState, Table, SectionDivider } from '../components/ui';
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

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

  // Monthly entries chart data — grouped by month
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
        label: new Date(month + '-15').toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
        amountCents,
      }));
  }, [savingsEntries, locale]);

  // Projection uses only explicitly set monthly savings — entries are historical records
  const projection = useMemo(
    () => projectSavings(totalSavedCents, monthlySavingsCents, annualReturnRate, projectionYears),
    [totalSavedCents, monthlySavingsCents, annualReturnRate, projectionYears],
  );

  const projectionEnd = projection.at(-1)?.valueCents ?? 0;
  const goalYear      = yearsToGoal(projection, goalCents);
  const goalProgress  = goalCents > 0 ? Math.min(100, (totalSavedCents / goalCents) * 100) : 0;

  // Transfer-linked entries can only be removed via the Transfers page
  const isEntrySelectable = (e) => !e.transferId;
  const batchSelect = useBatchSelect(savingsEntries, isEntrySelectable);

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

  // ── Table columns ──
  const entryColumns = [
    { key: 'date', header: 'Date', width: 110 },
    {
      key: 'type',
      header: 'Type',
      width: 90,
      render: (r) =>
        r.amountCents < 0 ? (
          <span className="inline-flex items-center rounded-sm bg-danger-soft border border-danger/20 px-2 py-0.5 text-xs text-danger">
            Withdrawal
          </span>
        ) : (
          <span className="inline-flex items-center rounded-sm bg-surface-sunken border border-rule px-2 py-0.5 text-xs text-ink-muted">
            Deposit
          </span>
        ),
    },
    { key: 'note', header: 'Note', render: (r) => r.note || <span className="text-ink-faint">—</span> },
    {
      key: 'amountCents',
      header: 'Amount',
      numeric: true,
      render: (r) => (
        <span className={r.amountCents < 0 ? 'text-danger font-mono tabular' : 'font-mono tabular'}>
          {r.amountCents < 0 ? '−' : '+'}
          {formatCurrency(Math.abs(r.amountCents), currency, locale).replace(/^[−-]/, '')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {!r.transferId && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(r.id)}>Edit</Button>
          )}
          {r.transferId ? (
            <span className="text-xs text-ink-faint px-2 py-1">via transfer</span>
          ) : (
            <Button variant="ghost" size="sm" onClick={async () => {
              if (await confirm({ title: 'Delete savings entry', description: 'This entry will be permanently removed from your log.' }))
                removeSavingsEntry(r.id);
            }}>Delete</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12">
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
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2 lg:grid-cols-4">
        <div className={'min-w-0 bg-surface p-6 ' + rise(1)}>
          <Stat
            label="Total saved"
            value={totalSavedCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="starting balance + logged entries"
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label="This month"
            value={savedThisMonthCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="saved so far this month"
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat
            label="Monthly avg"
            value={realAvgCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="avg per month from your log"
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(4)}>
          <Stat
            label={`In ${projectionYears} years`}
            value={projectionEnd}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={annualReturnRate > 0 ? `at ${annualReturnRate}% p.a.` : 'set up projection below'}
          />
        </div>
      </section>

      {/* ── SECTION 1: Savings history ─────────────────────────────────────── */}

      {/* Entries log */}
      <Card
        eyebrow="Log"
        title="Savings entries"
        description="Every time you put money aside, log it here."
        className={rise(2)}
        action={
          <div className="flex gap-2">
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
        <BatchDeleteBar
          selecting={batchSelect.selecting}
          selectedCount={batchSelect.selectedIds.size}
          onDelete={handleBatchDeleteEntries}
          onCancel={batchSelect.cancel}
        />
        {savingsEntries.length ? (
          <Table
            columns={entryColumns}
            rows={[...savingsEntries].sort((a, b) => b.date.localeCompare(a.date))}
            selectable={batchSelect.selecting}
            selectedIds={batchSelect.selectedIds}
            onToggleRow={batchSelect.toggle}
            onToggleAll={batchSelect.toggleAll}
            isRowSelectable={isEntrySelectable}
          />
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

      {/* Entries chart */}
      <Card
        eyebrow="History"
        title="Savings over time"
        description="Monthly totals from your logged entries."
        variant="chart"
        className={rise(3)}
        action={
          <Button variant="primary" size="sm" onClick={openNew}>
            <PlusIcon /> Add saving
          </Button>
        }
      >
        {monthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
                tickLine={false} axisLine={false} width={60}
              />
              <Tooltip formatter={(v) => [formatCurrency(v, currency, locale), 'Saved']} />
              <Bar dataKey="amountCents" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink-faint">No entries yet — add your first saving to see the chart.</p>
          </div>
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
                <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
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
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#savingsGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--accent)' }}
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

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
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
import { Card, Button, Stat, InfoPopover, FormField, Input, Select, Modal, EmptyState, SectionDivider } from '../components/ui';
import { rise } from '../utils/motion';
import { useTranslation } from '../i18n/useTranslation';

// ── Withdrawal modal ────────────────────────────────────────────────────────

function WithdrawalModal({ open, onClose, balanceCents, currency, locale, bankAccounts = [], onSubmit }) {
  const { t } = useTranslation();
  const alert = useAlert();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => normalizeDateInput(new Date()));
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState(
    () => bankAccounts.find((account) => account.isMain)?.id || bankAccounts[0]?.id || '',
  );
  const [submitting, setSubmitting] = useState(false);

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const isOver = amountCents > 0 && amountCents > balanceCents;
  const canSubmit = amountCents > 0 && !isOver && (!bankAccounts.length || bankAccountId);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ amountCents, date, description: description.trim(), bankAccountId });
    } catch (err) {
      await alert({ title: t('savings.withdrawalModal.errorWithdrawal.title'), description: err.message || t('savings.withdrawalModal.errorWithdrawal.description') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t('savings.withdrawalModal.eyebrow')}
      title={t('savings.withdrawalModal.title')}
      description={t('savings.withdrawalModal.description')}
      size="sm"
    >
      <div className="grid gap-5">
        {/* Balance pill */}
        <div className="flex items-center justify-between rounded-lg border border-rule bg-surface-raised px-4 py-3">
          <p className="text-sm text-ink-muted">{t('savings.withdrawalModal.availableLabel')}</p>
          <p className="numeric text-sm font-semibold text-ink">
            {formatCurrency(balanceCents, currency, locale)}
          </p>
        </div>

        {/* Amount + Date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('savings.withdrawalModal.amountLabel', { currency })} htmlFor="wd-amount">
            <Input
              id="wd-amount"
              type="number"
              min="0.01"
              step="0.01"
              numeric
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label={t('savings.withdrawalModal.dateLabel')} htmlFor="wd-date">
            <Input
              id="wd-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>
        </div>

        {bankAccounts.length ? (
          <FormField label={t('savings.withdrawalModal.destinationBank')} htmlFor="wd-bank" required>
            {(props) => (
              <Select
                {...props}
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                required
              >
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.isMain ? t('savings.withdrawalModal.mainSuffix') : ''}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        ) : null}

        {/* Overdraft warning */}
        {isOver && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {t('savings.withdrawalModal.overdraftWarning', { amount: formatCurrency(balanceCents, currency, locale) })}
          </p>
        )}

        {/* Description */}
        <FormField label={t('savings.withdrawalModal.descriptionLabel')} htmlFor="wd-desc">
          <Input
            id="wd-desc"
            type="text"
            placeholder={t('savings.withdrawalModal.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            {t('savings.withdrawalModal.withdraw')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  const cashEntries = entries.filter((entry) => entry.source !== 'allocation');
  if (!cashEntries.length) return 0;
  const total = cashEntries.reduce((sum, e) => sum + e.amountCents, 0);
  const sorted = [...cashEntries].sort((a, b) => a.date.localeCompare(b.date));
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

function entryReportMonth(entry) {
  return entry.accountingMonth || entry.date?.slice(0, 7);
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
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const amountCents = payload.find((item) => item.dataKey === 'amountCents')?.value ?? payload[0]?.payload?.amountCents;
  if (amountCents == null) return null;

  return (
    <div className="rounded-md border border-rule-strong bg-surface-raised px-3 py-2 shadow-card">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">
        {t('savings.evolutionChart.savedTooltip', { amount: formatCurrency(amountCents, currency, locale) })}
      </p>
    </div>
  );
}

function SavingsGoalForm({ initialValue, currency, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: initialValue?.name || '',
    target: initialValue?.targetCents ? (initialValue.targetCents / 100).toFixed(2) : '',
  });

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          name: form.name.trim(),
          targetCents: Math.round(Number(form.target || 0) * 100),
        });
      }}
    >
      <FormField label={t('savings.goalModal.nameLabel')} htmlFor="savings-goal-name" required>
        {(props) => (
          <Input
            {...props}
            value={form.name}
            onChange={set('name')}
            placeholder={t('savings.goalModal.namePlaceholder')}
            required
          />
        )}
      </FormField>
      <FormField label={t('savings.goalModal.targetLabel', { currency })} htmlFor="savings-goal-target" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            min="0.01"
            step="0.01"
            numeric
            value={form.target}
            onChange={set('target')}
            placeholder="0.00"
            required
          />
        )}
      </FormField>
      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {initialValue ? t('savings.goalModal.saveChanges') : t('savings.goalModal.addGoal')}
        </Button>
      </div>
    </form>
  );
}

function BucketSpendForm({ goal, categories, currency, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    date: normalizeDateInput(new Date()),
    amount: '',
    category: categories[0] || '',
    description: goal ? `${goal.name} expense from bucket` : '',
  });

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          date: form.date,
          amountCents: Math.round(Number(form.amount || 0) * 100),
          category: form.category,
          description: form.description.trim(),
        });
      }}
    >
      <FormField label={t('savings.bucketSpendModal.dateLabel')} htmlFor="bucket-spend-date">
        {(props) => <Input {...props} type="date" value={form.date} onChange={set('date')} required />}
      </FormField>
      <FormField label={t('savings.bucketSpendModal.amountLabel', { currency })} htmlFor="bucket-spend-amount" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            min="0.01"
            step="0.01"
            numeric
            value={form.amount}
            onChange={set('amount')}
            placeholder="0.00"
            required
          />
        )}
      </FormField>
      <FormField label={t('savings.bucketSpendModal.categoryLabel')} htmlFor="bucket-spend-category">
        {(props) => (
          <Select {...props} value={form.category} onChange={set('category')}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label={t('savings.bucketSpendModal.descriptionLabel')} htmlFor="bucket-spend-description">
        {(props) => (
          <Input
            {...props}
            value={form.description}
            onChange={set('description')}
            placeholder={t('savings.bucketSpendModal.descriptionPlaceholder')}
          />
        )}
      </FormField>
      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('savings.bucketSpendModal.createExpense')}
        </Button>
      </div>
    </form>
  );
}

export default function SavingsPage() {
  const { t, locale } = useTranslation();

  const savingsConfig      = useFinanceStore((state) => state.savingsConfig);
  const savingsEntries     = useFinanceStore((state) => state.savingsEntries);
  const savingsGoals       = useFinanceStore((state) => state.savingsGoals);
  const saveSavingsConfig  = useFinanceStore((state) => state.saveSavingsConfig);
  const saveSavingsEntry   = useFinanceStore((state) => state.saveSavingsEntry);
  const removeSavingsEntry = useFinanceStore((state) => state.removeSavingsEntry);
  const saveSavingsGoal    = useFinanceStore((state) => state.saveSavingsGoal);
  const removeSavingsGoal  = useFinanceStore((state) => state.removeSavingsGoal);
  const withdrawSavings    = useFinanceStore((state) => state.withdrawSavings);
  const spendFromSavings   = useFinanceStore((state) => state.spendFromSavings);
  const settings           = useFinanceStore((state) => state.settings);
  const bankAccounts       = useFinanceStore((state) => state.bankAccounts || []);

  const confirm = useConfirm();
  const alert = useAlert();
  const currency = settings.baseCurrency;

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
  const [modal, setModal] = useState({ open: false, id: null, goalId: '', withdraw: false });
  const openNew  = (goalId = '') => setModal({ open: true, id: null, goalId, withdraw: false });
  const openWithdraw = (goalId) => setModal({ open: true, id: null, goalId, withdraw: true });
  const openEdit = (id) => setModal({ open: true, id, goalId: '', withdraw: false });
  const close    = () => setModal({ open: false, id: null, goalId: '', withdraw: false });
  const editingEntry = savingsEntries.find((e) => e.id === modal.id);
  const [goalModal, setGoalModal] = useState({ open: false, id: null });
  const openNewGoal = () => setGoalModal({ open: true, id: null });
  const openEditGoal = (id) => setGoalModal({ open: true, id });
  const closeGoal = () => setGoalModal({ open: false, id: null });
  const editingGoal = savingsGoals.find((goal) => goal.id === goalModal.id);
  const [bucketSpendModal, setBucketSpendModal] = useState({ open: false, goalId: null });
  const openBucketSpend = (goalId) => setBucketSpendModal({ open: true, goalId });
  const closeBucketSpend = () => setBucketSpendModal({ open: false, goalId: null });
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
    () => savingsEntries
      .filter((entry) => entry.source !== 'allocation')
      .reduce((sum, e) => sum + e.amountCents, 0),
    [savingsEntries],
  );
  const totalSavedCents = currentBalanceCents + totalEntriesCents;
  const goalLookup = useMemo(
    () => new Map(savingsGoals.map((goal) => [goal.id, goal.name])),
    [savingsGoals],
  );
  const activeGoalIds = useMemo(() => new Set(savingsGoals.map((g) => g.id)), [savingsGoals]);
  const goalBalances = useMemo(() => {
    const map = {};
    savingsEntries.forEach((entry) => {
      // Ignore entries for deleted goals so their balance returns to the unallocated pool.
      if (!entry.goalId || !activeGoalIds.has(entry.goalId)) return;
      map[entry.goalId] = (map[entry.goalId] || 0) + entry.amountCents;
    });
    return map;
  }, [savingsEntries, activeGoalIds]);
  const goalsWithBalances = useMemo(
    () =>
      savingsGoals.map((goal) => {
        const savedCents = goalBalances[goal.id] || 0;
        const targetCents = goal.targetCents || 0;
        return {
          ...goal,
          savedCents,
          progress: targetCents > 0 ? Math.min(100, Math.max(0, (savedCents / targetCents) * 100)) : 0,
        };
      }),
    [goalBalances, savingsGoals],
  );
  const spendingGoal = goalsWithBalances.find((goal) => goal.id === bucketSpendModal.goalId);
  const allocatedSavingsCents = useMemo(
    () => Object.values(goalBalances).reduce((sum, value) => sum + value, 0),
    [goalBalances],
  );
  const unallocatedSavingsCents = Math.max(0, totalSavedCents - allocatedSavingsCents);

  const thisMonthKey = monthKey(new Date());
  const savedThisMonthCents = useMemo(
    () => savingsEntries
      .filter((e) => entryReportMonth(e) === thisMonthKey && e.source !== 'allocation')
      .reduce((sum, e) => sum + e.amountCents, 0),
    [savingsEntries, thisMonthKey],
  );

  const realAvgCents = useMemo(() => computeMonthlyAvg(savingsEntries), [savingsEntries]);

  const monthlyChartData = useMemo(() => {
    const map = {};
    savingsEntries.forEach((e) => {
      if (e.source === 'allocation') return;
      const key = entryReportMonth(e);
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
      if (e.source === 'allocation') return;
      const key = entryReportMonth(e);
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
          (!filterMonth || entryReportMonth(e) === filterMonth) &&
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

  // Legacy transfer-linked entries are read-only (the transfer system was removed).
  // Typed entries can edit metadata only; structural fields stay locked in the form/store.
  const isEntrySelectable = (e) => !e.transferId;
  const isEntryEditable = (e) => !e.transferId;
  const entryKindLabel = (e) => {
    if (e.kind === 'withdrawal') return t('savings.logCard.kindWithdrawal');
    if (e.kind === 'portfolio_buy') return t('savings.logCard.kindPortfolioBuy');
    if (e.kind === 'expense') return t('savings.logCard.kindExpense');
    if (e.kind === 'allocation_release') return t('savings.logCard.kindAllocationRelease');
    if (e.transferId) return t('savings.logCard.viaTransfer');
    return null;
  };
  const batchSelect = useBatchSelect(sortedEntries, isEntrySelectable);

  useEffect(() => { batchSelect.cancel(); }, [filterMonth, filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBatchDeleteEntries = async () => {
    const ids = [...batchSelect.selectedIds];
    const ok = await confirm({
      title: t('savings.confirmDeleteBatch.title', { count: ids.length, plural: ids.length !== 1 ? 'ies' : 'y' }),
      description: t('savings.confirmDeleteBatch.description'),
    });
    if (!ok) return;
    for (const id of ids) await removeSavingsEntry(id);
    batchSelect.cancel();
  };

  const handleDeleteGoal = async (goal) => {
    const hasEntries = savingsEntries.some((entry) => entry.goalId === goal.id);
    if (hasEntries) {
      await alert({
        title: t('savings.goalHasEntries.title'),
        description: t('savings.goalHasEntries.description'),
      });
      return;
    }
    const ok = await confirm({
      title: t('savings.confirmDeleteGoal.title'),
      description: t('savings.confirmDeleteGoal.description', { name: goal.name }),
    });
    if (!ok) return;
    await removeSavingsGoal(goal.id);
  };

  // ── Entry list (card-list style matching Income / Expenses) ──
  function SavingsEntryList({ rows }) {
    if (!rows.length) {
      return (
        <EmptyState
          title={t('savings.logCard.emptyFilterTitle')}
          description={t('savings.logCard.emptyFilterDescription')}
        />
      );
    }
    return (
      <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
        {rows.map((r) => {
          const goalName = r.goalId ? goalLookup.get(r.goalId) : null;
          const meta = [
            r.amountCents < 0 ? t('savings.logCard.entryWithdrawal') : t('savings.logCard.entryDeposit'),
            goalName ? t('savings.logCard.entryFor', { goal: goalName }) : null,
          ]
            .filter(Boolean)
            .join(' / ');
          return (
          <li
            key={r.id}
            className={batchSelect.selecting && batchSelect.selectedIds.has(r.id) ? 'bg-accent-soft' : 'transition-colors duration-120 hover:bg-surface-raised'}
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              {batchSelect.selecting && (
                isEntrySelectable(r) ? (
                  <input
                    type="checkbox"
                    aria-label={t('savings.logCard.rowAriaSelect')}
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
                    {meta} / {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(r.date))}
                  </p>
                  {r.transferId ? (
                    <span className="shrink-0 text-xs text-ink-faint">{entryKindLabel(r)}</span>
                  ) : (
                    <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                      {entryKindLabel(r) ? (
                        <span className="shrink-0 text-xs text-ink-faint">{entryKindLabel(r)}</span>
                      ) : null}
                      {isEntryEditable(r) ? (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                          aria-label={t('savings.logCard.rowAriaEdit')}
                          title={t('common.edit')}
                          onClick={() => openEdit(r.id)}
                        >
                          <EditIcon />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                        aria-label={t('savings.logCard.rowAriaDelete')}
                        title={t('common.delete')}
                        onClick={async () => {
                          if (await confirm({ title: t('savings.confirmDeleteEntry.title'), description: t('savings.confirmDeleteEntry.description') }))
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
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="05"
        eyebrow={t('savings.eyebrow')}
        title={t('savings.title')}
        description={t('savings.description')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
              {t('savings.withdrawal')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <PlusIcon /> {t('savings.addSaving')}
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <section data-tour="savings-stats" className="flex w-full flex-col gap-5 md:h-[172px] md:flex-row md:items-stretch md:justify-center">
        <div className={'min-w-0 rounded-lg border border-rule bg-surface p-6 md:flex md:min-w-[360px] md:flex-col md:items-center md:justify-center ' + rise(1)}>
          <Stat
            label={t('savings.kpiTotalSaved.label')}
            value={totalSavedCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('savings.kpiTotalSaved.hint')}
            align="center"
            valueClassName="text-accent-strong"
            info={t('savings.kpiTotalSaved.info')}
          />
        </div>
        <div className={'relative min-w-0 overflow-hidden rounded-lg border border-rule bg-surface p-3 md:w-[420px] ' + rise(2)}>
          <div className="mb-2 flex items-center justify-center gap-1.5">
            <p className="eyebrow">{t('savings.evolutionChart.eyebrow')}</p>
            <InfoPopover info={t('savings.evolutionChart.info')} />
          </div>
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
                  <Tooltip formatter={(v) => [formatCurrency(v, currency, locale), t('savings.kpiTotalSaved.label')]} />
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
                {t('savings.evolutionChart.addToSee')}
              </div>
            )}
          </div>
        </div>
        <div className="grid min-w-0 gap-px overflow-hidden rounded-lg border border-rule bg-rule md:grid-cols-2">
          <div className={'min-w-0 bg-surface p-4 md:flex md:min-w-[260px] md:flex-col md:items-center md:justify-center md:px-6 md:py-2 ' + rise(3)}>
            <Stat
              label={t('savings.kpiThisMonth.label')}
              value={savedThisMonthCents}
              mode="currency"
              currency={currency}
              locale={locale}
              hint={t('savings.kpiThisMonth.hint')}
              size="compact"
              align="center"
              tone="muted"
              info={t('savings.kpiThisMonth.info')}
            />
          </div>
          <div className={'min-w-0 bg-surface p-4 md:flex md:min-w-[260px] md:flex-col md:items-center md:justify-center md:px-6 md:py-2 ' + rise(4)}>
            <Stat
              label={t('savings.kpiMonthlyAvg.label')}
              value={realAvgCents}
              mode="currency"
              currency={currency}
              locale={locale}
              hint={t('savings.kpiMonthlyAvg.hint')}
              size="compact"
              align="center"
              tone="muted"
              info={t('savings.kpiMonthlyAvg.info')}
            />
          </div>
        </div>
      </section>

      <Card
        data-tour="savings-buckets"
        eyebrow={t('savings.bucketsCard.eyebrow')}
        title={t('savings.bucketsCard.title')}
        description={t('savings.bucketsCard.description')}
        className={rise(2)}
        action={
          <Button variant="primary" size="sm" onClick={openNewGoal}>
            <PlusIcon /> {t('savings.addGoal')}
          </Button>
        }
      >
        {!goalsWithBalances.length && settings.setupIntent?.buckets && (
          <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft px-4 py-3">
            <p className="text-sm font-medium text-ink">{t('savings.bucketsCard.bucketsHint')}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{t('savings.bucketsCard.bucketsHintDescription')}</p>
          </div>
        )}
        {goalsWithBalances.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goalsWithBalances.map((goal) => {
              const remainingCents = Math.max(0, (goal.targetCents || 0) - goal.savedCents);
              return (
                <div key={goal.id} className="rounded-lg border border-rule bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{goal.name}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {t('savings.bucketsCard.savedOf', {
                          saved: formatCurrency(goal.savedCents, currency, locale),
                          target: formatCurrency(goal.targetCents || 0, currency, locale),
                        })}
                      </p>
                    </div>
                    <p className="numeric shrink-0 text-sm text-ink">{goal.progress.toFixed(0)}%</p>
                  </div>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">
                    {remainingCents > 0
                      ? t('savings.bucketsCard.remaining', { amount: formatCurrency(remainingCents, currency, locale) })
                      : t('savings.bucketsCard.goalReached')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openNew(goal.id)}>
                      {t('savings.bucketsCard.addMoney')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openWithdraw(goal.id)}
                      disabled={goal.savedCents <= 0}
                    >
                      {t('savings.bucketsCard.release')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openBucketSpend(goal.id)}
                      disabled={goal.savedCents <= 0}
                    >
                      {t('savings.bucketsCard.spend')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditGoal(goal.id)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteGoal(goal)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={t('savings.bucketsCard.emptyTitle')}
            description={t('savings.bucketsCard.emptyDescription')}
            action={
              <Button variant="secondary" size="sm" onClick={openNewGoal}>
                <PlusIcon /> {t('savings.addGoal')}
              </Button>
            }
          />
        )}
      </Card>

      {/* ── SECTION 1: Savings history ─────────────────────────────────────── */}

      {/* Entries log */}
      <Card
        eyebrow={t('savings.logCard.eyebrow')}
        title={t('savings.logCard.title')}
        description={t('savings.logCard.description')}
        className={rise(3)}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {!batchSelect.selecting && (
              <Button variant="secondary" size="sm" onClick={batchSelect.start}>
                {t('savings.select')}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <PlusIcon /> {t('savings.addSaving')}
            </Button>
          </div>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label={t('savings.logCard.monthLabel')} htmlFor="savings-month">
            <Input
              id="savings-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </FormField>
          <FormField label={t('savings.logCard.typeLabel')} htmlFor="savings-type">
            <Select id="savings-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">{t('savings.logCard.typeAll')}</option>
              <option value="deposit">{t('savings.logCard.typeDeposit')}</option>
              <option value="withdrawal">{t('savings.logCard.typeWithdrawal')}</option>
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
            title={t('savings.logCard.emptyTitle')}
            description={t('savings.logCard.emptyDescription')}
            action={
              <Button variant="secondary" size="sm" onClick={() => openNew()}>
                <PlusIcon /> {t('savings.addSaving')}
              </Button>
            }
          />
        )}
      </Card>

      {/* Entries chart */}
      <Card
        eyebrow={t('savings.historyChart.eyebrow')}
        title={t('savings.historyChart.title')}
        description={t('savings.historyChart.description')}
        variant="chart"
        className={rise(2)}
        action={
          <>
            <Select
              aria-label={t('savings.historyChart.ariaLabel')}
              value={savingsChartPeriod}
              onChange={(e) => setSavingsChartPeriod(e.target.value)}
              className="h-10 min-w-[150px] py-2 text-sm"
            >
              <option value="6">{t('savings.historyChart.last6')}</option>
              <option value="12">{t('savings.historyChart.lastYear')}</option>
              <option value="24">{t('savings.historyChart.last2Years')}</option>
            </Select>
            <Button variant="primary" size="sm" onClick={() => openNew()}>
              <PlusIcon /> {t('savings.addSaving')}
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
            <p className="text-sm text-ink-faint">{t('savings.historyChart.noEntries')}</p>
          </div>
        )}
      </Card>

      {/* ── SECTION 2: Future projection ───────────────────────────────────── */}

      {/* Projection config */}
      <Card
        data-tour="savings-projection"
        eyebrow={t('savings.projectionCard.eyebrow')}
        title={t('savings.projectionCard.title')}
        description={t('savings.projectionCard.description')}
        className={rise(4)}
        action={
          <Button variant={configDirty ? 'primary' : 'secondary'} size="sm" onClick={saveConfig} disabled={!configDirty}>
            {configDirty ? t('savings.projectionCard.saveChanges') : t('savings.projectionCard.saved')}
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            label={t('savings.projectionCard.startingBalance', { currency })}
            hint={t('savings.projectionCard.startingBalanceHint')}
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" step="0.01" numeric placeholder="0.00"
                value={config.currentBalance} onChange={changeConfig('currentBalance')} {...a11y} />
            )}
          </FormField>

          <FormField
            label={t('savings.projectionCard.monthlySavings', { currency })}
            hint={t('savings.projectionCard.monthlySavingsHint')}
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" step="0.01" numeric placeholder="0.00"
                value={config.monthlySavings} onChange={changeConfig('monthlySavings')} {...a11y} />
            )}
          </FormField>

          <FormField
            label={t('savings.projectionCard.interestRate')}
            hint={t('savings.projectionCard.interestRateHint')}
          >
            {({ id, ...a11y }) => (
              <Input id={id} type="number" min="0" max="100" step="0.1" numeric placeholder="0"
                value={config.annualReturnRate} onChange={changeConfig('annualReturnRate')} {...a11y} />
            )}
          </FormField>

          <FormField
            label={t('savings.projectionCard.savingsGoal', { currency })}
            hint={t('savings.projectionCard.savingsGoalHint')}
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
        eyebrow={t('savings.projectionChartCard.eyebrowYears', { count: projectionYears })}
        title={t('savings.projectionChartCard.title')}
        variant="chart"
        className={rise(5)}
        action={
          <div className="relative inline-flex items-center">
            <select
              value={config.projectionYears}
              onChange={changeConfig('projectionYears')}
              aria-label={t('savings.projectionChartCard.ariaLabel')}
              className="appearance-none cursor-pointer rounded-md border border-rule-strong bg-surface-raised pl-3 pr-7 h-8 text-xs text-ink-muted hover:text-ink hover:border-ink-faint transition-colors duration-180 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-sans"
            >
              {[5, 10, 15, 20, 25, 30, 40, 50].map((y) => (
                <option key={y} value={y}>{t('savings.projectionChartCard.yearsOption', { count: y })}</option>
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
            <Tooltip formatter={(v) => [formatCurrency(v, currency, locale), t('savings.kpiTotalSaved.label')]} />
            {goalCents > 0 && (
              <ReferenceLine
                y={goalCents}
                stroke="var(--positive)"
                strokeDasharray="4 4"
                label={{ value: t('savings.projectionChartCard.goalLabel'), position: 'insideTopRight', fill: 'var(--positive)', fontSize: 11 }}
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
        <Card eyebrow={t('savings.goalProgressCard.eyebrow')} title={t('savings.goalProgressCard.title')} className={rise(6)}>
          <div className="grid gap-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-ink-muted">
                {formatCurrency(totalSavedCents, currency, locale)}{' '}
                <span className="text-ink-faint">{t('savings.goalProgressCard.of')}</span>{' '}
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
                <span className="text-positive font-medium">{t('savings.goalProgressCard.alreadyReached')}</span>
              ) : goalYear !== null ? (
                t('savings.goalProgressCard.willReach', { years: goalYear, plural: goalYear !== 1 ? 's' : '' })
              ) : (
                <span className="text-danger">
                  {t('savings.goalProgressCard.wontReach', { years: projectionYears })}
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
        eyebrow={t('savings.entryModal.eyebrow')}
        title={editingEntry ? t('savings.entryModal.titleEdit') : modal.withdraw ? t('savings.entryModal.titleWithdraw') : t('savings.entryModal.titleNew')}
        description={modal.withdraw ? t('savings.entryModal.descriptionWithdraw') : t('savings.entryModal.descriptionDeposit')}
      >
        <SavingsEntryForm
          initialValue={editingEntry}
          currency={currency}
          goals={savingsGoals}
          defaultGoalId={modal.goalId}
          goalLocked={modal.withdraw}
          showBucketSource={Boolean(modal.goalId && !modal.withdraw && !editingEntry)}
          unallocatedSavingsCents={unallocatedSavingsCents}
          bankAccounts={modal.withdraw ? [] : bankAccounts}
          metadataOnly={Boolean(editingEntry?.kind && !editingEntry?.transferId)}
          submitLabel={modal.withdraw ? t('savings.entryModal.release') : undefined}
          onSubmit={async (value) => {
            try {
              if (modal.withdraw && Math.abs(value.amountCents) > (goalBalances[modal.goalId] || 0)) {
                await alert({
                  title: t('savings.entryModal.errorWithdrawalTooLarge.title'),
                  description: t('savings.entryModal.errorWithdrawalTooLarge.description'),
                });
                return;
              }
              if (
                modal.goalId &&
                !modal.withdraw &&
                !editingEntry &&
                value.bucketSource === 'savings' &&
                value.amountCents > unallocatedSavingsCents
              ) {
                await alert({
                  title: t('savings.entryModal.errorAllocationTooLarge.title'),
                  description: t('savings.entryModal.errorAllocationTooLarge.description'),
                });
                return;
              }
              const { bucketSource, ...entryValue } = value;
              await saveSavingsEntry({
                ...entryValue,
                amountCents: modal.withdraw ? -Math.abs(value.amountCents) : value.amountCents,
                source: modal.withdraw || bucketSource === 'savings' ? 'allocation' : undefined,
                note: value.note || (
                  modal.withdraw
                    ? t('savings.entryModal.noteWithdrawal')
                    : bucketSource === 'savings'
                      ? t('savings.entryModal.noteAllocation')
                      : value.goalId ? t('savings.entryModal.noteGoalSaving') : ''
                ),
              });
              close();
            } catch (error) {
              await alert({ title: t('savings.entryModal.errorSave.title'), description: error.message || t('savings.entryModal.errorSave.description') });
            }
          }}
          onCancel={close}
        />
      </Modal>

      <Modal
        open={goalModal.open}
        onClose={closeGoal}
        eyebrow={t('savings.goalModal.eyebrow')}
        title={editingGoal ? t('savings.goalModal.titleEdit') : t('savings.goalModal.titleNew')}
        description={t('savings.goalModal.description')}
      >
        <SavingsGoalForm
          initialValue={editingGoal}
          currency={currency}
          onSubmit={async (value) => {
            if (!value.name || value.targetCents <= 0) return;
            await saveSavingsGoal(value);
            closeGoal();
          }}
          onCancel={closeGoal}
        />
      </Modal>

      <Modal
        open={bucketSpendModal.open}
        onClose={closeBucketSpend}
        eyebrow={t('savings.bucketSpendModal.eyebrow')}
        title={spendingGoal ? t('savings.bucketSpendModal.titlePrefix', { name: spendingGoal.name }) : t('savings.bucketSpendModal.titleFallback')}
        description={t('savings.bucketSpendModal.description')}
      >
        {spendingGoal ? (
          <BucketSpendForm
            goal={spendingGoal}
            categories={settings.categories}
            currency={currency}
            onSubmit={async (value) => {
              if (!value.amountCents || value.amountCents <= 0) return;
              if (value.amountCents > spendingGoal.savedCents) {
                await alert({
                  title: t('savings.bucketSpendModal.errorTooLarge.title'),
                  description: t('savings.bucketSpendModal.errorTooLarge.description'),
                });
                return;
              }
              await spendFromSavings({
                date: value.date,
                amountCents: value.amountCents,
                description: value.description || `${spendingGoal.name} expense from bucket`,
                category: value.category,
                goalId: spendingGoal.id,
              });
              closeBucketSpend();
            }}
            onCancel={closeBucketSpend}
          />
        ) : null}
      </Modal>

      {/* Withdrawal modal */}
      {transferOpen && (
        <WithdrawalModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          balanceCents={totalSavedCents}
          currency={currency}
          locale={locale}
          bankAccounts={bankAccounts}
          onSubmit={async ({ amountCents, date, description, bankAccountId }) => {
            await withdrawSavings({
              date,
              amountCents,
              description,
              bankAccountId,
            });
            setTransferOpen(false);
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import LWHistogram from '../components/charts/LWHistogram';
import { AttachmentViewer } from '../components/AttachmentViewer';
import { ManageCategoriesModal } from '../components/ManageCategoriesModal';
import { MonthSelector } from '../components/MonthSelector';
import { PageHeader } from '../components/PageHeader';
import { ExpenseForm } from '../components/forms/ExpenseForm';
import { FixedExpenseForm } from '../components/forms/FixedExpenseForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { categoryBreakdown, computeExpenseSeries } from '../utils/finance';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { rowsToCsv } from '../utils/csv';
import {
  Card,
  Button,
  EmptyState,
  FormField,
  Input,
  Select,
  Stat,
  Modal,
} from '../components/ui';
import { rise } from '../utils/motion';
import { useTranslation } from '../i18n/useTranslation';

const PAGE_SIZE = 5;

function Pagination({ page, totalPages, onPrev, onNext, tPrev, tNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 1}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ‹ {tPrev}
      </button>
      <span className="tabular text-ink-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page === totalPages}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {tNext} ›
      </button>
    </div>
  );
}

const DONUT_COLORS = [
  'var(--accent)',
  'var(--danger)',
  '#8FB97E',
  '#C9A96E',
  '#7A9CC6',
  '#B48EAD',
  '#6E8E8A',
];

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

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="m6 8 3.5-3.5a2.2 2.2 0 0 1 3.1 3.1l-4.8 4.8a3.3 3.3 0 0 1-4.7-4.7l4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M5.5 4v8M10.5 4v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden>
      <path d="M5.5 3.8v8.4L12 8 5.5 3.8Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExpenseLedgerList({
  rows,
  attachments,
  currency,
  locale,
  selectable,
  selectedIds,
  onToggleRow,
  openAttachments,
  openEditExpense,
  onDeleteExpense,
  t,
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
      {rows.map((row) => {
        const attCount = attachments.filter((a) => a.expenseId === row.id).length;
        const meta = row.category || t('expenses.title');
        return (
          <li
            key={row.id}
            className={selectable && selectedIds?.has(row.id) ? 'bg-accent-soft' : 'transition-colors duration-120 hover:bg-surface-raised'}
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              {selectable ? (
                <input
                  type="checkbox"
                  aria-label={t('expenses.rowAriaEdit')}
                  checked={selectedIds?.has(row.id)}
                  onChange={() => onToggleRow?.(row.id)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[color:var(--accent)]"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {row.description || row.category || t('expenses.title')}
                  </p>
                  <span className="numeric shrink-0 rounded px-1.5 py-0.5 text-sm tabular text-danger bg-danger-soft">
                    -{formatCurrency(Math.abs(row.amountCents), row.currency || currency, locale).replace(/^[−-]/, '')}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                  <p className="min-w-0 truncate eyebrow">
                    {meta} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(row.date))}
                  </p>
                  <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                    {attCount > 0 ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-accent"
                        aria-label={t('expenses.rowAriaAttachments', { count: attCount, plural: attCount !== 1 ? 's' : '' })}
                        title={t('expenses.rowAriaAttachments', { count: attCount, plural: attCount !== 1 ? 's' : '' })}
                        onClick={() => openAttachments(row.id)}
                      >
                        <PaperclipIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                      aria-label={t('expenses.rowAriaEdit')}
                      title={t('common.edit')}
                      onClick={() => openEditExpense(row.id)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                      aria-label={t('expenses.rowAriaDelete')}
                      title={t('common.delete')}
                      onClick={() => onDeleteExpense(row.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FixedExpenseLedgerList({
  rows,
  currency,
  locale,
  onEdit,
  onToggleStatus,
  onDelete,
  t,
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
      {rows.map((row) => {
        const meta = [row.category, row.chargeDay ? `day ${row.chargeDay}` : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <li
            key={row.id}
            className="transition-colors duration-120 hover:bg-surface-raised"
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {row.name || t('expenses.recurringBillFallback')}
                  </p>
                  <span className="numeric shrink-0 rounded px-1.5 py-0.5 text-sm tabular text-danger bg-danger-soft">
                    -{formatCurrency(Math.abs(row.amountCents), row.currency || currency, locale).replace(/^[−-]/, '')}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                  <p className="min-w-0 truncate eyebrow flex items-center gap-1.5">
                    {meta}
                    <span
                      aria-label={row.active ? t('expenses.statusActive') : t('expenses.statusPaused')}
                      title={row.active ? t('expenses.statusActive') : t('expenses.statusPaused')}
                      className={
                        'inline-block h-1.5 w-1.5 rounded-full ' +
                        (row.active ? 'bg-positive' : 'bg-ink-faint')
                      }
                    />
                  </p>
                  <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                      aria-label={t('expenses.rowAriaEditRecurring')}
                      title={t('common.edit')}
                      onClick={() => onEdit(row.id)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                      aria-label={row.active ? t('expenses.rowAriaPause') : t('expenses.rowAriaResume')}
                      title={row.active ? t('expenses.statusActive') : t('expenses.statusPaused')}
                      onClick={() => onToggleStatus(row.id)}
                    >
                      {row.active ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                      aria-label={t('expenses.rowAriaDeleteRecurring')}
                      title={t('common.delete')}
                      onClick={() => onDelete(row.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ExpensesPage() {
  const { t, locale } = useTranslation();

  const expenses = useFinanceStore((state) => state.expenses);
  const fixedExpenses = useFinanceStore((state) => state.fixedExpenses);
  const attachments = useFinanceStore((state) => state.attachments);
  const bankAccounts = useFinanceStore((state) => state.bankAccounts || []);
  const debts = useFinanceStore((state) => state.debts || []);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const saveFixedExpense = useFinanceStore((state) => state.saveFixedExpense);
  const toggleFixedExpenseStatus = useFinanceStore((state) => state.toggleFixedExpenseStatus);
  const uploadAttachment = useFinanceStore((state) => state.uploadAttachment);
  const removeAttachment = useFinanceStore((state) => state.removeAttachment);
  const [selectedMonth, setSelectedMonth] = useState(normalizeDateInput(new Date()).slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [descSearch, setDescSearch] = useState('');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [expenseModal, setExpenseModal] = useState({ open: false, id: null });
  const [fixedModal, setFixedModal] = useState({ open: false, id: null });
  const [attachmentModal, setAttachmentModal] = useState({ open: false, expenseId: null });
  const [expensePage, setExpensePage] = useState(1);

  const confirm = useConfirm();
  const alert = useAlert();
  const currency = settings.baseCurrency;
  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          expense.date.startsWith(selectedMonth) &&
          (selectedCategory === 'all' || expense.category === selectedCategory) &&
          (!descSearch || (expense.description || '').toLowerCase().includes(descSearch.toLowerCase())),
      ),
    [expenses, selectedMonth, selectedCategory, descSearch],
  );
  const { sortKey: expSortKey, sortDir: expSortDir, onSort: onExpSort } = useSortable('date', 'desc');
  const sortedExpenses = useMemo(
    () => sortRows(filteredExpenses, expSortKey, expSortDir),
    [filteredExpenses, expSortKey, expSortDir],
  );

  const batchSelect = useBatchSelect(sortedExpenses);

  // Clear selection when any filter changes so stale IDs can't be batch-deleted
  useEffect(() => { batchSelect.cancel(); }, [selectedMonth, selectedCategory, descSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setExpensePage(1); }, [selectedMonth, selectedCategory, descSearch]);

  const chartData = computeExpenseSeries(expenses);
  const breakdown = categoryBreakdown(filteredExpenses);

  const lwExpenseData = useMemo(() =>
    chartData.map((entry) => ({ time: `${entry.key}-01`, value: entry.amountCents })),
  [chartData]);
  const editingExpense = expenses.find((item) => item.id === expenseModal.id);
  const editingFixedExpense = fixedExpenses.find((item) => item.id === fixedModal.id);

  const monthTotal = filteredExpenses.reduce((s, e) => s + e.amountCents, 0);
  const fixedMonthly = fixedExpenses.filter((f) => f.active).reduce((s, f) => s + f.amountCents, 0);

  const openNewExpense = () => setExpenseModal({ open: true, id: null });
  const openEditExpense = (id) => setExpenseModal({ open: true, id });
  const closeExpenseModal = () => setExpenseModal({ open: false, id: null });

  const openNewFixed = () => setFixedModal({ open: true, id: null });
  const openEditFixed = (id) => setFixedModal({ open: true, id });
  const closeFixedModal = () => setFixedModal({ open: false, id: null });

  const openAttachments = (expenseId) => setAttachmentModal({ open: true, expenseId });
  const closeAttachments = () => setAttachmentModal({ open: false, expenseId: null });

  const exportCsv = () => {
    const csv = rowsToCsv(
      expenses.map((expense) => ({
        date: expense.date,
        amount: (expense.amountCents / 100).toFixed(2),
        currency: expense.currency,
        category: expense.category,
        description: expense.description,
        recurring: expense.isRecurring,
      })),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'expenses.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchDeleteExpenses = async () => {
    const ids = [...batchSelect.selectedIds];
    const ok = await confirm({
      title: t('expenses.confirmDeleteBatch.title', { count: ids.length, plural: ids.length !== 1 ? 's' : '' }),
      description: t('expenses.confirmDeleteBatch.description'),
    });
    if (!ok) return;
    for (const id of ids) await removeEntity('expenses', id);
    batchSelect.cancel();
  };

  const expenseColumns = [
    { key: 'date', header: t('common.edit'), width: 110, sortable: true },
    {
      key: 'description',
      header: t('expenses.ledgerCard.descriptionLabel'),
      sortable: true,
      noTruncate: true,
      render: (r) => (
        <span className="block whitespace-normal break-words leading-snug">
          {r.description || <span className="text-ink-faint">—</span>}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('expenses.ledgerCard.categoryLabel'),
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        <span className="inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted border border-rule">
          {row.category}
        </span>
      ),
    },
    {
      key: 'amountCents',
      header: t('expenses.kpiTracked.label'),
      numeric: true,
      sortable: true,
      render: (r) => <span className="text-danger">{formatCurrency(r.amountCents, r.currency, locale)}</span>,
    },
    {
      key: 'isRecurring',
      header: t('expenses.recurringCard.title'),
      hideOnMobile: true,
      align: 'center',
      render: (r) =>
        r.isRecurring ? (
          <span className="numeric text-xs text-accent">●</span>
        ) : (
          <span className="numeric text-xs text-ink-faint">○</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      _render: (r) => {
        const attCount = attachments.filter((a) => a.expenseId === r.id).length;
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {attCount > 0 && (
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => openAttachments(r.id)}>
                📎 {attCount}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openEditExpense(r.id)}>
              {t('common.edit')}
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (await confirm({ title: t('expenses.confirmDeleteOne.title'), description: t('expenses.confirmDeleteOne.description') }))
                removeEntity('expenses', r.id);
            }}>
              {t('common.delete')}
            </Button>
          </div>
        );
      },
      render: (r) => {
        const attCount = attachments.filter((a) => a.expenseId === r.id).length;
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {attCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 px-0"
                aria-label={t('expenses.rowAriaAttachments', { count: attCount, plural: attCount !== 1 ? 's' : '' })}
                title={t('expenses.rowAriaAttachments', { count: attCount, plural: attCount !== 1 ? 's' : '' })}
                onClick={() => openAttachments(r.id)}
              >
                <PaperclipIcon />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0"
              aria-label={t('expenses.rowAriaEdit')}
              title={t('common.edit')}
              onClick={() => openEditExpense(r.id)}
            >
              <EditIcon />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0"
              aria-label={t('expenses.rowAriaDelete')}
              title={t('common.delete')}
              onClick={async () => {
                if (await confirm({ title: t('expenses.confirmDeleteOne.title'), description: t('expenses.confirmDeleteOne.description') }))
                  removeEntity('expenses', r.id);
              }}
            >
              <TrashIcon />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="02"
        eyebrow={t('expenses.eyebrow')}
        title={t('expenses.title')}
        description={t('expenses.description')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              {t('expenses.exportCsv')}
            </Button>
            <Button variant="primary" size="sm" onClick={openNewExpense}>
              <PlusIcon /> {t('expenses.newExpense')}
            </Button>
            <MonthSelector
              id="expenses-view-month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="mt-8 w-full"
            />
          </>
        }
      />

      {/* summary stats */}
      <section data-tour="expenses-stats" className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3">
        <div className={'min-w-0 bg-surface p-6 ' + rise(1)}>
          <Stat
            label={t('expenses.kpiSelectedMonth.label')}
            value={monthTotal}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('expenses.kpiSelectedMonth.hintTransactions', { count: filteredExpenses.length })}
            info={t('expenses.kpiSelectedMonth.info')}
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label={t('expenses.kpiFixedMonthly.label')}
            value={fixedMonthly}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={t('expenses.kpiFixedMonthly.hintActive', { count: fixedExpenses.filter((f) => f.active).length })}
            info={t('expenses.kpiFixedMonthly.info')}
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat
            label={t('expenses.kpiTracked.label')}
            value={expenses.length}
            mode="number"
            locale={locale}
            hint={t('expenses.kpiTracked.hint')}
            info={t('expenses.kpiTracked.info')}
          />
        </div>
      </section>

      {/* charts */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card eyebrow={t('expenses.spendChart.eyebrow')} title={t('expenses.spendChart.title')} variant="chart" className={'lg:col-span-8 ' + rise(2)}>
          <LWHistogram
            data={lwExpenseData}
            color="var(--danger)"
            priceFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
          />
        </Card>

        <Card data-tour="expenses-breakdown" eyebrow={t('expenses.breakdownCard.eyebrow')} title={t('expenses.breakdownCard.title')} className={'lg:col-span-4 ' + rise(3)}>
          {breakdown.length ? (
            <div className="flex flex-col gap-5">
              <div className="relative mx-auto h-[200px] w-full max-w-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="95%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {breakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-1.5">
                {(() => {
                  const total = breakdown.reduce((s, i) => s + i.value, 0);
                  return breakdown.slice(0, 5).map((entry) => {
                    const originalIndex = breakdown.findIndex((s) => s.name === entry.name);
                    const share = total ? (entry.value / total) * 100 : 0;
                    return (
                      <li key={entry.name} className="flex items-baseline gap-3">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-sm"
                          style={{ background: DONUT_COLORS[originalIndex % DONUT_COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm text-ink">{entry.name}</span>
                          <span className="font-mono tabular text-xs text-ink-muted shrink-0">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </li>
                    );
                  });
                })()}
                {breakdown.length > 5 ? (
                  <li className="eyebrow pl-5 text-ink-faint">{t('expenses.breakdownCard.moreCategories', { count: breakdown.length - 5 })}</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <EmptyState title={t('expenses.breakdownCard.emptyTitle')} description={t('expenses.breakdownCard.emptyDescription')} />
          )}
        </Card>
      </section>

      {/* ledgers */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card
        data-tour="expenses-log"
        eyebrow={t('expenses.ledgerCard.eyebrow')}
        title={t('expenses.ledgerCard.title')}
        description={t('expenses.ledgerCard.description')}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {!batchSelect.selecting && (
              <Button variant="secondary" size="sm" onClick={batchSelect.start}>
                {t('expenses.select')}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={openNewExpense}>
              <PlusIcon /> {t('expenses.addExpense')}
            </Button>
          </div>
        }
        className={'lg:col-span-8 ' + rise(3)}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label={t('expenses.ledgerCard.categoryLabel')} htmlFor="expenses-category">
            <Select
              id="expenses-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">{t('expenses.ledgerCard.allCategories')}</option>
              {settings.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('expenses.ledgerCard.descriptionLabel')} htmlFor="expenses-desc">
            <Input
              id="expenses-desc"
              type="text"
              placeholder={t('expenses.ledgerCard.searchPlaceholder')}
              value={descSearch}
              onChange={(e) => setDescSearch(e.target.value)}
            />
          </FormField>
        </div>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCatModalOpen(true)}
            className="text-xs text-accent hover:underline"
          >
            {t('expenses.manageCategories')}
          </button>
        </div>

        <BatchDeleteBar
          selecting={batchSelect.selecting}
          selectedCount={batchSelect.selectedIds.size}
          onDelete={handleBatchDeleteExpenses}
          onCancel={batchSelect.cancel}
        />
        {filteredExpenses.length ? (
          <>
            <ExpenseLedgerList
              rows={sortedExpenses.slice((expensePage - 1) * PAGE_SIZE, expensePage * PAGE_SIZE)}
              attachments={attachments}
              currency={currency}
              locale={locale}
              selectable={batchSelect.selecting}
              selectedIds={batchSelect.selectedIds}
              onToggleRow={batchSelect.toggle}
              openAttachments={openAttachments}
              openEditExpense={openEditExpense}
              onDeleteExpense={async (id) => {
                if (await confirm({ title: t('expenses.confirmDeleteOne.title'), description: t('expenses.confirmDeleteOne.description') }))
                  removeEntity('expenses', id);
              }}
              t={t}
            />
            <Pagination
              page={expensePage}
              totalPages={Math.ceil(sortedExpenses.length / PAGE_SIZE)}
              onPrev={() => setExpensePage((p) => Math.max(1, p - 1))}
              onNext={() => setExpensePage((p) => Math.min(Math.ceil(sortedExpenses.length / PAGE_SIZE), p + 1))}
              tPrev={t('common.previous')}
              tNext={t('common.next')}
            />
          </>
        ) : (
          <EmptyState
            title={t('expenses.ledgerCard.emptyTitle')}
            description={t('expenses.ledgerCard.emptyDescription')}
            action={
              <Button variant="secondary" size="sm" onClick={openNewExpense}>
                <PlusIcon /> {t('expenses.addExpense')}
              </Button>
            }
          />
        )}
      </Card>

      {/* fixed expenses */}
        <Card
        data-tour="expenses-recurring"
        eyebrow={t('expenses.recurringCard.eyebrow')}
        title={t('expenses.recurringCard.title')}
        description={t('expenses.recurringCard.description')}
        action={
          <Button variant="primary" size="sm" onClick={openNewFixed}>
            <PlusIcon /> {t('expenses.addRecurring')}
          </Button>
        }
        className={'lg:col-span-4 ' + rise(4)}
      >
        {fixedExpenses.length ? (
          <FixedExpenseLedgerList
            rows={fixedExpenses}
            currency={currency}
            locale={locale}
            onEdit={openEditFixed}
            onToggleStatus={toggleFixedExpenseStatus}
            onDelete={async (id) => {
              const row = fixedExpenses.find((f) => f.id === id);
              if (await confirm({ title: t('expenses.confirmDeleteRecurring.title'), description: t('expenses.confirmDeleteRecurring.description', { name: row?.name }) }))
                removeEntity('fixedExpenses', id);
            }}
            t={t}
          />
        ) : (
          <>
            {settings.setupIntent?.recurringBills && (
              <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft px-4 py-3">
                <p className="text-sm font-medium text-ink">{t('expenses.recurringCard.recurringBillsHint')}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{t('expenses.recurringCard.recurringBillsHintDescription')}</p>
              </div>
            )}
            <EmptyState
              title={t('expenses.recurringCard.emptyTitle')}
              description={t('expenses.recurringCard.emptyDescription')}
              action={
                <Button variant="secondary" size="sm" onClick={openNewFixed}>
                  <PlusIcon /> {t('expenses.addRecurring')}
                </Button>
              }
            />
          </>
        )}
        </Card>
      </section>

      <ManageCategoriesModal open={catModalOpen} onClose={() => setCatModalOpen(false)} />

      <AttachmentViewer
        open={attachmentModal.open}
        onClose={closeAttachments}
        expenseId={attachmentModal.expenseId}
      />

      <Modal
        open={expenseModal.open}
        onClose={closeExpenseModal}
        eyebrow={t('expenses.expenseModal.eyebrow')}
        title={editingExpense ? t('expenses.expenseModal.titleEdit') : t('expenses.expenseModal.titleNew')}
        description={t('expenses.expenseModal.description')}
        size="lg"
      >
        <ExpenseForm
          categories={settings.categories}
          bankAccounts={bankAccounts}
          debts={debts}
          initialValue={editingExpense}
          existingAttachments={attachments.filter((a) => a.expenseId === editingExpense?.id)}
          onRemoveAttachment={removeAttachment}
          onSubmit={async (value, pendingFiles) => {
            try {
              const saved = await saveEntity('expenses', value);
              for (const file of pendingFiles) {
                await uploadAttachment(saved.id, file);
              }
              closeExpenseModal();
            } catch (error) {
              await alert({ title: t('expenses.expenseModal.errorSave.title'), description: error.message || t('expenses.expenseModal.errorSave.description') });
            }
          }}
          onCancel={closeExpenseModal}
        />
      </Modal>

      <Modal
        open={fixedModal.open}
        onClose={closeFixedModal}
        eyebrow={t('expenses.recurringModal.eyebrow')}
        title={editingFixedExpense ? t('expenses.recurringModal.titleEdit') : t('expenses.recurringModal.titleNew')}
        description={t('expenses.recurringModal.description')}
        size="lg"
      >
        <FixedExpenseForm
          categories={settings.categories}
          initialValue={editingFixedExpense}
          onSubmit={async (value) => {
            await saveFixedExpense(value);
            closeFixedModal();
          }}
          onCancel={closeFixedModal}
        />
      </Modal>
    </div>
  );
}

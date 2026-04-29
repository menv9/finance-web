import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
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

const PAGE_SIZE = 5;

function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 1}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ‹ Previous
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
        Next ›
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
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
      {rows.map((row) => {
        const attCount = attachments.filter((a) => a.expenseId === row.id).length;
        const meta = [row.category, row.subcategory].filter(Boolean).join(' / ') || 'Expense';
        return (
          <li
            key={row.id}
            className={selectable && selectedIds?.has(row.id) ? 'bg-accent-soft' : 'transition-colors duration-120 hover:bg-surface-raised'}
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              {selectable ? (
                <input
                  type="checkbox"
                  aria-label="Select expense"
                  checked={selectedIds?.has(row.id)}
                  onChange={() => onToggleRow?.(row.id)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[color:var(--accent)]"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {row.description || row.category || 'Expense'}
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
                        aria-label={`Open ${attCount} attachment${attCount !== 1 ? 's' : ''}`}
                        title={`Attachments (${attCount})`}
                        onClick={() => openAttachments(row.id)}
                      >
                        <PaperclipIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                      aria-label="Edit expense"
                      title="Edit"
                      onClick={() => openEditExpense(row.id)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                      aria-label="Delete expense"
                      title="Delete"
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
                    {row.name || 'Recurring bill'}
                  </p>
                  <span className="numeric shrink-0 rounded px-1.5 py-0.5 text-sm tabular text-danger bg-danger-soft">
                    -{formatCurrency(Math.abs(row.amountCents), row.currency || currency, locale).replace(/^[−-]/, '')}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                  <p className="min-w-0 truncate eyebrow flex items-center gap-1.5">
                    {meta}
                    <span
                      aria-label={row.active ? 'Active' : 'Paused'}
                      title={row.active ? 'Active' : 'Paused'}
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
                      aria-label="Edit recurring bill"
                      title="Edit"
                      onClick={() => onEdit(row.id)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                      aria-label={row.active ? 'Pause recurring bill' : 'Resume recurring bill'}
                      title={row.active ? 'Pause' : 'Resume'}
                      onClick={() => onToggleStatus(row.id)}
                    >
                      {row.active ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                      aria-label="Delete recurring bill"
                      title="Delete"
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
  const expenses = useFinanceStore((state) => state.expenses);
  const fixedExpenses = useFinanceStore((state) => state.fixedExpenses);
  const attachments = useFinanceStore((state) => state.attachments);
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
  const locale = settings.locale;
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
        subcategory: expense.subcategory,
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
      title: `Delete ${ids.length} expense${ids.length !== 1 ? 's' : ''}`,
      description: 'These expenses will be permanently removed. This cannot be undone.',
    });
    if (!ok) return;
    for (const id of ids) await removeEntity('expenses', id);
    batchSelect.cancel();
  };

  const expenseColumns = [
    { key: 'date', header: 'Date', width: 110, sortable: true },
    {
      key: 'description',
      header: 'Description',
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
      header: 'Category',
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        <span className="inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted border border-rule">
          {row.category}
        </span>
      ),
    },
    { key: 'subcategory', header: 'Sub', hideOnMobile: true, render: (r) => r.subcategory || <span className="text-ink-faint">—</span> },
    {
      key: 'amountCents',
      header: 'Amount',
      numeric: true,
      sortable: true,
      render: (r) => <span className="text-danger">{formatCurrency(r.amountCents, r.currency, locale)}</span>,
    },
    {
      key: 'isRecurring',
      header: 'Recurring',
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
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (await confirm({ title: 'Delete expense', description: 'This expense will be permanently removed.' }))
                removeEntity('expenses', r.id);
            }}>
              Delete
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
                aria-label={`Open ${attCount} attachment${attCount !== 1 ? 's' : ''}`}
                title={`Attachments (${attCount})`}
                onClick={() => openAttachments(r.id)}
              >
                <PaperclipIcon />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0"
              aria-label="Edit expense"
              title="Edit"
              onClick={() => openEditExpense(r.id)}
            >
              <EditIcon />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 px-0"
              aria-label="Delete expense"
              title="Delete"
              onClick={async () => {
                if (await confirm({ title: 'Delete expense', description: 'This expense will be permanently removed.' }))
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
        eyebrow="Module"
        title="Expenses"
        description="Variable and recurring outflows. Log transactions and see where the month goes."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" size="sm" onClick={openNewExpense}>
              <PlusIcon /> New expense
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
            label="Selected month"
            value={monthTotal}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={`${filteredExpenses.length} transactions`}
            info="Total expenses in the selected month after the current category and search filters are applied."
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label="Fixed monthly"
            value={fixedMonthly}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={`${fixedExpenses.filter((f) => f.active).length} active`}
            info="Sum of active recurring bills configured in the recurring expenses schedule."
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat
            label="Tracked"
            value={expenses.length}
            mode="number"
            locale={locale}
            hint="all-time entries"
            info="Total number of expense records stored in the app."
          />
        </div>
      </section>

      {/* charts */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card eyebrow="Twelve months" title="Monthly spend" variant="chart" className={'lg:col-span-8 ' + rise(2)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
              <Bar dataKey="amountCents" fill="var(--danger)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card data-tour="expenses-breakdown" eyebrow="Filtered month" title="By category" className={'lg:col-span-4 ' + rise(3)}>
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
                  <li className="eyebrow pl-5 text-ink-faint">+{breakdown.length - 5} more</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <EmptyState title="No data" description="Log expenses to see the split." />
          )}
        </Card>
      </section>

      {/* ledgers */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card
        data-tour="expenses-log"
        eyebrow="Ledger"
        title="Expenses"
        description="Filter the selected month by category and description."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {!batchSelect.selecting && (
              <Button variant="secondary" size="sm" onClick={batchSelect.start}>
                Select
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={openNewExpense}>
              <PlusIcon /> Add expense
            </Button>
          </div>
        }
        className={'lg:col-span-8 ' + rise(3)}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label="Category" htmlFor="expenses-category">
            <Select
              id="expenses-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {settings.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description" htmlFor="expenses-desc">
            <Input
              id="expenses-desc"
              type="text"
              placeholder="Search…"
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
            Manage categories
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
                if (await confirm({ title: 'Delete expense', description: 'This expense will be permanently removed.' }))
                  removeEntity('expenses', id);
              }}
            />
            <Pagination
              page={expensePage}
              totalPages={Math.ceil(sortedExpenses.length / PAGE_SIZE)}
              onPrev={() => setExpensePage((p) => Math.max(1, p - 1))}
              onNext={() => setExpensePage((p) => Math.min(Math.ceil(sortedExpenses.length / PAGE_SIZE), p + 1))}
            />
          </>
        ) : (
          <EmptyState
            title="No expenses for this filter"
            description="Try another month, clear the category, or add a new expense."
            action={
              <Button variant="secondary" size="sm" onClick={openNewExpense}>
                <PlusIcon /> Add expense
              </Button>
            }
          />
        )}
      </Card>

      {/* fixed expenses */}
        <Card
        data-tour="expenses-recurring"
        eyebrow="Schedule"
        title="Recurring bills"
        description="Rent, utilities, subscriptions. Pause, resume, or remove — paused bills drop out of projections."
        action={
          <Button variant="primary" size="sm" onClick={openNewFixed}>
            <PlusIcon /> Add recurring
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
              if (await confirm({ title: 'Delete recurring bill', description: `"${row?.name}" will be permanently removed.` }))
                removeEntity('fixedExpenses', id);
            }}
          />
        ) : (
          <>
            {settings.setupIntent?.recurringBills && (
              <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft px-4 py-3">
                <p className="text-sm font-medium text-ink">You mentioned having recurring bills</p>
                <p className="mt-0.5 text-xs text-ink-muted">Add rent, subscriptions, or utilities here — they stay in your monthly projections automatically.</p>
              </div>
            )}
            <EmptyState
              title="No recurring bills yet"
              description="Add your first fixed expense — rent, internet, anything monthly."
              action={
                <Button variant="secondary" size="sm" onClick={openNewFixed}>
                  <PlusIcon /> Add recurring
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
        eyebrow="Ledger entry"
        title={editingExpense ? 'Edit expense' : 'New expense'}
        description="Stored locally in IndexedDB. Syncs to Supabase if configured."
        size="lg"
      >
        <ExpenseForm
          categories={settings.categories}
          initialValue={editingExpense}
          existingAttachments={attachments.filter((a) => a.expenseId === editingExpense?.id)}
          onRemoveAttachment={removeAttachment}
          onSubmit={async (value, pendingFiles) => {
            const saved = await saveEntity('expenses', value);
            for (const file of pendingFiles) {
              await uploadAttachment(saved.id, file);
            }
            closeExpenseModal();
          }}
          onCancel={closeExpenseModal}
        />
      </Modal>

      <Modal
        open={fixedModal.open}
        onClose={closeFixedModal}
        eyebrow="Recurring bill"
        title={editingFixedExpense ? 'Edit recurring' : 'New recurring'}
        description="Anything that charges monthly — rent, utilities, subscriptions."
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

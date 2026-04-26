import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AttachmentViewer } from '../components/AttachmentViewer';
import { BudgetTab } from '../components/BudgetTab';
import { SmartBankImport } from '../components/SmartBankImport';
import { ManageCategoriesModal } from '../components/ManageCategoriesModal';
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
  Table,
  EmptyState,
  FormField,
  Input,
  Select,
  SectionDivider,
  Stat,
  Modal,
} from '../components/ui';
import { rise } from '../utils/motion';

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
  const [activeTab, setActiveTab] = useState('expenses');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [expenseModal, setExpenseModal] = useState({ open: false, id: null });
  const [fixedModal, setFixedModal] = useState({ open: false, id: null });
  const [attachmentModal, setAttachmentModal] = useState({ open: false, expenseId: null });

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
    { key: 'description', header: 'Description', sortable: true },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
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
      render: (r) => formatCurrency(r.amountCents, r.currency, locale),
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
      render: (r) => {
        const attCount = attachments.filter((a) => a.expenseId === r.id).length;
        return (
          <div className="flex justify-end gap-1">
            {attCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => openAttachments(r.id)}>
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
    },
  ];

  const fixedColumns = [
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'chargeDay', header: 'Day', numeric: true, width: 70 },
    {
      key: 'amountCents',
      header: 'Amount',
      numeric: true,
      render: (r) => formatCurrency(r.amountCents, r.currency, locale),
    },
    {
      key: 'active',
      header: 'Status',
      render: (r) => (
        <span
          className={
            'inline-flex items-center gap-1.5 text-xs ' +
            (r.active ? 'text-positive' : 'text-ink-faint')
          }
        >
          <span
            aria-hidden
            className={
              'inline-block h-1.5 w-1.5 rounded-full ' +
              (r.active ? 'bg-positive' : 'bg-ink-faint')
            }
          />
          {r.active ? 'Active' : 'Paused'}
        </span>
      ),
    },
    {
      key: 'alerts',
      header: 'Alerts',
      render: (r) => <span className="text-xs text-ink-muted">{r.alerts ? 'On' : 'Off'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditFixed(r.id)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleFixedExpenseStatus(r.id)}>
            {r.active ? 'Pause' : 'Resume'}
          </Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: 'Delete recurring bill', description: `"${r.name}" will be permanently removed.` }))
              removeEntity('fixedExpenses', r.id);
          }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12">
      <PageHeader
        number="02"
        eyebrow="Module"
        title="Expenses"
        description="Variable and recurring outflows. Log transactions, import bank statements, and see where the month goes."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" size="sm" onClick={openNewExpense}>
              <PlusIcon /> New expense
            </Button>
          </>
        }
      />

      {/* tab switcher */}
      <div className="flex w-fit overflow-hidden rounded-lg border border-rule">
        {[
          { id: 'expenses', label: 'Expenses' },
          { id: 'budget', label: 'Budget' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-5 py-2 text-sm font-medium transition-colors ' +
              (activeTab === tab.id
                ? 'bg-ink text-ink-inverse'
                : 'bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'budget' && <BudgetTab />}

      {activeTab === 'expenses' && <>
      {/* summary stats */}
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3">
        <div className={'min-w-0 bg-surface p-6 ' + rise(1)}>
          <Stat label="This month" value={monthTotal} mode="currency" currency={currency} locale={locale} hint={`${filteredExpenses.length} transactions`} />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat label="Fixed monthly" value={fixedMonthly} mode="currency" currency={currency} locale={locale} hint={`${fixedExpenses.filter((f) => f.active).length} active`} />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat label="Tracked" value={expenses.length} mode="number" locale={locale} hint="all-time entries" />
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

        <Card eyebrow="Filtered month" title="By category" className={'lg:col-span-4 ' + rise(3)}>
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

      {/* transactions */}
      <Card
        eyebrow="Ledger"
        title="Transactions"
        description="Filter by month and category."
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
        className={rise(3)}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <FormField label="Month" htmlFor="expenses-month">
            <Input
              id="expenses-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </FormField>
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
          <Table
            columns={expenseColumns}
            rows={sortedExpenses}
            sortKey={expSortKey}
            sortDir={expSortDir}
            onSort={onExpSort}
            selectable={batchSelect.selecting}
            selectedIds={batchSelect.selectedIds}
            onToggleRow={batchSelect.toggle}
            onToggleAll={batchSelect.toggleAll}
          />
        ) : (
          <EmptyState
            title="No expenses for this filter"
            description="Try another month, clear the category, or import a bank extract."
            action={
              <Button variant="secondary" size="sm" onClick={openNewExpense}>
                <PlusIcon /> Add expense
              </Button>
            }
          />
        )}
      </Card>

      {/* CSV import */}
      <Card
        eyebrow="Import"
        title="Bank extract CSV"
        description="Supports Revolut, N26, ING, and most standard exports. Splits rows into expenses and income automatically."
        className={rise(4)}
      >
        <SmartBankImport
          categories={settings.categories}
          onImportExpenses={async (rows) => {
            for (const row of rows) await saveEntity('expenses', row);
          }}
          onImportIncomes={async (rows) => {
            for (const row of rows) await saveEntity('incomes', row);
          }}
        />
      </Card>

      <SectionDivider label="Recurring" />

      {/* fixed expenses */}
      <Card
        eyebrow="Schedule"
        title="Recurring bills"
        description="Rent, utilities, subscriptions. Pause, resume, or remove — paused bills drop out of projections."
        action={
          <Button variant="primary" size="sm" onClick={openNewFixed}>
            <PlusIcon /> Add recurring
          </Button>
        }
        className={rise(5)}
      >
        {fixedExpenses.length ? (
          <Table columns={fixedColumns} rows={fixedExpenses} density="compact" />
        ) : (
          <EmptyState
            title="No recurring bills yet"
            description="Add your first fixed expense — rent, internet, anything monthly."
            action={
              <Button variant="secondary" size="sm" onClick={openNewFixed}>
                <PlusIcon /> Add recurring
              </Button>
            }
          />
        )}
      </Card>

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
      </>}
    </div>
  );
}

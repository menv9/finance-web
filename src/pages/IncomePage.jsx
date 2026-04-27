import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmContext';
import { BatchDeleteBar } from '../components/BatchDeleteBar';
import { useBatchSelect } from '../hooks/useBatchSelect';
import { useSortable } from '../hooks/useSortable';
import { sortRows } from '../utils/sort';
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
import { MonthSelector } from '../components/MonthSelector';
import { PageHeader } from '../components/PageHeader';
import { IncomeForm } from '../components/forms/IncomeForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { computeIncomeSeries } from '../utils/finance';
import { normalizeDateInput } from '../utils/dates';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { Card, Button, Stat, Table, EmptyState, Modal, FormField, Input, Select } from '../components/ui';
import { rise } from '../utils/motion';

const COLORS = ['var(--accent)', '#8FB97E', '#C9A96E', '#7A9CC6', '#B48EAD'];

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

function saleCashflowCents(sale) {
  return Math.max(sale.proceedsCents || 0, 0);
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

function IncomeLedgerList({
  rows,
  currency,
  locale,
  selectable,
  selectedIds,
  onToggleRow,
  openEdit,
  onDeleteIncome,
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
      {rows.map((row) => {
        const isEditable = row.ledgerType === 'income';
        const isPortfolioSaleLoss = row.incomeKind === 'portfolio_sale' && (row.realizedPnlCents || 0) < 0;
        const displayAmountCents = isPortfolioSaleLoss ? row.realizedPnlCents : row.amountCents;
        const amountClass = row.incomeKind === 'portfolio_sale'
          ? displayAmountCents > 0
            ? 'text-positive'
            : 'text-danger'
          : 'text-positive';
        return (
          <li
            key={row.id}
            className={selectable && selectedIds?.has(row.id) ? 'bg-accent-soft' : 'transition-colors duration-120 hover:bg-surface-raised'}
          >
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              {selectable ? (
                isEditable ? (
                  <input
                    type="checkbox"
                    aria-label="Select income"
                    checked={selectedIds?.has(row.id)}
                    onChange={() => onToggleRow?.(row.id)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[color:var(--accent)]"
                  />
                ) : (
                  <span className="mt-1 block h-4 w-4 shrink-0" />
                )
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {row.source || 'Income'}
                  </p>
                  <span className={`shrink-0 font-mono text-sm tabular ${amountClass}`}>
                    {displayAmountCents >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(displayAmountCents), row.currency || currency, locale).replace(/^[−-]/, '')}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                  <p className="min-w-0 truncate eyebrow">
                    {row.incomeKind || 'income'} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(row.date))}
                  </p>
                  {isEditable ? (
                    <div className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-sunken hover:text-ink"
                        aria-label="Edit income"
                        title="Edit"
                        onClick={() => openEdit(row.id)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger"
                        aria-label="Delete income"
                        title="Delete"
                        onClick={() => onDeleteIncome(row.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-ink-faint">via Portfolio</span>
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

export default function IncomePage() {
  const incomes = useFinanceStore((state) => state.incomes);
  const portfolioSales = useFinanceStore((state) => state.portfolioSales);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const confirm = useConfirm();
  const [modal, setModal] = useState({ open: false, id: null });
  const [incomePage, setIncomePage] = useState(1);
  const currency = settings.baseCurrency;
  const locale = settings.locale;
  const editingIncome = incomes.find((income) => income.id === modal.id);

  const openNew = () => setModal({ open: true, id: null });
  const openEdit = (id) => setModal({ open: true, id });
  const close = () => setModal({ open: false, id: null });

  // ── Filters ──
  const [selectedMonth, setSelectedMonth] = useState(normalizeDateInput(new Date()).slice(0, 7));
  const [filterKind, setFilterKind] = useState('all');
  const [sourceSearch, setSourceSearch] = useState('');

  const incomeLedgerRows = useMemo(
    () => [
      ...incomes.map((income) => ({ ...income, ledgerType: 'income' })),
      ...(portfolioSales || [])
        .map((sale) => ({
          id: `portfolio-sale-cashflow-${sale.id}`,
          date: sale.date,
          source: `${sale.ticker} sale cashflow`,
          incomeKind: 'portfolio_sale_cashflow',
          amountCents: sale.cashflowCents ?? saleCashflowCents(sale),
          currency,
          assetTicker: `Returned capital - ${sale.ticker}`,
          ledgerType: 'portfolio-sale-cashflow',
        }))
        .filter((row) => row.amountCents > 0),
    ],
    [currency, incomes, portfolioSales],
  );

  const filteredIncomeRows = useMemo(
    () =>
      incomeLedgerRows.filter(
        (row) =>
          row.date.startsWith(selectedMonth) &&
          (filterKind === 'all' || row.incomeKind === filterKind) &&
          (!sourceSearch || (row.source || '').toLowerCase().includes(sourceSearch.toLowerCase())),
      ),
    [filterKind, incomeLedgerRows, selectedMonth, sourceSearch],
  );

  const selectedMonthRows = useMemo(
    () => incomeLedgerRows.filter((row) => row.date.startsWith(selectedMonth)),
    [incomeLedgerRows, selectedMonth],
  );

  const { sortKey: incSortKey, sortDir: incSortDir, onSort: onIncSort } = useSortable('date', 'desc');
  const sortedIncomeRows = useMemo(
    () => sortRows(filteredIncomeRows, incSortKey, incSortDir),
    [filteredIncomeRows, incSortKey, incSortDir],
  );

  const batchSelect = useBatchSelect(sortedIncomeRows.filter((row) => row.ledgerType === 'income'));

  useEffect(() => { batchSelect.cancel(); }, [selectedMonth, filterKind, sourceSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setIncomePage(1); }, [selectedMonth, filterKind, sourceSearch]);

  const handleBatchDeleteIncomes = async () => {
    const ids = [...batchSelect.selectedIds];
    const ok = await confirm({
      title: `Delete ${ids.length} income record${ids.length !== 1 ? 's' : ''}`,
      description: 'These income entries will be permanently removed. This cannot be undone.',
    });
    if (!ok) return;
    for (const id of ids) await removeEntity('incomes', id);
    batchSelect.cancel();
  };

  const sourceBreakdown = useMemo(() => {
    const portfolioKinds = new Set(['dividend', 'portfolio_sale', 'portfolio_sale_cashflow']);
    const totals = selectedMonthRows.reduce((acc, i) => {
      const key = portfolioKinds.has(i.incomeKind) ? 'Holdings' : i.source;
      acc[key] = (acc[key] || 0) + i.amountCents;
      return acc;
    }, {});
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [selectedMonthRows]);

  const selectedMonthIncome = selectedMonthRows.reduce((sum, row) => sum + row.amountCents, 0);
  const selectedMonthSideIncome = selectedMonthRows
    .filter((row) => row.incomeKind === 'variable')
    .reduce((sum, row) => sum + row.amountCents, 0);
  const topSource = sourceBreakdown.slice().sort((a, b) => b.value - a.value)[0];

  const incomeColumns = [
    { key: 'date', header: 'Date', width: 110, sortable: true },
    { key: 'source', header: 'Source', sortable: true },
    {
      key: 'incomeKind',
      header: 'Kind',
      sortable: true,
      hideOnMobile: true,
      render: (r) => (
        <span className="inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted border border-rule">
          {r.incomeKind}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      hideOnMobile: true,
      render: (r) =>
        r.incomeKind === 'fixed'
          ? `${r.frequency} · day ${r.payDay}`
          : r.incomeKind === 'variable'
          ? `${r.client || '—'} · ${r.invoiceStatus || 'draft'}`
          : r.assetTicker || 'asset pending',
    },
    {
      key: 'amountCents',
      header: 'Amount',
      numeric: true,
      sortable: true,
      render: (r) => {
        const isPortfolioSaleLoss = r.incomeKind === 'portfolio_sale' && (r.realizedPnlCents || 0) < 0;
        const displayAmountCents = isPortfolioSaleLoss ? r.realizedPnlCents : r.amountCents;
        return (
          <span
            className={
              r.incomeKind === 'portfolio_sale'
                ? displayAmountCents > 0
                  ? 'text-positive'
                  : 'text-danger'
                : 'text-positive'
            }
          >
            {formatCurrency(displayAmountCents, r.currency, locale)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      render: (r) => (
        r.ledgerType === 'income' ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(r.id)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (await confirm({ title: 'Delete income record', description: 'This income entry will be permanently removed.' }))
                removeEntity('incomes', r.id);
            }}>Delete</Button>
          </div>
        ) : (
          <span className="text-xs text-ink-faint px-2 py-1">via Portfolio</span>
        )
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="03"
        eyebrow="Module"
        title="Income"
        description="Salary, freelance, dividends — three models rolled into a single monthly cashflow view."
        actions={
          <>
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> New income
            </Button>
            <MonthSelector
              id="income-view-month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="mt-8 w-full"
            />
          </>
        }
      />

      {/* KPIs */}
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3">
        <div className={'min-w-0 bg-surface p-6 ' + rise(1)}>
          <Stat
            label="Selected month"
            value={selectedMonthIncome}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={`${selectedMonthRows.length} records`}
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label="Side income"
            value={selectedMonthSideIncome}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="freelance & variable this month"
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(3)}>
          <Stat
            label="Top source"
            value={topSource ? formatCurrency(topSource.value, currency, locale) : '—'}
            mode="custom"
            hint={topSource?.name || 'no records'}
          />
        </div>
      </section>

      {/* split + trend — same grid pattern as portfolio */}
      <section className={'grid gap-6 lg:grid-cols-12 ' + rise(3)}>
        <Card eyebrow="Twelve months" title="Monthly income" variant="chart" className="lg:col-span-7">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={computeIncomeSeries(incomes)} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
              <Bar dataKey="amountCents" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card eyebrow="Split" title="By source" className="lg:col-span-5">
          {sourceBreakdown.length ? (
            <div className="flex flex-col gap-5">
              <div className="relative mx-auto h-[200px] w-full max-w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="95%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {sourceBreakdown.map((item, index) => (
                        <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex flex-col gap-2">
                {(() => {
                  const total = sourceBreakdown.reduce((s, i) => s + i.value, 0);
                  return sourceBreakdown
                    .slice()
                    .sort((a, b) => b.value - a.value)
                    .map((item) => {
                      const originalIndex = sourceBreakdown.findIndex((s) => s.name === item.name);
                      const color = COLORS[originalIndex % COLORS.length];
                      const share = total ? (item.value / total) * 100 : 0;
                      return (
                        <li key={item.name} className="flex items-center gap-2 min-w-0">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                          <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.name || 'Unnamed'}</span>
                          <span className="w-20 shrink-0 font-mono tabular text-xs text-ink-muted">{formatCurrency(item.value, currency, locale)}</span>
                          <span className="w-9 shrink-0 font-mono tabular text-xs text-ink-faint text-right">{share.toFixed(1)}%</span>
                          <div className="w-14 shrink-0 h-1 rounded-full bg-rule overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${share}%`, background: color }} />
                          </div>
                        </li>
                      );
                    });
                })()}
              </ul>
            </div>
          ) : (
            <EmptyState title="No data yet" description="Log income to see the source split." />
          )}
        </Card>
      </section>

      {/* ledger */}
      <Card
        eyebrow="Ledger"
        title="Income"
        description="Filter the selected month by kind and source."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {!batchSelect.selecting && sortedIncomeRows.some((row) => row.ledgerType === 'income') && (
              <Button variant="secondary" size="sm" onClick={batchSelect.start}>
                Select
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={openNew}>
              <PlusIcon /> Add income
            </Button>
          </div>
        }
        className={rise(5)}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <FormField label="Kind" htmlFor="income-kind">
            <Select id="income-kind" value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
              <option value="all">All kinds</option>
              <option value="fixed">Fixed (salary)</option>
              <option value="variable">Variable (freelance)</option>
              <option value="dividend">Dividend</option>
              <option value="portfolio_sale">Portfolio sale</option>
              <option value="portfolio_sale_cashflow">Portfolio sale cashflow</option>
            </Select>
          </FormField>
          <FormField label="Source" htmlFor="income-source">
            <Input
              id="income-source"
              type="text"
              placeholder="Search…"
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
            />
          </FormField>
        </div>
        <BatchDeleteBar
          selecting={batchSelect.selecting}
          selectedCount={batchSelect.selectedIds.size}
          onDelete={handleBatchDeleteIncomes}
          onCancel={batchSelect.cancel}
        />
        {filteredIncomeRows.length ? (
          <>
            <IncomeLedgerList
              rows={sortedIncomeRows.slice((incomePage - 1) * PAGE_SIZE, incomePage * PAGE_SIZE)}
              currency={currency}
              locale={locale}
              selectable={batchSelect.selecting}
              selectedIds={batchSelect.selectedIds}
              onToggleRow={batchSelect.toggle}
              openEdit={openEdit}
              onDeleteIncome={async (id) => {
                if (await confirm({ title: 'Delete income record', description: 'This income entry will be permanently removed.' }))
                  removeEntity('incomes', id);
              }}
            />
            <Pagination
              page={incomePage}
              totalPages={Math.ceil(sortedIncomeRows.length / PAGE_SIZE)}
              onPrev={() => setIncomePage((p) => Math.max(1, p - 1))}
              onNext={() => setIncomePage((p) => Math.min(Math.ceil(sortedIncomeRows.length / PAGE_SIZE), p + 1))}
            />
          </>
        ) : (
          <EmptyState
            title={incomeLedgerRows.length ? 'No results for this filter' : 'No income records yet'}
            description={incomes.length ? 'Try adjusting the month, kind, or source.' : 'Add salary, freelance invoices, or dividends to get started.'}
            action={
              !incomeLedgerRows.length && (
                <Button variant="secondary" size="sm" onClick={openNew}>
                  <PlusIcon /> Add income
                </Button>
              )
            }
          />
        )}
      </Card>

      <Modal
        open={modal.open}
        onClose={close}
        eyebrow="Income entry"
        title={editingIncome ? 'Edit income' : 'New income'}
        description="Choose fixed (salary), variable (freelance), or asset-linked (dividends)."
        size="lg"
      >
        <IncomeForm
          initialValue={editingIncome}
          onSubmit={async (value) => {
            await saveEntity('incomes', value);
            close();
          }}
          onCancel={close}
        />
      </Modal>

    </div>
  );
}
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
import { PageHeader } from '../components/PageHeader';
import { IncomeForm } from '../components/forms/IncomeForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { computeIncomeSeries, yearlySideIncome } from '../utils/finance';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { Card, Button, Stat, Table, EmptyState, Modal, FormField, Input, Select } from '../components/ui';
import { rise } from '../utils/motion';

const COLORS = ['var(--accent)', '#8FB97E', '#C9A96E', '#7A9CC6', '#B48EAD'];

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

export default function IncomePage() {
  const incomes = useFinanceStore((state) => state.incomes);
  const portfolioSales = useFinanceStore((state) => state.portfolioSales);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const confirm = useConfirm();
  const [modal, setModal] = useState({ open: false, id: null });
  const currency = settings.baseCurrency;
  const locale = settings.locale;
  const editingIncome = incomes.find((income) => income.id === modal.id);

  const openNew = () => setModal({ open: true, id: null });
  const openEdit = (id) => setModal({ open: true, id });
  const close = () => setModal({ open: false, id: null });

  // ── Filters ──
  const [filterMonth, setFilterMonth] = useState('');
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
          (!filterMonth || row.date.startsWith(filterMonth)) &&
          (filterKind === 'all' || row.incomeKind === filterKind) &&
          (!sourceSearch || (row.source || '').toLowerCase().includes(sourceSearch.toLowerCase())),
      ),
    [filterKind, filterMonth, incomeLedgerRows, sourceSearch],
  );

  const { sortKey: incSortKey, sortDir: incSortDir, onSort: onIncSort } = useSortable('date', 'desc');
  const sortedIncomeRows = useMemo(
    () => sortRows(filteredIncomeRows, incSortKey, incSortDir),
    [filteredIncomeRows, incSortKey, incSortDir],
  );

  const batchSelect = useBatchSelect(sortedIncomeRows.filter((row) => row.ledgerType === 'income'));

  useEffect(() => { batchSelect.cancel(); }, [filterMonth, filterKind, sourceSearch]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const totals = incomes.reduce((acc, i) => {
      const key = portfolioKinds.has(i.incomeKind) ? 'Holdings' : i.source;
      acc[key] = (acc[key] || 0) + i.amountCents;
      return acc;
    }, {});
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [incomes]);

  const topSource = sourceBreakdown.sort((a, b) => b.value - a.value)[0];

  const incomeColumns = [
    { key: 'date', header: 'Date', width: 110, sortable: true },
    { key: 'source', header: 'Source', sortable: true },
    {
      key: 'incomeKind',
      header: 'Kind',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted border border-rule">
          {r.incomeKind}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
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
      render: (r) => (
        <span
          className={
            r.incomeKind === 'portfolio_sale'
              ? r.amountCents > 0
                ? 'text-positive'
                : 'text-danger'
              : 'text-positive'
          }
        >
          {formatCurrency(r.amountCents, r.currency, locale)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        r.ledgerType === 'income' ? (
          <div className="flex justify-end gap-1">
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
    <div className="grid grid-cols-1 gap-12">
      <PageHeader
        number="03"
        eyebrow="Module"
        title="Income"
        description="Salary, freelance, dividends — three models rolled into a single monthly cashflow view."
        actions={
          <Button variant="primary" size="sm" onClick={openNew}>
            <PlusIcon /> New income
          </Button>
        }
      />

      {/* KPIs */}
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3">
        <div className={'min-w-0 bg-surface p-6 ' + rise(1)}>
          <Stat
            label="Net cashflow"
            value={dashboard.cashflowCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint={
              dashboard.cashflowCents >= 0
                ? 'available to spend this month'
                : 'expenses exceed income'
            }
          />
        </div>
        <div className={'min-w-0 bg-surface p-6 ' + rise(2)}>
          <Stat
            label="Side income YTD"
            value={yearlySideIncome(incomes)}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="freelance & variable"
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

      {/* source split */}
      <Card
        eyebrow="Split"
        title="By source"
        className={rise(3)}
      >
        {sourceBreakdown.length ? (
          <div className="flex flex-col items-center gap-6">
            <div className="relative h-[260px] w-full max-w-[260px]">
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
            <ul className="flex w-full flex-col gap-2">
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
                        <span className="w-24 shrink-0 font-mono tabular text-xs text-ink-muted">{formatCurrency(item.value, currency, locale)}</span>
                        <span className="w-9 shrink-0 font-mono tabular text-xs text-ink-faint text-right">{share.toFixed(1)}%</span>
                        <div className="w-16 shrink-0 h-1 rounded-full bg-rule overflow-hidden">
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

      {/* trend */}
      <Card
        eyebrow="Twelve months"
        title="Monthly income"
        variant="chart"
        className={rise(4)}
      >
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

      {/* ledger */}
      <Card
        eyebrow="Ledger"
        title="All income records"
        description="Each entry has type-specific details; dividends flow in from the Portfolio module."
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
        <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <FormField label="Month" htmlFor="income-month">
            <Input
              id="income-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </FormField>
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
          <Table
            columns={incomeColumns}
            rows={sortedIncomeRows}
            sortKey={incSortKey}
            sortDir={incSortDir}
            onSort={onIncSort}
            selectable={batchSelect.selecting}
            selectedIds={batchSelect.selectedIds}
            onToggleRow={batchSelect.toggle}
            onToggleAll={batchSelect.toggleAll}
            isRowSelectable={(row) => row.ledgerType === 'income'}
          />
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

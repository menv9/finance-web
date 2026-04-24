import { useMemo, useState } from 'react';
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
import { Card, Button, Stat, Table, EmptyState, Modal } from '../components/ui';
import { rise } from '../utils/motion';

const COLORS = ['var(--accent)', '#8FB97E', '#C9A96E', '#7A9CC6', '#B48EAD'];

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function IncomePage() {
  const incomes = useFinanceStore((state) => state.incomes);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const [modal, setModal] = useState({ open: false, id: null });
  const currency = settings.baseCurrency;
  const locale = settings.locale;
  const editingIncome = incomes.find((income) => income.id === modal.id);

  const openNew = () => setModal({ open: true, id: null });
  const openEdit = (id) => setModal({ open: true, id });
  const close = () => setModal({ open: false, id: null });

  const sourceBreakdown = useMemo(() => {
    const totals = incomes.reduce((acc, i) => {
      acc[i.source] = (acc[i.source] || 0) + i.amountCents;
      return acc;
    }, {});
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [incomes]);

  const topSource = sourceBreakdown.sort((a, b) => b.value - a.value)[0];

  const incomeColumns = [
    { key: 'date', header: 'Date', width: 110 },
    { key: 'source', header: 'Source' },
    {
      key: 'incomeKind',
      header: 'Kind',
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
      render: (r) => formatCurrency(r.amountCents, r.currency, locale),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r.id)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => removeEntity('incomes', r.id)}>Delete</Button>
        </div>
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
                ? 'income exceeds expenses'
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
          <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,260px)_1fr] md:items-center">
            <div className="relative mx-auto h-[240px] w-full max-w-[240px] min-w-0">
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
            <ul className="grid gap-2">
              {(() => {
                const total = sourceBreakdown.reduce((s, i) => s + i.value, 0);
                return sourceBreakdown
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((item) => {
                    const originalIndex = sourceBreakdown.findIndex((s) => s.name === item.name);
                    const share = total ? (item.value / total) * 100 : 0;
                    return (
                      <li key={item.name} className="flex items-baseline gap-3">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-sm"
                          style={{ background: COLORS[originalIndex % COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">{item.name || 'Unnamed'}</p>
                          <p className="eyebrow mt-0.5">
                            <span className="font-mono tabular text-ink-muted">
                              {formatCurrency(item.value, currency, locale)}
                            </span>
                            <span className="mx-1.5 text-ink-faint">·</span>
                            <span className="font-mono tabular">{share.toFixed(1)}%</span>
                          </p>
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
          <Button variant="primary" size="sm" onClick={openNew}>
            <PlusIcon /> Add income
          </Button>
        }
        className={rise(5)}
      >
        {incomes.length ? (
          <Table columns={incomeColumns} rows={incomes} />
        ) : (
          <EmptyState
            title="No income records yet"
            description="Add salary, freelance invoices, or dividends to get started."
            action={
              <Button variant="secondary" size="sm" onClick={openNew}>
                <PlusIcon /> Add income
              </Button>
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

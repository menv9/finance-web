import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { IncomeForm } from '../components/forms/IncomeForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { computeIncomeSeries, yearlySideIncome } from '../utils/finance';
import { formatCurrency } from '../utils/formatters';

const COLORS = ['#0f766e', '#2563eb', '#d97706'];

export default function IncomePage() {
  const incomes = useFinanceStore((state) => state.incomes);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const [editingId, setEditingId] = useState(null);
  const currency = settings.baseCurrency;
  const locale = settings.locale;
  const editingIncome = incomes.find((income) => income.id === editingId);

  const sourceBreakdown = useMemo(() => {
    const sourceTotals = incomes.reduce((accumulator, income) => {
      accumulator[income.source] = (accumulator[income.source] || 0) + income.amountCents;
      return accumulator;
    }, {});
    return Object.entries(sourceTotals).map(([name, value]) => ({ name, value }));
  }, [incomes]);

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Module 2" title="Income" description="Fixed salary, freelance work and dividend income rolled into one monthly cashflow view." />

      <section className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Income vs expenses" subtitle="Cashflow snapshot for the current month.">
          <p className="text-3xl font-bold">{formatCurrency(dashboard.cashflowCents, currency, locale)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {formatCurrency(dashboard.incomeSeries.at(-1)?.amountCents || 0, currency, locale)} income against {formatCurrency(dashboard.expenseSeries.at(-1)?.amountCents || 0, currency, locale)} expenses.
          </p>
        </SectionCard>
        <SectionCard title="Side income YTD" subtitle="Freelance and variable income accumulated this year.">
          <p className="text-3xl font-bold">{formatCurrency(yearlySideIncome(incomes), currency, locale)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Useful for tracking side projects and extra shifts.</p>
        </SectionCard>
        <SectionCard title="Shift calendar model" subtitle="4-on / 4-off can live as a fixed income frequency.">
          <p className="text-sm text-[var(--text-muted)]">Enter it as a fixed income and set frequency to `every 8 days` in the form below.</p>
        </SectionCard>
      </section>

      <section className="mobile-stack grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Income entry" subtitle="Three data models aligned with the spec.">
          <IncomeForm
            initialValue={editingIncome}
            onSubmit={async (value) => { await saveEntity('incomes', value); setEditingId(null); }}
            onCancel={editingIncome ? () => setEditingId(null) : undefined}
          />
        </SectionCard>

        <ChartCard title="Income by source">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sourceBreakdown} dataKey="value" nameKey="name" innerRadius={65} outerRadius={110}>
                {sourceBreakdown.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value, currency, locale)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <ChartCard title="Monthly income trend">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={computeIncomeSeries(incomes)}>
            <CartesianGrid stroke="var(--border-soft)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--text-muted)" />
            <YAxis hide />
            <Tooltip formatter={(value) => formatCurrency(value, currency, locale)} />
            <Bar dataKey="amountCents" fill="var(--accent)" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionCard title="Income ledger" subtitle="Income records with type-specific fields.">
        {incomes.length ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => (
                  <tr key={income.id}>
                    <td>{income.date}</td>
                    <td>{income.source}</td>
                    <td>{income.incomeKind}</td>
                    <td>{income.incomeKind === 'fixed' ? `${income.frequency} / day ${income.payDay}` : income.incomeKind === 'variable' ? `${income.client || 'No client'} / ${income.invoiceStatus || 'draft'}` : income.assetTicker || 'Asset pending'}</td>
                    <td>{formatCurrency(income.amountCents, income.currency, locale)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="button-ghost" onClick={() => setEditingId(income.id)}>Edit</button>
                        <button className="button-ghost" onClick={() => removeEntity('incomes', income.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No income records yet" description="Add salary, freelance work or dividends to start." />}
      </SectionCard>
    </div>
  );
}

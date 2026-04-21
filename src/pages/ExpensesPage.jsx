import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { CsvImportCard } from '../components/CsvImportCard';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { ExpenseForm } from '../components/forms/ExpenseForm';
import { FixedExpenseForm } from '../components/forms/FixedExpenseForm';
import { useFinanceStore } from '../store/useFinanceStore';
import { categoryBreakdown, computeExpenseSeries } from '../utils/finance';
import { formatCurrency } from '../utils/formatters';
import { normalizeDateInput } from '../utils/dates';
import { rowsToCsv } from '../utils/csv';

const DONUT_COLORS = ['#0f766e', '#d97706', '#2563eb', '#dc2626', '#7c3aed', '#0891b2', '#65a30d'];

export default function ExpensesPage() {
  const expenses = useFinanceStore((state) => state.expenses);
  const fixedExpenses = useFinanceStore((state) => state.fixedExpenses);
  const settings = useFinanceStore((state) => state.settings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const removeEntity = useFinanceStore((state) => state.removeEntity);
  const saveFixedExpense = useFinanceStore((state) => state.saveFixedExpense);
  const toggleFixedExpenseStatus = useFinanceStore((state) => state.toggleFixedExpenseStatus);
  const [selectedMonth, setSelectedMonth] = useState(normalizeDateInput(new Date()).slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editingFixedId, setEditingFixedId] = useState(null);

  const locale = settings.locale;
  const currency = settings.baseCurrency;
  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.startsWith(selectedMonth) && (selectedCategory === 'all' || expense.category === selectedCategory)),
    [expenses, selectedCategory, selectedMonth],
  );
  const chartData = computeExpenseSeries(expenses);
  const breakdown = categoryBreakdown(filteredExpenses);
  const editingExpense = expenses.find((item) => item.id === editingId);
  const editingFixedExpense = fixedExpenses.find((item) => item.id === editingFixedId);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Module 1"
        title="Expenses"
        description="Track recurring and variable spending, import bank extracts and monitor fixed outflows."
        actions={<button className="button-secondary" onClick={() => {
          const csv = rowsToCsv(expenses.map((expense) => ({
            date: expense.date,
            amount: (expense.amountCents / 100).toFixed(2),
            currency: expense.currency,
            category: expense.category,
            subcategory: expense.subcategory,
            description: expense.description,
            recurring: expense.isRecurring,
          })));
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'expenses.csv';
          anchor.click();
          URL.revokeObjectURL(url);
        }}>Export CSV</button>}
      />

      <section className="mobile-stack grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Expense entry" subtitle="Create or edit transactions stored in IndexedDB.">
          <ExpenseForm
            categories={settings.categories}
            initialValue={editingExpense}
            onSubmit={async (value) => { await saveEntity('expenses', value); setEditingId(null); }}
            onCancel={editingExpense ? () => setEditingId(null) : undefined}
          />
        </SectionCard>

        <SectionCard title="CSV import" subtitle="Flexible column mapping for Austrian bank extracts.">
          <CsvImportCard
            mapping={settings.csvMapping}
            categories={settings.categories}
            onImport={async (rows) => {
              for (const row of rows) {
                await saveEntity('expenses', row);
              }
            }}
          />
        </SectionCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard title="Monthly spend, last 12 months">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="month" stroke="var(--text-muted)" />
              <YAxis hide />
              <Tooltip formatter={(value) => formatCurrency(value, currency, locale)} />
              <Bar dataKey="amountCents" fill="#d97706" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Category distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110}>
                {breakdown.map((entry, index) => <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value, currency, locale)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <SectionCard title="Transactions" subtitle="Filter by month and category.">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="field">
            <label htmlFor="expenses-month">Month</label>
            <input id="expenses-month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="expenses-category">Category</label>
            <select id="expenses-category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              <option value="all">All categories</option>
              {settings.categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
        </div>

        {filteredExpenses.length ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Amount</th>
                  <th>Recurring</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.date}</td>
                    <td>{expense.description}</td>
                    <td>{expense.category}</td>
                    <td>{expense.subcategory || '-'}</td>
                    <td>{formatCurrency(expense.amountCents, expense.currency, locale)}</td>
                    <td>{expense.isRecurring ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="button-ghost" onClick={() => setEditingId(expense.id)}>Edit</button>
                        <button className="button-ghost" onClick={() => removeEntity('expenses', expense.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No expenses for this filter" description="Try another month or import a bank extract." />}
      </SectionCard>

      <section className="mobile-stack grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Fixed expense entry" subtitle="Manage rent, Strom and any other recurring bill from a dedicated CRUD.">
          <FixedExpenseForm
            categories={settings.categories}
            initialValue={editingFixedExpense}
            onSubmit={async (value) => {
              await saveFixedExpense(value);
              setEditingFixedId(null);
            }}
            onCancel={editingFixedExpense ? () => setEditingFixedId(null) : undefined}
          />
        </SectionCard>

        <SectionCard title="Fixed expenses" subtitle="Active or paused recurring bills with due dates and alerts.">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Charge day</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Alerts</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fixedExpenses.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.chargeDay}</td>
                    <td>{formatCurrency(item.amountCents, item.currency, locale)}</td>
                    <td><span className="badge">{item.active ? 'Active' : 'Paused'}</span></td>
                    <td>{item.alerts ? 'On' : 'Off'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="button-ghost" onClick={() => setEditingFixedId(item.id)}>Edit</button>
                        <button className="button-ghost" onClick={() => toggleFixedExpenseStatus(item.id)}>{item.active ? 'Pause' : 'Activate'}</button>
                        <button className="button-ghost" onClick={() => removeEntity('fixedExpenses', item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

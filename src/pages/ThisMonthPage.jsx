import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { chartMonthLabel, normalizeDateInput } from '../utils/dates';
import { Card, Stat, EmptyState } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { MonthSelector } from '../components/MonthSelector';
import { rise } from '../utils/motion';

function currentMonthKey() {
  return normalizeDateInput(new Date()).slice(0, 7);
}

const PAGE_SIZE = 10;

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

// Progress-bar cell that contextualises the cashflow number with income as denominator
function CashflowIncomeCell({ incomeCents, cashflowCents, currency, locale, className }) {
  const incomeTotalCents = Math.max(incomeCents, 0);
  // spentCents = everything that left income (expenses + saved + invested)
  const spentCents = Math.max(incomeCents - cashflowCents, 0);
  const isOver = cashflowCents < 0;
  const differenceCents = Math.abs(cashflowCents);
  const fillPercent = incomeTotalCents > 0 ? Math.min((spentCents / incomeTotalCents) * 100, 100) : 100;

  return (
    <div className={`min-w-0 bg-surface p-6 ${className || ''}`}>
      <p className="eyebrow mb-3">Net cashflow</p>
      {incomeTotalCents > 0 ? (
        <>
          <p className="text-sm text-ink mb-3">
            Spent{' '}
            <span className="font-semibold numeric">
              {formatCurrency(spentCents, currency, locale)}
            </span>{' '}
            of{' '}
            <span className="font-semibold numeric">
              {formatCurrency(incomeTotalCents, currency, locale)}
            </span>{' '}
            income
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-danger' : 'bg-accent'}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className={`mt-2.5 text-sm font-semibold numeric ${isOver ? 'text-danger' : 'text-positive'}`}>
            {isOver
              ? `+${formatCurrency(differenceCents, currency, locale).replace(/^[−-]/, '')} over`
              : `${formatCurrency(differenceCents, currency, locale)} left`}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">No income logged this month.</p>
      )}
    </div>
  );
}

function monthDisplayLabel(month) {
  if (!month) return '';
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(year, m - 1, 1),
  );
}

export default function ThisMonthPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [activityPage, setActivityPage] = useState(1);
  useEffect(() => { setActivityPage(1); }, [selectedMonth]);

  const dashboard = useFinanceStore((s) => s.derived.dashboard);
  const incomes = useFinanceStore((s) => s.incomes);
  const expenses = useFinanceStore((s) => s.expenses);
  const transfers = useFinanceStore((s) => s.transfers);
  const savingsEntries = useFinanceStore((s) => s.savingsEntries);
  const portfolioSales = useFinanceStore((s) => s.portfolioSales);
  const settings = useFinanceStore((s) => s.settings);

  const currency = settings.baseCurrency;
  const locale = settings.locale || 'en-GB';

  // Compute monthly KPIs from raw data for the selected month
  const metrics = useMemo(() => {
    const savingsPaidExpenseIds = new Set(
      transfers
        .filter((t) => t.fromModule === 'savings' && t.toModule === 'expenses')
        .map((t) => t.linkedExpenseId)
        .filter(Boolean),
    );

    // Exclude transfer incomes (savings withdrawals) — they affect balance but
    // should not inflate the monthly cashflow/income metrics.
    const monthIncomes = incomes.filter(
      (e) =>
        (e.accountingMonth || e.date?.slice(0, 7)) === selectedMonth &&
        e.incomeKind !== 'transfer',
    );
    const monthCashflowIncomes = monthIncomes.filter((e) => e.incomeKind !== 'portfolio_sale');
    const monthExpenses = expenses.filter(
      (e) => e.date?.slice(0, 7) === selectedMonth && !savingsPaidExpenseIds.has(e.id),
    );
    const monthTransfers = transfers.filter((t) => t.date?.startsWith(selectedMonth));

    const incomeCents = monthIncomes.reduce((s, e) => s + (e.amountCents || 0), 0);
    const cashflowIncomeCents = monthCashflowIncomes.reduce((s, e) => s + (e.amountCents || 0), 0);
    const expenseCents = monthExpenses.reduce((s, e) => s + (e.amountCents || 0), 0);

    const isCashflowSource = (t) => t.fromModule === 'income' || t.fromModule === 'cashflow';
    const distributedToPortfolioCents = monthTransfers
      .filter((t) => isCashflowSource(t) && t.toModule === 'portfolio')
      .reduce((s, t) => s + (t.amountCents || 0), 0);

    const netSavedThisMonthCents = (savingsEntries || [])
      .filter((e) => e.date?.startsWith(selectedMonth) && e.source !== 'allocation')
      .reduce((s, e) => s + (e.amountCents || 0), 0);

    const saleCashflowCents = (portfolioSales || [])
      .filter((sale) => sale.date?.slice(0, 7) === selectedMonth)
      .reduce((acc, sale) => acc + Math.max((sale.proceedsCents || 0) - (sale.feeCents || 0), 0), 0);

    const cashflowCents =
      cashflowIncomeCents +
      saleCashflowCents -
      expenseCents -
      distributedToPortfolioCents;

    return {
      incomeCents,
      expenseCents,
      cashflowCents,
      savedCents: netSavedThisMonthCents,
      investedCents: distributedToPortfolioCents,
    };
  }, [incomes, expenses, transfers, savingsEntries, portfolioSales, selectedMonth]);

  // Combined activity log for the selected month
  const activityLog = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = [];

    incomes
      .filter(
        (e) =>
          (e.accountingMonth || e.date?.slice(0, 7)) === selectedMonth && e.date <= today,
      )
      .forEach((e) =>
        rows.push({
          id: e.id,
          type: 'income',
          date: e.date,
          label: e.source || 'Income',
          amountCents: e.amountCents,
          direction: 'in',
        }),
      );

    expenses
      .filter((e) => e.date?.slice(0, 7) === selectedMonth && e.date <= today)
      .forEach((e) =>
        rows.push({
          id: e.id,
          type: 'expense',
          date: e.date,
          label: e.description || e.category || 'Expense',
          amountCents: e.amountCents,
          direction: 'out',
        }),
      );

    transfers
      .filter((t) => t.date?.startsWith(selectedMonth) && t.date <= today)
      .forEach((t) =>
        rows.push({
          id: t.id,
          type: 'transfer',
          date: t.date,
          label: t.description || `${t.fromModule} → ${t.toModule}`,
          amountCents: t.amountCents,
          direction: 'out',
        }),
      );

    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [incomes, expenses, transfers, selectedMonth]);

  // 12-month bar chart data + selected month highlight label
  const chartData = dashboard.cashflowSeries || [];
  const selectedMonthChartLabel = chartMonthLabel(`${selectedMonth}-01`);

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="02"
        eyebrow={monthDisplayLabel(selectedMonth)}
        title="This month"
        description="A snapshot of your monthly income, spending, and cashflow."
        className="mb-0 pb-6"
        actions={
          <MonthSelector
            id="this-month-selector"
            value={selectedMonth}
            onChange={setSelectedMonth}
            className="mt-8 w-full"
          />
        }
      />

      {/* Monthly KPIs */}
      <section
        aria-label="Monthly figures"
        data-tour="this-month-kpis"
        className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-3"
      >
        <div className={`min-w-0 bg-surface p-6 ${rise(1)}`}>
          <Stat
            label="Income"
            value={metrics.incomeCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="this month"
            info="Total income assigned to this month."
            animate
          />
        </div>
        <div className={`min-w-0 bg-surface p-6 ${rise(2)}`}>
          <Stat
            label="Expenses"
            value={metrics.expenseCents}
            mode="currency"
            currency={currency}
            locale={locale}
            hint="this month"
            info="Total expenses logged this month."
            animate
          />
        </div>
        <CashflowIncomeCell
          incomeCents={metrics.incomeCents}
          cashflowCents={metrics.cashflowCents}
          currency={currency}
          locale={locale}
          className={rise(3)}
        />
      </section>

      {/* Saved / Invested */}
      <section className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2">
        {[
          {
            label: 'Saved',
            value: metrics.savedCents,
            hint: metrics.savedCents >= 0 ? 'to savings' : 'withdrawn from savings',
            info: 'Net savings movement this month: deposits minus withdrawals.',
          },
          {
            label: 'Invested',
            value: metrics.investedCents,
            hint: 'to portfolio',
            info: 'Transfers to your portfolio this month.',
          },
        ].map((kpi, i) => (
          <div key={kpi.label} className={`min-w-0 bg-surface p-6 ${rise(i + 4)}`}>
            <Stat
              label={kpi.label}
              value={kpi.value}
              mode="currency"
              currency={currency}
              locale={locale}
              hint={kpi.hint}
              info={kpi.info}
              animate
            />
          </div>
        ))}
      </section>

      {/* 12-month bar chart */}
      <Card
        data-tour="this-month-chart"
        eyebrow="12-month view"
        title="Income vs. expenses"
        description="Your monthly rhythm over the last year. Selected month is highlighted."
        variant="chart"
        className={rise(5)}
      >
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => formatCurrencyCompact(v, currency, locale)}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
              <Bar dataKey="incomeCents" name="Income" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill="var(--accent)"
                    fillOpacity={entry.month === selectedMonthChartLabel ? 1 : 0.35}
                  />
                ))}
              </Bar>
              <Bar dataKey="expenseCents" name="Expenses" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill="var(--danger)"
                    fillOpacity={entry.month === selectedMonthChartLabel ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No data yet" description="Log income or expenses to see this chart." />
        )}
      </Card>

      {/* Activity log */}
      <Card
        data-tour="this-month-activity"
        eyebrow="Activity"
        title={`Transactions in ${monthDisplayLabel(selectedMonth)}`}
        className={rise(6)}
      >
        {activityLog.length ? (
          <>
          <ul className="divide-y divide-rule">
            {activityLog.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE).map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.label}</p>
                  <p className="eyebrow mt-1">
                    {item.type} ·{' '}
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(
                      new Date(item.date),
                    )}
                  </p>
                </div>
                <span
                  className={`numeric text-sm tabular rounded px-1.5 py-0.5 ${
                    item.direction === 'in'
                      ? 'text-positive bg-positive-soft'
                      : item.type === 'transfer'
                        ? 'text-ink-muted bg-surface-raised'
                        : 'text-danger bg-danger-soft'
                  }`}
                >
                  {item.direction === 'in' ? '+' : '−'}
                  {formatCurrency(Math.abs(item.amountCents), currency, locale).replace(
                    /^[−-]/,
                    '',
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Pagination
            page={activityPage}
            totalPages={Math.ceil(activityLog.length / PAGE_SIZE)}
            onPrev={() => setActivityPage((p) => Math.max(1, p - 1))}
            onNext={() => setActivityPage((p) => Math.min(Math.ceil(activityLog.length / PAGE_SIZE), p + 1))}
          />
          </>
        ) : (
          <EmptyState
            title="No activity this month"
            description="Nothing logged for this period."
          />
        )}
      </Card>
    </div>
  );
}

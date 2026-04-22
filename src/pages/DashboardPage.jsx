import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { exportElementToPdf } from '../utils/pdf';
import { formatCurrency } from '../utils/formatters';
import { Card, Stat, Button, EmptyState } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { rise } from '../utils/motion';

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date);
}

function RecentActivity({ items, currency, locale }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No recent activity"
        description="Your ledger is quiet. Log an expense or income on the next page to see it here."
      />
    );
  }
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`} className="flex items-baseline justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{item.label}</p>
            <p className="eyebrow mt-1">
              {item.type} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(item.date))}
            </p>
          </div>
          <span
            className={
              'numeric text-sm tabular ' +
              (item.direction === 'in' ? 'text-positive' : 'text-ink')
            }
          >
            {item.direction === 'in' ? '+' : '−'}
            {formatCurrency(Math.abs(item.amountCents), currency, locale).replace(/^[−-]/, '')}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const reportRef = useRef(null);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const expenses = useFinanceStore((state) => state.expenses);
  const incomes = useFinanceStore((state) => state.incomes);

  const currency = settings.baseCurrency;
  const locale = settings.locale || 'de-AT';

  const netWorthDelta = useMemo(() => {
    const s = dashboard.netWorthSeries || [];
    if (s.length < 2) return null;
    const prev = s[s.length - 2]?.netWorthCents ?? 0;
    const curr = s[s.length - 1]?.netWorthCents ?? 0;
    if (!prev) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }, [dashboard.netWorthSeries]);

  const recentActivity = useMemo(() => {
    const expenseRows = expenses.map((e) => ({
      id: e.id,
      type: 'expense',
      label: e.description || e.category || 'Expense',
      amountCents: e.amountCents,
      date: e.date,
      direction: 'out',
    }));
    const incomeRows = incomes.map((i) => ({
      id: i.id,
      type: 'income',
      label: i.source || 'Income',
      amountCents: i.amountCents,
      date: i.date,
      direction: 'in',
    }));
    return [...expenseRows, ...incomeRows]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [expenses, incomes]);

  const upcoming = dashboard.upcomingEvents || [];

  return (
    <div ref={reportRef} className="grid grid-cols-1 gap-12">
      <PageHeader
        number="01"
        eyebrow={formatLongDate()}
        title={`${greeting()}.`}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportElementToPdf(reportRef.current)}
            >
              Export PDF
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to="/expenses">Log expense</Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <section
        aria-label="Key figures"
        className="grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          {
            label: 'Net worth',
            value: dashboard.netWorthCents,
            mode: 'currency',
            delta: netWorthDelta,
            deltaMode: 'percent',
          },
          {
            label: 'Monthly cashflow',
            value: dashboard.cashflowCents,
            mode: 'currency',
            hint: dashboard.cashflowCents >= 0 ? 'saving' : 'overspend',
          },
          {
            label: 'Savings rate',
            value: dashboard.savingsRate,
            mode: 'percent',
          },
          {
            label: 'Portfolio value',
            value: portfolio.currentValueCents,
            mode: 'currency',
            hint: `TWRR ${(portfolio.twrr ?? 0).toFixed(2)}%`,
          },
        ].map((k, i) => (
          <div key={k.label} className={`min-w-0 bg-surface p-6 ${rise(i + 1)}`}>
            <Stat
              label={k.label}
              value={k.value}
              mode={k.mode}
              currency={currency}
              locale={locale}
              hint={k.hint}
              delta={k.delta}
              deltaMode={k.deltaMode}
            />
          </div>
        ))}
      </section>

      {/* Primary chart */}
      <Card
        eyebrow="Twelve-month arc"
        title="Net worth"
        description="How your total position has moved through the last year."
        variant="chart"
        className={rise(2)}
      >
        {dashboard.netWorthSeries?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboard.netWorthSeries} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => formatCurrency(v, currency, locale)}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
              <Area
                type="monotone"
                dataKey="netWorthCents"
                stroke="var(--accent)"
                strokeWidth={1.75}
                fill="url(#nwArea)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--canvas)', fill: 'var(--accent)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No data yet" description="Log income or expenses to see this chart come to life." />
        )}
      </Card>

      {/* Cashflow bars + recent activity */}
      <section className="grid gap-6 lg:grid-cols-12">
        <Card
          eyebrow="Monthly rhythm"
          title="Income vs. expenses"
          className={'lg:col-span-7 ' + rise(3)}
          variant="chart"
        >
          {dashboard.cashflowSeries?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.cashflowSeries}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                barCategoryGap="22%"
              >
                <CartesianGrid strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v, currency, locale)}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip formatter={(v) => formatCurrency(v, currency, locale)} />
                <Bar dataKey="incomeCents" fill="var(--accent)" radius={[3, 3, 0, 0]} name="Income" />
                <Bar dataKey="expenseCents" fill="var(--danger)" radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No data yet" description="Income and expense bars populate once you log them." />
          )}
        </Card>

        <Card
          eyebrow="Ledger"
          title="Recent activity"
          action={
            <Button variant="link" size="sm" asChild>
              <Link to="/expenses">All expenses →</Link>
            </Button>
          }
          className={'lg:col-span-5 ' + rise(4)}
        >
          <RecentActivity items={recentActivity} currency={currency} locale={locale} />
        </Card>
      </section>

      {/* Upcoming */}
      <Card
        eyebrow="Coming up"
        title="Next seven to fourteen days"
        description="Fixed expenses and dividends scheduled soon."
        className={rise(5)}
      >
        {upcoming.length ? (
          <ul className="divide-y divide-rule">
            {upcoming.map((e) => (
              <li key={`${e.type}-${e.id}`} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{e.label}</p>
                  <p className="eyebrow mt-1">
                    {e.type.replace('-', ' ')} ·{' '}
                    {new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }).format(
                      e.dueDate instanceof Date ? e.dueDate : new Date(e.dueDate),
                    )}
                  </p>
                </div>
                <span
                  className={
                    'numeric text-sm tabular ' +
                    (e.type === 'dividend' ? 'text-positive' : 'text-ink')
                  }
                >
                  {e.type === 'dividend' ? '+' : '−'}
                  {formatCurrency(Math.abs(e.amountCents), currency, locale).replace(/^[−-]/, '')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nothing on the horizon"
            description="No fixed expenses or dividends in the next fortnight."
          />
        )}
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { Card, Stat, Button, EmptyState } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { rise } from '../utils/motion';
import ShinyText from '../components/ShinyText';

// Gorka-only: cursor spotlight overlay for KPI cells
function GorkaSpotlight({ children, className = '' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onMouseMove={e => {
        const r = ref.current.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity,
          background: `radial-gradient(circle at ${pos.x}px ${pos.y}px, rgba(192,132,252,0.18), transparent 65%)`,
          zIndex: 1,
        }}
      />
      {children}
    </div>
  );
}

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

function EyeIcon({ hidden }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <path
        d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {hidden ? (
        <path d="M4 16 16 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function ExpenseArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="#b5372a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4v12M4 10l6 6 6-6" />
    </svg>
  );
}

function IncomeArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 16V4M4 10l6-6 6 6" />
    </svg>
  );
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
      {items.map((item) => {
        const isPortfolioSaleLoss = item.incomeKind === 'portfolio_sale' && (item.realizedPnlCents || 0) < 0;
        const visualAmountCents = isPortfolioSaleLoss ? item.realizedPnlCents : item.amountCents;
        const amountClass = isPortfolioSaleLoss
          ? 'text-danger'
          : item.direction === 'in'
            ? 'text-positive'
            : 'text-danger';
        return (
        <li key={`${item.type}-${item.id}`} className="flex items-baseline justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{item.label}</p>
            <p className="eyebrow mt-1">
              {item.type} · {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(item.date))}
            </p>
          </div>
          <span
            className={
              'numeric text-sm tabular rounded px-1.5 py-0.5 ' +
              (amountClass === 'text-danger'
                ? 'text-danger bg-danger-soft'
                : amountClass === 'text-positive'
                  ? 'text-positive bg-positive-soft'
                  : amountClass)
            }
          >
            {isPortfolioSaleLoss ? '−' : item.direction === 'in' ? '+' : '−'}
            {formatCurrency(Math.abs(visualAmountCents), currency, locale).replace(/^[−-]/, '')}
          </span>
        </li>
        );
      })}
    </ul>
  );
}

export default function DashboardPage() {
  const reportRef = useRef(null);
  const [hideKpis, setHideKpis] = useState(() => localStorage.getItem('pft-dashboard-hide-kpis') === 'true');
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const expenses = useFinanceStore((state) => state.expenses);
  const incomes = useFinanceStore((state) => state.incomes);

  const supabaseUser = useFinanceStore((state) => state.supabaseUser);
  const isGorka = supabaseUser?.email === 'gorkaaamendiola@gmail.com';

  const currency = settings.baseCurrency;
  const locale = settings.locale || 'en-GB';
  const portfolioEnabled = settings.modules?.portfolio !== false;

  const netWorthDelta = useMemo(() => {
    const s = dashboard.netWorthSeries || [];
    if (s.length < 2) return null;
    const prev = s[s.length - 2]?.netWorthCents ?? 0;
    const curr = s[s.length - 1]?.netWorthCents ?? 0;
    if (!prev) return null;
    const delta = ((curr - prev) / Math.abs(prev)) * 100;
    // Hide delta when it's an unreliable projection artefact (e.g. base near zero)
    if (Math.abs(delta) > 500) return null;
    return delta;
  }, [dashboard.netWorthSeries]);

  const recentActivity = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
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
      incomeKind: i.incomeKind,
      realizedPnlCents: i.realizedPnlCents,
    }));
    return [...expenseRows, ...incomeRows]
      .filter((item) => item.date <= today)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [expenses, incomes]);

  const upcoming = dashboard.upcomingEvents || [];

  const totalIncomeCents = dashboard.totalIncomeCents || 0;
  const distributedToSavingsCents = dashboard.distributedToSavingsCents || 0;
  const distributedToPortfolioCents = dashboard.distributedToPortfolioCents || 0;
  const distributedTotalCents = distributedToSavingsCents + distributedToPortfolioCents;
  const hasDistribution = distributedTotalCents > 0;
  const kpis = [
    {
      label: 'Net worth',
      value: dashboard.netWorthCents,
      mode: 'currency',
      delta: netWorthDelta,
      deltaMode: 'percent',
      info: 'Savings plus portfolio value. This is your broad financial position, not just cash available to spend.',
    },
    {
      label: 'Monthly cashflow',
      value: dashboard.cashflowCents,
      mode: 'currency',
      hint: dashboard.cashflowCents >= 0 ? 'available to spend' : 'overspend',
      info: 'Income assigned to the current month minus expenses, savings, and investments for this month.',
    },
    {
      label: 'Total balance',
      value: dashboard.availableBalanceCents,
      mode: 'currency',
      hint: 'cash carried over',
      info: 'Cash available now. It counts income from the day you receive it and carries leftover cash across months.',
    },
    {
      label: 'Total savings',
      value: dashboard.savingsBalanceCents,
      mode: 'currency',
      hint: 'saved balance',
      info: 'Current savings balance plus all logged savings entries.',
    },
    ...(portfolioEnabled
      ? [{
          label: 'Portfolio value',
          value: portfolio.currentValueCents,
          mode: 'currency',
          hint: `TWRR ${(portfolio.twrr ?? 0).toFixed(2)}%`,
          info: 'Current market value of your active portfolio holdings.',
        }]
      : []),
  ];

  useEffect(() => {
    localStorage.setItem('pft-dashboard-hide-kpis', String(hideKpis));
  }, [hideKpis]);

  return (
    <div ref={reportRef} className="grid grid-cols-1 gap-8">
      <PageHeader
        number="01"
        eyebrow={formatLongDate()}
        title={`${greeting()}.`}
        className="mb-0 pb-6"
      />

      {/* KPIs */}
      <div>
        <div className="relative mb-3 flex items-center justify-center">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors"
            aria-label={hideKpis ? 'Show KPI values' : 'Hide KPI values'}
            title={hideKpis ? 'Show KPI values' : 'Hide KPI values'}
            onClick={() => setHideKpis((value) => !value)}
          >
            <EyeIcon hidden={hideKpis} />
            {hideKpis ? 'Show' : 'Hide'}
          </button>
          <div className="absolute right-0 flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('finance:open-entry-modal', { detail: 'expense' }))}
              aria-label="Log expense"
              title="Log expense"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-danger/40 bg-surface text-base font-medium text-danger transition-colors hover:border-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <ExpenseArrowIcon />
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('finance:open-entry-modal', { detail: 'income' }))}
              aria-label="Log income"
              title="Log income"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-positive/40 bg-surface text-base font-medium text-positive transition-colors hover:border-positive hover:bg-positive-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <IncomeArrowIcon />
            </button>
          </div>
        </div>
        <section
          aria-label="Key figures"
          data-tour="dashboard-kpis"
          className={
            'grid gap-px border border-rule rounded-lg overflow-hidden bg-rule sm:grid-cols-2 ' +
            (portfolioEnabled ? 'lg:grid-cols-5' : 'lg:grid-cols-4')
          }
        >
          {kpis.map((k, i) => (
            isGorka ? (
              <GorkaSpotlight key={k.label} className={`min-w-0 bg-surface p-6 ${rise(i + 1)}`}>
                <Stat
                  label={k.label}
                  value={hideKpis ? '****' : k.value}
                  mode={hideKpis ? 'custom' : k.mode}
                  currency={currency}
                  locale={locale}
                  hint={hideKpis && k.hint ? '****' : k.hint}
                  delta={hideKpis ? undefined : k.delta}
                  deltaMode={k.deltaMode}
                  animate={!hideKpis}
                  info={k.info}
                />
              </GorkaSpotlight>
            ) : (
              <div key={k.label} className={`min-w-0 bg-surface p-6 ${rise(i + 1)}`}>
                <Stat
                  label={k.label}
                  value={hideKpis ? '****' : k.value}
                  mode={hideKpis ? 'custom' : k.mode}
                  currency={currency}
                  locale={locale}
                  hint={hideKpis && k.hint ? '****' : k.hint}
                  delta={hideKpis ? undefined : k.delta}
                  deltaMode={k.deltaMode}
                  animate={!hideKpis}
                  info={k.info}
                />
              </div>
            )
          ))}
        </section>
      </div>

      {/* Primary chart */}
      <Card
        data-tour="dashboard-networth"
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
                tickFormatter={(v) => (hideKpis ? '****' : formatCurrencyCompact(v, currency, locale))}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip formatter={(v) => (hideKpis ? '****' : formatCurrency(v, currency, locale))} />
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
          data-tour="dashboard-cashflow"
          eyebrow="Monthly rhythm"
          title="Income vs. expenses"
          variant="chart"
          className={'lg:col-span-7 h-full ' + rise(3)}
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
                  tickFormatter={(v) => (hideKpis ? '****' : formatCurrencyCompact(v, currency, locale))}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip formatter={(v) => (hideKpis ? '****' : formatCurrency(v, currency, locale))} />
                <Bar dataKey="incomeCents" fill="var(--accent)" radius={[3, 3, 0, 0]} name="Income" />
                <Bar dataKey="expenseCents" fill="var(--danger)" radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No data yet" description="Income and expense bars populate once you log them." />
          )}
        </Card>

        <Card
          data-tour="dashboard-activity"
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

      {/* Income distribution — only when transfers exist this month */}
      {hasDistribution && (
        <Card
          eyebrow="This month"
          title="Cashflow distribution"
          description="How your monthly cashflow was split between savings, portfolio, and discretionary spending."
          className={rise(5)}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Total income', valueCents: totalIncomeCents, color: 'text-ink' },
              { label: '→ Savings', valueCents: distributedToSavingsCents, color: 'text-accent' },
              { label: '→ Portfolio', valueCents: distributedToPortfolioCents, color: 'text-positive' },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-rule bg-surface-sunken px-4 py-3">
                <p className="eyebrow mb-1">{item.label}</p>
                <p className={`numeric text-lg font-medium ${item.color}`}>
                  {formatCurrency(item.valueCents, currency, locale)}
                </p>
              </div>
            ))}
          </div>
          {totalIncomeCents > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Distributed</span>
                <span className="numeric">{totalIncomeCents > 0 ? ((distributedTotalCents / totalIncomeCents) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${Math.min(100, (distributedTotalCents / totalIncomeCents) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Discretionary remaining:{' '}
                <span className="numeric font-medium text-ink">
                  {formatCurrency(Math.max(0, totalIncomeCents - distributedTotalCents), currency, locale)}
                </span>
              </p>
            </div>
          )}
        </Card>
      )}

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
                    'numeric text-sm tabular rounded px-1.5 py-0.5 ' +
                    (e.type === 'dividend' ? 'text-positive bg-positive-soft' : 'text-danger bg-danger-soft')
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

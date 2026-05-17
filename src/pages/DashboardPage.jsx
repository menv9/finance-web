import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LWAreaChart from '../components/charts/LWAreaChart';
import LWGroupedHistogram from '../components/charts/LWGroupedHistogram';
import { useFinanceStore } from '../store/useFinanceStore';
import { buildRecentActivity } from '../utils/finance';
import RecentActivity from '../components/RecentActivity';
import { exportElementToPdf } from '../utils/pdf';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { Card, Stat, Button, EmptyState } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { rise } from '../utils/motion';
import ShinyText from '../components/ShinyText';
import { useTranslation } from '../i18n/useTranslation';

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

const NET_WORTH_PERIODS = [
  { key: '3m', label: '3M', months: 3 },
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
];

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const reportRef = useRef(null);
  const hideKpis = useFinanceStore((state) => state.hideAmounts);
  const toggleHideAmounts = useFinanceStore((state) => state.toggleHideAmounts);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const expenses = useFinanceStore((state) => state.expenses);
  const incomes = useFinanceStore((state) => state.incomes);
  const dividends = useFinanceStore((state) => state.dividends);

  const supabaseUser = useFinanceStore((state) => state.supabaseUser);
  const isGorka = supabaseUser?.email === 'gorkaaamendiola@gmail.com';
  const [netWorthPeriod, setNetWorthPeriod] = useState('1y');

  const currency = settings.baseCurrency;
  const portfolioEnabled = settings.modules?.portfolio !== false;

  function greeting(date = new Date()) {
    const h = date.getHours();
    if (h < 5) return t('dashboard.greetingStillUp');
    if (h < 12) return t('dashboard.greetingMorning');
    if (h < 18) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  }

  function formatLongDate(date = new Date()) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date);
  }

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

  const lwNetWorthData = useMemo(() =>
    (dashboard.netWorthSeries || []).map((entry) => ({
      time: `${entry.key}-01`,
      value: entry.netWorthCents,
    })),
  [dashboard.netWorthSeries]);

  const visibleNetWorthData = useMemo(() => {
    const period = NET_WORTH_PERIODS.find((item) => item.key === netWorthPeriod) || NET_WORTH_PERIODS.at(-1);
    return lwNetWorthData.slice(-Math.min(period.months + 1, lwNetWorthData.length));
  }, [lwNetWorthData, netWorthPeriod]);

  const visibleNetWorthRange = useMemo(() => {
    const period = NET_WORTH_PERIODS.find((item) => item.key === netWorthPeriod) || NET_WORTH_PERIODS.at(-1);
    const lastPoint = lwNetWorthData.at(-1);
    if (!lastPoint?.time) return null;
    const to = new Date(`${lastPoint.time}T00:00:00`);
    const from = new Date(to);
    from.setUTCMonth(from.getUTCMonth() - period.months);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, [lwNetWorthData, netWorthPeriod]);

  const lwCashflowData = useMemo(() =>
    (dashboard.cashflowSeries || []).map((entry) => ({
      incomeTime: `${entry.key}-01`,
      expenseTime: `${entry.key}-01`,
      incomeCents: entry.incomeCents,
      expenseCents: entry.expenseCents,
    })),
  [dashboard.cashflowSeries]);

  const recentActivity = useMemo(
    () => buildRecentActivity({ expenses, incomes, dividends, limit: 8 }),
    [dividends, expenses, incomes],
  );

  const upcoming = dashboard.upcomingEvents || [];

  const totalIncomeCents = dashboard.totalIncomeCents || 0;
  const distributedToSavingsCents = dashboard.distributedToSavingsCents || 0;
  const distributedToPortfolioCents = dashboard.distributedToPortfolioCents || 0;
  const distributedTotalCents = distributedToSavingsCents + distributedToPortfolioCents;
  const hasDistribution = distributedTotalCents > 0;
  const totalDebtCents = dashboard.totalDebtCents || 0;
  const kpis = [
    {
      label: t('dashboard.kpiNetWorth.label'),
      value: dashboard.netWorthCents,
      mode: 'currency',
      delta: netWorthDelta,
      deltaMode: 'percent',
      info: t('dashboard.kpiNetWorth.info'),
    },
    {
      label: t('dashboard.kpiTotalBalance.label'),
      value: dashboard.availableBalanceCents,
      mode: 'currency',
      hint: t('dashboard.kpiTotalBalance.hint'),
      info: t('dashboard.kpiTotalBalance.info'),
    },
    {
      label: t('dashboard.kpiTotalSavings.label'),
      value: dashboard.savingsBalanceCents,
      mode: 'currency',
      hint: t('dashboard.kpiTotalSavings.hint'),
      info: t('dashboard.kpiTotalSavings.info'),
    },
    ...(portfolioEnabled
      ? [{
          label: t('dashboard.kpiPortfolioValue.label'),
          value: portfolio.currentValueCents,
          mode: 'currency',
          hint: `TWRR ${(portfolio.twrr ?? 0).toFixed(2)}%`,
          info: t('dashboard.kpiPortfolioValue.info'),
        }]
      : []),
    ...(totalDebtCents > 0
      ? [{
          label: t('dashboard.kpiTotalDebt.label'),
          value: totalDebtCents,
          mode: 'currency',
          hint: t('dashboard.kpiTotalDebt.hint'),
          info: t('dashboard.kpiTotalDebt.info'),
        }]
      : []),
  ];


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
            onClick={toggleHideAmounts}
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
          className={`grid gap-px border border-rule rounded-lg overflow-hidden bg-rule ${
            kpis.length <= 2
              ? ['', 'grid-cols-1', 'grid-cols-2'][kpis.length]
              : kpis.length === 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : kpis.length === 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          }`}
        >
          {kpis.map((k, i) => {
            const spanLastOnMobile = kpis.length === 3 && i === 2 ? 'col-span-2 sm:col-span-1' : '';
            const cellClass = `min-w-0 bg-surface px-3 py-3 sm:px-4 sm:py-4 ${spanLastOnMobile} ${rise(i + 1)}`;
            return isGorka ? (
              <GorkaSpotlight key={k.label} className={cellClass}>
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
              <div key={k.label} className={cellClass}>
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
            );
          })}
        </section>
      </div>

      {/* Primary chart */}
      <Card
        data-tour="dashboard-networth"
        eyebrow="Twelve-month arc"
        title="Net worth"
        description="How your total position has moved through the last year."
        action={
          <div className="inline-flex h-8 rounded-md border border-rule bg-surface-raised p-0.5" aria-label="Net worth period">
            {NET_WORTH_PERIODS.map((period) => (
              <button
                key={period.key}
                type="button"
                onClick={() => setNetWorthPeriod(period.key)}
                className={
                  'min-w-9 rounded px-2 text-xs font-medium transition-colors duration-150 ' +
                  (netWorthPeriod === period.key
                    ? 'bg-accent text-accent-contrast shadow-sm'
                    : 'text-ink-muted hover:text-ink')
                }
              >
                {period.label}
              </button>
            ))}
          </div>
        }
        variant="chart"
        className={rise(2)}
      >
        {lwNetWorthData.length ? (
          <LWAreaChart
            data={visibleNetWorthData}
            color="var(--accent)"
            topOpacity={0.32}
            priceFormatter={hideKpis ? () => '••••' : (v) => formatCurrencyCompact(v, currency, locale)}
            visibleRange={visibleNetWorthRange}
          />
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
          {lwCashflowData.length ? (
            <LWGroupedHistogram
              seriesA={{ data: lwCashflowData.map((d) => ({ time: d.incomeTime, value: d.incomeCents })), color: 'var(--accent)' }}
              seriesB={{ data: lwCashflowData.map((d) => ({ time: d.expenseTime, value: d.expenseCents })), color: 'var(--danger)' }}
              priceFormatter={hideKpis ? () => '••••' : (v) => formatCurrencyCompact(v, currency, locale)}
              showAllMonthLabels
            />
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
          <RecentActivity items={recentActivity} currency={currency} locale={locale} hideAmounts={hideKpis} />
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
                  {hideKpis ? '••••' : formatCurrency(item.valueCents, currency, locale)}
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
                  {hideKpis ? '••••' : formatCurrency(Math.max(0, totalIncomeCents - distributedTotalCents), currency, locale)}
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
                  {hideKpis ? '••••' : (
                    <>
                      {e.type === 'dividend' ? '+' : '−'}
                      {formatCurrency(Math.abs(e.amountCents), currency, locale).replace(/^[−-]/, '')}
                    </>
                  )}
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

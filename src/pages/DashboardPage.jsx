import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { exportElementToPdf } from '../utils/pdf';
import { formatCurrency } from '../utils/formatters';

export default function DashboardPage() {
  const reportRef = useRef(null);
  const dashboard = useFinanceStore((state) => state.derived.dashboard);
  const portfolio = useFinanceStore((state) => state.derived.portfolio);
  const settings = useFinanceStore((state) => state.settings);
  const expenses = useFinanceStore((state) => state.expenses);
  const incomes = useFinanceStore((state) => state.incomes);
  const holdings = useFinanceStore((state) => state.holdings);

  const currency = settings.baseCurrency;
  const locale = settings.locale;

  const featureTiles = useMemo(
    () => [
      {
        label: 'Spending',
        title: 'Every outgoing in one calm surface.',
        text: 'Recurring bills, bank CSV imports and variable transactions live together without feeling like accounting software.',
        to: '/expenses',
        tone: 'mint',
        metric: `${expenses.length} tracked expenses`,
      },
      {
        label: 'Portfolio',
        title: 'Allocation, yield and performance at a glance.',
        text: 'Current value, TWRR, XIRR and dividend flow stay visible without hiding the raw holdings data.',
        to: '/portfolio',
        tone: 'rose',
        metric: `${holdings.length} holdings in view`,
      },
    ],
    [expenses.length, holdings.length],
  );

  const stackPills = useMemo(
    () => [
      `Net worth ${formatCurrency(dashboard.netWorthCents, currency, locale)}`,
      `Cashflow ${formatCurrency(dashboard.cashflowCents, currency, locale)}`,
      `Savings rate ${dashboard.savingsRate.toFixed(1)}%`,
      `Portfolio ${formatCurrency(portfolio.currentValueCents, currency, locale)}`,
      `Dividend yield ${portfolio.dividendYield.toFixed(2)}%`,
      `Income records ${incomes.length}`,
      `Upcoming events ${dashboard.upcomingEvents.length}`,
    ],
    [currency, dashboard, incomes.length, locale, portfolio],
  );

  const trustTiles = useMemo(
    () => [
      { title: 'Monthly cashflow', value: formatCurrency(dashboard.cashflowCents, currency, locale), wide: false },
      { title: 'Expenses tracked', value: `${expenses.length}`, wide: true },
      { title: 'Portfolio P&L', value: formatCurrency(portfolio.pnlCents, currency, locale), wide: false },
      { title: 'Savings rate', value: `${dashboard.savingsRate.toFixed(1)}%`, wide: false },
      { title: 'Upcoming events', value: `${dashboard.upcomingEvents.length}`, wide: true },
      { title: 'Holdings', value: `${holdings.length}`, wide: false },
    ],
    [currency, dashboard, expenses.length, holdings.length, locale, portfolio.pnlCents],
  );

  return (
    <div ref={reportRef} className="dashboard-story">
      <section className="hero-stage">
        <div className="hero-copy">
          <p className="hero-kicker">Financial clarity for every month.</p>
          <h1>Money tracking for your whole picture.</h1>
          <p>
            A polished finance workspace for expenses, income, investments and sync across devices, built to feel more like a product than a spreadsheet.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" to="/expenses">Open expenses</Link>
            <button className="button-secondary" onClick={() => exportElementToPdf(reportRef.current)}>
              Export monthly PDF
            </button>
          </div>
        </div>

        <div className="phone-stage">
          <div className="phone-shell">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-top">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">This month</p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(dashboard.netWorthCents, currency, locale)}</p>
                </div>
                <span className="badge">Local-first</span>
              </div>
              <div className="phone-mini-grid">
                <div className="mini-metric">
                  <span>Income</span>
                  <strong>{formatCurrency(dashboard.incomeSeries.at(-1)?.amountCents || 0, currency, locale)}</strong>
                </div>
                <div className="mini-metric">
                  <span>Expenses</span>
                  <strong>{formatCurrency(dashboard.expenseSeries.at(-1)?.amountCents || 0, currency, locale)}</strong>
                </div>
              </div>
              <div className="phone-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.netWorthSeries}>
                    <defs>
                      <linearGradient id="storyArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.78} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <YAxis hide />
                    <XAxis dataKey="month" hide />
                    <Tooltip formatter={(value) => formatCurrency(value, currency, locale)} />
                    <Area dataKey="netWorthCents" stroke="var(--accent)" strokeWidth={3} fill="url(#storyArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="phone-bottom">
                {stackPills.slice(0, 4).map((item) => (
                  <span key={item} className="phone-pill">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hero-sidecard">
          <div className="hero-sidecard-media">
            <div className="hero-sidecard-orb" />
            <p>Sync-ready</p>
          </div>
          <p className="hero-sidecard-label">Supabase, conflict resolution and JSON backup already built in.</p>
        </div>
      </section>

      <section className="story-section">
        <div className="story-heading">
          <h2>Finance tracker with the full picture of your money.</h2>
          <Link to="/settings">view all controls</Link>
        </div>
        <div className="feature-grid">
          {featureTiles.map((tile) => (
            <article key={tile.title} className="feature-showcase" data-tone={tile.tone}>
              <div className="feature-showcase-copy">
                <p>{tile.label}</p>
                <h3>{tile.title}</h3>
                <span>{tile.metric}</span>
              </div>
              <div className="feature-showcase-visual">
                <div className="feature-island" />
                <p>{tile.text}</p>
                <Link className="quadrant-link" to={tile.to}>Open module</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="story-section">
        <div className="story-heading">
          <h2>Your super app for personal finance.</h2>
        </div>
        <div className="split-feature">
          <div className="split-visual">
            <div className="tilted-device">
              <div className="tilted-device-screen">
                <div className="mini-metric">
                  <span>Portfolio value</span>
                  <strong>{formatCurrency(portfolio.currentValueCents, currency, locale)}</strong>
                </div>
                <div className="mini-bars">
                  {dashboard.cashflowSeries.slice(-6).map((item) => (
                    <span key={item.month} style={{ height: `${Math.max(18, Math.min(100, Math.abs(item.incomeCents - item.expenseCents) / 1500))}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="split-copy">
            {stackPills.map((item) => (
              <div key={item} className="stack-pill">
                <span>{item}</span>
                <span>+</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="story-section">
        <div className="social-proof">
          <h2>Built around the numbers that matter most every week.</h2>
          <div className="proof-grid">
            {trustTiles.map((tile) => (
              <article key={tile.title} className={`proof-tile ${tile.wide ? 'proof-tile-wide' : ''}`}>
                <p>{tile.title}</p>
                <h3>{tile.value}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="dark-cta">
        <div className="dark-cta-inner">
          <p className="dark-cta-kicker">Everything in one place</p>
          <h2>Your finance operating system is waiting.</h2>
          <div className="dark-cta-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.cashflowSeries}>
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip formatter={(value) => formatCurrency(value, currency, locale)} />
                <Bar dataKey="incomeCents" fill="#54d2b1" radius={[10, 10, 0, 0]} />
                <Bar dataKey="expenseCents" fill="#fb923c" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="hero-actions">
            <Link className="button-primary" to="/portfolio">Open portfolio</Link>
            <Link className="button-secondary" to="/settings">Open settings</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

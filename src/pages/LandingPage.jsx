import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import LiquidChrome from '../components/LiquidChrome';
import SakuraPetals from '../components/SakuraPetals';

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    num: '01',
    title: 'Dashboard',
    body: 'Net worth arc, cashflow bars, and upcoming fixed expenses — your full financial picture at a glance.',
    stat: '↑ 12.4%',
    statLabel: 'net growth',
  },
  {
    num: '02',
    title: 'Expenses',
    body: 'Log, categorise, and filter every outgoing. Budget envelopes with rollover support built in.',
    stat: '−€ 1,840',
    statLabel: 'tracked monthly',
  },
  {
    num: '03',
    title: 'Income',
    body: 'Track salary, freelance, dividends, and portfolio sales. Everything that flows in, accounted for.',
    stat: '+€ 3,200',
    statLabel: 'this quarter',
  },
  {
    num: '04',
    title: 'Portfolio',
    body: 'Holdings with live price refresh, allocation targets vs actuals, and realised P&L tracking.',
    stat: '42.5%',
    statLabel: 'savings rate',
  },
  {
    num: '05',
    title: 'Savings',
    body: 'Goal-based savings pots with deposit history and progress toward each target.',
    stat: '6 pots',
    statLabel: 'active goals',
  },
  {
    num: '06',
    title: 'Transfers',
    body: 'Move money between pots and track cashflow distribution across savings and portfolio.',
    stat: '100%',
    statLabel: 'visibility',
  },
];

const principles = [
  {
    label: 'Private by default',
    body: 'Everything lives in your browser. No accounts required, no data leaves your device unless you opt into sync.',
    glyph: '◈',
  },
  {
    label: 'Optional cloud sync',
    body: 'Connect your own Supabase project for cross-device sync. You own the database — we never touch it.',
    glyph: '◎',
  },
  {
    label: 'Quarterly discipline',
    body: 'Built around the rhythm of a quarterly review — not daily noise. See the arc, not just the tick.',
    glyph: '◐',
  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowRight({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Decorative chart ─────────────────────────────────────────────────────────

function HeroChart() {
  const pts = [
    [0, 90], [22, 78], [44, 84], [66, 58], [88, 64],
    [110, 42], [132, 36], [154, 20], [176, 24], [198, 8],
  ];
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = line + ' L198,100 L0,100 Z';

  return (
    <svg viewBox="0 0 198 100" className="w-full h-full" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
        <filter id="hero-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={area} fill="url(#hero-area)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" filter="url(#hero-glow)" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y}
          r={i === pts.length - 1 ? 3 : 1.5}
          fill="var(--accent)"
          opacity={i === pts.length - 1 ? 1 : 0.35} />
      ))}
    </svg>
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function Wordmark({ size = 'lg' }) {
  const isLg = size === 'lg';
  return (
    <svg
      viewBox="50 55 540 175"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={isLg ? 'h-[4.5rem] w-auto md:h-24' : 'h-7 w-auto'}
    >
      <title>FinGes</title>
      <defs>
        <linearGradient id={`wm-grad-${size}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="60%" stopColor="var(--accent-strong)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <text x="60" y="188" fontFamily="'Fraunces', Georgia, serif" fontSize="130" fontWeight="400"
        fill="var(--ink)" opacity="0.92" letterSpacing="-3">Fin</text>
      <text x="253" y="188" fontFamily="'Fraunces', Georgia, serif" fontSize="130" fontWeight="600"
        fill={`url(#wm-grad-${size})`} letterSpacing="-3">Ges</text>
      {isLg && (
        <text x="61" y="222" fontFamily="'Instrument Sans', system-ui, sans-serif" fontSize="15"
          fontWeight="500" letterSpacing="6" fill="var(--ink-faint)">QUARTERLY LEDGER</text>
      )}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const theme     = useFinanceStore((s) => s.settings?.theme);
  const supabaseConfigured = useFinanceStore((s) => s.supabaseConfigured);
  const supabaseUser       = useFinanceStore((s) => s.supabaseUser);

  const appliedTheme = ['dark', 'light', 'eris', 'gorka'].includes(theme) ? theme : 'dark';
  const gorkaBaseColor = useMemo(() => [0.427, 0, 1.0], []);

  // Mirror what AppShell does — keep data-theme in sync while landing is mounted.
  // When the user navigates away, AppShell will take over and re-apply on mount.
  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.body.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  const ctaTo    = supabaseUser ? '/dashboard' : supabaseConfigured ? '/login' : '/dashboard';
  const ctaLabel = supabaseUser ? 'Go to dashboard' : 'Open the ledger';

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Theme-specific backgrounds ───────────────────────── */}

      {/* Eris: sakura petals layer (fixed, pointer-events-none, z-0 via its CSS) */}
      {appliedTheme === 'eris' && <SakuraPetals />}

      {/* Gorka: full-page WebGL chrome, same setup as AppShell */}
      {appliedTheme === 'gorka' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#060412' }}>
          <LiquidChrome baseColor={gorkaBaseColor} speed={0.12} amplitude={0.3} interactive={false} />
        </div>
      )}

      {/* ── Top accent rule ──────────────────────────────────── */}
      <div
        className="h-px w-full flex-shrink-0"
        style={{
          background: 'linear-gradient(to right, transparent 0%, var(--accent) 40%, var(--accent-strong) 60%, var(--accent) 80%, transparent 100%)',
          opacity: 0.5,
        }}
      />

      {/* ── Nav ─────────────────────────────────────────────── */}
      {/* `sticky` class is targeted by [data-theme='eris'] and [data-theme='gorka']
           in styles.css for their frosted-glass / chrome header overrides */}
      <header className="sticky top-0 z-40 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-6">
          <Wordmark size="sm" />
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-2 rounded-full border border-rule-strong px-4 py-1.5 text-sm text-ink transition-colors duration-180 hover:border-accent hover:text-accent"
          >
            {ctaLabel} <ArrowRight />
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-5xl px-6 pt-20 pb-24 md:pt-32 md:pb-32 overflow-hidden">
          {/* Subtle grid texture — hidden on gorka since LiquidChrome provides depth */}
          {appliedTheme !== 'gorka' && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(var(--rule) 1px, transparent 1px),
                  linear-gradient(90deg, var(--rule) 1px, transparent 1px)
                `,
                backgroundSize: '64px 64px',
                opacity: 0.5,
                maskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 30%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 30%, transparent 100%)',
              }}
            />
          )}

          <div className="relative grid gap-12 lg:grid-cols-[1fr_420px] lg:items-center">

            {/* Left — copy with staggered rise animations */}
            <div className="space-y-8">
              <div className="space-y-5">
                <p className="rise rise-1 inline-flex items-center gap-2 rounded-full border border-rule-strong px-3 py-1 eyebrow text-ink-faint">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  Private finance tracker
                </p>
                <div className="rise rise-2">
                  <Wordmark size="lg" />
                </div>
              </div>

              <p className="rise rise-3 text-lg text-ink-muted leading-relaxed max-w-[38ch]">
                A personal ledger for people who want full clarity over their finances —
                without handing their data to anyone else.
              </p>

              <div className="rise rise-4 flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to={ctaTo}
                  className="inline-flex items-center gap-2.5 rounded-md px-5 py-2.5 text-sm font-medium transition-all duration-180 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                >
                  {ctaLabel} <ArrowRight />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-md border border-rule-strong px-5 py-2.5 text-sm text-ink-muted transition-colors duration-180 hover:text-ink hover:border-accent"
                >
                  See what's inside
                </a>
              </div>

              {/* Micro-stats */}
              <div className="rise rise-5 flex flex-wrap gap-x-8 gap-y-3 pt-2 border-t border-rule">
                {[
                  { label: 'Savings rate', val: '42.5%' },
                  { label: 'Monthly income', val: '+€ 3,200' },
                  { label: 'Net growth', val: '↑ 12.4%' },
                ].map(s => (
                  <div key={s.label} className="space-y-0.5">
                    <p className="eyebrow text-ink-faint">{s.label}</p>
                    <p className="numeric text-sm font-medium" style={{ color: 'var(--accent)' }}>{s.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — decorative card */}
            <div className="rise rise-3 relative hidden lg:block">
              <div
                aria-hidden
                className="absolute inset-0 -m-8 rounded-3xl"
                style={{
                  background: 'radial-gradient(ellipse at center, var(--accent-soft) 0%, transparent 70%)',
                  filter: 'blur(32px)',
                }}
              />
              <div
                className="relative rounded-2xl border border-rule-strong bg-surface p-6 space-y-5"
                style={{ boxShadow: '0 32px 80px -24px rgba(0,0,0,0.45)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="eyebrow text-ink-faint">Net worth</p>
                    <p className="numeric mt-1 text-2xl font-medium text-ink">€ 48,320</p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-positive"
                    style={{ background: 'var(--positive-soft)' }}
                  >
                    ↑ 12.4%
                  </span>
                </div>

                <div className="h-24 w-full">
                  <HeroChart />
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Income',   val: '+€ 3,200', positive: true  },
                    { label: 'Expenses', val: '−€ 1,840', positive: false },
                    { label: 'Savings',  val: '42.5%',    positive: true  },
                  ].map(p => (
                    <div
                      key={p.label}
                      className="inline-flex items-baseline gap-2 rounded-full border border-rule-strong bg-surface-raised px-3.5 py-1.5"
                    >
                      <span className="eyebrow text-ink-faint">{p.label}</span>
                      <span className={`numeric text-xs font-medium ${p.positive ? 'text-positive' : 'text-danger'}`}>
                        {p.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating portfolio chip */}
              <div
                className="absolute -bottom-4 -right-4 rounded-xl border border-rule-strong bg-surface-raised px-4 py-3"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
              >
                <p className="eyebrow text-ink-faint mb-0.5">Portfolio</p>
                <p className="numeric text-sm font-medium text-positive">+€ 620 this month</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Ticker ───────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-y border-rule bg-surface py-3">
          <style>{`
            @keyframes lp-ticker {
              from { transform: translateX(0); }
              to   { transform: translateX(-50%); }
            }
            .lp-ticker-track {
              display: flex;
              width: max-content;
              animation: lp-ticker 28s linear infinite;
            }
            .lp-ticker-track:hover { animation-play-state: paused; }
            @media (prefers-reduced-motion: reduce) {
              .lp-ticker-track { animation: none; }
            }
          `}</style>
          <div className="lp-ticker-track select-none" aria-hidden>
            {[...Array(2)].map((_, rep) => (
              <span key={rep} className="flex items-center">
                {['Dashboard', 'Expenses', 'Income', 'Portfolio', 'Savings', 'Transfers', 'Private', 'Local-first', 'Quarterly'].map((item) => (
                  <span key={item} className="flex items-center gap-6 px-6">
                    <span className="eyebrow text-ink-faint">{item}</span>
                    <span className="text-xs" style={{ color: 'var(--accent)', opacity: 0.4 }}>◆</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ── Features ─────────────────────────────────────────── */}
        <section id="features" className="mx-auto max-w-5xl px-6 py-24 lg:py-32">
          <div className="flex items-end justify-between mb-14 gap-6 flex-wrap">
            <div>
              <p className="eyebrow text-ink-faint mb-3">Modules</p>
              <h2 className="font-display text-4xl md:text-5xl text-ink leading-[0.9] tracking-tight">
                Six views,<br />
                <span style={{ color: 'var(--accent)' }}>one picture.</span>
              </h2>
            </div>
            <Link
              to={ctaTo}
              className="inline-flex items-center gap-2 text-sm text-ink-faint transition-colors duration-180 hover:text-accent"
            >
              Explore all <ArrowRight />
            </Link>
          </div>

          <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3 rounded-2xl overflow-hidden border border-rule">
            {features.map((f) => (
              <div
                key={f.num}
                className="group relative bg-canvas p-7 flex flex-col gap-4 transition-colors duration-180 hover:bg-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="numeric text-xs text-ink-faint">{f.num}</span>
                  <div className="text-right">
                    <p className="numeric text-sm font-medium leading-none" style={{ color: 'var(--accent)' }}>
                      {f.stat}
                    </p>
                    <p className="eyebrow text-[0.55rem] text-ink-faint mt-0.5">{f.statLabel}</p>
                  </div>
                </div>

                <h3 className="font-display text-xl text-ink transition-colors duration-180 group-hover:text-accent">
                  {f.title}
                </h3>

                <p className="text-sm text-ink-muted leading-relaxed flex-1">{f.body}</p>

                <div className="flex items-center gap-1.5 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  View module <ArrowRight className="h-3 w-3" />
                </div>

                {/* Left accent border on hover */}
                <div
                  className="absolute left-0 top-6 bottom-6 w-0.5 rounded-full scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"
                  style={{ background: 'var(--accent)' }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Principles ───────────────────────────────────────── */}
        <section className="border-t border-b border-rule bg-surface">
          <div className="mx-auto max-w-5xl px-6 py-24 lg:py-28">
            <div className="grid gap-14 md:grid-cols-[280px_1fr]">
              <div>
                <p className="eyebrow text-ink-faint mb-3">Philosophy</p>
                <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight tracking-tight">
                  Built on a few<br />firm beliefs.
                </h2>
                <div className="mt-6 h-px w-12" style={{ background: 'var(--accent)' }} />
              </div>

              <div className="grid gap-8 sm:grid-cols-3">
                {principles.map((p, i) => (
                  <div key={p.label} className="space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xl" style={{ color: 'var(--accent)', opacity: 0.7 }} aria-hidden>
                        {p.glyph}
                      </span>
                      <span className="numeric text-xs text-ink-faint">0{i + 1}</span>
                    </div>
                    <h3 className="font-display text-lg text-ink">{p.label}</h3>
                    <p className="text-sm text-ink-muted leading-relaxed">{p.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-28 lg:py-36">
          <div className="relative rounded-3xl border border-rule-strong bg-surface overflow-hidden p-12 md:p-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 60% 50% at 50% 100%, var(--accent-soft), transparent)',
              }}
            />
            <div aria-hidden className="absolute top-5 left-5  w-8 h-8 border-l border-t rounded-tl-lg border-accent opacity-30" />
            <div aria-hidden className="absolute top-5 right-5 w-8 h-8 border-r border-t rounded-tr-lg border-accent opacity-30" />
            <div aria-hidden className="absolute bottom-5 left-5  w-8 h-8 border-l border-b rounded-bl-lg border-accent opacity-30" />
            <div aria-hidden className="absolute bottom-5 right-5 w-8 h-8 border-r border-b rounded-br-lg border-accent opacity-30" />

            <div className="relative space-y-6">
              <p className="eyebrow text-ink-faint">Ready</p>
              <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-ink leading-[0.88] tracking-tight">
                Your ledger<br />
                <span style={{ color: 'var(--accent)' }}>awaits.</span>
              </h2>
              <p className="text-base text-ink-muted max-w-xs mx-auto leading-relaxed">
                No setup required. Open the app, start logging, and see your financial picture take shape.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  to={ctaTo}
                  className="inline-flex items-center gap-2.5 rounded-md px-7 py-3 text-sm font-medium transition-all duration-180 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                >
                  {ctaLabel} <ArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      {/* bare `footer` element — gorka theme override in styles.css applies here */}
      <footer className="border-t border-rule px-6 py-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4 flex-wrap text-xs text-ink-faint">
          <p className="font-display italic">Finance — a private ledger.</p>
          <p>Your data, your device.</p>
        </div>
      </footer>

    </div>
  );
}
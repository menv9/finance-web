import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import Silk from '../components/Silk';
import SakuraPetals from '../components/SakuraPetals';
import Grainient from '../components/Grainient';

// ─── Editorial data ───────────────────────────────────────────────────────────

const modules = [
  { title: 'Dashboard',  blurb: 'the arc of net worth, in one panel' },
  { title: 'This Month', blurb: 'every entry, side-by-side with last year' },
  { title: 'Accounts',   blurb: 'bank balances, kept honest and reconciled' },
  { title: 'Debts',      blurb: 'mortgages, loans, paid down by linked expenses' },
  { title: 'Income',     blurb: 'salary, freelance, dividends, sales' },
  { title: 'Expenses',   blurb: 'envelopes, rollover, every outgoing logged' },
  { title: 'Budgets',    blurb: 'category limits with rollover support' },
  { title: 'Savings',    blurb: 'goal pots, deposit history, progress' },
  { title: 'Portfolio',  blurb: 'holdings, allocations, realised P&L' },
];

const articles = [
  {
    head: 'Private by default.',
    lede: 'Everything is kept in your browser. There are no accounts to make, no servers to trust, no analytics in the gutters. The ledger never leaves the desk it was written on.',
  },
  {
    head: 'Quarterly, not hourly.',
    lede: 'This ledger is built around the rhythm of a quarterly review — not the daily noise of a feed. The arc of three months tells the truth that any single Tuesday cannot.',
  },
  {
    head: 'Kept for a household.',
    lede: 'Two people, one ledger. Each view is shared, each entry is visible, and the books belong to neither one alone. Finance is more honest when it\'s not a secret.',
  },
];

// ─── Tiny utilities ───────────────────────────────────────────────────────────

function ArrowRight({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ornament({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 select-none ${className}`} aria-hidden>
      <span className="h-px w-16" style={{ background: 'var(--rule-strong)' }} />
      <span className="text-[0.7rem]" style={{ color: 'var(--accent)' }}>✦</span>
      <span className="h-px w-16" style={{ background: 'var(--rule-strong)' }} />
    </div>
  );
}

// ─── Cover figure: net worth as an editorial spark line ──────────────────────

function CoverFigure() {
  const pts = [
    [0, 92], [12, 80], [26, 86], [40, 64], [54, 70],
    [68, 50], [82, 44], [96, 26], [110, 30], [124, 12],
  ];
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = line + ' L124,100 L0,100 Z';
  return (
    <svg viewBox="0 0 124 100" className="w-full h-full" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="cov-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cov-area)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 2.4 : 1} fill="var(--accent)" opacity={i === pts.length - 1 ? 1 : 0.4} />
      ))}
      <line x1="124" y1="0" x2="124" y2="100" stroke="var(--rule-strong)" strokeWidth="0.5" />
    </svg>
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function Wordmark({ size = 'sm' }) {
  const isLg = size === 'lg';
  return (
    <svg viewBox="50 55 540 140" role="img" xmlns="http://www.w3.org/2000/svg" className={isLg ? 'h-12 w-auto' : 'h-6 w-auto'}>
      <title>FinGes</title>
      <defs>
        <linearGradient id={`wm-grad-${size}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="60%" stopColor="var(--accent-strong)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <text x="60" y="170" fontFamily="'Fraunces', Georgia, serif" fontSize="120" fontWeight="400" fill="var(--ink)" opacity="0.92" letterSpacing="-3">Fin</text>
      <text x="240" y="170" fontFamily="'Fraunces', Georgia, serif" fontStyle="italic" fontSize="120" fontWeight="500" fill={`url(#wm-grad-${size})`} letterSpacing="-3">Ges</text>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const theme = useFinanceStore((s) => s.settings?.theme);

  const appliedTheme = ['dark', 'light', 'eris', 'gorka', 'gorka-light'].includes(theme) ? theme : 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.body.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const issueDate = `${months[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="min-h-screen flex flex-col" data-landing-edition="true">
      <style>{landingCss}</style>

      {appliedTheme === 'eris' && <SakuraPetals />}

      {appliedTheme === 'gorka' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#08101F' }}>
          <Silk speed={1} scale={1.5} color="#1E2C44" noiseIntensity={2} rotation={0.6} />
        </div>
      )}

      {appliedTheme === 'gorka-light' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#EDE5CF' }}>
          <Grainient
            color1="#F2E8CA" color2="#DBBE93" color3="#E8D8B2"
            timeSpeed={0.07} warpStrength={0.5} warpFrequency={3.0} warpSpeed={0.6}
            warpAmplitude={90.0} blendAngle={20.0} blendSoftness={0.18}
            rotationAmount={160.0} noiseScale={1.4} grainAmount={0.04}
            grainScale={3.0} contrast={1.05} gamma={1.0} saturation={0.75} zoom={1.05}
          />
          <svg xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.13 }}>
            <defs>
              <filter id="lp-paper-wrinkle" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.032 0.048" numOctaves="5" seed="11" result="noise" />
                <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1.2" result="light">
                  <feDistantLight azimuth="38" elevation="52" />
                </feDiffuseLighting>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#lp-paper-wrinkle)" />
          </svg>
        </div>
      )}

      {/* ╔════════════════════════ MASTHEAD ════════════════════════╗ */}
      <header className="sticky top-0 z-40 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="flex items-center justify-between py-2 border-b border-rule">
            <span className="masthead-meta">A QUARTERLY LEDGER</span>
            <span className="masthead-meta hidden md:inline">PRIVATE · LOCAL · HONEST</span>
            <span className="masthead-meta">{issueDate.toUpperCase()}</span>
          </div>
          <div className="flex h-12 items-center justify-between gap-6">
            <Wordmark size="sm" />
            <Link to="/dashboard" className="cta-link group">
              <span className="cta-link-label">Open the ledger</span>
              <span className="cta-link-arrow"><ArrowRight /></span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ╔════════════════════════ COVER ════════════════════════╗ */}
        <section className="relative mx-auto max-w-[1280px] px-10 pt-20 pb-24 lg:pt-28 lg:pb-32 overflow-hidden">

          {appliedTheme !== 'gorka' && appliedTheme !== 'gorka-light' && (
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{
              backgroundImage: 'linear-gradient(var(--rule) 1px, transparent 1px), linear-gradient(90deg, var(--rule) 1px, transparent 1px)',
              backgroundSize: '88px 88px',
              opacity: 0.4,
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)',
            }} />
          )}

          <div className="relative grid grid-cols-12 gap-x-8 gap-y-10">

            <div className="col-span-12 lg:col-span-7 space-y-8">
              <p className="rise rise-1 eyebrow text-ink-faint">A personal finance ledger</p>

              <h1 className="rise rise-2 cover-head">
                <span className="cover-head-1">A&nbsp;quiet</span>
                <span className="cover-head-2"><em>ledger</em></span>
                <span className="cover-head-3">for&nbsp;loud&nbsp;months.</span>
              </h1>

              <p className="rise rise-3 cover-lede">
                <span className="drop-cap">F</span>inGes is a personal finance journal for people who want
                <em> full clarity</em> over their money — without handing the keys to anyone else.
                Logged in your browser, read in the rhythm of a quarter rather than a tick.
              </p>

              <div className="rise rise-4 flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
                <Link to="/dashboard" className="btn-primary group">
                  <span>Open the ledger</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <a href="#contents" className="btn-rule">
                  <span>See what's inside</span>
                </a>
              </div>
            </div>

            <aside className="col-span-12 lg:col-span-4 lg:col-start-9 lg:pl-8 lg:border-l lg:border-rule">
              <div className="rise rise-3 space-y-1">
                <p className="margin-caption">
                  <em>Net worth, ten quarters trailing.</em>
                  &nbsp;Drawn from the household&nbsp;books.
                </p>
                <div className="figure-frame">
                  <div className="h-32 mt-1">
                    <CoverFigure />
                  </div>
                  <div className="figure-baseline">
                    <span>Q3 '23</span>
                    <span className="text-positive">↑ 12.4%</span>
                    <span>Q1 '26</span>
                  </div>
                </div>
              </div>

              <dl className="rise rise-4 mt-8 grid grid-cols-1 gap-3">
                {[
                  ['Savings rate',    '42.5 %'],
                  ['Monthly income',  '+€ 3,200'],
                  ['Monthly outflow', '−€ 1,840'],
                  ['Holdings',        '14 lines'],
                ].map(([k, v]) => (
                  <div key={k} className="dot-row">
                    <dt>{k}</dt>
                    <span className="dot-leader" aria-hidden />
                    <dd className="numeric">{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        {/* ╔════════════════════════ CONTENTS ════════════════════╗ */}
        <section id="contents" className="mx-auto max-w-[1280px] px-10 py-24 lg:py-32">
          <div className="grid grid-cols-12 gap-x-8 gap-y-10">

            <div className="col-span-12 lg:col-span-3 space-y-3">
              <h2 className="section-head">
                <span>What's</span>
                <span><em>inside</em></span>
              </h2>
              <p className="section-sub">
                Nine chapters, one ledger.<br />
                Hover a line to follow its thread.
              </p>
            </div>

            <ul className="col-span-12 lg:col-span-9 lg:pl-8 lg:border-l lg:border-rule contents-list">
              {modules.map((m, i) => (
                <li key={m.title} style={{ animationDelay: `${i * 60}ms` }} className="rise contents-row">
                  <Link to="/dashboard" className="contents-link group">
                    <span className="contents-title">{m.title}</span>
                    <span className="contents-blurb"><em>{m.blurb}</em></span>
                    <span className="contents-leader" aria-hidden />
                    <span className="contents-arrow"><ArrowRight /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Ornament className="my-2" />

        {/* ╔════════════════════════ LETTER FROM THE EDITOR ══════╗ */}
        <section className="border-t border-b border-rule bg-surface relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, var(--ink) 0 1px, transparent 1px 28px)' }} />
          <div className="relative mx-auto max-w-[1280px] px-10 py-24 lg:py-32">
            <div className="grid grid-cols-12 gap-x-8 gap-y-10">
              <div className="col-span-12 lg:col-span-3 space-y-3">
                <h2 className="section-head">
                  <span>From the</span>
                  <span><em>editor</em></span>
                </h2>
                <p className="section-sub">A short note on how — and why — the books are kept.</p>
              </div>

              <div className="col-span-12 lg:col-span-9 lg:pl-8 lg:border-l lg:border-rule">
                <div className="grid gap-10 lg:grid-cols-3">
                  {articles.map((a, i) => (
                    <article key={a.head} className="rise letter-article" style={{ animationDelay: `${i * 80}ms` }}>
                      <h3 className="article-head">{a.head}</h3>
                      <p className="article-lede">{a.lede}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-14 pt-6 border-t border-rule signature-row">
                  <span className="signature-em">—</span>
                  <span className="signature-name">eris &amp; gorka</span>
                  <span className="signature-role"><em>keepers of the books</em></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ╔════════════════════════ SPECIMEN ════════════════════╗ */}
        <section className="mx-auto max-w-[1280px] px-10 py-24 lg:py-32">
          <div className="grid grid-cols-12 gap-x-8 gap-y-12">
            <div className="col-span-12 lg:col-span-3 space-y-3">
              <h2 className="section-head">
                <span>A specimen</span>
                <span><em>page</em></span>
              </h2>
              <p className="section-sub">
                A sample dashboard, set in our usual styles. Numbers approximate, sentiment honest.
              </p>
            </div>

            <div className="col-span-12 lg:col-span-9 lg:pl-8 lg:border-l lg:border-rule">
              <div className="specimen-frame">
                <div className="specimen-header">
                  <span className="eyebrow text-ink-faint">Dashboard · overview</span>
                  <span className="text-xs text-ink-faint font-display italic">illustrative</span>
                </div>

                <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 mt-6">
                  <div className="space-y-3">
                    <p className="eyebrow text-ink-faint">Net worth</p>
                    <p className="display-serif text-5xl text-ink leading-none tracking-tight">
                      € 48,320
                      <span className="ml-3 text-positive text-xl align-middle">↑ 12.4%</span>
                    </p>
                    <div className="h-44 mt-3">
                      <CoverFigure />
                    </div>
                    <p className="margin-caption mt-2">
                      <em>Trailing twelve months. Locally computed.</em>
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      ['Income',       '+€ 3,200', 'positive'],
                      ['Expenses',     '−€ 1,840', 'danger'],
                      ['Savings rate', '42.5 %',   'accent'],
                      ['Holdings',     '14 lines', 'muted'],
                      ['Realised P&L', '+€ 620',   'positive'],
                      ['Pots active',  '6',         'muted'],
                    ].map(([k, v, tone]) => (
                      <div key={k} className="dot-row">
                        <dt>{k}</dt>
                        <span className="dot-leader" aria-hidden />
                        <dd className={`numeric tone-${tone}`}>{v}</dd>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-rule flex items-center justify-between">
                  <p className="margin-caption m-0">
                    <em>Each module is private. Nothing leaves your browser.</em>
                  </p>
                  <Link to="/dashboard" className="btn-rule btn-rule-sm">
                    <span>Take a closer look</span>
                    <ArrowRight />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ╔════════════════════════ CLOSING ═════════════════════╗ */}
        <section className="mx-auto max-w-[1280px] px-10 pb-32 pt-12">
          <div className="closing-card">
            <h2 className="closing-head">
              <span>Begin</span>
              <span className="closing-italic"><em>your ledger.</em></span>
            </h2>
            <p className="closing-sub">
              No setup. No accounts. Open the app and start typing — your books take shape from there.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link to="/dashboard" className="btn-primary btn-primary-lg group">
                <span>Open the ledger</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
            <Ornament className="mt-10" />
            <p className="closing-fin">FIN.</p>
          </div>
        </section>
      </main>

      {/* ╔════════════════════════ COLOPHON ═════════════════════╗ */}
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1280px] px-10 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-baseline">
          <p className="eyebrow text-ink-faint">Colophon</p>
          <p className="text-xs text-ink-muted leading-relaxed text-center md:text-left">
            Set in <em>Fraunces</em>, <em>Instrument Sans</em>, and <em>JetBrains Mono</em>.
            Pressed locally, printed on the open web.
          </p>
          <p className="text-xs text-ink-faint text-right font-display italic">
            Your data, your device. <span className="numeric">© {now.getFullYear()}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Page-scoped CSS ──────────────────────────────────────────────────────────

const landingCss = `
[data-landing-edition="true"] {
  --leader: var(--rule-strong);
}

.masthead-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
  text-transform: uppercase;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.95rem;
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  color: var(--ink);
  transition: border-color 200ms ease, color 200ms ease, background 200ms ease;
}
.cta-link:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.cta-link-label { font-family: 'Instrument Sans', sans-serif; }
.cta-link-arrow { display: inline-flex; transition: transform 200ms ease; }
.cta-link:hover .cta-link-arrow { transform: translateX(2px); }

.cover-head {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 144, 'SOFT' 0;
  font-weight: 400;
  font-size: clamp(2.6rem, 4.6vw, 4.8rem);
  line-height: 0.95;
  letter-spacing: -0.035em;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 100%;
}
.cover-head-1 { padding-left: 0; }
.cover-head-2 { color: var(--accent); padding-left: 1.6em; font-weight: 500; }
.cover-head-3 { padding-left: 0.4em; }
.cover-head em { font-style: italic; }

.cover-lede {
  font-family: 'Fraunces', serif;
  font-weight: 350;
  font-size: 1.18rem;
  line-height: 1.55;
  color: var(--ink-muted);
  max-width: 52ch;
}
.cover-lede em { font-style: italic; color: var(--ink); font-weight: 400; }

.drop-cap {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 144;
  font-weight: 500;
  font-style: italic;
  font-size: 4.6rem;
  line-height: 0.85;
  float: left;
  padding: 0.18rem 0.55rem 0 0;
  color: var(--accent);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1.3rem;
  background: var(--accent);
  color: var(--accent-ink);
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: 'Instrument Sans', sans-serif;
  letter-spacing: 0.005em;
  border: 1px solid var(--accent);
  transition: transform 180ms ease, box-shadow 200ms ease, background 200ms ease;
  box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 8px 24px -10px var(--accent-soft);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 2px 0 rgba(0,0,0,0.04), 0 14px 28px -8px var(--accent-soft); }
.btn-primary:active { transform: translateY(0); }
.btn-primary-lg { padding: 0.95rem 1.7rem; font-size: 0.95rem; }

.btn-rule {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.3rem;
  border: 1px solid var(--rule-strong);
  border-radius: 4px;
  color: var(--ink-muted);
  font-size: 0.875rem;
  font-family: 'Instrument Sans', sans-serif;
  transition: color 180ms ease, border-color 180ms ease, background 200ms ease;
}
.btn-rule:hover { color: var(--ink); border-color: var(--accent); background: var(--accent-soft); }
.btn-rule-sm { padding: 0.4rem 0.85rem; font-size: 0.78rem; }

.margin-caption {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 350;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--ink-faint);
  letter-spacing: 0.005em;
}
.margin-caption em { color: var(--ink-muted); }

.figure-frame {
  position: relative;
  padding: 0.75rem 0.75rem 0.5rem;
  border: 1px solid var(--rule-strong);
  border-radius: 4px;
  background: linear-gradient(180deg, transparent 0%, var(--accent-soft) 200%);
}
.figure-baseline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.35rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
  text-transform: uppercase;
}

.dot-row {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  font-size: 0.85rem;
  color: var(--ink-muted);
  padding: 0.18rem 0;
}
.dot-row dt { font-family: 'Instrument Sans', sans-serif; white-space: nowrap; }
.dot-row .dot-leader {
  flex: 1;
  border-bottom: 1px dotted var(--leader);
  position: relative;
  top: -3px;
}
.dot-row dd {
  font-family: 'JetBrains Mono', monospace;
  color: var(--ink);
  font-weight: 500;
  white-space: nowrap;
}
.tone-positive { color: var(--positive) !important; }
.tone-danger   { color: var(--danger) !important; }
.tone-accent   { color: var(--accent) !important; }
.tone-muted    { color: var(--ink-muted) !important; }

.section-head {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 2.1rem;
  line-height: 1;
  color: var(--ink);
  letter-spacing: -0.02em;
  display: flex;
  flex-direction: column;
}
.section-head em { font-style: italic; color: var(--accent); font-weight: 500; }
.section-sub {
  font-family: 'Fraunces', serif;
  font-weight: 350;
  font-style: italic;
  font-size: 0.95rem;
  color: var(--ink-muted);
  line-height: 1.5;
}

.contents-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.contents-row { border-bottom: 1px solid var(--rule); }
.contents-row:first-child { border-top: 1px solid var(--rule); }
.contents-link {
  display: grid;
  grid-template-columns: minmax(8rem, auto) 1fr 2rem;
  align-items: baseline;
  gap: 1.25rem;
  padding: 1.1rem 0.5rem;
  position: relative;
  transition: padding 240ms cubic-bezier(0.2, 0.8, 0.2, 1), background 240ms ease;
}
.contents-link:hover { padding-left: 1.6rem; background: var(--accent-soft); }
.contents-title {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 1.85rem;
  color: var(--ink);
  line-height: 1;
  letter-spacing: -0.015em;
  transition: color 200ms ease;
}
.contents-link:hover .contents-title { color: var(--accent); }
.contents-blurb {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 350;
  font-size: 0.95rem;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.contents-leader {
  border-bottom: 1px dotted var(--leader);
  position: relative;
  top: -5px;
  transition: border-color 200ms ease;
}
.contents-link:hover .contents-leader { border-color: var(--accent); }
.contents-arrow {
  display: inline-flex;
  align-items: center;
  color: var(--ink-faint);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 200ms ease, transform 240ms ease, color 200ms ease;
}
.contents-link:hover .contents-arrow { opacity: 1; transform: translateX(0); color: var(--accent); }

@media (max-width: 900px) {
  .contents-link { grid-template-columns: 1fr 2rem; gap: 0.8rem; }
  .contents-blurb, .contents-leader { display: none; }
}

.letter-article {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  position: relative;
  padding-top: 1.5rem;
  border-top: 1px solid var(--rule);
}
.article-head {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 1.45rem;
  line-height: 1.1;
  color: var(--ink);
  letter-spacing: -0.015em;
}
.article-lede {
  font-family: 'Fraunces', serif;
  font-weight: 350;
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--ink-muted);
}
.article-lede em { font-style: italic; color: var(--ink); font-weight: 400; }

.signature-row {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
  font-family: 'Fraunces', serif;
}
.signature-em { color: var(--ink-faint); font-size: 1.1rem; }
.signature-name { font-size: 1.1rem; color: var(--ink); font-weight: 500; }
.signature-role { color: var(--ink-muted); font-size: 0.95rem; font-weight: 350; }

.specimen-frame {
  position: relative;
  border: 1px solid var(--rule-strong);
  border-radius: 6px;
  background: var(--surface);
  padding: 1.75rem 2rem 1.5rem;
  box-shadow: 0 32px 80px -36px rgba(0,0,0,0.5);
}
.specimen-frame::before {
  content: '';
  position: absolute;
  inset: 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--rule);
  opacity: 0.5;
  pointer-events: none;
}
.specimen-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--rule);
}

.closing-card {
  position: relative;
  padding: 4rem 2rem;
  text-align: center;
  border-top: 1px solid var(--rule-strong);
  border-bottom: 1px solid var(--rule-strong);
}
.closing-card::before, .closing-card::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 1px;
  height: 24px;
  background: var(--rule-strong);
  transform: translateX(-50%);
}
.closing-card::before { top: -12px; }
.closing-card::after { bottom: -12px; }
.closing-head {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: clamp(3rem, 6vw, 5.5rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--ink);
  display: inline-flex;
  flex-direction: column;
  margin: 1rem auto 1.25rem;
}
.closing-italic { color: var(--accent); font-weight: 500; }
.closing-italic em { font-style: italic; }
.closing-sub {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 350;
  font-size: 1.05rem;
  color: var(--ink-muted);
  max-width: 38ch;
  margin: 0 auto;
  line-height: 1.5;
}
.closing-fin {
  margin-top: 1.5rem;
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 500;
  letter-spacing: 0.4em;
  font-size: 0.85rem;
  color: var(--ink-faint);
}

[data-theme='gorka'] [data-landing-edition='true'],
[data-theme='gorka-light'] [data-landing-edition='true'] {
  --leader: rgba(148, 163, 184, 0.25);
}
[data-theme='eris'] [data-landing-edition='true'] {
  --leader: rgba(212, 96, 122, 0.28);
}

@media (max-width: 767px) {
  .cover-head-2 { padding-left: 0.6em; }
  .cover-head-3 { padding-left: 0; }
  .specimen-frame { padding: 1.25rem; }
}
`;

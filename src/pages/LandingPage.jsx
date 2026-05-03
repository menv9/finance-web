import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import Silk from '../components/Silk';
import SakuraPetals from '../components/SakuraPetals';
import Grainient from '../components/Grainient';
import { Wordmark } from '../components/Wordmark';
import { useTranslation } from '../i18n/useTranslation';

const VALID_THEMES = ['dark', 'light', 'eris', 'gorka', 'gorka-light'];

const PILLAR_KEYS = [
  { glyph: '◐', titleKey: 'landing.pillars.local.title',     bodyKey: 'landing.pillars.local.body' },
  { glyph: '↗', titleKey: 'landing.pillars.portfolio.title', bodyKey: 'landing.pillars.portfolio.body' },
  { glyph: '◇', titleKey: 'landing.pillars.goals.title',     bodyKey: 'landing.pillars.goals.body' },
];

const FEATURE_KEYS = [
  'dashboard', 'accounts', 'expenses', 'income', 'budgets', 'savings', 'portfolio', 'debts', 'activity',
];

const SYNC_STEP_KEYS = [
  { n: '01', titleKey: 'landing.syncSection.step1Title', bodyKey: 'landing.syncSection.step1Body' },
  { n: '02', titleKey: 'landing.syncSection.step2Title', bodyKey: 'landing.syncSection.step2Body' },
  { n: '03', titleKey: 'landing.syncSection.step3Title', bodyKey: 'landing.syncSection.step3Body' },
];

const THEME_KEYS = [
  { id: 'dark',        labelKey: 'landing.themesSection.dark.label',        subKey: 'landing.themesSection.dark.sub' },
  { id: 'light',       labelKey: 'landing.themesSection.light.label',       subKey: 'landing.themesSection.light.sub' },
  { id: 'eris',        labelKey: 'landing.themesSection.eris.label',        subKey: 'landing.themesSection.eris.sub' },
  { id: 'gorka',       labelKey: 'landing.themesSection.gorka.label',       subKey: 'landing.themesSection.gorka.sub' },
  { id: 'gorka-light', labelKey: 'landing.themesSection.gorkaLight.label',  subKey: 'landing.themesSection.gorkaLight.sub' },
];

function ArrowRight({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sparkline({ className = '' }) {
  const pts = [[0,80],[12,72],[26,76],[40,58],[54,62],[68,44],[82,38],[96,24],[110,28],[124,10]];
  const line = pts.map(([x,y], i) => `${i===0?'M':'L'}${x},${y}`).join(' ');
  const area = line + ' L124,100 L0,100 Z';
  return (
    <svg viewBox="0 0 124 100" className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="lp-spark-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lp-spark-area)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="124" cy="10" r="2.6" fill="var(--accent)" />
    </svg>
  );
}

function ProjectionCurve({ className = '' }) {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const x = (i / 30) * 124;
    const y = 75 - 65 * (1 - Math.exp(-i / 9));
    pts.push([x, y]);
  }
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 124 90" className={className} aria-hidden preserveAspectRatio="none">
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2.5 2.5" opacity="0.85" />
      <circle cx="124" cy={(75 - 65 * (1 - Math.exp(-30 / 9))).toFixed(1)} r="2.4" fill="var(--accent)" />
    </svg>
  );
}

function HeroComposition({ t }) {
  return (
    <div className="lp-hero-stack">
      <div aria-hidden className="lp-hero-glow" />

      <div className="lp-hero-card lp-hero-card-1">
        <div className="lp-card-meta">
          <span>{t('landing.hero3up.netWorth')}</span>
          <span className="lp-tag">{t('landing.hero3up.illustrative')}</span>
        </div>
        <div className="lp-bignum">€&thinsp;48,320</div>
        <div className="lp-delta-row">
          <span className="lp-delta lp-positive">{t('landing.hero3up.delta')}</span>
          <span className="lp-muted">{t('landing.hero3up.trailing')}</span>
        </div>
        <div className="lp-spark"><Sparkline className="w-full h-full" /></div>
        <div className="lp-spark-axis">
          <span>2024</span>
          <span>2025</span>
          <span>2026</span>
        </div>
      </div>

      <div className="lp-hero-card lp-hero-card-2">
        <div className="lp-card-meta">
          <span>{t('landing.hero3up.portfolioHolding')}</span>
        </div>
        <div className="lp-holding-head">
          <span className="lp-ticker">VWRL.DE</span>
          <span className="lp-holding-name">Vanguard FTSE All-World</span>
        </div>
        <div className="lp-holding-grid">
          <div><span className="lp-muted">{t('landing.hero3up.lots')}</span><span className="lp-num">42</span></div>
          <div><span className="lp-muted">{t('landing.hero3up.value')}</span><span className="lp-num">€&thinsp;18,420</span></div>
          <div><span className="lp-muted">{t('landing.hero3up.pnl')}</span><span className="lp-num lp-positive">+8.4%</span></div>
          <div><span className="lp-muted">{t('landing.hero3up.fx')}</span><span className="lp-num">EUR</span></div>
        </div>
      </div>

      <div className="lp-hero-card lp-hero-card-3">
        <div className="lp-card-meta">
          <span>{t('landing.hero3up.savingsPot')}</span>
        </div>
        <div className="lp-goal-row">
          <span className="lp-goal-name">{t('landing.hero3up.emergencyFund')}</span>
          <span className="lp-num">€&thinsp;4,800 <span className="lp-muted">/ €&thinsp;6,000</span></span>
        </div>
        <div className="lp-goal-bar"><span style={{ width: '80%' }} /></div>
        <div className="lp-goal-foot">
          <span className="lp-muted">{t('landing.hero3up.projected')}</span>
          <div className="lp-goal-proj"><ProjectionCurve className="w-full h-full" /></div>
          <span className="lp-num lp-positive">€&thinsp;36,200</span>
        </div>
      </div>
    </div>
  );
}

function Pillar({ glyph, title, body, delay }) {
  return (
    <article className="lp-pillar lp-rise" style={{ animationDelay: `${delay}ms` }}>
      <span className="lp-pillar-glyph" aria-hidden>{glyph}</span>
      <h3 className="lp-pillar-title">{title}</h3>
      <p className="lp-pillar-body">{body}</p>
    </article>
  );
}

function FeatureCard({ title, body, meta, delay }) {
  return (
    <Link to="/dashboard" className="lp-feature lp-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="lp-feature-head">
        <h3 className="lp-feature-title">{title}</h3>
        <span className="lp-feature-arrow"><ArrowRight /></span>
      </div>
      <p className="lp-feature-body">{body}</p>
      <span className="lp-feature-meta">{meta}</span>
    </Link>
  );
}

function SyncStep({ n, title, body, delay }) {
  return (
    <div className="lp-step lp-rise" style={{ animationDelay: `${delay}ms` }}>
      <span className="lp-step-n">§ {n}</span>
      <h3 className="lp-step-title">{title}</h3>
      <p className="lp-step-body">{body}</p>
    </div>
  );
}

function ThemeSwatch({ id, label, sub }) {
  return (
    <div className="lp-swatch" data-theme={id}>
      <div className="lp-swatch-canvas">
        <div className="lp-swatch-surface">
          <span className="lp-swatch-line lp-swatch-line-a" />
          <span className="lp-swatch-line lp-swatch-line-b" />
          <span className="lp-swatch-dot" />
        </div>
      </div>
      <div className="lp-swatch-foot">
        <span className="lp-swatch-label">{label}</span>
        <span className="lp-swatch-sub">{sub}</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const theme = useFinanceStore((s) => s.settings?.theme);
  const appliedTheme = VALID_THEMES.includes(theme) ? theme : 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.body.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  const trustItems = [
    t('landing.trust.offline'),
    t('landing.trust.pwa'),
    t('landing.trust.sync'),
  ];

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
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-rule lp-nav">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 h-14 flex items-center justify-between gap-6">
          <Link to="/landing" aria-label={t('landing.nav.home')}><Wordmark size="sm" /></Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#features" className="lp-nav-link hidden sm:inline-flex">{t('landing.nav.features')}</a>
            <a href="#sync" className="lp-nav-link hidden md:inline-flex">{t('landing.nav.sync')}</a>
            <Link to="/login" className="lp-nav-link">{t('landing.nav.signIn')}</Link>
            <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-sm">
              <span>{t('landing.nav.openApp')}</span>
              <ArrowRight />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="lp-hero-grid" />

          <div className="relative mx-auto max-w-[1280px] px-6 lg:px-10 pt-16 lg:pt-24 pb-20 lg:pb-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-14 items-start">

              <div className="col-span-12 lg:col-span-7 lg:pr-6 space-y-7">
                <p className="lp-rise lp-rise-1 lp-eyebrow">
                  <span className="lp-eyebrow-dot" /> {t('landing.hero.eyebrow')}
                </p>

                <h1 className="lp-rise lp-rise-2 lp-h1">
                  <span>{t('landing.hero.h1Line1')}</span>
                  <span className="lp-h1-italic"><em>{t('landing.hero.h1Line2')}</em></span>
                </h1>

                <p className="lp-rise lp-rise-3 lp-lede">
                  {t('landing.hero.lede')}
                </p>

                <div className="lp-rise lp-rise-4 flex flex-wrap items-center gap-x-4 gap-y-3 pt-2">
                  <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg group">
                    <span>{t('landing.hero.openApp')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                  <Link to="/login" className="lp-btn lp-btn-rule lp-btn-lg">
                    <span>{t('landing.hero.createAccount')}</span>
                  </Link>
                </div>

                <ul className="lp-rise lp-rise-5 lp-trust">
                  {trustItems.map((item) => (
                    <li key={item}><span className="lp-trust-tick" aria-hidden>✓</span>{item}</li>
                  ))}
                </ul>
              </div>

              <aside className="col-span-12 lg:col-span-5 lp-rise lp-rise-3">
                <HeroComposition t={t} />
              </aside>

            </div>
          </div>
        </section>

        {/* PILLARS ──────────────────────────────────────────────────────── */}
        <section className="border-t border-rule lp-section">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-12">
              <div className="col-span-12 lg:col-span-3">
                <p className="lp-section-tag">{t('landing.pillars.sectionTag')}</p>
                <h2 className="lp-h2">
                  <span>{t('landing.pillars.h2Line1')}</span>
                  <span className="lp-h2-italic"><em>{t('landing.pillars.h2Line2')}</em></span>
                </h2>
                <p className="lp-section-sub">
                  {t('landing.pillars.sub')}
                </p>
              </div>
              <div className="col-span-12 lg:col-span-9 grid gap-10 md:grid-cols-3">
                {PILLAR_KEYS.map((p, i) => (
                  <Pillar key={p.titleKey} glyph={p.glyph} title={t(p.titleKey)} body={t(p.bodyKey)} delay={i * 80} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES ─────────────────────────────────────────────────────── */}
        <section id="features" className="border-t border-rule lp-section lp-section-alt">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-12">
              <div className="col-span-12 lg:col-span-3">
                <p className="lp-section-tag">{t('landing.features.sectionTag')}</p>
                <h2 className="lp-h2">
                  <span>{t('landing.features.h2Line1')}</span>
                  <span className="lp-h2-italic"><em>{t('landing.features.h2Line2')}</em></span>
                </h2>
                <p className="lp-section-sub">
                  {t('landing.features.sub')}
                </p>
              </div>
              <div className="col-span-12 lg:col-span-9 grid gap-px lp-feature-grid">
                {FEATURE_KEYS.map((key, i) => (
                  <FeatureCard
                    key={key}
                    title={t(`landing.features.${key}.title`)}
                    body={t(`landing.features.${key}.body`)}
                    meta={t(`landing.features.${key}.meta`)}
                    delay={i * 50}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SYNC ─────────────────────────────────────────────────────────── */}
        <section id="sync" className="border-t border-rule lp-section">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-12">
              <div className="col-span-12 lg:col-span-3">
                <p className="lp-section-tag">{t('landing.syncSection.sectionTag')}</p>
                <h2 className="lp-h2">
                  <span>{t('landing.syncSection.h2Line1')}</span>
                  <span className="lp-h2-italic"><em>{t('landing.syncSection.h2Line2')}</em></span>
                </h2>
                <p className="lp-section-sub">
                  {t('landing.syncSection.sub')}
                </p>
              </div>
              <div className="col-span-12 lg:col-span-9 grid gap-x-6 gap-y-10 md:grid-cols-3 lp-step-row">
                {SYNC_STEP_KEYS.map((s, i) => (
                  <SyncStep key={s.n} n={s.n} title={t(s.titleKey)} body={t(s.bodyKey)} delay={i * 90} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* THEMES ───────────────────────────────────────────────────────── */}
        <section className="border-t border-rule lp-section lp-section-alt">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-10">
              <div className="col-span-12 lg:col-span-3">
                <p className="lp-section-tag">{t('landing.themesSection.sectionTag')}</p>
                <h2 className="lp-h2">
                  <span>{t('landing.themesSection.h2Line1')}</span>
                  <span className="lp-h2-italic"><em>{t('landing.themesSection.h2Line2')}</em></span>
                </h2>
                <p className="lp-section-sub">
                  {t('landing.themesSection.sub')}
                </p>
              </div>
              <div className="col-span-12 lg:col-span-9 lp-swatch-row">
                {THEME_KEYS.map((th) => (
                  <ThemeSwatch key={th.id} id={th.id} label={t(th.labelKey)} sub={t(th.subKey)} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CLOSING ─────────────────────────────────────────────────────── */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-24 lg:py-32 text-center">
            <p className="lp-section-tag inline-block">{t('landing.closing.sectionTag')}</p>
            <h2 className="lp-h-closing">
              <span>{t('landing.closing.h1')}</span>
              <span className="lp-h-closing-italic"><em>{t('landing.closing.h2')}</em></span>
            </h2>
            <p className="lp-closing-sub">
              {t('landing.closing.sub')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
              <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg group">
                <span>{t('landing.hero.openApp')}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link to="/login" className="lp-btn lp-btn-rule lp-btn-lg">
                <span>{t('landing.hero.createAccount')}</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex items-center gap-3">
            <Wordmark size="sm" />
            <span className="lp-foot-tag">{t('landing.footer.tag')}</span>
          </div>
          <div className="flex items-center justify-center gap-5">
            <Link to="/dashboard" className="lp-foot-link">{t('landing.footer.openApp')}</Link>
            <Link to="/login" className="lp-foot-link">{t('landing.footer.signIn')}</Link>
            <a href="#features" className="lp-foot-link">{t('landing.footer.features')}</a>
            <Link to="/privacy" className="lp-foot-link">Privacy</Link>
            <Link to="/terms" className="lp-foot-link">Terms</Link>
          </div>
          <p className="lp-foot-meta md:text-right">
            <span>© {new Date().getFullYear()}</span>
            <span> · {t('landing.footer.meta1')} </span>
            <em>Fraunces</em>, <em>Instrument Sans</em>, <em>JetBrains Mono</em>.
          </p>
        </div>
      </footer>
    </div>
  );
}

const landingCss = `
[data-landing-edition="true"] {
  background: var(--canvas);
  color: var(--ink);
}

/* ─── Type primitives ───────────────────────────────────────────────── */
.lp-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}
.lp-eyebrow-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.lp-h1 {
  font-family: 'Fraunces', Georgia, serif;
  font-variation-settings: 'opsz' 144;
  font-weight: 400;
  font-size: clamp(2.6rem, 5.4vw, 5rem);
  line-height: 0.98;
  letter-spacing: -0.038em;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 0.05em;
}
.lp-h1-italic { color: var(--accent); font-weight: 500; }
.lp-h1-italic em { font-style: italic; }

.lp-lede {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 350;
  font-size: clamp(1.05rem, 1.4vw, 1.2rem);
  line-height: 1.55;
  color: var(--ink-muted);
  max-width: 56ch;
}

.lp-h2 {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 400;
  font-size: clamp(2rem, 3.6vw, 2.8rem);
  line-height: 1;
  letter-spacing: -0.025em;
  color: var(--ink);
  display: flex;
  flex-direction: column;
}
.lp-h2-italic { color: var(--accent); font-weight: 500; }
.lp-h2-italic em { font-style: italic; }

.lp-h-closing {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 400;
  font-size: clamp(2.8rem, 6vw, 4.8rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--ink);
  display: inline-flex;
  flex-direction: column;
  margin: 1.5rem auto 1rem;
}
.lp-h-closing-italic { color: var(--accent); font-weight: 500; }
.lp-h-closing-italic em { font-style: italic; }
.lp-closing-sub {
  font-family: 'Fraunces', Georgia, serif;
  font-style: italic;
  font-weight: 350;
  font-size: 1.05rem;
  color: var(--ink-muted);
  max-width: 42ch;
  margin: 0 auto;
  line-height: 1.55;
}

.lp-section-tag {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
  text-transform: uppercase;
  margin-bottom: 1rem;
}
.lp-section-sub {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 350;
  font-style: italic;
  font-size: 0.98rem;
  color: var(--ink-muted);
  line-height: 1.55;
  margin-top: 1.1rem;
  max-width: 30ch;
}

.lp-section { background: var(--canvas); }
.lp-section-alt { background: var(--surface); }

/* ─── Nav ───────────────────────────────────────────────────────────── */
.lp-nav {
  background: color-mix(in srgb, var(--canvas) 78%, transparent);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
}
.lp-nav-link {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.85rem;
  color: var(--ink-muted);
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  transition: color 180ms ease, background 180ms ease;
}
.lp-nav-link:hover { color: var(--ink); background: var(--accent-soft); }

/* ─── Buttons ───────────────────────────────────────────────────────── */
.lp-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 1.1rem;
  border-radius: 6px;
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.005em;
  border: 1px solid transparent;
  transition: transform 180ms ease, box-shadow 220ms ease, background 200ms ease, color 200ms ease, border-color 200ms ease;
  cursor: pointer;
}
.lp-btn-sm { padding: 0.4rem 0.85rem; font-size: 0.8rem; }
.lp-btn-lg { padding: 0.85rem 1.4rem; font-size: 0.95rem; }

.lp-btn-primary {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
  box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 14px 28px -14px var(--accent-soft);
}
.lp-btn-primary:hover {
  transform: translateY(-1px);
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  box-shadow: 0 2px 0 rgba(0,0,0,0.05), 0 22px 40px -16px var(--accent-soft);
}
.lp-btn-primary:active { transform: translateY(0); }

.lp-btn-rule {
  background: transparent;
  color: var(--ink-muted);
  border: 1px solid var(--rule-strong);
}
.lp-btn-rule:hover {
  color: var(--ink);
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* ─── Hero ──────────────────────────────────────────────────────────── */
.lp-hero-grid {
  position: absolute; inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--rule) 1px, transparent 1px),
    linear-gradient(90deg, var(--rule) 1px, transparent 1px);
  background-size: 96px 96px;
  opacity: 0.5;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, black 20%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, black 20%, transparent 100%);
}
[data-theme='gorka'] .lp-hero-grid,
[data-theme='gorka-light'] .lp-hero-grid { display: none; }

.lp-trust {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.4rem;
  margin-top: 0.5rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--rule);
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--ink-muted);
  list-style: none;
}
.lp-trust li {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}
.lp-trust-tick {
  color: var(--accent);
  font-size: 0.78rem;
}

/* ─── Hero composition ──────────────────────────────────────────────── */
.lp-hero-stack {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.1rem;
  perspective: 2000px;
}
.lp-hero-glow {
  position: absolute;
  inset: -10% -8% -10% -8%;
  z-index: -1;
  background: radial-gradient(60% 60% at 80% 20%, var(--accent-soft) 0%, transparent 70%),
              radial-gradient(40% 40% at 10% 80%, var(--accent-soft) 0%, transparent 70%);
  filter: blur(20px);
  opacity: 0.9;
}

.lp-hero-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: 10px;
  padding: 1.1rem 1.25rem;
  box-shadow: 0 30px 60px -32px rgba(0,0,0,0.45);
  transition: transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 380ms ease;
}
.lp-hero-card:hover { transform: translateY(-2px); box-shadow: 0 36px 70px -28px rgba(0,0,0,0.55); }
.lp-hero-card-1 { transform: translateX(0); }
.lp-hero-card-2 { transform: translateX(2.5rem); }
.lp-hero-card-3 { transform: translateX(-1rem); }
@media (max-width: 1023px) {
  .lp-hero-card-1, .lp-hero-card-2, .lp-hero-card-3 { transform: none; }
}

.lp-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: var(--ink-faint);
  text-transform: uppercase;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--rule);
}
.lp-tag {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
  text-transform: lowercase;
}

.lp-bignum {
  font-family: 'Fraunces', Georgia, serif;
  font-variation-settings: 'opsz' 144;
  font-weight: 400;
  font-size: clamp(2.6rem, 4.4vw, 3.4rem);
  letter-spacing: -0.03em;
  color: var(--ink);
  margin: 0.85rem 0 0.3rem;
  line-height: 1;
}
.lp-delta-row {
  display: flex; gap: 0.7rem; align-items: baseline;
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
}
.lp-delta {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
}
.lp-positive { color: var(--positive); }
.lp-muted    { color: var(--ink-faint); font-size: 0.78rem; }

.lp-spark {
  height: 70px;
  margin-top: 0.7rem;
}
.lp-spark-axis {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
  text-transform: uppercase;
  margin-top: 0.2rem;
}

.lp-holding-head {
  display: flex; align-items: baseline; gap: 0.7rem;
  margin-top: 0.85rem;
}
.lp-ticker {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 1rem;
  color: var(--ink);
  background: var(--accent-soft);
  padding: 0.18rem 0.45rem;
  border-radius: 4px;
}
.lp-holding-name {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 350;
  color: var(--ink-muted);
  font-size: 0.95rem;
}
.lp-holding-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
  margin-top: 0.85rem;
  padding-top: 0.7rem;
  border-top: 1px dashed var(--rule);
}
.lp-holding-grid > div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.lp-holding-grid .lp-muted {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lp-num {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  color: var(--ink);
  font-size: 0.85rem;
}

.lp-goal-row {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-top: 0.85rem;
}
.lp-goal-name {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 1rem;
  color: var(--ink);
}
.lp-goal-bar {
  position: relative;
  height: 6px;
  background: var(--surface-sunken, var(--accent-soft));
  border: 1px solid var(--rule);
  border-radius: 3px;
  margin-top: 0.55rem;
  overflow: hidden;
}
.lp-goal-bar > span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  border-radius: 2px;
}
.lp-goal-foot {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.7rem;
}
.lp-goal-proj { height: 26px; }

/* ─── Pillars ───────────────────────────────────────────────────────── */
.lp-pillar {
  position: relative;
  padding-top: 1.5rem;
  border-top: 1px solid var(--rule-strong);
}
.lp-pillar-glyph {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 32px; height: 32px;
  margin-bottom: 1rem;
  border: 1px solid var(--rule-strong);
  border-radius: 50%;
  font-family: 'Fraunces', serif;
  color: var(--accent);
  font-size: 1.1rem;
  background: var(--accent-soft);
}
.lp-pillar-title {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 1.45rem;
  line-height: 1.15;
  letter-spacing: -0.012em;
  color: var(--ink);
  margin-bottom: 0.55rem;
}
.lp-pillar-body {
  font-family: 'Fraunces', serif;
  font-weight: 350;
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--ink-muted);
}

/* ─── Feature grid ──────────────────────────────────────────────────── */
.lp-feature-grid {
  grid-template-columns: 1fr;
  background: var(--rule);
  border: 1px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
}
@media (min-width: 640px) { .lp-feature-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 960px) { .lp-feature-grid { grid-template-columns: repeat(3, 1fr); } }

.lp-feature {
  display: block;
  position: relative;
  background: var(--surface);
  padding: 1.4rem 1.4rem 1.3rem;
  text-decoration: none;
  transition: background 220ms ease, transform 220ms ease;
}
.lp-feature:hover { background: var(--surface-raised, var(--surface)); }
.lp-feature::after {
  content: '';
  position: absolute;
  left: 1.4rem; right: 1.4rem; bottom: 0;
  height: 2px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.lp-feature:hover::after { transform: scaleX(1); }

.lp-feature-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.5rem;
}
.lp-feature-title {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 1.4rem;
  color: var(--ink);
  letter-spacing: -0.012em;
}
.lp-feature-arrow {
  color: var(--ink-faint);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 220ms ease, transform 220ms ease, color 220ms ease;
}
.lp-feature:hover .lp-feature-arrow { opacity: 1; transform: translateX(0); color: var(--accent); }

.lp-feature-body {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--ink-muted);
  margin-bottom: 0.85rem;
  min-height: 2.8em;
}
.lp-feature-meta {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
  border-top: 1px dashed var(--rule);
  padding-top: 0.65rem;
  width: 100%;
}

/* ─── Sync steps ────────────────────────────────────────────────────── */
.lp-step-row { position: relative; }
.lp-step {
  position: relative;
  padding-top: 1.5rem;
  border-top: 1px solid var(--rule-strong);
}
.lp-step-n {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  color: var(--accent);
  text-transform: uppercase;
  margin-bottom: 0.85rem;
  display: inline-block;
}
.lp-step-title {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 1.5rem;
  line-height: 1.15;
  letter-spacing: -0.015em;
  color: var(--ink);
  margin-bottom: 0.55rem;
}
.lp-step-body {
  font-family: 'Fraunces', serif;
  font-weight: 350;
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--ink-muted);
}

/* ─── Theme swatches ────────────────────────────────────────────────── */
.lp-swatch-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
@media (min-width: 720px) { .lp-swatch-row { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .lp-swatch-row { grid-template-columns: repeat(5, 1fr); } }

.lp-swatch {
  border: 1px solid var(--rule-strong);
  border-radius: 8px;
  overflow: hidden;
  background: var(--canvas);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 280ms ease;
}
.lp-swatch:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 40px -22px rgba(0,0,0,0.4);
}
.lp-swatch-canvas {
  background: var(--canvas);
  padding: 0.85rem;
  height: 100px;
  display: flex;
  align-items: stretch;
}
.lp-swatch-surface {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: 5px;
  padding: 0.6rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.lp-swatch-line {
  display: block;
  height: 5px;
  border-radius: 3px;
  background: var(--ink-muted);
  opacity: 0.35;
}
.lp-swatch-line-a { width: 65%; }
.lp-swatch-line-b { width: 40%; }
.lp-swatch-dot {
  position: absolute;
  right: 0.6rem; bottom: 0.6rem;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.lp-swatch-foot {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 0.7rem 0.95rem;
  border-top: 1px solid var(--rule-strong);
  background: var(--surface);
}
.lp-swatch-label {
  font-family: 'Fraunces', serif;
  font-weight: 500;
  font-size: 0.95rem;
  color: var(--ink);
}
.lp-swatch-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: var(--ink-faint);
  text-transform: uppercase;
}

/* ─── Footer ────────────────────────────────────────────────────────── */
.lp-foot-tag {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 350;
  color: var(--ink-muted);
  font-size: 0.85rem;
}
.lp-foot-link {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--ink-muted);
  transition: color 180ms ease;
}
.lp-foot-link:hover { color: var(--accent); }
.lp-foot-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: var(--ink-faint);
  letter-spacing: 0.04em;
}
.lp-foot-meta em {
  font-family: 'Fraunces', serif;
  font-style: italic;
  color: var(--ink-muted);
}

/* ─── Reveal animation ──────────────────────────────────────────────── */
@keyframes lp-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.lp-rise {
  opacity: 0;
  animation: lp-rise 720ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
.lp-rise-1 { animation-delay: 80ms; }
.lp-rise-2 { animation-delay: 160ms; }
.lp-rise-3 { animation-delay: 280ms; }
.lp-rise-4 { animation-delay: 380ms; }
.lp-rise-5 { animation-delay: 460ms; }

/* ─── Mobile tweaks ─────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .lp-hero-card { padding: 1rem; }
  .lp-bignum { font-size: 2.4rem; }
  .lp-h1 { letter-spacing: -0.03em; }
  .lp-h2 { font-size: 1.8rem; }
  .lp-feature-body { min-height: auto; }
}
`;

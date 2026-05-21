import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import Silk from '../components/Silk';
import SakuraPetals from '../components/SakuraPetals';
import Grainient from '../components/Grainient';
import { Wordmark } from '../components/Wordmark';
import { useTranslation } from '../i18n/useTranslation';

const VALID_THEMES = ['dark', 'light', 'eris', 'gorka', 'gorka-light'];

const HOUSE_RULES = ['one', 'two', 'three'];

const CONTENTS = ['dashboard', 'accounts', 'expenses', 'income', 'budgets', 'savings', 'portfolio', 'debts', 'activity'];

const SHARED_STEPS = ['one', 'two', 'three'];

const THEME_KEYS = [
  { id: 'dark',        labelKey: 'landing.themesSection.dark.label',        subKey: 'landing.themesSection.dark.sub' },
  { id: 'light',       labelKey: 'landing.themesSection.light.label',       subKey: 'landing.themesSection.light.sub' },
  { id: 'eris',        labelKey: 'landing.themesSection.eris.label',        subKey: 'landing.themesSection.eris.sub' },
  { id: 'gorka',       labelKey: 'landing.themesSection.gorka.label',       subKey: 'landing.themesSection.gorka.sub' },
  { id: 'gorka-light', labelKey: 'landing.themesSection.gorkaLight.label',  subKey: 'landing.themesSection.gorkaLight.sub' },
];

/* ───── ornaments ────────────────────────────────────────────────────── */

function ArrowRight({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Area chart preview — mirrors LWAreaChart visual (filled gradient + line) */
function PreviewAreaChart({ className = '' }) {
  // 24 points, mildly rising with realistic wobble — same vibe as LWAreaChart
  const pts = [
    [0, 78], [8, 76], [16, 74], [24, 70], [32, 72], [40, 66],
    [48, 60], [56, 62], [64, 56], [72, 50], [80, 52], [88, 46],
    [96, 44], [104, 38], [112, 40], [120, 33], [128, 30], [136, 32],
    [144, 26], [152, 22], [160, 18], [168, 20], [176, 12], [184, 8],
  ];
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = line + ' L184,90 L0,90 Z';
  return (
    <svg viewBox="0 0 184 90" className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="lp-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* faint horizontal gridlines like LightweightCharts */}
      <g stroke="var(--rule)" strokeWidth="0.5" opacity="0.7">
        <line x1="0" y1="20" x2="184" y2="20" />
        <line x1="0" y1="45" x2="184" y2="45" />
        <line x1="0" y1="70" x2="184" y2="70" />
      </g>
      <path d={area} fill="url(#lp-area-fill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="184" cy="8" r="2.4" fill="var(--accent)" />
    </svg>
  );
}

/* tiny KPI sparkline */
function TinySpark({ className = '' }) {
  return (
    <svg viewBox="0 0 56 18" className={className} aria-hidden preserveAspectRatio="none">
      <path
        d="M1 14 L8 12 L15 13 L22 10 L29 11 L36 7 L43 6 L50 3 L55 2"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

const PERIODS = ['1M', '6M', 'YTD', '1Y', 'ALL'];

/* ───── hero artifact: a faithful preview of the Dashboard ──────────── */
function AppPreview({ t }) {
  return (
    <div className="lp-preview-stage">
      <div aria-hidden className="lp-preview-glow" />

      {/* KPI strip — three real Stat-style tiles */}
      <div className="lp-preview-kpis">
        <div className="lp-kpi">
          <span className="lp-kpi-label">{t('landing.preview.kpi1Label')}</span>
          <span className="lp-kpi-value">{t('landing.preview.kpi1Value')}</span>
          <span className="lp-kpi-delta lp-pos">↑ {t('landing.preview.kpi1Delta')}</span>
        </div>
        <div className="lp-kpi">
          <span className="lp-kpi-label">{t('landing.preview.kpi2Label')}</span>
          <span className="lp-kpi-value">{t('landing.preview.kpi2Value')}</span>
          <span className="lp-kpi-delta lp-pos">↑ {t('landing.preview.kpi2Delta')}</span>
        </div>
        <div className="lp-kpi">
          <span className="lp-kpi-label">{t('landing.preview.kpi3Label')}</span>
          <span className="lp-kpi-value">{t('landing.preview.kpi3Value')}</span>
          <span className="lp-kpi-spark"><TinySpark className="w-full h-full" /></span>
        </div>
      </div>

      {/* Net worth card — faithful to <Card eyebrow title action> + LWAreaChart */}
      <article className="lp-card">
        <header className="lp-card-head">
          <div className="lp-card-headtext">
            <p className="lp-card-eyebrow">{t('landing.preview.chartEyebrow')}</p>
            <h3 className="lp-card-title">{t('landing.preview.chartTitle')}</h3>
          </div>
          <div className="lp-card-segctl" aria-hidden>
            {PERIODS.map((p) => (
              <span key={p} className={`lp-seg ${p === '1Y' ? 'lp-seg-active' : ''}`}>{p}</span>
            ))}
          </div>
        </header>
        <div className="lp-card-body">
          <div className="lp-card-axis">
            <span>€ 48k</span>
            <span>€ 36k</span>
            <span>€ 24k</span>
          </div>
          <div className="lp-card-chart">
            <PreviewAreaChart className="w-full h-full" />
          </div>
          <div className="lp-card-xaxis">
            <span>Feb</span><span>May</span><span>Aug</span><span>Nov</span><span>Jan</span>
          </div>
        </div>
      </article>

    </div>
  );
}

/* ───── manifesto entry ──────────────────────────────────────────────── */
function HouseRule({ title, body, delay }) {
  return (
    <article className="lp-rule lp-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="lp-rule-rule" aria-hidden />
      <h3 className="lp-rule-title">{title}</h3>
      <p className="lp-rule-body">{body}</p>
    </article>
  );
}

/* ───── table of contents row ────────────────────────────────────────── */
function TocLine({ title, body, delay }) {
  return (
    <li className="lp-toc-li lp-rise" style={{ animationDelay: `${delay}ms` }}>
      <Link to="/dashboard" className="lp-toc-link">
        <div className="lp-toc-main">
          <span className="lp-toc-title">{title}</span>
        </div>
        <p className="lp-toc-body">{body}</p>
      </Link>
    </li>
  );
}

/* ───── shared (for-two) step ────────────────────────────────────────── */
function SharedNote({ title, body, delay }) {
  return (
    <article className="lp-shared lp-rise" style={{ animationDelay: `${delay}ms` }}>
      <h3 className="lp-shared-title">{title}</h3>
      <p className="lp-shared-body">{body}</p>
    </article>
  );
}

/* ───── theme swatch ─────────────────────────────────────────────────── */
function ThemeSwatch({ id, label, sub, active, onClick }) {
  return (
    <div
      className={`lp-swatch${active ? ' lp-swatch-active' : ''}`}
      data-theme={id}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
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

/* ───── page ─────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { t } = useTranslation();
  const theme = useFinanceStore((s) => s.settings?.theme);
  const setTheme = useFinanceStore((s) => s.setTheme);
  const appliedTheme = VALID_THEMES.includes(theme) ? theme : 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.body.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  return (
    <div className="min-h-screen flex flex-col" data-landing-edition="true">
      <style>{landingCss}</style>

      {appliedTheme === 'eris' && <SakuraPetals />}

      {appliedTheme === 'gorka' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#08101F' }}>
          <Silk speed={1.2} scale={1.3} color="#1E2C44" noiseIntensity={0.8} rotation={0.6} />
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

      {/* MASTHEAD ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 lp-nav">
        <div className="lp-nav-rule" aria-hidden />
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 h-14 flex items-center justify-between gap-6">
          <Link to="/landing" aria-label={t('landing.nav.home')} className="flex items-center gap-3">
            <Wordmark size="sm" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#contents" className="lp-nav-link hidden sm:inline-flex">{t('landing.nav.contents')}</a>
            <a href="#for-two"  className="lp-nav-link hidden md:inline-flex">{t('landing.nav.forTwo')}</a>
            <Link to="/login" className="lp-nav-link">{t('landing.nav.signIn')}</Link>
            <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-sm">
              <span>{t('landing.nav.openApp')}</span>
              <ArrowRight />
            </Link>
          </nav>
        </div>
        <div className="lp-nav-rule" aria-hidden />
      </header>

      <main className="flex-1">

        {/* HERO ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="lp-baseline" />
          <div aria-hidden className="lp-hero-vignette" />

          <div className="relative mx-auto max-w-[1280px] px-6 lg:px-10 pt-14 lg:pt-20 pb-24 lg:pb-32">

            <div className="grid grid-cols-12 gap-x-8 gap-y-16 items-start">

              <div className="col-span-12 lg:col-span-7 lg:pr-6">
                <h1 className="lp-rise lp-rise-2 lp-h1">
                  <span className="lp-h1-line">{t('landing.hero.h1Line1')}</span>
                  <span className="lp-h1-line lp-h1-italic">
                    <em>{t('landing.hero.h1Line2')}</em>
                  </span>
                </h1>

                <p className="lp-rise lp-rise-3 lp-lede">
                  {t('landing.hero.ledeA')}{' '}
                  {t('landing.hero.ledeB')}
                </p>

                <div className="lp-rise lp-rise-4 flex flex-wrap items-center gap-x-4 gap-y-3 pt-3">
                  <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg group">
                    <span>{t('landing.hero.openApp')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                  <Link to="/login" className="lp-btn lp-btn-rule lp-btn-lg">
                    <span>{t('landing.hero.createAccount')}</span>
                  </Link>
                </div>
              </div>

              <aside className="col-span-12 lg:col-span-5 lp-rise lp-rise-3">
                <AppPreview t={t} />
              </aside>

            </div>
          </div>
        </section>

        {/* HOUSE RULES ──────────────────────────────────────────────── */}
        <section className="lp-section lp-section-bordered">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-12">
              <div className="col-span-12 lg:col-span-4">
<h2 className="lp-h2"><span>{t('landing.manifesto.h2Line1')}</span></h2>
                <p className="lp-section-sub">{t('landing.manifesto.sub')}</p>
              </div>
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-12">
                {HOUSE_RULES.map((k, i) => (
                  <HouseRule
                    key={k}
                    title={t(`landing.manifesto.${k}.title`)}
                    body={t(`landing.manifesto.${k}.body`)}
                    delay={i * 90}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CONTENTS ─────────────────────────────────────────────────── */}
        <section id="contents" className="lp-section lp-section-bordered lp-section-alt">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-12">
              <div className="col-span-12 lg:col-span-4">
<h2 className="lp-h2"><span>{t('landing.contents.h2Line1')}</span></h2>
                <p className="lp-section-sub">{t('landing.contents.sub')}</p>
              </div>
              <ol className="col-span-12 lg:col-span-8 lp-toc">
                {CONTENTS.map((k, i) => (
                  <TocLine
                    key={k}
                    title={t(`landing.contents.${k}.title`)}
                    body={t(`landing.contents.${k}.body`)}
                    delay={i * 45}
                  />
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* FOR TWO ──────────────────────────────────────────────────── */}
        <section id="for-two" className="lp-section lp-section-bordered">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-12">
              <div className="col-span-12 lg:col-span-4">
<h2 className="lp-h2"><span>{t('landing.shared.h2Line1')}</span></h2>
                <p className="lp-section-sub">{t('landing.shared.sub')}</p>
              </div>
              <div className="col-span-12 lg:col-span-8 grid gap-x-6 gap-y-10 md:grid-cols-3 lp-shared-row">
                {SHARED_STEPS.map((k, i) => (
                  <SharedNote
                    key={k}
                    title={t(`landing.shared.${k}.title`)}
                    body={t(`landing.shared.${k}.body`)}
                    delay={i * 90}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* THEMES — a room of one's own ─────────────────────────────── */}
        <section className="lp-section lp-section-bordered lp-section-alt">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-x-8 gap-y-10">
              <div className="col-span-12 lg:col-span-4">
<h2 className="lp-h2"><span>{t('landing.themesSection.h2Line1')}</span></h2>
                <p className="lp-section-sub">{t('landing.themesSection.sub')}</p>
              </div>
              <div className="col-span-12 lg:col-span-8 lp-swatch-row">
                {THEME_KEYS.map((th) => (
                  <ThemeSwatch
                    key={th.id}
                    id={th.id}
                    label={t(th.labelKey)}
                    sub={t(th.subKey)}
                    active={appliedTheme === th.id}
                    onClick={() => setTheme(th.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CLOSING ──────────────────────────────────────────────────── */}
        <section className="lp-section-bordered">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-24 lg:py-32 text-center">
<h2 className="lp-h-closing"><span>{t('landing.closing.h1')}</span></h2>
            <p className="lp-closing-sub">{t('landing.closing.sub')}</p>
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

      {/* COLOPHON / FOOTER ──────────────────────────────────────────── */}
      <footer className="lp-colophon">
        <div className="lp-nav-rule" aria-hidden />
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 flex flex-col gap-2">
              <Wordmark size="sm" />
              <span className="lp-foot-tag">{t('landing.footer.tag')}</span>
            </div>
            <div className="md:col-span-7 flex flex-col md:items-end gap-2">
              <div className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
                <Link to="/dashboard" className="lp-foot-link">{t('landing.footer.openApp')}</Link>
                <Link to="/login" className="lp-foot-link">{t('landing.footer.signIn')}</Link>
                <a href="#contents" className="lp-foot-link">{t('landing.footer.contents')}</a>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
                <Link to="/privacy" className="lp-foot-link">Privacy</Link>
                <Link to="/terms" className="lp-foot-link">Terms</Link>
                <Link to="/contact" className="lp-foot-link">Contact</Link>
              </div>
              <p className="lp-foot-meta md:text-right">© {new Date().getFullYear()} · {t('landing.footer.meta1')}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

const landingCss = `
[data-landing-edition="true"] {
  background: var(--canvas);
  color: var(--ink);
  position: relative;
}
[data-theme='gorka'] [data-landing-edition="true"],
[data-theme='gorka-light'] [data-landing-edition="true"],
[data-theme='eris'] [data-landing-edition="true"] {
  background: transparent;
}

/* ─── Type primitives ───────────────────────────────────────────────── */
.lp-h1 {
  font-family: 'Fraunces', Georgia, serif;
  font-variation-settings: 'opsz' 144, 'SOFT' 30;
  font-weight: 380;
  font-size: clamp(2.8rem, 6vw, 5.6rem);
  line-height: 0.96;
  letter-spacing: -0.04em;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 0.04em;
  margin: 0 0 1.5rem;
}
.lp-h1-line { display: block; }
.lp-h1-italic { color: var(--ink); font-weight: 400; }
.lp-h1-italic em {
  font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 100;
  color: var(--accent);
}

.lp-lede {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 360;
  font-size: clamp(1.05rem, 1.35vw, 1.22rem);
  line-height: 1.6;
  color: var(--ink-muted);
  max-width: 60ch;
}

/* ─── Section heading ───────────────────────────────────────────────── */
.lp-section { background: var(--canvas); position: relative; }
.lp-section-alt { background: var(--surface); }
.lp-section-bordered { border-top: 1px solid var(--rule); }
.lp-section-bordered::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--rule);
  transform: translateY(3px);
  opacity: 0.5;
}

[data-theme='gorka'] .lp-section,
[data-theme='gorka'] .lp-section-alt,
[data-theme='gorka-light'] .lp-section,
[data-theme='gorka-light'] .lp-section-alt,
[data-theme='eris'] .lp-section,
[data-theme='eris'] .lp-section-alt { background: transparent; }
[data-theme='gorka'] .lp-section-alt,
[data-theme='gorka-light'] .lp-section-alt,
[data-theme='eris'] .lp-section-alt {
  background: color-mix(in srgb, var(--surface) 30%, transparent);
}

.lp-section-sub {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 360;
  font-style: italic;
  font-size: 1rem;
  color: var(--ink-muted);
  line-height: 1.6;
  margin-top: 1.2rem;
  max-width: 34ch;
}
.lp-h2 {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 400;
  font-size: clamp(2.1rem, 3.8vw, 3rem);
  line-height: 1;
  letter-spacing: -0.028em;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  margin: 0;
}
.lp-h-closing {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 380;
  font-size: clamp(2.8rem, 6vw, 5rem);
  line-height: 0.94;
  letter-spacing: -0.035em;
  color: var(--ink);
  display: inline-flex;
  flex-direction: column;
  margin: 0 auto 1rem;
}
.lp-closing-sub {
  font-family: 'Fraunces', Georgia, serif;
  font-style: italic;
  font-weight: 360;
  font-size: 1.08rem;
  color: var(--ink-muted);
  max-width: 44ch;
  margin: 0 auto;
  line-height: 1.55;
}

/* ─── Masthead ──────────────────────────────────────────────────────── */
.lp-nav {
  background: color-mix(in srgb, var(--canvas) 82%, transparent);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
}
.lp-nav-rule {
  height: 1px;
  background: var(--rule);
}
.lp-nav-rule + .lp-nav-rule,
.lp-nav > .lp-nav-rule:last-child {
  opacity: 0.4;
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
  border-radius: 4px;
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

/* ─── Hero baseline (ruled paper) ───────────────────────────────────── */
.lp-baseline {
  position: absolute; inset: 0;
  pointer-events: none;
  background-image: linear-gradient(to bottom, transparent 0, transparent calc(2.4rem - 1px), var(--rule) calc(2.4rem - 1px), var(--rule) 2.4rem);
  background-size: 100% 2.4rem;
  opacity: 0.16;
  mask-image: linear-gradient(to bottom, black 0%, black 70%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 70%, transparent 100%);
}
.lp-hero-vignette {
  position: absolute;
  inset: -10% -5% 0 -5%;
  pointer-events: none;
  background:
    radial-gradient(55% 65% at 75% 18%, var(--accent-soft) 0%, transparent 70%),
    radial-gradient(35% 45% at 12% 75%, var(--accent-soft) 0%, transparent 70%);
  filter: blur(20px);
  opacity: 0.7;
  z-index: 0;
}
[data-theme='gorka'] .lp-baseline,
[data-theme='gorka-light'] .lp-baseline,
[data-theme='eris'] .lp-baseline { display: none; }

/* ─── App preview (faithful Dashboard mock) ──────────────────────────── */
.lp-preview-stage {
  position: relative;
  padding: 1rem 0.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.lp-preview-glow {
  position: absolute;
  inset: 5% -5% 5% -5%;
  z-index: -1;
  background:
    radial-gradient(60% 60% at 70% 30%, var(--accent-soft) 0%, transparent 65%),
    radial-gradient(40% 45% at 20% 75%, var(--accent-soft) 0%, transparent 70%);
  filter: blur(28px);
  opacity: 0.85;
}

/* KPI strip */
.lp-preview-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}
.lp-kpi {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 0.65rem 0.8rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}
.lp-kpi-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.lp-kpi-value {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 96;
  font-weight: 500;
  font-size: clamp(1.1rem, 1.6vw, 1.35rem);
  color: var(--ink);
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.lp-kpi-delta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.lp-kpi-delta.lp-pos { color: var(--positive); }
.lp-kpi-spark {
  display: block;
  height: 12px;
  color: var(--accent);
  margin-top: 0.05rem;
}

/* Main card (mirrors <Card> component shell) */
.lp-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 30px 60px -32px rgba(0,0,0,0.45);
  transition: transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 380ms ease;
}
.lp-card:hover { transform: translateY(-2px); box-shadow: 0 36px 72px -28px rgba(0,0,0,0.55); }

.lp-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 0.95rem 1.05rem 0.85rem;
  border-bottom: 1px solid var(--rule);
}
.lp-card-headtext { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.lp-card-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0;
}
.lp-card-title {
  font-family: 'Fraunces', serif;
  font-weight: 500;
  font-size: 1.18rem;
  letter-spacing: -0.012em;
  color: var(--ink);
  margin: 0.1rem 0 0;
  line-height: 1.1;
}

/* segmented period control */
.lp-card-segctl {
  display: inline-flex;
  border: 1px solid var(--rule);
  background: var(--canvas);
  border-radius: 6px;
  padding: 2px;
  gap: 1px;
  flex-shrink: 0;
}
.lp-seg {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-faint);
  padding: 0.22rem 0.42rem;
  border-radius: 4px;
  line-height: 1;
}
.lp-seg-active {
  background: var(--accent);
  color: var(--accent-ink);
}

.lp-card-body {
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  grid-template-rows: 1fr auto;
  gap: 0.35rem 0.4rem;
  padding: 0.85rem 1.05rem 0.8rem;
  min-height: 170px;
}
.lp-card-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
  padding: 2px 0 14px;
  text-align: right;
}
.lp-card-chart {
  height: 100%;
  min-height: 130px;
}
.lp-card-xaxis {
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
  text-transform: uppercase;
  padding-top: 0.15rem;
  border-top: 1px solid var(--rule);
  margin-top: 0.25rem;
}

@media (max-width: 480px) {
  .lp-preview-kpis { grid-template-columns: 1fr 1fr; }
  .lp-preview-kpis .lp-kpi:nth-child(3) { grid-column: span 2; }
  .lp-card-segctl .lp-seg:nth-child(1),
  .lp-card-segctl .lp-seg:nth-child(2) { display: none; }
}

/* ─── House rules (manifesto) ──────────────────────────────────────── */
.lp-rule {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 1.6rem;
}
.lp-rule-rule {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--rule-strong);
}
.lp-rule-title {
  font-family: 'Fraunces', serif;
  font-weight: 420;
  font-size: clamp(1.5rem, 2.4vw, 2rem);
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 0;
}
.lp-rule-body {
  font-family: 'Fraunces', serif;
  font-weight: 360;
  font-size: 1.02rem;
  line-height: 1.65;
  color: var(--ink-muted);
  max-width: 60ch;
  margin: 0;
}
.lp-rule-body em { color: var(--ink); font-style: italic; }

/* ─── Table of Contents ────────────────────────────────────────────── */
.lp-toc {
  list-style: none;
  margin: 0; padding: 0;
  border-top: 1px solid var(--rule-strong);
}
.lp-toc-li {
  border-bottom: 1px solid var(--rule);
  position: relative;
}
.lp-toc-link {
  display: block;
  padding: 1.2rem 0.4rem;
  text-decoration: none;
  color: inherit;
  transition: background 220ms ease, padding 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.lp-toc-link:hover {
  background: color-mix(in srgb, var(--accent-soft) 70%, transparent);
  padding-left: 1rem;
}
.lp-toc-main {
  display: flex;
  align-items: baseline;
}
.lp-toc-title {
  font-family: 'Fraunces', serif;
  font-weight: 420;
  font-size: clamp(1.25rem, 1.9vw, 1.55rem);
  letter-spacing: -0.012em;
  color: var(--ink);
  transition: color 200ms ease;
}
.lp-toc-link:hover .lp-toc-title { color: var(--accent); }

.lp-toc-body {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 360;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--ink-muted);
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 240ms ease, margin 240ms ease;
  margin: 0;
  max-width: 64ch;
}
.lp-toc-link:hover .lp-toc-body,
.lp-toc-link:focus .lp-toc-body {
  max-height: 120px;
  opacity: 1;
  margin-top: 0.55rem;
}

/* ─── For two ──────────────────────────────────────────────────────── */
.lp-shared-row { position: relative; }
.lp-shared {
  position: relative;
  padding-top: 1.4rem;
  border-top: 1px solid var(--rule-strong);
}
.lp-shared-title {
  font-family: 'Fraunces', serif;
  font-weight: 420;
  font-size: 1.4rem;
  line-height: 1.15;
  letter-spacing: -0.014em;
  color: var(--ink);
  margin: 0 0 0.55rem;
}
.lp-shared-body {
  font-family: 'Fraunces', serif;
  font-weight: 360;
  font-size: 0.98rem;
  line-height: 1.62;
  color: var(--ink-muted);
  margin: 0;
}

/* ─── Theme swatches ───────────────────────────────────────────────── */
.lp-swatch-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
@media (min-width: 720px) { .lp-swatch-row { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .lp-swatch-row { grid-template-columns: repeat(5, 1fr); } }

.lp-swatch {
  border: 1px solid var(--rule-strong);
  border-radius: 6px;
  overflow: hidden;
  background: var(--canvas);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 280ms ease, border-color 180ms ease;
  cursor: pointer;
}
.lp-swatch:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 40px -22px rgba(0,0,0,0.4);
}
.lp-swatch-active {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
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
  border-radius: 4px;
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

/* ─── Colophon / Footer ────────────────────────────────────────────── */
.lp-colophon { background: var(--canvas); position: relative; }
[data-theme='gorka'] .lp-colophon,
[data-theme='gorka-light'] .lp-colophon,
[data-theme='eris'] .lp-colophon { background: transparent; }

.lp-foot-tag {
  font-family: 'Fraunces', serif;
  font-weight: 360;
  color: var(--ink-muted);
  font-size: 0.92rem;
  line-height: 1.4;
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
  font-size: 0.68rem;
  color: var(--ink-faint);
  letter-spacing: 0.06em;
  margin-top: 0.4rem;
}

/* ─── Reveal animation ─────────────────────────────────────────────── */
@keyframes lp-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.lp-rise {
  opacity: 0;
  animation: lp-rise 720ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
.lp-rise-1 { animation-delay: 80ms; }
.lp-rise-2 { animation-delay: 200ms; }
.lp-rise-3 { animation-delay: 340ms; }
.lp-rise-4 { animation-delay: 460ms; }
.lp-rise-5 { animation-delay: 580ms; }

@media (prefers-reduced-motion: reduce) {
  .lp-rise { animation: none; opacity: 1; }
}

/* ─── Mobile tweaks ────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .lp-h1 { letter-spacing: -0.032em; }
}
`;

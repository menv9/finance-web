import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { UserCircle } from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { Modal } from './ui';
import { cn } from './ui/cn';
import { ExpenseForm } from './forms/ExpenseForm';
import { IncomeForm } from './forms/IncomeForm';
import Silk from './Silk';
import SakuraPetals from './SakuraPetals';
import Grainient from './Grainient';
import { TourProvider } from './tour/TourContext';
import { TourSpotlight } from './tour/TourSpotlight';
import { useAlert } from './ConfirmContext';
import { LITE_PATHS } from '../utils/appMode';
import { Wordmark } from './Wordmark';
import { useTranslation } from '../i18n/useTranslation';

const NAV_GROUPS = [
  { kind: 'link', to: '/dashboard', labelKey: 'nav.overview' },
  { kind: 'link', to: '/this-month', labelKey: 'nav.month' },
  {
    kind: 'menu',
    id: 'money',
    labelKey: 'nav.money',
    items: [
      { to: '/accounts', labelKey: 'nav.accounts' },
      { to: '/debts', labelKey: 'nav.debts' },
      { to: '/expenses', labelKey: 'nav.expenses' },
      { to: '/income', labelKey: 'nav.income' },
    ],
  },
  {
    kind: 'menu',
    id: 'planning',
    labelKey: 'nav.planning',
    items: [
      { to: '/budgets', labelKey: 'nav.budgets' },
      { to: '/savings', labelKey: 'nav.savings' },
    ],
  },
  {
    kind: 'menu',
    id: 'investing',
    labelKey: 'nav.investing',
    module: 'portfolio',
    items: [
      { to: '/portfolio', labelKey: 'nav.portfolio', module: 'portfolio' },
      { to: '/portfolio/platforms', labelKey: 'nav.platforms', module: 'portfolio' },
    ],
  },
];

const MORE_LINKS = [
  { to: '/accounts', labelKey: 'nav.accounts' },
  { to: '/debts', labelKey: 'nav.debts' },
  { to: '/income', labelKey: 'nav.income' },
  { to: '/expenses', labelKey: 'nav.expenses' },
  { to: '/budgets', labelKey: 'nav.budgets' },
  { to: '/savings', labelKey: 'nav.savings' },
  { to: '/portfolio', labelKey: 'nav.portfolio', module: 'portfolio' },
  { to: '/portfolio/platforms', labelKey: 'nav.platforms', module: 'portfolio' },
  { to: '/settings', labelKey: 'nav.settings' },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle cx="10" cy="10" r="3.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d="M14.5 12.8A6.2 6.2 0 1 1 7.2 5.5a5 5 0 0 0 7.3 7.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d="M10 2c.3 2.7 1.3 4.6 3 5.6 1.7 1 3.3 1.4 5 1.4-2.7.4-4.6 1.4-5.6 3-1 1.7-1.4 3.3-1.4 5-.4-2.7-1.4-4.6-3-5.6-1.7-1-3.3-1.4-5-1.4 2.7-.4 4.6-1.4 5.6-3 1-1.7 1.4-3.3 1.4-5z"
        fill="currentColor"
      />
    </svg>
  );
}

function DiscIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle cx="10" cy="10" r="7" fill="currentColor" opacity="0.85" />
      <circle cx="7.5" cy="7.5" r="2.2" fill="white" opacity="0.55" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function NewspaperIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7.5h6M5.5 10h6M5.5 12.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="12.5" y="7.5" width="2.5" height="2.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

const THEME_OPTIONS = [
  { value: 'dark',        labelKey: 'theme.dark.label',       hintKey: 'theme.dark.hint',       Icon: MoonIcon },
  { value: 'light',       labelKey: 'theme.light.label',      hintKey: 'theme.light.hint',      Icon: SunIcon },
  { value: 'eris',        labelKey: 'theme.eris.label',       hintKey: 'theme.eris.hint',       Icon: SparkleIcon },
  { value: 'gorka',       labelKey: 'theme.gorka.label',      hintKey: 'theme.gorka.hint',      Icon: DiscIcon },
  { value: 'gorka-light', labelKey: 'theme.gorkaLight.label', hintKey: 'theme.gorkaLight.hint', Icon: NewspaperIcon },
];

function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      {open ? (
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Logo({ to = '/dashboard' }) {
  return (
    <NavLink to={to} className="flex items-center group" aria-label="FinGes">
      <Wordmark size="md" />
    </NavLink>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 15l3-5-3-5" />
      <path d="M16 10H7" />
      <path d="M7 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M16.2 11.5a6.6 6.6 0 0 0 0-3l1.4-1.1-1.7-2.8-1.7.7a6.4 6.4 0 0 0-2.6-1.5L11.4 2H8.6l-.3 1.8a6.4 6.4 0 0 0-2.5 1.5l-1.7-.7-1.7 2.8 1.4 1.1a6.6 6.6 0 0 0 0 3l-1.4 1.1 1.7 2.8 1.7-.7a6.4 6.4 0 0 0 2.5 1.5l.3 1.8h2.8l.3-1.8a6.4 6.4 0 0 0 2.6-1.5l1.7.7 1.7-2.8-1.5-1.1Z" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <circle cx="10" cy="10" r="2" />
      <path d="M5.5 8v0M14.5 12v0" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 10 5l6 6.5" />
      <path d="M6 10v6h8v-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
      <path d="M7 3v3M13 3v3M3.5 8h13" />
    </svg>
  );
}

function MonthOverview({ metrics, baseCurrency, locale, t }) {
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date()),
    [locale],
  );
  const income = Math.max(metrics.totalIncomeCents || 0, 0);
  const expenses = Math.max(metrics.totalExpensesCents || 0, 0);
  const net = (metrics.totalIncomeCents || 0) - (metrics.totalExpensesCents || 0);
  const ratio = income > 0 ? Math.min(expenses / income, 1) : 0;
  const netPositive = net >= 0;

  return (
    <section
      aria-label={t('shell.monthOverview.ariaLabel')}
      className="flex shrink-0 flex-col gap-4 border-b border-rule px-5 py-5"
    >
      <div className="flex flex-col gap-0.5">
        <span className="eyebrow text-[0.6rem] text-ink-muted">{t('shell.monthOverview.thisMonth')}</span>
        <span className="font-display text-base text-ink leading-tight">{monthLabel}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow text-[0.55rem] text-ink-faint">{t('shell.monthOverview.netCashflow')}</span>
        <span
          className={cn(
            'numeric text-2xl leading-none',
            netPositive ? 'text-positive' : 'text-danger',
          )}
        >
          {netPositive ? '+' : '−'}
          {formatCurrency(Math.abs(net), baseCurrency, locale)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full bg-danger transition-[width] duration-300"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[0.7rem]">
          <div className="flex flex-col">
            <span className="eyebrow text-[0.55rem] text-ink-faint">{t('shell.monthOverview.income')}</span>
            <span className="numeric text-positive">
              {formatCurrency(income, baseCurrency, locale)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="eyebrow text-[0.55rem] text-ink-faint">{t('shell.monthOverview.spent')}</span>
            <span className="numeric text-danger">
              {formatCurrency(expenses, baseCurrency, locale)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useFinanceStore((state) => state.settings.theme);
  const settings = useFinanceStore((state) => state.settings);
  const toggleTheme = useFinanceStore((state) => state.toggleTheme);
  const setTheme = useFinanceStore((state) => state.setTheme);
  const metrics = useFinanceStore((state) => state.derived.dashboard);
  const bankAccounts = useFinanceStore((state) => state.bankAccounts || []);
  const debts = useFinanceStore((state) => state.debts || []);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const uploadAttachment = useFinanceStore((state) => state.uploadAttachment);
  const supabaseUser = useFinanceStore((state) => state.supabaseUser);
  const supabaseConfigured = useFinanceStore((state) => state.supabaseConfigured);
  const supabaseSyncStatus = useFinanceStore((state) => state.supabaseSyncStatus);
  const supabaseError = useFinanceStore((state) => state.supabaseError);
  const conflicts = useFinanceStore((state) => state.syncMeta.conflicts);
  const profile = useFinanceStore((state) => state.profile);
  const appMode = useFinanceStore((state) => state.appMode);
  const setAppMode = useFinanceStore((state) => state.setAppMode);
  const signOutSupabase = useFinanceStore((state) => state.signOutSupabase);
  const hideAmounts = useFinanceStore((state) => state.hideAmounts);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const alert = useAlert();
  const { t, locale } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsHover, setSettingsHover] = useState(false);
  const baseCurrency = settings.baseCurrency;
  const moduleVisible = useMemo(
    () => (item) => {
      if (item.module === 'portfolio' && settings.modules?.portfolio === false) return false;
      if (item.module === 'social' && settings.modules?.social === false) return false;
      return true;
    },
    [settings.modules?.portfolio, settings.modules?.social],
  );
  const isLite = appMode === 'lite';
  const handleAppModeChange = (mode) => {
    if (mode === appMode) return;
    setAppMode(mode);
    if (mode === 'pro') navigate('/dashboard');
    else navigate('/today');
  };
  const navGroups = useMemo(
    () => {
      if (isLite) {
        return [
          { kind: 'link', to: '/today',    labelKey: 'nav.today' },
          { kind: 'link', to: '/expenses', labelKey: 'nav.expenses' },
          { kind: 'link', to: '/income',   labelKey: 'nav.income' },
        ].filter(moduleVisible);
      }
      return NAV_GROUPS
        .filter(moduleVisible)
        .map((group) => (group.items ? { ...group, items: group.items.filter(moduleVisible) } : group))
        .filter((group) => group.kind !== 'menu' || group.items.length);
    },
    [moduleVisible, isLite],
  );
  const moreLinks = useMemo(
    () => (isLite
      ? MORE_LINKS.filter((link) => LITE_PATHS.has(link.to))
      : MORE_LINKS.filter(moduleVisible)),
    [moduleVisible, isLite],
  );

  const emailHandle = supabaseUser?.email?.split('@')[0] ?? null;
  const userHandle = profile?.display_name || profile?.username || emailHandle;

  const isEris = supabaseUser?.email === 'erisbarrancop@gmail.com';
  const isGorka = supabaseUser?.email === 'gorkaaamendiola@gmail.com';
  const isPrivileged = isEris || isGorka;

  // One-time auto-init: when a special user logs in for the first time on this device,
  // save their theme so 'dark' and 'light' remain explicitly selectable afterward.
  useEffect(() => {
    if (!isEris && !isGorka) return;
    const userId = supabaseUser?.id;
    if (!userId) return;
    const storageKey = `pft-theme-identity-set-${userId}`;
    if (localStorage.getItem(storageKey)) return;
    if (isEris) setTheme('eris');
    else if (isGorka) setTheme('gorka');
    localStorage.setItem(storageKey, '1');
  }, [isEris, isGorka, supabaseUser?.id, setTheme]);

  // Simple: theme value is applied directly. No mapping.
  const appliedTheme = ['dark', 'light', 'eris', 'gorka', 'gorka-light'].includes(theme) ? theme : 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.body.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  // Edge-swipe gesture: swipe left from right edge to open, swipe right inside
  // panel to close. Ignored on wide viewports where the panel isn't shown.
  useEffect(() => {
    const EDGE = 64;        // open: start zone, px from right edge
    const PANEL_W = 288;    // close: panel width (w-72), track swipes within it
    const TRIGGER = 50;     // min horizontal delta to count as a swipe
    const Y_TOL = 60;       // max vertical drift; more = treat as scroll, skip
    let startX = null;
    let startY = null;

    const onStart = (e) => {
      if (window.innerWidth >= 1024) return;
      const t = e.touches[0];
      if (!t) return;
      if (!mobileOpen && t.clientX >= window.innerWidth - EDGE) {
        startX = t.clientX; startY = t.clientY;          // candidate open
      } else if (mobileOpen && t.clientX >= window.innerWidth - PANEL_W) {
        startX = t.clientX; startY = t.clientY;          // candidate close
      }
    };
    const onEnd = (e) => {
      if (startX == null) return;
      const t = e.changedTouches[0];
      if (!t) { startX = null; return; }
      const dx = startX - t.clientX;                     // +left  −right
      const dy = Math.abs(startY - t.clientY);
      startX = null; startY = null;
      if (dy >= Y_TOL) return;                           // too vertical
      if (!mobileOpen && dx > TRIGGER)  setMobileOpen(true);
      if (mobileOpen  && dx < -TRIGGER) setMobileOpen(false);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend',   onEnd);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setOpenNavMenu(null);
    setAddMenuOpen(false);
    setThemeMenuOpen(false);
    setProfileMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!openNavMenu && !addMenuOpen && !themeMenuOpen && !profileMenuOpen) return undefined;
    const closeMenus = () => {
      setOpenNavMenu(null);
      setAddMenuOpen(false);
      setThemeMenuOpen(false);
      setProfileMenuOpen(false);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, [openNavMenu, addMenuOpen, themeMenuOpen, profileMenuOpen]);

  useEffect(() => {
    const openEntryModal = (event) => {
      if (event.detail === 'income') setIncomeModalOpen(true);
      else setExpenseModalOpen(true);
    };
    window.addEventListener('finance:open-entry-modal', openEntryModal);
    return () => window.removeEventListener('finance:open-entry-modal', openEntryModal);
  }, []);

  return (
    <TourProvider>
    <div className="min-h-screen">
      {/* Eris: falling sakura petals */}
      {appliedTheme === 'eris' && <SakuraPetals />}

      {/* Gorka dark: full-page silk background */}
      {appliedTheme === 'gorka' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#08101F' }}>
          <Silk
            speed={1.2}
            scale={1.3}
            color="#1E2C44"
            noiseIntensity={0.8}
            rotation={0.6}
          />
        </div>
      )}

      {/* Gorka light: grainient + wrinkled paper overlay */}
      {appliedTheme === 'gorka-light' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#EDE5CF' }}>
          <Grainient
            color1="#F2E8CA"
            color2="#DBBE93"
            color3="#E8D8B2"
            timeSpeed={0.07}
            warpStrength={0.5}
            warpFrequency={3.0}
            warpSpeed={0.6}
            warpAmplitude={90.0}
            blendAngle={20.0}
            blendSoftness={0.18}
            rotationAmount={160.0}
            noiseScale={1.4}
            grainAmount={0.04}
            grainScale={3.0}
            contrast={1.05}
            gamma={1.0}
            saturation={0.75}
            zoom={1.05}
          />
          {/* SVG wrinkle: fractal noise treated as a bump map, lit from upper-left.
              multiply blend darkens the "valleys" of the crumpled surface. */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.13 }}
          >
            <defs>
              <filter id="paper-wrinkle" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.032 0.048" numOctaves="5" seed="11" result="noise" />
                <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1.2" result="light">
                  <feDistantLight azimuth="38" elevation="52" />
                </feDiffuseLighting>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#paper-wrinkle)" />
          </svg>
        </div>
      )}

      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-accent-ink"
      >
        {t('nav.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-wide grid-cols-[1fr_auto_1fr] items-center gap-6 pl-4 pr-5 lg:px-10">
          <div className="col-start-1 flex min-w-0 items-center justify-start gap-6">
            <Logo to={isLite ? '/today' : '/dashboard'} />
          </div>

          <nav aria-label={t('nav.primary')} className="col-start-2 hidden justify-center lg:flex items-center gap-1">
            {navGroups.map((group) => {
              if (group.kind === 'link') {
                return (
                  <NavLink
                    key={group.to}
                    to={group.to}
                    className={({ isActive }) =>
                      cn(
                        'group relative inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors duration-180',
                        isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                      )
                    }
                  >
                    {t(group.labelKey)}
                  </NavLink>
                );
              }
              const isActive = group.items.some((item) => item.to === location.pathname);
              const isOpen = openNavMenu === group.id;
              return (
                <div key={group.id} className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setOpenNavMenu((current) => (current === group.id ? null : group.id))}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors duration-180',
                      isActive || isOpen ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                    )}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                  >
                    {t(group.labelKey)}
                    <ChevronIcon />
                  </button>
                  {isOpen ? (
                    <div className="absolute left-1/2 top-11 z-40 w-44 -translate-x-1/2 rounded-lg border border-rule bg-surface p-1 shadow-lift">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive: itemActive }) =>
                            cn(
                              'flex min-w-0 items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-150',
                              itemActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                            )
                          }
                        >
                          <span>{t(item.labelKey)}</span>
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="col-start-3 flex items-center justify-end gap-3">
            <div className="relative hidden md:block" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setAddMenuOpen((current) => !current)}
                aria-label={t('nav.addTransaction')}
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink transition-colors duration-180 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <PlusIcon />
                <span>{t('common.add')}</span>
              </button>
              {addMenuOpen ? (
                <div className="absolute right-0 top-11 z-40 w-48 rounded-lg border border-rule bg-surface p-1 shadow-lift">
                  <button
                    type="button"
                    onClick={() => { setExpenseModalOpen(true); setAddMenuOpen(false); }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                  >
                    <span>{t('nav.newExpense')}</span>
                    <span className="text-danger">↓</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIncomeModalOpen(true); setAddMenuOpen(false); }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                  >
                    <span>{t('nav.newIncome')}</span>
                    <span className="text-positive">↑</span>
                  </button>
                </div>
              ) : null}
            </div>
            <div className="hidden lg:flex items-center gap-4 border-l border-rule pl-4">
              <div className="flex flex-col items-end">
                <span className="eyebrow text-[0.6rem] text-ink-muted leading-none mb-0.5 whitespace-nowrap">{t('shell.header.totalBalance')}</span>
                <span className="numeric text-sm text-ink leading-none">
                  {hideAmounts ? '••••' : formatCurrency(metrics.availableBalanceCents, baseCurrency, locale)}
                </span>
              </div>
              {metrics.totalDebtCents > 0 && (
                <div className="flex flex-col items-end border-l border-rule pl-4">
                  <span className="eyebrow text-[0.6rem] text-ink-muted leading-none mb-0.5">{t('shell.header.debt')}</span>
                  <span className="numeric text-sm text-danger leading-none">
                    {hideAmounts ? '••••' : formatCurrency(metrics.totalDebtCents, baseCurrency, locale)}
                  </span>
                </div>
              )}
            </div>

            <div
              role="group"
              aria-label={t('shell.workspace.groupLabel')}
              className="hidden sm:inline-flex items-center rounded-full border border-rule-strong p-0.5 text-[0.65rem] eyebrow"
            >
              {[
                { id: 'pro',  label: t('shell.workspace.pro'),  hint: t('shell.workspace.proHint') },
                { id: 'lite', label: t('shell.workspace.lite'), hint: t('shell.workspace.liteHint') },
              ].map((opt) => {
                const active = appMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleAppModeChange(opt.id)}
                    aria-pressed={active}
                    title={opt.hint}
                    className={cn(
                      'inline-flex h-7 items-center px-2.5 rounded-full transition-colors duration-150',
                      active ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Profile dropdown */}
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-label={t('nav.profile')}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted transition-colors duration-180 hover:text-ink hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <UserCircle className="h-4 w-4" />
              </button>
              {profileMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-11 z-40 w-52 rounded-lg border border-rule bg-surface p-1 shadow-lift"
                >
                  {supabaseUser && (
                    <div className="px-3 py-2 border-b border-rule mb-1">
                      <p className="text-sm text-ink truncate">{userHandle}</p>
                      <p className="eyebrow text-[0.6rem] text-ink-faint truncate">{supabaseUser.email}</p>
                    </div>
                  )}
                  <NavLink
                    to="/profile"
                    role="menuitem"
                    className={({ isActive }) => cn(
                      'flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150',
                      isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                    )}
                  >
                    {t('nav.profile')}
                  </NavLink>
                  {settings.modules?.social !== false && (
                    <>
                      <NavLink
                        to="/activity"
                        role="menuitem"
                        className={({ isActive }) => cn(
                          'flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150',
                          isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                        )}
                      >
                        {t('nav.activity')}
                      </NavLink>
                      <NavLink
                        to="/friends"
                        role="menuitem"
                        className={({ isActive }) => cn(
                          'flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150',
                          isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                        )}
                      >
                        {t('nav.friends')}
                      </NavLink>
                      <NavLink
                        to="/friends/money"
                        role="menuitem"
                        className={({ isActive }) => cn(
                          'flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150',
                          isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                        )}
                      >
                        {t('nav.friendsMoney')}
                      </NavLink>
                    </>
                  )}
                  {settings.modules?.coingame !== false && (
                    <NavLink
                      to="/coingame"
                      role="menuitem"
                      className={({ isActive }) => cn(
                        'flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150',
                        isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                      )}
                    >
                      {t('nav.coingame')}
                    </NavLink>
                  )}
                  {profile?.is_admin && (
                    <NavLink
                      to="/admin"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className={({ isActive }) => cn(
                        'flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150',
                        isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                      )}
                    >
                      Admin
                    </NavLink>
                  )}
                  {supabaseConfigured && supabaseUser && (
                    <div className="border-t border-rule mt-1 pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setProfileMenuOpen(false); signOutSupabase(); }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-danger"
                      >
                        <SignOutIcon />
                        <span>{t('common.signOut')}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative" onClick={(event) => event.stopPropagation()}>
              {(() => {
                const ActiveIcon = (THEME_OPTIONS.find((o) => o.value === appliedTheme)?.Icon) || SunIcon;
                return (
                  <button
                    type="button"
                    onClick={() => setThemeMenuOpen((v) => !v)}
                    aria-label={t('theme.menuLabel')}
                    aria-haspopup="menu"
                    aria-expanded={themeMenuOpen}
                    title={t('theme.title')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted transition-colors duration-180 hover:text-ink hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <ActiveIcon />
                  </button>
                );
              })()}
              {themeMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-11 z-40 w-52 rounded-lg border border-rule bg-surface p-1 shadow-lift"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const active = appliedTheme === opt.value;
                    const OptIcon = opt.Icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => { setTheme(opt.value); setThemeMenuOpen(false); }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150',
                          active ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                        )}
                      >
                        <span className={active ? 'text-accent' : 'text-ink-faint'}><OptIcon /></span>
                        <span className="flex flex-col leading-tight min-w-0">
                          <span className="truncate">{t(opt.labelKey)}</span>
                          <span className="eyebrow text-[0.55rem] text-ink-faint truncate">{t(opt.hintKey)}</span>
                        </span>
                        {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div
              className="relative hidden sm:block"
              onMouseEnter={() => setSettingsHover(true)}
              onMouseLeave={() => setSettingsHover(false)}
            >
              <NavLink
                to="/settings"
                aria-label={t('nav.settings')}
                title={t('nav.settings')}
                className={({ isActive }) =>
                  cn(
                    'relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong transition-colors duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                    isActive ? 'text-ink border-ink-faint bg-surface-raised' : 'text-ink-muted hover:text-ink hover:border-ink-faint',
                  )
                }
              >
                <SettingsIcon />
                {(conflicts.length > 0 || supabaseSyncStatus === 'error') && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger border-2 border-canvas" />
                )}
              </NavLink>
              {settingsHover && (
                <div className="hidden lg:block absolute right-0 top-9 pt-1.5 z-40">
                  <div className="w-48 rounded-lg border border-rule bg-surface shadow-lift p-3 grid gap-3">
                    <p className="eyebrow text-[0.6rem] text-ink-faint">Modules</p>
                    {[
                      { key: 'portfolio', label: t('settings.modules.portfolio') },
                      { key: 'social',    label: t('settings.modules.social') },
                    ].map(({ key, label }) => {
                      const enabled = settings.modules?.[key] !== false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateSettings({ modules: { ...(settings.modules || {}), [key]: !enabled } })}
                          className="flex items-center justify-between gap-3 text-sm text-ink-muted hover:text-ink transition-colors duration-150"
                        >
                          <span>{label}</span>
                          <span className={cn(
                            'relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors duration-180',
                            enabled ? 'bg-accent border-accent' : 'bg-surface-raised border-rule-strong',
                          )}>
                            <span className={cn(
                              'absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-180',
                              enabled ? 'translate-x-3' : 'translate-x-0',
                            )} />
                          </span>
                        </button>
                      );
                    })}
                    <div className="border-t border-rule pt-2 grid gap-1.5">
                      <p className="eyebrow text-[0.6rem] text-ink-faint">Language</p>
                      <div className="flex rounded-md border border-rule p-0.5 bg-surface-raised">
                        {['en', 'es'].map((lang) => {
                          const active = (settings.language || 'en') === lang;
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => updateSettings({ language: lang })}
                              className={cn(
                                'flex-1 rounded px-2 py-1 text-xs transition-colors duration-150',
                                active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                              )}
                            >
                              {lang.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileOpen}
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

      </header>

      {/* ── Mobile drawer — fixed right-side panel ─────────────────────────── */}
      {/* Backdrop: fades in/out, click-to-close */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden
        onClick={() => setMobileOpen(false)}
      />
      {/* Panel: slides in from right */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.navigationMenu')}
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-rule bg-surface shadow-2xl transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Panel header row */}
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <Logo to={isLite ? '/today' : '/dashboard'} />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MenuIcon open />
          </button>
        </div>
        {/* Body: 50% month overview / 50% nav links */}
        <div className="flex flex-1 min-h-0 flex-col">
          <MonthOverview
            metrics={metrics}
            baseCurrency={baseCurrency}
            locale={locale}
            t={t}
          />
          <nav aria-label={t('nav.primaryMobile')} className="flex flex-1 min-h-0 flex-col overflow-y-auto px-3 py-3">
            {moreLinks.map((link) => {
              const isSettings = link.to === '/settings';
              const showBadge = isSettings && (conflicts.length > 0 || supabaseSyncStatus === 'error');
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 border-b border-rule last:border-b-0 transition-colors duration-120',
                      isActive ? 'text-ink' : 'text-ink-muted',
                    )
                  }
                >
                  <span className="font-display text-lg">{t(link.labelKey)}</span>
                  {showBadge && (
                    <span className="h-2 w-2 rounded-full bg-danger" />
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
        {/* Panel footer: balance + debt + sign-out */}
        <div className="border-t border-rule px-4 py-4 grid gap-3">
          <div
            role="group"
            aria-label={t('shell.workspace.groupLabel')}
            className="inline-flex w-max items-center rounded-full border border-rule-strong p-0.5 text-[0.65rem] eyebrow"
          >
            {[
              { id: 'pro',  label: t('shell.workspace.pro') },
              { id: 'lite', label: t('shell.workspace.lite') },
            ].map((opt) => {
              const active = appMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleAppModeChange(opt.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-7 items-center px-3 rounded-full transition-colors duration-150',
                    active ? 'bg-surface-raised text-ink' : 'text-ink-muted',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-end gap-4 min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="eyebrow text-[0.6rem] text-ink-muted">{t('shell.header.totalBalance')}</span>
                <span className="numeric text-sm text-ink truncate">
                  {hideAmounts ? '••••' : formatCurrency(metrics.availableBalanceCents, baseCurrency, locale)}
                </span>
              </div>
              {metrics.totalDebtCents > 0 && (
                <div className="flex flex-col gap-0.5 min-w-0 border-l border-rule pl-4">
                  <span className="eyebrow text-[0.6rem] text-ink-muted">{t('shell.header.debt')}</span>
                  <span className="numeric text-sm text-danger truncate">
                    {hideAmounts ? '••••' : formatCurrency(metrics.totalDebtCents, baseCurrency, locale)}
                  </span>
                </div>
              )}
            </div>
            {supabaseConfigured && supabaseUser && (
              <button
                type="button"
                onClick={() => { setMobileOpen(false); signOutSupabase(); }}
                className="flex shrink-0 items-center gap-1.5 text-xs text-ink-faint hover:text-danger transition-colors duration-180"
              >
                <SignOutIcon />
                <span className="eyebrow text-[0.6rem]">{t('common.signOut')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label={t('nav.mobileShortcuts')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-canvas/95 px-3 py-2 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center gap-1">
          {isLite ? (
            <>
              <NavLink
                to="/today"
                className={({ isActive }) =>
                  cn(
                    'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
                    isActive ? 'text-ink bg-surface-raised' : 'text-ink-muted',
                  )
                }
              >
                <DashboardIcon />
                <span>{t('nav.today')}</span>
              </NavLink>
              <NavLink
                to="/expenses"
                className={({ isActive }) =>
                  cn(
                    'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
                    isActive ? 'text-ink bg-surface-raised' : 'text-ink-muted',
                  )
                }
              >
                <span aria-hidden className="text-danger text-base leading-none">↓</span>
                <span>{t('nav.expenses')}</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
                    isActive ? 'text-ink bg-surface-raised' : 'text-ink-muted',
                  )
                }
              >
                <DashboardIcon />
                <span>{t('nav.home')}</span>
              </NavLink>
              <NavLink
                to="/this-month"
                className={({ isActive }) =>
                  cn(
                    'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
                    isActive ? 'text-ink bg-surface-raised' : 'text-ink-muted',
                  )
                }
              >
                <CalendarIcon />
                <span>{t('nav.month')}</span>
              </NavLink>
            </>
          )}
          <button
            type="button"
            onClick={() => setExpenseModalOpen(true)}
            aria-label={t('nav.addExpense')}
            className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-card transition-colors duration-150 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <PlusIcon />
          </button>
          {isLite ? (
            <NavLink
              to="/income"
              className={({ isActive }) =>
                cn(
                  'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
                  isActive ? 'text-ink bg-surface-raised' : 'text-ink-muted',
                )
              }
            >
              <span aria-hidden className="text-positive text-base leading-none">↑</span>
              <span>{t('nav.income')}</span>
            </NavLink>
          ) : (
            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                cn(
                  'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
                  isActive ? 'text-ink bg-surface-raised' : 'text-ink-muted',
                )
              }
            >
              <MoneyIcon />
              <span>{t('nav.money')}</span>
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? t('nav.closeMore') : t('nav.openMore')}
            aria-expanded={mobileOpen}
            className={cn(
              'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
              mobileOpen ? 'text-ink bg-surface-raised' : 'text-ink-muted',
            )}
          >
            <MenuIcon open={mobileOpen} />
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      <main id="main" className="mx-auto max-w-wide px-4 py-10 pb-28 lg:px-10 lg:py-14 lg:pb-14 overflow-x-clip">
        <div className="min-w-0">{children}</div>
      </main>

      <Modal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        eyebrow={t('shell.modals.ledgerEntry')}
        title={t('nav.newExpense')}
        description={t('shell.modals.newExpenseDescription')}
        size="lg"
      >
        <ExpenseForm
          categories={settings.categories}
          bankAccounts={bankAccounts}
          debts={debts}
          existingAttachments={[]}
          onRemoveAttachment={() => {}}
          onSubmit={async (value, pendingFiles) => {
            try {
              const saved = await saveEntity('expenses', value);
              for (const file of pendingFiles) {
                await uploadAttachment(saved.id, file);
              }
              setExpenseModalOpen(false);
            } catch (error) {
              await alert({ title: t('shell.modals.unableToSaveExpense'), description: error.message || t('shell.modals.somethingWentWrong') });
            }
          }}
          onCancel={() => setExpenseModalOpen(false)}
        />
      </Modal>

      <Modal
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        eyebrow={t('shell.modals.incomeEntry')}
        title={t('nav.newIncome')}
        description={t('shell.modals.newIncomeDescription')}
        size="lg"
      >
        <IncomeForm
          bankAccounts={bankAccounts}
          onSubmit={async (value) => {
            await saveEntity('incomes', value);
            setIncomeModalOpen(false);
          }}
          onCancel={() => setIncomeModalOpen(false)}
        />
      </Modal>

      <footer className="mx-auto max-w-wide border-t border-rule px-4 py-8 lg:px-10 mt-20">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <p className="font-display italic">{t('shell.footer.tagline')}</p>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="text-ink-faint hover:text-ink transition-colors">Contact</Link>
            <Link to="/privacy" className="text-ink-faint hover:text-ink transition-colors">Privacy</Link>
            <Link to="/terms" className="text-ink-faint hover:text-ink transition-colors">Terms</Link>
            <p className="numeric text-ink-faint">
              {new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date())}
            </p>
          </div>
        </div>
      </footer>

      <TourSpotlight />
    </div>
    </TourProvider>
  );
}

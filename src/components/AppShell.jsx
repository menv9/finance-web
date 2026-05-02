import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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

const NAV_GROUPS = [
  { kind: 'link', to: '/dashboard', label: 'Overview' },
  { kind: 'link', to: '/this-month', label: 'Month' },
  {
    kind: 'menu',
    id: 'money',
    label: 'Money',
    items: [
      { to: '/accounts', label: 'Accounts' },
      { to: '/debts', label: 'Debts' },
      { to: '/expenses', label: 'Expenses' },
      { to: '/income', label: 'Income' },
    ],
  },
  {
    kind: 'menu',
    id: 'planning',
    label: 'Planning',
    items: [
      { to: '/budgets', label: 'Budgets' },
      { to: '/savings', label: 'Savings' },
    ],
  },
  { kind: 'link', to: '/portfolio', label: 'Investing', module: 'portfolio' },
  { kind: 'link', to: '/profile', label: 'Profile' },
];

const MORE_LINKS = [
  { to: '/accounts', label: 'Accounts' },
  { to: '/debts', label: 'Debts' },
  { to: '/income', label: 'Income' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/savings', label: 'Savings' },
  { to: '/portfolio', label: 'Portfolio', module: 'portfolio' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
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
  { value: 'dark',        label: 'Dark',        Icon: MoonIcon,      hint: 'Deep & minimal' },
  { value: 'light',       label: 'Light',       Icon: SunIcon,       hint: 'Clean & bright' },
  { value: 'eris',        label: 'Eris',        Icon: SparkleIcon,   hint: 'Lavender dreams' },
  { value: 'gorka',       label: 'Gorka',       Icon: DiscIcon,      hint: 'Silk dark navy' },
  { value: 'gorka-light', label: 'Gorka light', Icon: NewspaperIcon, hint: 'Old newspaper' },
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

const LOGO_GRADIENTS = {
  dark:  [{ o: '0%', c: '#C8D0DA' }, { o: '45%', c: '#8896A8' }, { o: '100%', c: '#5A6878' }],
  light: [{ o: '0%', c: '#1F4B3A' }, { o: '45%', c: '#0F6E56' }, { o: '100%', c: '#085041' }],
  eris:  [{ o: '0%', c: '#D4607A' }, { o: '45%', c: '#B84362' }, { o: '100%', c: '#8A1A45' }],
  gorka: [{ o: '0%', c: '#3B82F6' }, { o: '45%', c: '#5B8DEF' }, { o: '100%', c: '#93C5FD' }],
  'gorka-light': [{ o: '0%', c: '#A0714F' }, { o: '45%', c: '#7C5535' }, { o: '100%', c: '#5E3D22' }],
};

const FIN_COLORS = {
  dark:  '#FAF9F5',
  light: '#1B1712',
  eris:  '#2A1218',
  gorka: '#FFFFFF',
  'gorka-light': '#1B1712',
};

const TAGLINE_COLORS = {
  dark:  '#C2C0B6',
  light: '#524A40',
  eris:  '#8A4F65',
  gorka: 'rgba(229,236,246,0.55)',
  'gorka-light': '#7A6248',
};

function FinGesWordmark({ theme }) {
  const stops = LOGO_GRADIENTS[theme] ?? LOGO_GRADIENTS.dark;
  const finColor = FIN_COLORS[theme] ?? FIN_COLORS.dark;
  const taglineColor = TAGLINE_COLORS[theme] ?? TAGLINE_COLORS.dark;
  const id = `lgw-${theme}`;

  return (
    <svg viewBox="50 55 540 175" role="img" xmlns="http://www.w3.org/2000/svg" className="h-9 w-auto">
      <title>FinGes</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map(s => <stop key={s.o} offset={s.o} stopColor={s.c} />)}
        </linearGradient>
      </defs>

      <text x="60" y="188" fontFamily="'Fraunces', Georgia, serif" fontSize="130" fontWeight="400" fill={finColor} opacity="0.9" letterSpacing="-3">Fin</text>
      <text x="253" y="188" fontFamily="'Fraunces', Georgia, serif" fontSize="130" fontWeight="600" fill={`url(#${id})`} letterSpacing="-3">Ges</text>

      <text x="61" y="220" fontFamily="'Instrument Sans', system-ui, sans-serif" fontSize="15" fontWeight="500" letterSpacing="6" fill={taglineColor}>QUARTERLY LEDGER</text>
    </svg>
  );
}

function Logo({ theme }) {
  return (
    <NavLink to="/dashboard" className="flex items-center group" aria-label="Finance Tracker — home">
      <FinGesWordmark theme={theme} />
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

function MonthOverview({ metrics, baseCurrency, locale }) {
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
      aria-label="This month overview"
      className="flex shrink-0 flex-col gap-4 border-b border-rule px-5 py-5"
    >
      <div className="flex flex-col gap-0.5">
        <span className="eyebrow text-[0.6rem] text-ink-muted">This month</span>
        <span className="font-display text-base text-ink leading-tight">{monthLabel}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow text-[0.55rem] text-ink-faint">Net cashflow</span>
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
            <span className="eyebrow text-[0.55rem] text-ink-faint">Income</span>
            <span className="numeric text-positive">
              {formatCurrency(income, baseCurrency, locale)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="eyebrow text-[0.55rem] text-ink-faint">Spent</span>
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
  const profile = useFinanceStore((state) => state.profile);
  const appMode = useFinanceStore((state) => state.appMode);
  const setAppMode = useFinanceStore((state) => state.setAppMode);
  const signOutSupabase = useFinanceStore((state) => state.signOutSupabase);
  const alert = useAlert();
  const locale = useMemo(() => 'en-GB', []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const baseCurrency = settings.baseCurrency;
  const moduleVisible = useMemo(
    () => (item) => item.module !== 'portfolio' || settings.modules?.portfolio !== false,
    [settings.modules?.portfolio],
  );
  const isLite = appMode === 'lite';
  const navGroups = useMemo(
    () => {
      if (isLite) {
        return [
          { kind: 'link', to: '/this-month', label: 'Month' },
          { kind: 'link', to: '/expenses',   label: 'Expenses' },
          { kind: 'link', to: '/income',     label: 'Income' },
          { kind: 'link', to: '/profile',    label: 'Profile' },
        ];
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
    const initialized = localStorage.getItem('pft-theme-identity-set');
    if (initialized) return;
    if (isEris) setTheme('eris');
    else if (isGorka) setTheme('gorka');
    localStorage.setItem('pft-theme-identity-set', '1');
  }, [isEris, isGorka, setTheme]);

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
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!openNavMenu && !addMenuOpen && !themeMenuOpen) return undefined;
    const closeMenus = () => {
      setOpenNavMenu(null);
      setAddMenuOpen(false);
      setThemeMenuOpen(false);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, [openNavMenu, addMenuOpen, themeMenuOpen]);

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
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-wide grid-cols-[1fr_auto_1fr] items-center gap-6 pl-4 pr-5 lg:px-10">
          <div className="col-start-1 flex min-w-0 items-center justify-start gap-6">
            <Logo theme={appliedTheme} />
          </div>

          <nav aria-label="Primary" className="col-start-2 hidden justify-center lg:flex items-center gap-1">
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
                    {group.label}
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
                    {group.label}
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
                          <span>{item.label}</span>
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
                aria-label="Add transaction"
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink transition-colors duration-180 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <PlusIcon />
                <span>Add</span>
              </button>
              {addMenuOpen ? (
                <div className="absolute right-0 top-11 z-40 w-48 rounded-lg border border-rule bg-surface p-1 shadow-lift">
                  <button
                    type="button"
                    onClick={() => { setExpenseModalOpen(true); setAddMenuOpen(false); }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                  >
                    <span>New expense</span>
                    <span className="text-danger">↓</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIncomeModalOpen(true); setAddMenuOpen(false); }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                  >
                    <span>New income</span>
                    <span className="text-positive">↑</span>
                  </button>
                </div>
              ) : null}
            </div>
            <div className="hidden md:flex items-center gap-4 border-l border-rule pl-4">
              <div className="flex flex-col items-end">
                <span className="eyebrow text-[0.6rem] text-ink-muted leading-none mb-0.5">Total balance</span>
                <span className="numeric text-sm text-ink leading-none">
                  {formatCurrency(metrics.availableBalanceCents, baseCurrency, locale)}
                </span>
              </div>
              {metrics.totalDebtCents > 0 && (
                <div className="flex flex-col items-end border-l border-rule pl-4">
                  <span className="eyebrow text-[0.6rem] text-ink-muted leading-none mb-0.5">Debt</span>
                  <span className="numeric text-sm text-danger leading-none">
                    {formatCurrency(metrics.totalDebtCents, baseCurrency, locale)}
                  </span>
                </div>
              )}
            </div>

            {/* User pill + sign-out — only when Supabase auth is active */}
            {supabaseConfigured && supabaseUser && (
              <div className="hidden sm:flex items-center gap-2 border-l border-rule pl-3">
                <span
                  className="eyebrow text-[0.6rem] text-ink-faint max-w-[140px] truncate"
                  title={supabaseUser.email}
                >
                  {userHandle}
                </span>
                <button
                  type="button"
                  onClick={signOutSupabase}
                  aria-label="Sign out"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors duration-180 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <SignOutIcon />
                </button>
              </div>
            )}

            <div
              role="group"
              aria-label="Workspace mode"
              className="hidden sm:inline-flex items-center rounded-full border border-rule-strong p-0.5 text-[0.65rem] eyebrow"
            >
              {[
                { id: 'pro',  label: 'Pro' },
                { id: 'lite', label: 'Lite' },
              ].map((opt) => {
                const active = appMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAppMode(opt.id)}
                    aria-pressed={active}
                    title={opt.id === 'lite' ? 'FinGes Lite — minimal daily view' : 'FinGes Pro — full feature set'}
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

            <NavLink
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className={({ isActive }) =>
                cn(
                  'hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong transition-colors duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                  isActive ? 'text-ink border-ink-faint bg-surface-raised' : 'text-ink-muted hover:text-ink hover:border-ink-faint',
                )
              }
            >
              <SettingsIcon />
            </NavLink>
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              {(() => {
                const ActiveIcon = (THEME_OPTIONS.find((o) => o.value === appliedTheme)?.Icon) || SunIcon;
                return (
                  <button
                    type="button"
                    onClick={() => setThemeMenuOpen((v) => !v)}
                    aria-label="Choose theme"
                    aria-haspopup="menu"
                    aria-expanded={themeMenuOpen}
                    title="Theme"
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
                          <span className="truncate">{opt.label}</span>
                          <span className="eyebrow text-[0.55rem] text-ink-faint truncate">{opt.hint}</span>
                        </span>
                        {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
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
        aria-label="Navigation menu"
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-rule bg-surface shadow-2xl transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Panel header row */}
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <Logo theme={appliedTheme} />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
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
          />
          <nav aria-label="Primary mobile" className="flex flex-1 min-h-0 flex-col overflow-y-auto px-3 py-3">
            {moreLinks.map((link) => (
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
                <span className="font-display text-lg">{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        {/* Panel footer: balance + debt + sign-out */}
        <div className="border-t border-rule px-4 py-4 grid gap-3">
          <div
            role="group"
            aria-label="Workspace mode"
            className="inline-flex w-max items-center rounded-full border border-rule-strong p-0.5 text-[0.65rem] eyebrow"
          >
            {[
              { id: 'pro',  label: 'Pro' },
              { id: 'lite', label: 'Lite' },
            ].map((opt) => {
              const active = appMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAppMode(opt.id)}
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
                <span className="eyebrow text-[0.6rem] text-ink-muted">Total balance</span>
                <span className="numeric text-sm text-ink truncate">
                  {formatCurrency(metrics.availableBalanceCents, baseCurrency, locale)}
                </span>
              </div>
              {metrics.totalDebtCents > 0 && (
                <div className="flex flex-col gap-0.5 min-w-0 border-l border-rule pl-4">
                  <span className="eyebrow text-[0.6rem] text-ink-muted">Debt</span>
                  <span className="numeric text-sm text-danger truncate">
                    {formatCurrency(metrics.totalDebtCents, baseCurrency, locale)}
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
                <span className="eyebrow text-[0.6rem]">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label="Mobile shortcuts"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-canvas/95 px-3 py-2 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center gap-1">
          {isLite ? (
            <>
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
                <span>Month</span>
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
                <span>Expenses</span>
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
                <span>Home</span>
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
                <span>Month</span>
              </NavLink>
            </>
          )}
          <button
            type="button"
            onClick={() => setExpenseModalOpen(true)}
            aria-label="Add expense"
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
              <span>Income</span>
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
              <span>Money</span>
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? 'Close more menu' : 'Open more menu'}
            aria-expanded={mobileOpen}
            className={cn(
              'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] transition-colors duration-150',
              mobileOpen ? 'text-ink bg-surface-raised' : 'text-ink-muted',
            )}
          >
            <MenuIcon open={mobileOpen} />
            <span>More</span>
          </button>
        </div>
      </nav>

      <main id="main" className="mx-auto max-w-wide px-4 py-10 pb-28 lg:px-10 lg:py-14 lg:pb-14 overflow-x-clip">
        <div className="min-w-0">{children}</div>
      </main>

      <Modal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        eyebrow="Ledger entry"
        title="New expense"
        description="Stored locally in IndexedDB. Syncs to Supabase if configured."
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
              await alert({ title: 'Unable to save expense', description: error.message || 'Something went wrong.' });
            }
          }}
          onCancel={() => setExpenseModalOpen(false)}
        />
      </Modal>

      <Modal
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        eyebrow="Income entry"
        title="New income"
        description="Choose fixed, variable, or asset-linked income."
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
          <p className="font-display italic">Finance — a private ledger.</p>
          <p className="numeric text-ink-faint">
            {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date())}
          </p>
        </div>
      </footer>

      <TourSpotlight />
    </div>
    </TourProvider>
  );
}

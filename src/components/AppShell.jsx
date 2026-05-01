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
import { TourProvider } from './tour/TourContext';
import { TourSpotlight } from './tour/TourSpotlight';

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
];

const MORE_LINKS = [
  { to: '/accounts', label: 'Accounts' },
  { to: '/debts', label: 'Debts' },
  { to: '/income', label: 'Income' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/savings', label: 'Savings' },
  { to: '/portfolio', label: 'Portfolio', module: 'portfolio' },
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
  dark:  [{ o: '0%', c: '#28B87A' }, { o: '45%', c: '#1A9ECC' }, { o: '100%', c: '#2563EB' }],
  light: [{ o: '0%', c: '#1F4B3A' }, { o: '45%', c: '#0F6E56' }, { o: '100%', c: '#085041' }],
  eris:  [{ o: '0%', c: '#D4607A' }, { o: '45%', c: '#B84362' }, { o: '100%', c: '#8A1A45' }],
  gorka: [{ o: '0%', c: '#3B82F6' }, { o: '45%', c: '#5B8DEF' }, { o: '100%', c: '#93C5FD' }],
  'gorka-light': [{ o: '0%', c: '#3B82F6' }, { o: '45%', c: '#5B8DEF' }, { o: '100%', c: '#93C5FD' }],
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
  'gorka-light': '#524A40',
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

const FAVICON_TOKENS = {
  dark:  { cardFrom: '#1B2434', cardTo: '#141B26', coinFrom: '#232E42', coinTo: '#1B2434', ringFrom: '#2A3A58', ringTo: '#1E2C46', euroColor: '#5FB394', cardShadow: '#9060D8' },
  light: { cardFrom: '#FFFFFF', cardTo: '#E8EFFE', coinFrom: '#FFFFFF', coinTo: '#EEF2FF', ringFrom: '#E0E8FF', ringTo: '#C8D8F8', euroColor: '#1B3A7A', cardShadow: '#8AAAD8' },
  eris:  { cardFrom: '#FFF6FA', cardTo: '#FEF0F5', coinFrom: '#FFF0F7', coinTo: '#FFE0EE', ringFrom: '#FFD6EA', ringTo: '#FFBAD8', euroColor: '#D4607A', cardShadow: '#E8A0B8' },
  gorka: { cardFrom: '#131D30', cardTo: '#0E1726', coinFrom: '#1A2540', coinTo: '#0F1827', ringFrom: '#2A3548', ringTo: '#1E2A40', euroColor: '#5B8DEF', cardShadow: '#3B5680' },
  'gorka-light': { cardFrom: '#F6F1E8', cardTo: '#E8EFFE', coinFrom: '#FFFFFF', coinTo: '#EEF2FF', ringFrom: '#D6E1F8', ringTo: '#BFD1F6', euroColor: '#3B82F6', cardShadow: '#8AAAD8' },
};

function buildFaviconSVG(theme) {
  const t = FAVICON_TOKENS[theme] ?? FAVICON_TOKENS.dark;
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${t.cardFrom}"/>
      <stop offset="100%" stop-color="${t.cardTo}"/>
    </linearGradient>
    <linearGradient id="g1" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#52E8A8"/><stop offset="100%" stop-color="#28B87A"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#3ED8E8"/><stop offset="100%" stop-color="#1A9ECC"/>
    </linearGradient>
    <linearGradient id="g3" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#60A8FF"/><stop offset="100%" stop-color="#1A5FE8"/>
    </linearGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.52)"/>
      <stop offset="55%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="bsh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.14)"/>
    </linearGradient>
    <linearGradient id="coinbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.coinFrom}"/>
      <stop offset="100%" stop-color="${t.coinTo}"/>
    </linearGradient>
    <linearGradient id="coinring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.ringFrom}"/>
      <stop offset="100%" stop-color="${t.ringTo}"/>
    </linearGradient>
    <filter id="cardshadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="20" stdDeviation="32" flood-color="${t.cardShadow}" flood-opacity="0.28"/>
    </filter>
    <filter id="bardepth" x="-20%" y="-10%" width="150%" height="130%">
      <feDropShadow dx="4" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.16"/>
    </filter>
    <filter id="coinshadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#5577BB" flood-opacity="0.22"/>
    </filter>
    <filter id="lineglow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dotglow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#fff" flood-opacity="0.9"/>
    </filter>
  </defs>
  <rect x="72" y="72" width="880" height="880" rx="196" fill="url(#bg)" filter="url(#cardshadow)"/>
  <g filter="url(#bardepth)">
    <rect x="230" y="530" width="155" height="325" rx="36" fill="url(#g1)"/>
    <rect x="230" y="530" width="155" height="325" rx="36" fill="url(#bsh)"/>
    <rect x="230" y="530" width="52"  height="325" rx="36" fill="url(#sh)" opacity="0.9"/>
  </g>
  <g filter="url(#bardepth)">
    <rect x="415" y="390" width="155" height="465" rx="36" fill="url(#g2)"/>
    <rect x="415" y="390" width="155" height="465" rx="36" fill="url(#bsh)"/>
    <rect x="415" y="390" width="52"  height="465" rx="36" fill="url(#sh)" opacity="0.9"/>
  </g>
  <g filter="url(#bardepth)">
    <rect x="600" y="210" width="160" height="645" rx="36" fill="url(#g3)"/>
    <rect x="600" y="210" width="160" height="645" rx="36" fill="url(#bsh)"/>
    <rect x="600" y="210" width="54"  height="645" rx="36" fill="url(#sh)" opacity="0.9"/>
  </g>
  <path d="M307 668 C390 600 460 450 492 432 C530 412 590 358 680 310" stroke="rgba(255,255,255,0.32)" stroke-width="32" fill="none" stroke-linecap="round" filter="url(#lineglow)"/>
  <path d="M307 668 C390 600 460 450 492 432 C530 412 590 358 680 310" stroke="white" stroke-width="18" fill="none" stroke-linecap="round"/>
  <circle cx="307" cy="668" r="30" fill="white" filter="url(#dotglow)"/>
  <circle cx="307" cy="668" r="15" fill="#3ABDE0"/>
  <circle cx="492" cy="432" r="30" fill="white" filter="url(#dotglow)"/>
  <circle cx="492" cy="432" r="15" fill="#3ABDE0"/>
  <circle cx="680" cy="310" r="30" fill="white" filter="url(#dotglow)"/>
  <circle cx="680" cy="310" r="15" fill="#4B8EF5"/>
  <g filter="url(#coinshadow)">
    <circle cx="724" cy="748" r="118" fill="url(#coinring)"/>
    <circle cx="724" cy="748" r="100" fill="url(#coinbg)"/>
    <circle cx="724" cy="748" r="100" fill="none" stroke="rgba(180,200,240,0.6)" stroke-width="2"/>
    <path d="M748 692 A62 62 0 1 0 748 804" fill="none" stroke="${t.euroColor}" stroke-width="28" stroke-linecap="round"/>
    <line x1="650" y1="732" x2="715" y2="732" stroke="${t.euroColor}" stroke-width="22" stroke-linecap="round"/>
    <line x1="650" y1="764" x2="715" y2="764" stroke="${t.euroColor}" stroke-width="22" stroke-linecap="round"/>
  </g>
</svg>`;
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
  const signOutSupabase = useFinanceStore((state) => state.signOutSupabase);
  const locale = useMemo(() => 'en-GB', []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const baseCurrency = settings.baseCurrency;
  const moduleVisible = useMemo(
    () => (item) => item.module !== 'portfolio' || settings.modules?.portfolio !== false,
    [settings.modules?.portfolio],
  );
  const navGroups = useMemo(
    () =>
      NAV_GROUPS
        .filter(moduleVisible)
        .map((group) => (group.items ? { ...group, items: group.items.filter(moduleVisible) } : group))
        .filter((group) => group.kind !== 'menu' || group.items.length),
    [moduleVisible],
  );
  const moreLinks = useMemo(
    () => MORE_LINKS.filter(moduleVisible),
    [moduleVisible],
  );

  const userHandle = supabaseUser?.email?.split('@')[0] ?? null;

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
    const favicon = buildFaviconSVG(appliedTheme);
    const encoded = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = encoded;
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
    const EDGE = 24;        // open: start zone, px from right edge
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
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!openNavMenu && !addMenuOpen) return undefined;
    const closeMenus = () => {
      setOpenNavMenu(null);
      setAddMenuOpen(false);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, [openNavMenu, addMenuOpen]);

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

      {/* Gorka: full-page silk background. Solid navy fallback prevents a
          white flash before the WebGL canvas first renders. */}
      {(appliedTheme === 'gorka' || appliedTheme === 'gorka-light') && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: appliedTheme === 'gorka-light' ? '#FFF8E0' : '#08101F' }}>
          <Silk
            speed={appliedTheme === 'gorka-light' ? 1 : 1.2}
            scale={appliedTheme === 'gorka-light' ? 0.6 : 1.3}
            color={appliedTheme === 'gorka-light' ? '#FFFFFF' : '#1E2C44'}
            noiseIntensity={appliedTheme === 'gorka-light' ? 0.6 : 0.8}
            rotation={0.6}
          />
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
            <div className="hidden md:flex flex-col items-end border-l border-rule pl-4">
              <span className="eyebrow text-[0.6rem] text-ink-muted leading-none mb-0.5">Total balance</span>
              <span className="numeric text-sm text-ink leading-none">
                {formatCurrency(metrics.availableBalanceCents, baseCurrency, locale)}
              </span>
            </div>

            {/* User pill + sign-out — only when Supabase auth is active */}
            {supabaseConfigured && supabaseUser && (
              <div className="hidden sm:flex items-center gap-2 border-l border-rule pl-3">
                <span
                  className="eyebrow text-[0.6rem] text-ink-faint max-w-[96px] truncate"
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
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={appliedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted transition-colors duration-180 hover:text-ink hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {appliedTheme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
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
        {/* Panel footer: balance + sign-out */}
        <div className="border-t border-rule px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="eyebrow text-[0.6rem] text-ink-muted">Total balance</span>
              <span className="numeric text-sm text-ink truncate">
                {formatCurrency(metrics.availableBalanceCents, baseCurrency, locale)}
              </span>
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
          <button
            type="button"
            onClick={() => setExpenseModalOpen(true)}
            aria-label="Add expense"
            className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-card transition-colors duration-150 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <PlusIcon />
          </button>
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
              window.alert(error.message || 'Unable to save expense.');
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

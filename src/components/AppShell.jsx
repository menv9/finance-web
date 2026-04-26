import { NavLink } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { cn } from './ui/cn';
import LiquidChrome from './LiquidChrome';
import ElectricBorder from './ElectricBorder';

const links = [
  { to: '/dashboard', label: 'Dashboard', num: '01' },
  { to: '/expenses', label: 'Expenses', num: '02' },
  { to: '/income', label: 'Income', num: '03' },
  { to: '/portfolio', label: 'Portfolio', num: '04' },
  { to: '/savings', label: 'Savings', num: '05' },
  { to: '/transfers', label: 'Transfers', num: '06' },
  { to: '/settings', label: 'Settings', num: '07' },
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

function Logo({ isGorka }) {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-2.5 group" aria-label="Finance Tracker — home">
      {isGorka ? (
        <span aria-hidden className="relative inline-flex h-7 w-7 items-center justify-center">
          <ElectricBorder color="#C084FC" speed={0.7} chaos={0.06} borderRadius={999}>
            <span className="inline-flex h-7 w-7 items-center justify-center">
              <span className="font-display text-sm leading-none text-ink">ƒ</span>
            </span>
          </ElectricBorder>
        </span>
      ) : (
        <span
          aria-hidden
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-rule-strong bg-surface-raised"
        >
          <span className="font-display text-sm leading-none text-ink">ƒ</span>
        </span>
      )}
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-display text-sm text-ink tracking-tight">Finance</span>
        <span className="eyebrow text-[0.6rem] mt-0.5">Quarterly Ledger</span>
      </span>
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

export function AppShell({ children }) {
  const theme = useFinanceStore((state) => state.settings.theme);
  const toggleTheme = useFinanceStore((state) => state.toggleTheme);
  const setTheme = useFinanceStore((state) => state.setTheme);
  const metrics = useFinanceStore((state) => state.derived.dashboard);
  const baseCurrency = useFinanceStore((state) => state.settings.baseCurrency);
  const supabaseUser = useFinanceStore((state) => state.supabaseUser);
  const supabaseConfigured = useFinanceStore((state) => state.supabaseConfigured);
  const signOutSupabase = useFinanceStore((state) => state.signOutSupabase);
  const locale = useMemo(() => 'de-AT', []);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userHandle = supabaseUser?.email?.split('@')[0] ?? null;

  const isEris = supabaseUser?.email === 'erisbarrancop@gmail.com';
  const isGorka = supabaseUser?.email === 'gorkaaamendiola@gmail.com';

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
  const appliedTheme = ['dark', 'light', 'eris', 'gorka'].includes(theme) ? theme : 'dark';

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

  return (
    <div className="min-h-screen">
      {/* Gorka: full-page liquid chrome background fixed behind everything */}
      {appliedTheme === 'gorka' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
          <LiquidChrome baseColor={[0.1, 0.04, 0.22]} speed={0.15} amplitude={0.45} interactive={true} />
        </div>
      )}

      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-accent-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-wide items-center justify-between gap-6 px-4 lg:px-10">
          <div className="flex items-center gap-6 min-w-0">
            <Logo isGorka={isGorka} />
          </div>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'group relative inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-180',
                    isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="numeric text-[0.65rem] text-ink-faint">{link.num}</span>
                    <span className="font-sans">{link.label}</span>
                    <span
                      aria-hidden
                      className={cn(
                        'absolute bottom-0 left-3 right-3 h-px origin-center bg-accent transition-transform duration-220 ease-editorial',
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-baseline gap-2 border-l border-rule pl-4">
              <span className="eyebrow text-[0.6rem]">Net</span>
              <span className="numeric text-sm text-ink">
                {formatCurrency(metrics.netWorthCents, baseCurrency, locale)}
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
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-rule bg-surface animate-rise">
            <nav aria-label="Primary mobile" className="mx-auto flex max-w-wide flex-col px-4 py-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 py-3 border-b border-rule last:border-b-0 transition-colors duration-120',
                      isActive ? 'text-ink' : 'text-ink-muted',
                    )
                  }
                >
                  <span className="numeric text-xs text-ink-faint w-6">{link.num}</span>
                  <span className="font-display text-lg">{link.label}</span>
                </NavLink>
              ))}
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-rule">
                <div className="flex items-baseline gap-2">
                  <span className="eyebrow text-[0.6rem]">Net worth</span>
                  <span className="numeric text-sm text-ink">
                    {formatCurrency(metrics.netWorthCents, baseCurrency, locale)}
                  </span>
                </div>
                {supabaseConfigured && supabaseUser && (
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); signOutSupabase(); }}
                    className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-danger transition-colors duration-180"
                  >
                    <SignOutIcon />
                    <span className="eyebrow text-[0.6rem]">Sign out</span>
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto max-w-wide px-4 py-10 lg:px-10 lg:py-14 overflow-x-clip">
        <div className="min-w-0">{children}</div>
      </main>

      <footer className="mx-auto max-w-wide border-t border-rule px-4 py-8 lg:px-10 mt-20">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <p className="font-display italic">Finance — a private ledger.</p>
          <p className="numeric text-ink-faint">
            {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date())}
          </p>
        </div>
      </footer>
    </div>
  );
}

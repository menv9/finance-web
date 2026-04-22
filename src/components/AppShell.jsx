import { NavLink } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { cn } from './ui/cn';

const links = [
  { to: '/dashboard', label: 'Dashboard', num: '01' },
  { to: '/expenses', label: 'Expenses', num: '02' },
  { to: '/income', label: 'Income', num: '03' },
  { to: '/portfolio', label: 'Portfolio', num: '04' },
  { to: '/settings', label: 'Settings', num: '05' },
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

function Logo() {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-2.5 group" aria-label="Finance Tracker — home">
      <span
        aria-hidden
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-rule-strong bg-surface-raised"
      >
        <span className="font-display text-sm leading-none text-ink">ƒ</span>
      </span>
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-display text-sm text-ink tracking-tight">Finance</span>
        <span className="eyebrow text-[0.6rem] mt-0.5">Quarterly Ledger</span>
      </span>
    </NavLink>
  );
}

export function AppShell({ children }) {
  const theme = useFinanceStore((state) => state.settings.theme);
  const toggleTheme = useFinanceStore((state) => state.toggleTheme);
  const metrics = useFinanceStore((state) => state.derived.dashboard);
  const baseCurrency = useFinanceStore((state) => state.settings.baseCurrency);
  const locale = useMemo(() => 'de-AT', []);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-accent-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-wide items-center justify-between gap-6 px-4 lg:px-10">
          <div className="flex items-center gap-6 min-w-0">
            <Logo />
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
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted transition-colors duration-180 hover:text-ink hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
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
              <div className="mt-3 flex items-baseline gap-2 pt-3 border-t border-rule">
                <span className="eyebrow text-[0.6rem]">Net worth</span>
                <span className="numeric text-sm text-ink">
                  {formatCurrency(metrics.netWorthCents, baseCurrency, locale)}
                </span>
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

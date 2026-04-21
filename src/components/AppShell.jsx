import { NavLink } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/income', label: 'Income' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell({ children }) {
  const theme = useFinanceStore((state) => state.settings.theme);
  const toggleTheme = useFinanceStore((state) => state.toggleTheme);
  const metrics = useFinanceStore((state) => state.derived.dashboard);
  const baseCurrency = useFinanceStore((state) => state.settings.baseCurrency);
  const locale = useMemo(() => 'de-AT', []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto min-h-screen max-w-[1680px] px-4 py-4 lg:px-6">
        <header className="mb-6 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--text-main)] text-sm font-semibold text-[var(--bg-surface-strong)]">
              FT
            </div>
            <div>
              <p className="text-sm font-semibold">Finance Tracker</p>
              <p className="text-xs text-[var(--text-muted)]">Local-first wealth OS</p>
            </div>
          </div>

          <nav className="glass-card flex flex-wrap items-center justify-center gap-2 rounded-full px-3 py-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `nav-pill ${isActive ? 'nav-pill-active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center justify-start gap-3 lg:justify-end">
            <div className="hidden rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface-strong)] px-4 py-3 text-sm text-[var(--text-muted)] lg:block">
              Net worth {formatCurrency(metrics.netWorthCents, baseCurrency, locale)}
            </div>
            <button className="button-secondary" onClick={toggleTheme}>
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}

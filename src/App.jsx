import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/LoadingScreen';
import { useFinanceStore } from './store/useFinanceStore';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const IncomePage = lazy(() => import('./pages/IncomePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  const bootstrap = useFinanceStore((state) => state.bootstrap);
  const hydrated = useFinanceStore((state) => state.hydrated);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!hydrated) {
    return <LoadingScreen label="Loading your finance workspace..." />;
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingScreen label="Preparing module..." compact />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/income" element={<IncomePage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

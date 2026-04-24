import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ConfirmProvider } from './components/ConfirmContext';
import { LoadingScreen } from './components/LoadingScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useFinanceStore } from './store/useFinanceStore';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const IncomePage = lazy(() => import('./pages/IncomePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

export default function App() {
  const bootstrap = useFinanceStore((state) => state.bootstrap);
  const hydrated = useFinanceStore((state) => state.hydrated);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const { supabaseUser, supabaseSyncStatus, pullFromSupabase } = useFinanceStore.getState();
      if (!supabaseUser) return;
      if (supabaseSyncStatus === 'syncing-down' || supabaseSyncStatus === 'syncing-up') return;
      pullFromSupabase().catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (!hydrated) {
    return <LoadingScreen label="Loading your finance workspace..." />;
  }

  return (
    <ConfirmProvider>
    <Suspense fallback={<LoadingScreen label="Preparing module..." compact />}>
      <Routes>
        {/* Public — auth page (outside AppShell, no nav) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — all app routes behind auth gate + shared shell */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/income" element={<IncomePage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/savings" element={<SavingsPage />} />
                  <Route path="/transfers" element={<TransfersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
    </ConfirmProvider>
  );
}

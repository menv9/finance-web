import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ConfirmProvider } from './components/ConfirmContext';
import { LoadingScreen } from './components/LoadingScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useFinanceStore } from './store/useFinanceStore';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const IncomePage = lazy(() => import('./pages/IncomePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

export default function App() {
  const bootstrap = useFinanceStore((state) => state.bootstrap);
  const hydrated = useFinanceStore((state) => state.hydrated);
  const portfolioEnabled = useFinanceStore((state) => state.settings.modules?.portfolio !== false);
  const onboardingCompleted = useFinanceStore((state) => state.settings.onboardingCompleted === true);

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
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/landing" replace />} />

          {/* Public — standalone pages (no AppShell) */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

          {/* Protected — all app routes behind auth gate + shared shell */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {onboardingCompleted ? (
                  <AppShell>
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/income" element={<IncomePage />} />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route path="/budgets" element={<BudgetsPage />} />
                      <Route path="/savings" element={<SavingsPage />} />
                      <Route path="/portfolio" element={portfolioEnabled ? <PortfolioPage /> : <Navigate to="/dashboard" replace />} />
                      <Route path="/transfers" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </AppShell>
                ) : (
                  <Navigate to="/onboarding" replace />
                )}
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </ConfirmProvider>
  );
}

import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import CoingameShell from './components/coingame/CoingameShell';
import { ConfirmProvider } from './components/ConfirmContext';
import { LoadingScreen } from './components/LoadingScreen';
import { RouteLoader } from './components/RouteLoader';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useFinanceStore } from './store/useFinanceStore';
import { LITE_PATHS } from './utils/appMode';

function RootRedirect() {
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  return <Navigate to={supabaseUser ? '/dashboard' : '/landing'} replace />;
}

function LiteGuard({ children }) {
  const appMode = useFinanceStore((s) => s.appMode);
  const tourActive = useFinanceStore((s) => s.tourActive);
  const { pathname } = useLocation();
  if (appMode === 'lite' && !tourActive && !LITE_PATHS.has(pathname)) {
    return <Navigate to="/this-month" replace />;
  }
  return children;
}

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const IncomePage = lazy(() => import('./pages/IncomePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const PlatformsPage = lazy(() => import('./pages/PlatformsPage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ThisMonthPage = lazy(() => import('./pages/ThisMonthPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const DebtsPage = lazy(() => import('./pages/DebtsPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ActivityFeedPage = lazy(() => import('./pages/ActivityFeedPage'));
const SharedGoalsPage = lazy(() => import('./pages/SharedGoalsPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const FriendsMoneyPage = lazy(() => import('./pages/FriendsMoneyPage'));
const CoingamePage = lazy(() => import('./pages/CoingamePage'));
const CoingameMarketPage = lazy(() => import('./pages/CoingameMarketPage'));
const CoingameCoinPage = lazy(() => import('./pages/CoingameCoinPage'));
const CoingameTransactionsPage = lazy(() => import('./pages/CoingameTransactionsPage'));
const CoingameLeaderboardPage = lazy(() => import('./pages/CoingameLeaderboardPage'));
const CoingameInfoPage = lazy(() => import('./pages/CoingameInfoPage'));
const CoingameAdminPage = lazy(() => import('./pages/CoingameAdminPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

export default function App() {
  const bootstrap = useFinanceStore((state) => state.bootstrap);
  const hydrated = useFinanceStore((state) => state.hydrated);
  const portfolioEnabled = useFinanceStore((state) => state.settings.modules?.portfolio !== false);
  const socialEnabled = useFinanceStore((state) => state.settings.modules?.social !== false);
  const coingameEnabled = useFinanceStore((state) => state.settings.modules?.coingame !== false);
  const tourActive = useFinanceStore((state) => state.tourActive);

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
      <Suspense fallback={<LoadingScreen label="Loading..." />}>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Coingame — standalone shell (no AppShell nav) */}
          <Route
            path="/coingame/*"
            element={
              <ProtectedRoute>
                {coingameEnabled ? (
                  <CoingameShell>
                    <Suspense fallback={<div style={{ color: '#1cff00', fontFamily: 'monospace', padding: '2rem' }}>Loading...</div>}>
                      <Routes>
                        <Route path="/" element={<CoingamePage />} />
                        <Route path="/market" element={<CoingameMarketPage />} />
                        <Route path="/coin/:coinId" element={<CoingameCoinPage />} />
                        <Route path="/history" element={<CoingameTransactionsPage />} />
                        <Route path="/leaderboard" element={<CoingameLeaderboardPage />} />
                        <Route path="/info" element={<CoingameInfoPage />} />
                        <Route path="/admin" element={<CoingameAdminPage />} />
                        <Route path="*" element={<CoingamePage />} />
                      </Routes>
                    </Suspense>
                  </CoingameShell>
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </ProtectedRoute>
            }
          />

          {/* Public — standalone pages (no AppShell) */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

          {/* Protected — all app routes behind auth gate + shared shell */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Suspense fallback={<RouteLoader />}>
                    <LiteGuard>
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/this-month" element={<ThisMonthPage />} />
                      <Route path="/accounts" element={<AccountsPage />} />
                      <Route path="/debts" element={<DebtsPage />} />
                      <Route path="/income" element={<IncomePage />} />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route path="/budgets" element={<BudgetsPage />} />
                      <Route path="/savings" element={<SavingsPage />} />
                      <Route
                        path="/portfolio"
                        element={
                          portfolioEnabled || tourActive ? (
                            <PortfolioPage />
                          ) : (
                            <Navigate to="/dashboard" replace />
                          )
                        }
                      />
                      <Route
                        path="/portfolio/platforms"
                        element={
                          portfolioEnabled || tourActive ? (
                            <PlatformsPage />
                          ) : (
                            <Navigate to="/dashboard" replace />
                          )
                        }
                      />
                      <Route path="/profile" element={socialEnabled ? <ProfilePage /> : <Navigate to="/dashboard" replace />} />
                      <Route path="/activity" element={socialEnabled ? <ActivityFeedPage /> : <Navigate to="/dashboard" replace />} />
                      <Route path="/shared-goals" element={socialEnabled ? <SharedGoalsPage /> : <Navigate to="/dashboard" replace />} />
                      <Route path="/friends" element={socialEnabled ? <FriendsPage /> : <Navigate to="/dashboard" replace />} />
                      <Route path="/friends/money" element={socialEnabled ? <FriendsMoneyPage /> : <Navigate to="/dashboard" replace />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                    </LiteGuard>
                  </Suspense>
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </ConfirmProvider>
  );
}

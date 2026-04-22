import { Navigate } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';

/**
 * Guards all app routes behind Supabase auth when Supabase is configured.
 *
 * Behaviour:
 *  - Not yet hydrated        → render nothing (App.jsx shows LoadingScreen above us)
 *  - Supabase not configured → local mode, let through with no auth
 *  - Configured, no session  → redirect to /login
 *  - Configured + session    → render children
 */
export function ProtectedRoute({ children }) {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const supabaseConfigured = useFinanceStore((s) => s.supabaseConfigured);
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);

  if (!hydrated) return null;
  if (!supabaseConfigured) return children;
  if (!supabaseUser) return <Navigate to="/login" replace />;
  return children;
}

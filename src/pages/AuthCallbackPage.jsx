import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseBrowserClient } from '../utils/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      navigate('/login', { replace: true });
      return;
    }

    // Supabase will automatically exchange the code/hash from the URL
    // for a session when detectSessionInUrl is true. We just wait for it.
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard', { replace: true });
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // TOKEN_REFRESHED without SIGNED_IN means something went wrong
      }
    });

    // Also check if session is already there (race: listener fires before we subscribe)
    client.auth.getSession().then(({ data: { session }, error: err }) => {
      if (err) {
        setError(err.message);
      } else if (session) {
        navigate('/dashboard', { replace: true });
      }
    });

    return () => data.subscription.unsubscribe();
  }, [navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <p style={{ color: 'var(--color-danger)' }}>Sign-in failed: {error}</p>
        <a href="/login">Back to login</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Signing you in…</p>
    </div>
  );
}

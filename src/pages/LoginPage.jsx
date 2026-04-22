import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import { Button } from '../components/ui';

function CheckInboxIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 text-accent" fill="none" aria-hidden>
      <rect x="4" y="10" width="40" height="30" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 16l20 13 20-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const supabaseConfigured = useFinanceStore((s) => s.supabaseConfigured);
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const supabaseSyncStatus = useFinanceStore((s) => s.supabaseSyncStatus);
  const supabaseError = useFinanceStore((s) => s.supabaseError);
  const sendMagicLink = useFinanceStore((s) => s.sendMagicLink);

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState('');

  // Already signed in → into the app
  if (supabaseUser) return <Navigate to="/dashboard" replace />;

  // Supabase not configured → local mode, no auth needed
  if (!supabaseConfigured) return <Navigate to="/dashboard" replace />;

  const loading = supabaseSyncStatus === 'auth-pending';

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!email.trim()) {
      setLocalError('Enter your email address.');
      return;
    }
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setLocalError(err.message || 'Something went wrong. Try again.');
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Subtle top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        {/* Logo mark */}
        <div className="mb-14 flex flex-col items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong bg-surface-raised shadow-lift">
            <span className="font-display text-xl leading-none text-ink">ƒ</span>
          </span>
          <span className="eyebrow text-[0.65rem] text-ink-faint">Finance — Quarterly Ledger</span>
        </div>

        {sent ? (
          /* ── Confirmation state ── */
          <div className="w-full max-w-sm text-center space-y-6 animate-rise">
            <CheckInboxIcon />
            <div className="space-y-2">
              <h1 className="font-display text-4xl text-ink leading-[0.95] tracking-tight">
                Check your inbox.
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                We sent a magic link to{' '}
                <span className="text-ink font-medium">{email}</span>.
                <br />
                Click it to sign in — no password needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-sm text-ink-faint underline-offset-2 hover:text-ink hover:underline transition-colors duration-180"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* ── Sign-in form ── */
          <div className="w-full max-w-sm space-y-10 animate-rise">
            <div className="space-y-3">
              <h1 className="font-display text-5xl text-ink leading-[0.92] tracking-tight">
                Sign in.
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                Enter your email and we'll send a magic link.
                <br />
                No password, no friction.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="eyebrow text-[0.65rem] block"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setLocalError(''); }}
                  placeholder="you@example.com"
                  aria-describedby={localError || supabaseError ? 'login-error' : undefined}
                  aria-invalid={!!(localError || supabaseError)}
                  className={[
                    'w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint',
                    'transition-shadow duration-180',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas',
                    localError || supabaseError ? 'border-danger' : 'border-rule hover:border-rule-strong',
                  ].join(' ')}
                />
                {(localError || supabaseError) && (
                  <p id="login-error" className="text-sm text-danger" role="alert">
                    {localError || supabaseError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>

            <p className="text-center text-xs text-ink-faint leading-relaxed">
              Your data stays in your browser until you connect Supabase sync.
              <br />
              Each account is completely private.
            </p>
          </div>
        )}
      </div>

      <footer className="py-6 text-center">
        <p className="text-xs text-ink-faint font-display italic">a private ledger.</p>
      </footer>
    </div>
  );
}

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default function LoginPage() {
  const supabaseConfigured = useFinanceStore((s) => s.supabaseConfigured);
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const supabaseSyncStatus = useFinanceStore((s) => s.supabaseSyncStatus);
  const supabaseError = useFinanceStore((s) => s.supabaseError);
  const sendMagicLink = useFinanceStore((s) => s.sendMagicLink);
  const signInWithGoogle = useFinanceStore((s) => s.signInWithGoogle);

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

  async function handleGoogleSignIn() {
    setLocalError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(err.message || 'Google sign in failed. Try again.');
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

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-rule" />
                <span className="eyebrow text-[0.65rem] text-ink-faint">or</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon /> Continue with Google
              </Button>
            </div>

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

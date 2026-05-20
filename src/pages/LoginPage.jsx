import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import { Button } from '../components/ui';
import { cn } from '../components/ui/cn';
import { useTranslation } from '../i18n/useTranslation';

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
  const { t } = useTranslation();
  const supabaseConfigured = useFinanceStore((s) => s.supabaseConfigured);
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const supabaseSyncStatus = useFinanceStore((s) => s.supabaseSyncStatus);
  const supabaseError = useFinanceStore((s) => s.supabaseError);
  const sendMagicLink = useFinanceStore((s) => s.sendMagicLink);
  const signInWithGoogle = useFinanceStore((s) => s.signInWithGoogle);
  const signUpWithPassword = useFinanceStore((s) => s.signUpWithPassword);
  const signInWithPassword = useFinanceStore((s) => s.signInWithPassword);
  const sendPasswordReset = useFinanceStore((s) => s.sendPasswordReset);
  const resetAuthStatus = useFinanceStore((s) => s.resetAuthStatus);
  const navigate = useNavigate();

  // If the user lands here after backing out of an OAuth flow, the status can
  // be stuck on 'auth-pending'. Clear it so the form is interactive again.
  useEffect(() => {
    if (!supabaseUser) resetAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState(null); // null | 'magic-sent' | 'signup-sent' | 'reset-sent'
  const [localError, setLocalError] = useState('');

  // Already signed in → into the app
  if (supabaseUser) return <Navigate to="/dashboard" replace />;

  // Supabase not configured → local mode, no auth needed
  if (!supabaseConfigured) return <Navigate to="/dashboard" replace />;

  const loading = supabaseSyncStatus === 'auth-pending';
  const errorMessage = localError || supabaseError;

  const confirmationCopy = {
    'magic-sent':  { title: t('login.magicSentTitle'),  prefix: t('login.magicSentPrefix'),  suffix: t('login.magicSentSuffix') },
    'signup-sent': { title: t('login.signupSentTitle'), prefix: t('login.signupSentPrefix'), suffix: t('login.signupSentSuffix') },
    'reset-sent':  { title: t('login.resetSentTitle'),  prefix: t('login.resetSentPrefix'),  suffix: t('login.resetSentSuffix') },
  };

  function clearError() {
    setLocalError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    if (!email.trim() || !password.trim()) {
      setLocalError(t('login.errorRequired'));
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setLocalError(t('login.errorTooShort'));
      return;
    }
    try {
      if (mode === 'signup') {
        await signUpWithPassword(email.trim(), password);
        setConfirmation('signup-sent');
      } else {
        await signInWithPassword(email.trim(), password);
      }
    } catch (err) {
      setLocalError(err.message || t('login.errorGeneric'));
    }
  }

  async function handleGoogleSignIn() {
    clearError();
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(err.message || t('login.errorGoogle'));
    }
  }

  async function handleMagicLink() {
    clearError();
    if (!email.trim()) {
      setLocalError(t('login.errorMagicEmail'));
      return;
    }
    try {
      await sendMagicLink(email.trim());
      setConfirmation('magic-sent');
    } catch (err) {
      setLocalError(err.message || t('login.errorMagicSend'));
    }
  }

  async function handleForgotPassword() {
    clearError();
    if (!email.trim()) {
      setLocalError(t('login.errorResetEmail'));
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setConfirmation('reset-sent');
    } catch (err) {
      setLocalError(err.message || t('login.errorResetSend'));
    }
  }

  function resetForm() {
    setConfirmation(null);
    setEmail('');
    setPassword('');
    clearError();
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
          <span className="eyebrow text-[0.65rem] text-ink-faint">{t('login.eyebrow')}</span>
        </div>

        {confirmation ? (
          /* ── Confirmation state ── */
          <div className="w-full max-w-sm text-center space-y-6 animate-rise">
            <CheckInboxIcon />
            <div className="space-y-2">
              <h1 className="font-display text-4xl text-ink leading-[0.95] tracking-tight">
                {confirmationCopy[confirmation].title}
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                {confirmationCopy[confirmation].prefix}{' '}
                <span className="text-ink font-medium">{email}</span>.
                <br />
                {confirmationCopy[confirmation].suffix}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-ink-faint underline-offset-2 hover:text-ink hover:underline transition-colors duration-180"
            >
              {t('login.useDifferent')}
            </button>
          </div>
        ) : (
          /* ── Sign-in / Create-account form ── */
          <div className="w-full max-w-sm space-y-8 animate-rise">
            <div className="space-y-3">
              <h1 className="font-display text-5xl text-ink leading-[0.92] tracking-tight">
                {mode === 'signin' ? t('login.titleSignIn') : t('login.titleSignUp')}
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                {mode === 'signin' ? t('login.subtitleSignIn') : t('login.subtitleSignUp')}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex rounded-md border border-rule p-1 bg-surface-raised">
              <button
                type="button"
                onClick={() => { setMode('signin'); clearError(); }}
                className={cn(
                  'flex-1 rounded px-3 py-1.5 text-sm transition-colors duration-180',
                  mode === 'signin'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {t('login.tabSignIn')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); clearError(); }}
                className={cn(
                  'flex-1 rounded px-3 py-1.5 text-sm transition-colors duration-180',
                  mode === 'signup'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {t('login.tabSignUp')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="eyebrow text-[0.65rem] block">
                  {t('login.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  placeholder={t('login.emailPlaceholder')}
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  aria-invalid={!!errorMessage}
                  className={cn(
                    'w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint',
                    'transition-shadow duration-180',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas',
                    errorMessage ? 'border-danger' : 'border-rule hover:border-rule-strong',
                  )}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="eyebrow text-[0.65rem] block">
                    {t('login.password')}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-xs text-ink-faint hover:text-ink underline-offset-2 hover:underline transition-colors duration-180 disabled:opacity-50"
                    >
                      {t('login.forgot')}
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  placeholder={mode === 'signup' ? t('login.passwordPlaceholderNew') : '••••••••'}
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  aria-invalid={!!errorMessage}
                  className={cn(
                    'w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint',
                    'transition-shadow duration-180',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas',
                    errorMessage ? 'border-danger' : 'border-rule hover:border-rule-strong',
                  )}
                />
              </div>

              {errorMessage && (
                <p id="login-error" className="text-sm text-danger" role="alert">
                  {errorMessage}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
              >
                {loading
                  ? (mode === 'signup' ? t('login.loadingSignUp') : t('login.loadingSignIn'))
                  : (mode === 'signup' ? t('login.submitSignUp') : t('login.submitSignIn'))}
              </Button>
            </form>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-rule" />
                <span className="eyebrow text-[0.65rem] text-ink-faint">{t('login.or')}</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon /> {t('login.google')}
              </Button>
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading}
                className="block w-full text-center text-xs text-ink-faint hover:text-ink underline-offset-2 hover:underline transition-colors duration-180 disabled:opacity-50"
              >
                {t('login.magicLink')}
              </button>
            </div>

            <p className="text-center text-xs text-ink-faint leading-relaxed">
              {t('login.privacy')}
              <br />
              {t('login.privacyLine2')}
            </p>

          </div>
        )}
      </div>

      <footer className="py-6 text-center">
        <p className="text-xs text-ink-faint font-display italic">{t('login.footer')}</p>
      </footer>
    </div>
  );
}

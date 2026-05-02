import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';
import { Button } from '../components/ui';
import { cn } from '../components/ui/cn';
import { getSupabaseBrowserClient } from '../utils/supabase';
import { useTranslation } from '../i18n/useTranslation';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const supabaseConfigured = useFinanceStore((s) => s.supabaseConfigured);
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  // Listen for the PASSWORD_RECOVERY event Supabase fires after the link is clicked.
  // If the user already has a session (e.g. arrived via the recovery hash on first
  // mount), allow the form right away.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return undefined;
    if (supabaseUser) setRecoveryReady(true);
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setRecoveryReady(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabaseUser]);

  if (!supabaseConfigured) {
    // No Supabase, no recovery flow. Bounce to login (which will then bounce to dashboard).
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('resetPassword.errorTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.errorMismatch'));
      return;
    }
    setLoading(true);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error(t('resetPassword.notConfigured'));
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || t('resetPassword.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="mb-14 flex flex-col items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong bg-surface-raised shadow-lift">
            <span className="font-display text-xl leading-none text-ink">ƒ</span>
          </span>
          <span className="eyebrow text-[0.65rem] text-ink-faint">{t('resetPassword.eyebrow')}</span>
        </div>

        <div className="w-full max-w-sm space-y-8 animate-rise">
          <div className="space-y-3">
            <h1 className="font-display text-5xl text-ink leading-[0.92] tracking-tight">
              {t('resetPassword.title')}
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              {recoveryReady
                ? t('resetPassword.subtitle')
                : t('resetPassword.verifying')}
            </p>
          </div>

          {recoveryReady && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <label htmlFor="new-password" className="eyebrow text-[0.65rem] block">
                  {t('resetPassword.newPassword')}
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder={t('resetPassword.newPasswordPlaceholder')}
                  aria-invalid={!!error}
                  className={cn(
                    'w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint',
                    'transition-shadow duration-180',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas',
                    error ? 'border-danger' : 'border-rule hover:border-rule-strong',
                  )}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="eyebrow text-[0.65rem] block">
                  {t('resetPassword.confirmPassword')}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                  aria-invalid={!!error}
                  className={cn(
                    'w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint',
                    'transition-shadow duration-180',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas',
                    error ? 'border-danger' : 'border-rule hover:border-rule-strong',
                  )}
                />
              </div>

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
              >
                {loading ? t('resetPassword.updating') : t('resetPassword.update')}
              </Button>
            </form>
          )}
        </div>
      </div>

      <footer className="py-6 text-center">
        <p className="text-xs text-ink-faint font-display italic">{t('resetPassword.footer')}</p>
      </footer>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField, Input, Toggle } from '../components/ui';
import { useTranslation } from '../i18n/useTranslation';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const settings = useFinanceStore((state) => state.settings);
  const savingsConfig = useFinanceStore((state) => state.savingsConfig);
  const holdings = useFinanceStore((state) => state.holdings);
  const bankAccounts = useFinanceStore((state) => state.bankAccounts || []);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const saveEntity = useFinanceStore((state) => state.saveEntity);
  const saveSavingsConfig = useFinanceStore((state) => state.saveSavingsConfig);

  const { t, locale } = useTranslation();
  const currency = settings.baseCurrency || 'EUR';
  const [saving, setSaving] = useState(false);
  const [setup, setSetup] = useState({
    initialCash: '',
    savingsBalance: '',
    portfolio: holdings.length > 0 || settings.modules?.portfolio === true,
    buckets: false,
    budgets: false,
    recurringIncome: false,
    recurringBills: false,
  });

  const initialCashCents = toCents(setup.initialCash);
  const savingsBalanceCents = toCents(setup.savingsBalance);
  const setupSummary = useMemo(
    () => [
      initialCashCents > 0 ? t('onboarding.summaryAvailableCash', { amount: formatCurrency(initialCashCents, currency, locale) }) : null,
      savingsBalanceCents > 0 ? t('onboarding.summaryCurrentSavings', { amount: formatCurrency(savingsBalanceCents, currency, locale) }) : null,
      setup.portfolio ? t('onboarding.summaryPortfolioEnabled') : t('onboarding.summaryPortfolioHidden'),
      setup.buckets ? t('onboarding.summaryBuckets') : null,
      setup.budgets ? t('onboarding.summaryBudgets') : null,
      setup.recurringIncome ? t('onboarding.summaryRecurringIncome') : null,
      setup.recurringBills ? t('onboarding.summaryRecurringBills') : null,
    ].filter(Boolean),
    [currency, initialCashCents, locale, savingsBalanceCents, setup, t],
  );

  const completeWithoutSetup = async () => {
    setSaving(true);
    try {
      await updateSettings({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingTutorialCompleted: true,
        startTutorialAfterSetup: false,
        modules: {
          ...(settings.modules || {}),
          portfolio: holdings.length > 0 || settings.modules?.portfolio === true,
        },
      });
      navigate('/dashboard', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const completeSetup = async () => {
    setSaving(true);
    try {
      if (savingsBalanceCents > 0) {
        await saveSavingsConfig({
          ...savingsConfig,
          currentBalanceCents: (savingsConfig.currentBalanceCents || 0) + savingsBalanceCents,
        });
      }
      if (initialCashCents > 0) {
        const mainAccount = bankAccounts.find((account) => account.id === 'bank-main') || bankAccounts[0];
        await saveEntity('bankAccounts', {
          ...(mainAccount || { id: 'bank-main', name: 'Main bank' }),
          balanceCents: (mainAccount?.balanceCents || 0) + initialCashCents,
          currency,
        });
      }

      await updateSettings({
        initialCashBalanceCents: 0,
        modules: {
          ...(settings.modules || {}),
          portfolio: holdings.length > 0 || setup.portfolio,
        },
        setupIntent: {
          ...(settings.setupIntent || {}),
          buckets: setup.buckets,
          budgets: setup.budgets,
          recurringIncome: setup.recurringIncome,
          recurringBills: setup.recurringBills,
        },
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingTutorialCompleted: !settings.startTutorialAfterSetup,
        startTutorialAfterSetup: false,
        initialSetupCompleted: true,
        initialSetupCompletedAt: new Date().toISOString(),
      });
      navigate('/dashboard', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const updateSetup = (key, value) => setSetup((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto grid max-w-2xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
          <div>
            <p className="eyebrow">{t('onboarding.eyebrow')}</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-ink">{t('onboarding.title')}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={completeWithoutSetup} disabled={saving}>
            {t('onboarding.skipForNow')}
          </Button>
        </header>

        <Card
          eyebrow={t('onboarding.cardEyebrow')}
          title={t('onboarding.cardTitle')}
          description={t('onboarding.cardDescription')}
        >
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={t('onboarding.availableCash', { currency })} hint={t('onboarding.availableCashHint')}>
                {({ id, ...props }) => (
                  <Input
                    id={id}
                    {...props}
                    type="number"
                    min="0"
                    step="0.01"
                    numeric
                    value={setup.initialCash}
                    onChange={(event) => updateSetup('initialCash', event.target.value)}
                    placeholder="0.00"
                  />
                )}
              </FormField>
              <FormField label={t('onboarding.currentSavings', { currency })} hint={t('onboarding.currentSavingsHint')}>
                {({ id, ...props }) => (
                  <Input
                    id={id}
                    {...props}
                    type="number"
                    min="0"
                    step="0.01"
                    numeric
                    value={setup.savingsBalance}
                    onChange={(event) => updateSetup('savingsBalance', event.target.value)}
                    placeholder="0.00"
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-3">
              <Toggle
                id="setup-portfolio"
                checked={setup.portfolio}
                onChange={(checked) => updateSetup('portfolio', checked)}
                label={t('onboarding.usePortfolio')}
                description={t('onboarding.usePortfolioDescription')}
              />
              <Toggle
                id="setup-buckets"
                checked={setup.buckets}
                onChange={(checked) => updateSetup('buckets', checked)}
                label={t('onboarding.wantBuckets')}
                description={t('onboarding.wantBucketsDescription')}
              />
              <Toggle
                id="setup-budgets"
                checked={setup.budgets}
                onChange={(checked) => updateSetup('budgets', checked)}
                label={t('onboarding.wantBudgets')}
                description={t('onboarding.wantBudgetsDescription')}
              />
              <Toggle
                id="setup-recurring-income"
                checked={setup.recurringIncome}
                onChange={(checked) => updateSetup('recurringIncome', checked)}
                label={t('onboarding.recurringIncome')}
                description={t('onboarding.recurringIncomeDescription')}
              />
              <Toggle
                id="setup-recurring-bills"
                checked={setup.recurringBills}
                onChange={(checked) => updateSetup('recurringBills', checked)}
                label={t('onboarding.recurringBills')}
                description={t('onboarding.recurringBillsDescription')}
              />
            </div>

            {setupSummary.length ? (
              <div className="rounded-md border border-rule bg-surface-sunken p-4">
                <p className="eyebrow mb-3">Will save</p>
                <ul className="grid gap-2">
                  {setupSummary.map((item) => (
                    <li key={item} className="text-sm text-ink-muted">{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>

        <footer className="flex items-center justify-end gap-3">
          <Button variant="primary" onClick={completeSetup} disabled={saving}>
            {saving ? 'Saving...' : 'Finish setup'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

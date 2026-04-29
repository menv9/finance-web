import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField, Input, Toggle } from '../components/ui';
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
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const saveSavingsConfig = useFinanceStore((state) => state.saveSavingsConfig);

  const currency = settings.baseCurrency || 'EUR';
  const locale = settings.locale || 'en-GB';
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
      initialCashCents > 0 ? `Available cash: ${formatCurrency(initialCashCents, currency, locale)}` : null,
      savingsBalanceCents > 0 ? `Current savings: ${formatCurrency(savingsBalanceCents, currency, locale)}` : null,
      setup.portfolio ? 'Portfolio module enabled' : 'Portfolio module hidden',
      setup.buckets ? 'Savings bucket prompts enabled' : null,
      setup.budgets ? 'Budget prompts enabled' : null,
      setup.recurringIncome ? 'Recurring income prompts enabled' : null,
      setup.recurringBills ? 'Recurring bill prompts enabled' : null,
    ].filter(Boolean),
    [currency, initialCashCents, locale, savingsBalanceCents, setup],
  );

  const completeWithoutSetup = async () => {
    setSaving(true);
    try {
      await updateSettings({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingTutorialCompleted: true,
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

      await updateSettings({
        initialCashBalanceCents: (settings.initialCashBalanceCents || 0) + initialCashCents,
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
        onboardingTutorialCompleted: true,
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
            <p className="eyebrow">FinGes setup</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-ink">Initial setup</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={completeWithoutSetup} disabled={saving}>
            Skip for now
          </Button>
        </header>

        <Card
          eyebrow="Essentials"
          title="Set your starting point"
          description="Only the basics. You can create detailed records later from each page."
        >
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={`Available cash (${currency})`} hint="Money already available to spend.">
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
              <FormField label={`Current savings (${currency})`} hint="Money already set aside in savings.">
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
                label="Use Portfolio"
                description="Show Portfolio in navigation. It stays enabled if you already have holdings."
              />
              <Toggle
                id="setup-buckets"
                checked={setup.buckets}
                onChange={(checked) => updateSetup('buckets', checked)}
                label="I want savings buckets"
                description="FinGes can prompt you to create savings targets later."
              />
              <Toggle
                id="setup-budgets"
                checked={setup.budgets}
                onChange={(checked) => updateSetup('budgets', checked)}
                label="I want category budgets"
                description="FinGes can prompt you to plan monthly category limits later."
              />
              <Toggle
                id="setup-recurring-income"
                checked={setup.recurringIncome}
                onChange={(checked) => updateSetup('recurringIncome', checked)}
                label="I have recurring income"
                description="FinGes can remind you to add fixed monthly income later."
              />
              <Toggle
                id="setup-recurring-bills"
                checked={setup.recurringBills}
                onChange={(checked) => updateSetup('recurringBills', checked)}
                label="I have recurring bills"
                description="FinGes can remind you to add recurring bills later."
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

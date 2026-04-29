import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField, Input, Toggle } from '../components/ui';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';

const tutorialSteps = [
  {
    eyebrow: 'Dashboard',
    title: 'See the whole picture first',
    body: 'Your dashboard turns cash, savings, portfolio value, income, and expenses into one quick financial snapshot.',
    points: ['Total balance stays available immediately', 'Monthly cashflow shows what is left this month', 'Charts explain trends without opening each module'],
  },
  {
    eyebrow: 'Income',
    title: 'Separate received money from reporting months',
    body: 'Income can be received today and still belong to a chosen accounting month, so cash and reports both make sense.',
    points: ['Log salary, client work, dividends, and interest', 'Choose the accounting month when needed', 'Recurring income can be added later from the Income page'],
  },
  {
    eyebrow: 'Expenses',
    title: 'Track spending and recurring bills',
    body: 'Expenses are for real outflows. Recurring bills help you remember predictable monthly charges without rebuilding them each month.',
    points: ['Log one-off spending quickly', 'Create recurring bills from Expenses', 'Import bank CSVs from Settings'],
  },
  {
    eyebrow: 'Budgets',
    title: 'Plan limits before the month runs away',
    body: 'Budgets set monthly category limits and compare your plan against actual monthly cashflow.',
    points: ['Set limits by category', 'Compare cashflow minus budgets', 'Roll leftover budget into balance or savings'],
  },
  {
    eyebrow: 'Savings',
    title: 'Use buckets for money with a purpose',
    body: 'Savings tracks money set aside, and buckets let you split that saving into targets like trips, car repairs, or taxes.',
    points: ['Create savings targets', 'Add or withdraw money from buckets', 'Spend from a bucket and create the expense automatically'],
  },
  {
    eyebrow: 'Portfolio',
    title: 'Portfolio is optional',
    body: 'If you invest, Portfolio can track holdings, cashflows, dividends, sales, and allocation targets. If not, keep it hidden.',
    points: ['Enable it only if useful', 'Track holdings and realized sales', 'Refresh prices when you add an API key'],
  },
  {
    eyebrow: 'Settings',
    title: 'Settings is your control room',
    body: 'Settings manages modules, categories, imports, backups, sync, and the activity history with undo.',
    points: ['Turn optional modules on or off', 'Backup and restore your data', 'Review changes in Activity history'],
  },
];

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function TourMockup({ step }) {
  return (
    <div className="rounded-lg border border-rule bg-surface-sunken p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="eyebrow">{step.eyebrow}</span>
        <span className="h-2 w-2 rounded-full bg-accent" />
      </div>
      <div className="grid gap-3">
        <div className="h-12 rounded-md border border-rule bg-surface-raised" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-md border border-rule bg-surface-raised" />
          <div className="h-20 rounded-md border border-rule bg-surface-raised" />
          <div className="h-20 rounded-md border border-rule bg-surface-raised" />
        </div>
        <div className="h-24 rounded-md border border-rule bg-surface-raised" />
      </div>
    </div>
  );
}

function StepDots({ index }) {
  return (
    <div className="flex items-center gap-1.5">
      {tutorialSteps.map((step, i) => (
        <span
          key={step.eyebrow}
          className={[
            'h-1.5 rounded-full transition-all duration-180',
            i === index ? 'w-6 bg-accent' : i < index ? 'w-3 bg-accent/50' : 'w-3 bg-rule-strong',
          ].join(' ')}
        />
      ))}
    </div>
  );
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
  const [mode, setMode] = useState('tutorial');
  const [stepIndex, setStepIndex] = useState(0);
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

  const currentStep = tutorialSteps[stepIndex];
  const isLastTutorialStep = stepIndex === tutorialSteps.length - 1;
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
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
          <div>
            <p className="eyebrow">FinGes setup</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-ink">
              {mode === 'setup' ? 'Initial setup' : 'Financial tutorial'}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={completeWithoutSetup} disabled={saving}>
            Skip for now
          </Button>
        </header>

        {mode === 'tutorial' ? (
          <Card
            eyebrow={currentStep.eyebrow}
            title={currentStep.title}
            description={currentStep.body}
            action={<StepDots index={stepIndex} />}
          >
            <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
              <TourMockup step={currentStep} />
              <div className="grid content-center gap-3">
                {currentStep.points.map((point) => (
                  <div key={point} className="rounded-md border border-rule bg-surface-raised px-4 py-3 text-sm text-ink-muted">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {mode === 'choice' ? (
          <Card
            eyebrow="Next"
            title="Set up essentials now or jump in"
            description="The tutorial is done. Initial setup is optional and only saves balances plus module preferences."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setMode('setup')}
                className="rounded-lg border border-accent bg-accent-soft p-5 text-left transition-colors hover:border-accent-strong"
              >
                <p className="text-sm font-medium text-ink">Start initial setup</p>
                <p className="mt-2 text-xs text-ink-muted">Add cash, savings, and module preferences.</p>
              </button>
              <button
                type="button"
                onClick={completeWithoutSetup}
                disabled={saving}
                className="rounded-lg border border-rule bg-surface-raised p-5 text-left transition-colors hover:border-rule-strong disabled:opacity-50"
              >
                <p className="text-sm font-medium text-ink">Skip for now</p>
                <p className="mt-2 text-xs text-ink-muted">Mark onboarding complete without creating records.</p>
              </button>
              <button
                type="button"
                onClick={completeWithoutSetup}
                disabled={saving}
                className="rounded-lg border border-rule bg-surface-raised p-5 text-left transition-colors hover:border-rule-strong disabled:opacity-50"
              >
                <p className="text-sm font-medium text-ink">Go to dashboard</p>
                <p className="mt-2 text-xs text-ink-muted">Enter the app and configure later from each module.</p>
              </button>
            </div>
          </Card>
        ) : null}

        {mode === 'setup' ? (
          <Card
            eyebrow="Essentials"
            title="Initial setup"
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
        ) : null}

        <footer className="flex items-center justify-between gap-3">
          {mode === 'tutorial' ? (
            <Button variant="ghost" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0 || saving}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setMode(mode === 'setup' ? 'choice' : 'tutorial')} disabled={saving}>
              Back
            </Button>
          )}
          <div className="flex items-center gap-2">
            {mode === 'tutorial' ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (isLastTutorialStep) setMode('choice');
                  else setStepIndex((value) => value + 1);
                }}
              >
                {isLastTutorialStep ? 'Continue' : 'Next'}
              </Button>
            ) : null}
            {mode === 'choice' ? (
              <Button variant="secondary" onClick={completeWithoutSetup} disabled={saving}>
                Go to dashboard
              </Button>
            ) : null}
            {mode === 'setup' ? (
              <Button variant="primary" onClick={completeSetup} disabled={saving}>
                {saving ? 'Saving setup...' : 'Finish setup'}
              </Button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
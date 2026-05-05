import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField, Input, Select, Toggle } from '../components/ui';
import { useTranslation } from '../i18n/useTranslation';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function InlineItemsField({ items, onAdd, onRemove, currency, locale, namePlaceholder, fillLaterHint, t }) {
  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState('');

  const handleAdd = () => {
    const name = draftName.trim();
    const cents = toCents(draftAmount);
    if (!name || !cents) return;
    onAdd({ name, amountCents: cents });
    setDraftName('');
    setDraftAmount('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  };

  return (
    <div className="mt-2 grid gap-3 rounded-md border border-rule bg-surface-raised p-3">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-canvas px-3 py-1 text-xs text-ink"
            >
              <span>{item.name}</span>
              <span className="text-ink-muted">·</span>
              <span className="font-mono">{formatCurrency(item.amountCents, currency, locale)}</span>
              <button
                type="button"
                className="ml-0.5 text-ink-faint transition-colors hover:text-danger"
                onClick={() => onRemove(i)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draftName}
          placeholder={namePlaceholder}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          numeric
          value={draftAmount}
          placeholder={`0.00 ${currency}`}
          onChange={(e) => setDraftAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-32"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleAdd}
          disabled={!draftName.trim() || !draftAmount}
        >
          {t('common.add')}
        </Button>
      </div>
      <p className="text-xs text-ink-faint">{fillLaterHint}</p>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const settings = useFinanceStore((state) => state.settings);
  const savingsConfig = useFinanceStore((state) => state.savingsConfig);
  const holdings = useFinanceStore((state) => state.holdings);
  const bankAccounts = useFinanceStore((state) => state.bankAccounts || []);
  const investmentPortfolios = useFinanceStore((state) => state.investmentPortfolios || []);
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
    social: settings.modules?.social !== false,
    recurringIncome: false,
    recurringIncomeItems: [],
    recurringBills: false,
    recurringBillItems: [],
  });

  const initialCashCents = toCents(setup.initialCash);
  const savingsBalanceCents = toCents(setup.savingsBalance);

  const setupSummary = useMemo(() => {
    const lines = [];
    if (initialCashCents > 0)
      lines.push(t('onboarding.summaryAvailableCash', { amount: formatCurrency(initialCashCents, currency, locale) }));
    if (savingsBalanceCents > 0)
      lines.push(t('onboarding.summaryCurrentSavings', { amount: formatCurrency(savingsBalanceCents, currency, locale) }));
    lines.push(setup.portfolio ? t('onboarding.summaryPortfolioEnabled') : t('onboarding.summaryPortfolioHidden'));
    lines.push(setup.social ? t('onboarding.summarySocialEnabled') : t('onboarding.summarySocialHidden'));
    for (const item of setup.recurringIncomeItems)
      lines.push(`${item.name} · ${formatCurrency(item.amountCents, currency, locale)}`);
    for (const item of setup.recurringBillItems)
      lines.push(`${item.name} · ${formatCurrency(item.amountCents, currency, locale)}`);
    return lines;
  }, [currency, initialCashCents, locale, savingsBalanceCents, setup, t]);

  const updateSetup = (key, value) => setSetup((prev) => ({ ...prev, [key]: value }));

  const addIncomeItem = (item) =>
    setSetup((prev) => ({ ...prev, recurringIncomeItems: [...prev.recurringIncomeItems, item] }));
  const removeIncomeItem = (index) =>
    setSetup((prev) => ({ ...prev, recurringIncomeItems: prev.recurringIncomeItems.filter((_, i) => i !== index) }));

  const addBillItem = (item) =>
    setSetup((prev) => ({ ...prev, recurringBillItems: [...prev.recurringBillItems, item] }));
  const removeBillItem = (index) =>
    setSetup((prev) => ({ ...prev, recurringBillItems: prev.recurringBillItems.filter((_, i) => i !== index) }));

  const completeWithoutSetup = async () => {
    setSaving(true);
    try {
      if (!bankAccounts.length) {
        await saveEntity('bankAccounts', { id: 'bank-main', name: 'Main bank', balanceCents: 0, currency });
      }
      await updateSettings({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingTutorialCompleted: true,
        startTutorialAfterSetup: false,
        modules: {
          ...(settings.modules || {}),
          portfolio: holdings.length > 0 || settings.modules?.portfolio === true,
          social: setup.social,
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

      const mainAccount = bankAccounts.find((a) => a.id === 'bank-main') || bankAccounts[0];
      await saveEntity('bankAccounts', {
        ...(mainAccount || { id: 'bank-main', name: 'Main bank' }),
        balanceCents: (mainAccount?.balanceCents || 0) + initialCashCents,
        currency,
      });

      if ((setup.portfolio || holdings.length > 0) && !investmentPortfolios.length) {
        await saveEntity('investmentPortfolios', {
          id: 'ipr-main',
          name: 'Main Portfolio',
          description: '',
          color: '#0f5132',
        });
      }

      for (const item of setup.recurringIncomeItems) {
        await saveEntity('incomes', {
          source: item.name,
          amountCents: item.amountCents,
          currency,
          incomeKind: 'fixed',
          isRecurringSchedule: true,
          frequency: 'monthly',
          payDay: 1,
          date: new Date().toISOString().slice(0, 10),
          accountingMonth: new Date().toISOString().slice(0, 7),
        });
      }

      for (const item of setup.recurringBillItems) {
        await saveEntity('fixedExpenses', {
          name: item.name,
          amountCents: item.amountCents,
          currency,
          category: settings.categories?.[0] || 'Other',
          chargeDay: 1,
          active: true,
          alerts: true,
        });
      }

      await updateSettings({
        initialCashBalanceCents: 0,
        modules: {
          ...(settings.modules || {}),
          portfolio: holdings.length > 0 || setup.portfolio,
          social: setup.social,
        },
        setupIntent: {
          ...(settings.setupIntent || {}),
          recurringIncome: setup.recurringIncome && setup.recurringIncomeItems.length === 0,
          recurringBills: setup.recurringBills && setup.recurringBillItems.length === 0,
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
            {/* Currency + language */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={t('settings.preferences.baseCurrency')} htmlFor="onboarding-currency">
                <Select
                  id="onboarding-currency"
                  value={currency}
                  onChange={(e) => updateSettings({ baseCurrency: e.target.value })}
                >
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar</option>
                  <option value="GBP">GBP — Pound</option>
                </Select>
              </FormField>
              <FormField label={t('settings.language.title')} htmlFor="onboarding-language">
                <Select
                  id="onboarding-language"
                  value={settings.language || 'en'}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                >
                  <option value="en">{t('settings.language.english.label')}</option>
                  <option value="es">{t('settings.language.spanish.label')}</option>
                </Select>
              </FormField>
            </div>

            {/* Financial starting point */}
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
                    onChange={(e) => updateSetup('initialCash', e.target.value)}
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
                    onChange={(e) => updateSetup('savingsBalance', e.target.value)}
                    placeholder="0.00"
                  />
                )}
              </FormField>
            </div>

            {/* Module toggles */}
            <div className="grid gap-3">
              <Toggle
                id="setup-portfolio"
                checked={setup.portfolio}
                onChange={(checked) => updateSetup('portfolio', checked)}
                label={t('onboarding.usePortfolio')}
                description={t('onboarding.usePortfolioDescription')}
              />
              <Toggle
                id="setup-social"
                checked={setup.social}
                onChange={(checked) => updateSetup('social', checked)}
                label={t('onboarding.useSocial')}
                description={t('onboarding.useSocialDescription')}
              />

              {/* Recurring income */}
              <div>
                <Toggle
                  id="setup-recurring-income"
                  checked={setup.recurringIncome}
                  onChange={(checked) => updateSetup('recurringIncome', checked)}
                  label={t('onboarding.recurringIncome')}
                  description={t('onboarding.recurringIncomeDescription')}
                />
                {setup.recurringIncome && (
                  <InlineItemsField
                    items={setup.recurringIncomeItems}
                    onAdd={addIncomeItem}
                    onRemove={removeIncomeItem}
                    currency={currency}
                    locale={locale}
                    namePlaceholder={t('onboarding.incomeNamePlaceholder')}
                    fillLaterHint={t('onboarding.setLaterIncome')}
                    t={t}
                  />
                )}
              </div>

              {/* Recurring bills */}
              <div>
                <Toggle
                  id="setup-recurring-bills"
                  checked={setup.recurringBills}
                  onChange={(checked) => updateSetup('recurringBills', checked)}
                  label={t('onboarding.recurringBills')}
                  description={t('onboarding.recurringBillsDescription')}
                />
                {setup.recurringBills && (
                  <InlineItemsField
                    items={setup.recurringBillItems}
                    onAdd={addBillItem}
                    onRemove={removeBillItem}
                    currency={currency}
                    locale={locale}
                    namePlaceholder={t('onboarding.billsNamePlaceholder')}
                    fillLaterHint={t('onboarding.setLaterExpenses')}
                    t={t}
                  />
                )}
              </div>
            </div>

            {/* Summary */}
            {setupSummary.length > 0 && (
              <div className="rounded-md border border-rule bg-surface-sunken p-4">
                <p className="eyebrow mb-3">{t('onboarding.willSave')}</p>
                <ul className="grid gap-2">
                  {setupSummary.map((item) => (
                    <li key={item} className="text-sm text-ink-muted">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <footer className="flex items-center justify-end gap-3">
          <Button variant="primary" onClick={completeSetup} disabled={saving}>
            {saving ? t('onboarding.saving') : t('onboarding.finishSetup')}
          </Button>
        </footer>
      </div>
    </div>
  );
}

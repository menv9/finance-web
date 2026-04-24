import { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { normalizeDateInput } from '../../utils/dates';
import { formatCurrency } from '../../utils/formatters';
import { Button, FormField, Input, Select } from '../ui';

const TO_OPTIONS = {
  savings: [
    { value: 'expenses', label: 'Expenses (pay from savings)' },
    { value: 'portfolio', label: 'Portfolio (invest from savings)' },
  ],
  income: [
    { value: 'savings', label: 'Savings' },
    { value: 'portfolio', label: 'Portfolio' },
  ],
};

export function TransferForm({ onSubmit, onCancel, defaultFromModule = 'savings' }) {
  const incomes = useFinanceStore((s) => s.incomes);
  const holdings = useFinanceStore((s) => s.holdings);
  const settings = useFinanceStore((s) => s.settings);
  const savingsEntries = useFinanceStore((s) => s.savingsEntries);
  const savingsConfig = useFinanceStore((s) => s.savingsConfig);

  const currency = settings.baseCurrency;
  const locale = settings.locale;

  const [fromModule, setFromModule] = useState(defaultFromModule);
  const [fromId, setFromId] = useState('');
  const [toModule, setToModule] = useState(TO_OPTIONS[defaultFromModule][0].value);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(normalizeDateInput(new Date()));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(settings.categories[0] || '');
  const [ticker, setTicker] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Compute current savings balance for soft warning
  const savingsBalance =
    (savingsConfig?.currentBalanceCents || 0) +
    savingsEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const overdrawnSavings = fromModule === 'savings' && amountCents > savingsBalance && savingsBalance > 0;

  const handleFromModuleChange = (mod) => {
    setFromModule(mod);
    setFromId('');
    setToModule(TO_OPTIONS[mod][0].value);
  };

  const handleSubmit = async () => {
    if (!amountCents || amountCents <= 0) return;
    if (!date) return;
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        amountCents,
        fromModule,
        fromId: fromModule === 'income' ? fromId : null,
        toModule,
        description: description.trim(),
        category: toModule === 'expenses' ? category : null,
        ticker: toModule === 'portfolio' && ticker.trim() ? ticker.trim().toUpperCase() : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // When switching from-module, reset to-module to first valid option
  const toOptions = TO_OPTIONS[fromModule] || [];

  return (
    <div className="grid gap-5">
      {/* From */}
      <FormField label="Transfer from" htmlFor="trf-from-module">
        <Select
          id="trf-from-module"
          value={fromModule}
          onChange={(e) => handleFromModuleChange(e.target.value)}
        >
          <option value="savings">Savings</option>
          <option value="income">Income entry</option>
        </Select>
      </FormField>

      {/* Income picker */}
      {fromModule === 'income' && (
        <FormField label="Income entry" htmlFor="trf-from-id">
          <Select
            id="trf-from-id"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            <option value="">Select an income entry…</option>
            {[...incomes]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.date} — {inc.source} ({formatCurrency(inc.amountCents, inc.currency || currency, locale)})
                </option>
              ))}
          </Select>
        </FormField>
      )}

      {/* Savings balance info */}
      {fromModule === 'savings' && (
        <p className="text-xs text-ink-muted">
          Current savings balance:{' '}
          <span className="font-mono font-medium text-ink">
            {formatCurrency(savingsBalance, currency, locale)}
          </span>
        </p>
      )}

      {/* To */}
      <FormField label="Transfer to" htmlFor="trf-to-module">
        <Select
          id="trf-to-module"
          value={toModule}
          onChange={(e) => setToModule(e.target.value)}
        >
          {toOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </FormField>

      {/* Amount + Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={`Amount (${currency})`} htmlFor="trf-amount">
          <Input
            id="trf-amount"
            type="number"
            min="0.01"
            step="0.01"
            numeric
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Date" htmlFor="trf-date">
          <Input
            id="trf-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </FormField>
      </div>

      {/* Overdraft warning */}
      {overdrawnSavings && (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          This exceeds your current savings balance of{' '}
          {formatCurrency(savingsBalance, currency, locale)}. You can still proceed.
        </p>
      )}

      {/* Description */}
      <FormField label="Description" htmlFor="trf-desc">
        <Input
          id="trf-desc"
          type="text"
          placeholder={toModule === 'expenses' ? 'e.g. Car repair — mechanic' : 'e.g. Monthly investment'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      {/* Category (expenses only) */}
      {toModule === 'expenses' && (
        <FormField label="Expense category" htmlFor="trf-category">
          <Select
            id="trf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {settings.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </FormField>
      )}

      {/* Ticker (portfolio only) */}
      {toModule === 'portfolio' && (
        <>
          <datalist id="trf-ticker-list">
            {holdings.map((h) => <option key={h.id} value={h.ticker} />)}
          </datalist>
          <FormField
            label="Ticker (optional)"
            hint="Leave blank for a general portfolio deposit — useful when you haven't bought yet"
            htmlFor="trf-ticker"
          >
            <Input
              id="trf-ticker"
              type="text"
              list="trf-ticker-list"
              placeholder="e.g. VWCE.DE"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
            />
          </FormField>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!amountCents || amountCents <= 0 || (fromModule === 'income' && !fromId)}
        >
          Create transfer
        </Button>
      </div>
    </div>
  );
}

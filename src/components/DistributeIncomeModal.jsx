import { useMemo, useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { Button, FormField, Select, Input, Modal } from './ui';

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DistributeIncomeModal({ open, onClose, income }) {
  const settings = useFinanceStore((s) => s.settings);
  const transfers = useFinanceStore((s) => s.transfers);
  const distributeIncome = useFinanceStore((s) => s.distributeIncome);

  const currency = settings.baseCurrency;
  const locale = settings.locale;

  // Pre-fill rows from allocationRules if defined for this income source
  const rules = income ? (settings.allocationRules?.[income.source] || []) : [];

  const initialRows = useMemo(() => {
    if (!income) return [{ toModule: 'savings', amount: '' }];
    if (rules.length > 0) {
      return rules.map((r) => ({
        toModule: r.toModule,
        amount: r.kind === 'percent'
          ? ((income.amountCents * r.percent) / 10000).toFixed(2)
          : (r.amountCents / 100).toFixed(2),
      }));
    }
    return [{ toModule: 'savings', amount: '' }];
  }, [income, rules]);

  const [rows, setRows] = useState(initialRows);
  const [submitting, setSubmitting] = useState(false);

  // Already allocated from this income
  const alreadyAllocated = income
    ? transfers.filter((t) => t.fromId === income.id && t.fromModule === 'income')
    : [];

  const alreadyAllocatedCents = alreadyAllocated.reduce((s, t) => s + t.amountCents, 0);

  const totalRowsCents = rows.reduce((s, r) => {
    const v = Math.round(parseFloat(r.amount || '0') * 100);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  const remainingCents = income
    ? income.amountCents - alreadyAllocatedCents - totalRowsCents
    : 0;

  const addRow = () => setRows((prev) => [...prev, { toModule: 'savings', amount: '' }]);

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    const valid = rows
      .map((r) => ({ toModule: r.toModule, amountCents: Math.round(parseFloat(r.amount || '0') * 100) }))
      .filter((r) => r.amountCents > 0);
    if (!valid.length) return;
    setSubmitting(true);
    try {
      await distributeIncome(income.id, valid);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!income) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Income distribution"
      title={`Distribute — ${income.source}`}
      description="Decide how much goes to savings or portfolio. The rest stays discretionary."
      size="md"
    >
      <div className="grid gap-5">
        {/* Income summary */}
        <div className="rounded-md border border-rule bg-surface-sunken px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">Total income</span>
            <span className="numeric font-medium text-ink">
              {formatCurrency(income.amountCents, income.currency || currency, locale)}
            </span>
          </div>
          {alreadyAllocatedCents > 0 && (
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">Already distributed</span>
              <span className="numeric text-ink-muted">
                − {formatCurrency(alreadyAllocatedCents, currency, locale)}
              </span>
            </div>
          )}
          {alreadyAllocated.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {alreadyAllocated.map((t) => (
                <li key={t.id} className="flex justify-between text-xs text-ink-faint">
                  <span>→ {t.toModule.charAt(0).toUpperCase() + t.toModule.slice(1)}</span>
                  <span className="numeric">{formatCurrency(t.amountCents, currency, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Allocation rows */}
        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <FormField label={index === 0 ? 'Destination' : undefined} htmlFor={`dist-to-${index}`}>
                <Select
                  id={`dist-to-${index}`}
                  value={row.toModule}
                  onChange={(e) => updateRow(index, 'toModule', e.target.value)}
                >
                  <option value="savings">Savings</option>
                  <option value="portfolio">Portfolio</option>
                </Select>
              </FormField>
              <FormField label={index === 0 ? `Amount (${currency})` : undefined} htmlFor={`dist-amt-${index}`}>
                <Input
                  id={`dist-amt-${index}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  numeric
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(index, 'amount', e.target.value)}
                />
              </FormField>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="mb-px flex h-10 w-10 items-center justify-center rounded-md text-ink-faint hover:text-danger transition-colors"
                aria-label="Remove row"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={addRow} leading={<PlusIcon />} className="justify-start">
          Add destination
        </Button>

        {/* Remaining */}
        <div className={
          'flex items-baseline justify-between rounded-md border px-4 py-3 text-sm ' +
          (remainingCents < 0 ? 'border-danger/40 bg-danger-soft' : 'border-rule bg-surface-sunken')
        }>
          <span className="text-ink-muted">Remaining (discretionary)</span>
          <span className={
            'numeric font-medium ' +
            (remainingCents < 0 ? 'text-danger' : remainingCents === 0 ? 'text-positive' : 'text-ink')
          }>
            {formatCurrency(remainingCents, currency, locale)}
          </span>
        </div>

        {remainingCents < 0 && (
          <p className="text-xs text-danger">
            The total exceeds the income amount. Reduce one of the values above.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={submitting}
            onClick={handleConfirm}
            disabled={remainingCents < 0 || totalRowsCents <= 0}
          >
            Distribute
          </Button>
        </div>
      </div>
    </Modal>
  );
}

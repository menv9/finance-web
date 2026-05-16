import { useState } from 'react';
import { Button, FormField, Input } from '../ui';
import { formatCurrency } from '../../utils/formatters';

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function InlineItemsField({ items, onAdd, onRemove, currency, locale, namePlaceholder, fillLaterHint, t }) {
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
      <div className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
        <FormField label={t('onboarding.itemNameLabel')}>
          <Input
            value={draftName}
            placeholder={namePlaceholder}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </FormField>
        <FormField label={t('onboarding.itemAmountLabel', { currency })}>
          <Input
            type="number"
            min="0"
            step="0.01"
            numeric
            value={draftAmount}
            placeholder="0.00"
            onChange={(e) => setDraftAmount(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </FormField>
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

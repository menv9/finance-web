import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Button, Select } from '../ui';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  amountCents: '',
  note: '',
  goalId: '',
};

export function SavingsEntryForm({
  initialValue,
  currency = 'EUR',
  goals = [],
  defaultGoalId = '',
  goalLocked = false,
  showBucketSource = false,
  unallocatedSavingsCents = 0,
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    ...defaultValue,
    goalId: defaultGoalId,
    bucketSource: 'balance',
    ...initialValue,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          amountCents: Math.round(Number(form.amountCents || 0) * 100),
          goalId: form.goalId || null,
          bucketSource: form.bucketSource,
        });
      }}
    >
      {showBucketSource ? (
        <FormField
          label="Money source"
          htmlFor="saving-bucket-source"
          hint={`Unallocated savings available: ${(unallocatedSavingsCents / 100).toLocaleString(undefined, { style: 'currency', currency })}`}
          className="md:col-span-2"
        >
          {(props) => (
            <Select {...props} value={form.bucketSource} onChange={set('bucketSource')}>
              <option value="balance">Total balance (adds to total savings)</option>
              <option value="savings">Allocate from total savings</option>
            </Select>
          )}
        </FormField>
      ) : null}

      <FormField label="Date" htmlFor="saving-date">
        {(props) => (
          <Input {...props} type="date" value={form.date} onChange={set('date')} required />
        )}
      </FormField>

      <FormField label={`Amount (${currency})`} htmlFor="saving-amount" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            min="0.01"
            step="0.01"
            numeric
            placeholder="0.00"
            value={form.amountCents}
            onChange={set('amountCents')}
            required
          />
        )}
      </FormField>

      <FormField label="Note" htmlFor="saving-note" hint="Optional" className="md:col-span-2">
        {(props) => (
          <Input
            {...props}
            placeholder="e.g. Birthday money, bonus…"
            value={form.note}
            onChange={set('note')}
          />
        )}
      </FormField>

      {goals.length ? (
        <FormField label="Savings for" htmlFor="saving-goal" className="md:col-span-2">
          {(props) => (
            <Select
              {...props}
              value={form.goalId || ''}
              onChange={set('goalId')}
              disabled={goalLocked}
            >
              <option value="">No goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary">
          {submitLabel || (initialValue ? 'Save changes' : 'Add saving')}
        </Button>
      </div>
    </form>
  );
}

import { useState, useRef } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Button, Select, InfoPopover } from '../ui';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  accountingMonth: normalizeDateInput(new Date()).slice(0, 7),
  amountCents: '',
  note: '',
  goalId: '',
  bankAccountId: '',
};

export function SavingsEntryForm({
  initialValue,
  currency = 'EUR',
  goals = [],
  defaultGoalId = '',
  goalLocked = false,
  showBucketSource = false,
  unallocatedSavingsCents = 0,
  bankAccounts = [],
  metadataOnly = false,
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const defaultBankAccountId = bankAccounts.find((a) => a.isMain)?.id || bankAccounts[0]?.id || '';
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    ...defaultValue,
    goalId: defaultGoalId,
    bucketSource: 'balance',
    bankAccountId: defaultBankAccountId,
    ...initialValue,
    accountingMonth: initialValue?.accountingMonth || initialValue?.date?.slice(0, 7) || defaultValue.accountingMonth,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const onDateChange = (e) => {
    const nextDate = e.target.value;
    setForm((prev) => {
      const wasInSync = prev.date?.slice(0, 7) === prev.accountingMonth;
      return {
        ...prev,
        date: nextDate,
        accountingMonth: wasInSync ? nextDate.slice(0, 7) : prev.accountingMonth,
      };
    });
  };
  const monthsDiffer = form.date && form.accountingMonth && form.date.slice(0, 7) !== form.accountingMonth;
  const formatMonth = (ym) => {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        try {
          await onSubmit({
            ...initialValue,
            ...form,
            amountCents: Math.round(Number(form.amountCents || 0) * 100),
            goalId: form.goalId || null,
            bucketSource: form.bucketSource,
            bankAccountId: form.bankAccountId || null,
          });
        } finally {
          submittingRef.current = false;
          setSubmitting(false);
        }
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
            <Select {...props} value={form.bucketSource} onChange={set('bucketSource')} disabled={metadataOnly}>
              <option value="balance">Total balance (adds to total savings)</option>
              <option value="savings">Allocate from total savings</option>
            </Select>
          )}
        </FormField>
      ) : null}

      <FormField label="Date" htmlFor="saving-date">
        {(props) => (
          <Input {...props} type="date" value={form.date} onChange={onDateChange} required />
        )}
      </FormField>

      <div className="grid gap-1.5">
        <div className="eyebrow flex items-center gap-1.5 text-ink-muted">
          <label htmlFor="saving-accounting-month">Reporting month</label>
          <InfoPopover info="Which month this savings movement counts toward in reports. Defaults to the movement date; change it only for accrual accounting." />
        </div>
        <Input
          id="saving-accounting-month"
          type="month"
          value={form.accountingMonth}
          onChange={set('accountingMonth')}
        />
      </div>

      {monthsDiffer ? (
        <div className="md:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          Reporting a {formatMonth(form.date.slice(0, 7))} movement as {formatMonth(form.accountingMonth)} savings (accrual).
        </div>
      ) : null}

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
            disabled={metadataOnly}
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

      {bankAccounts.length && form.bucketSource !== 'savings' && !metadataOnly ? (
        <FormField label="Deduct from account" htmlFor="saving-bank" className="md:col-span-2" required>
          {(props) => (
            <Select {...props} value={form.bankAccountId || ''} onChange={set('bankAccountId')} required>
              <option value="" disabled>Select account</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isMain ? ' (main)' : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      {goals.length ? (
        <FormField label="Savings for" htmlFor="saving-goal" className="md:col-span-2">
          {(props) => (
            <Select
              {...props}
              value={form.goalId || ''}
              onChange={set('goalId')}
              disabled={goalLocked || metadataOnly}
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
        <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
          {submitLabel || (initialValue ? 'Save changes' : 'Add saving')}
        </Button>
      </div>
    </form>
  );
}

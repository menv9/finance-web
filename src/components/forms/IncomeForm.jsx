import { useEffect, useMemo, useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Select, Button, InfoPopover } from '../ui';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  accountingMonth: normalizeDateInput(new Date()).slice(0, 7),
  amountCents: '',
  currency: 'EUR',
  bankAccountId: '',
  incomeKind: 'variable',
  source: '',
  variableSourceType: 'employer',
  frequency: 'monthly',
  payDay: 1,
  client: '',
  invoiceStatus: 'draft',
  assetTicker: '',
};

function FormSection({ step, title, children }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <h3 className="eyebrow text-ink-muted">{step} - {title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function IncomeKindButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
        active
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-rule-strong bg-surface-raised text-ink-muted hover:border-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function MoneyInput({ amount, currency, onAmountChange, onCurrencyChange }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-rule-strong bg-surface-raised transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
      <select
        value={currency}
        onChange={onCurrencyChange}
        aria-label="Currency"
        className="w-24 shrink-0 border-r border-rule bg-transparent px-3 py-2.5 font-mono text-sm font-semibold text-ink outline-none"
      >
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
        <option value="GBP">GBP</option>
      </select>
      <input
        id="income-amount"
        type="number"
        step="0.01"
        value={amount}
        onChange={onAmountChange}
        placeholder="0.00"
        required
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base font-mono tabular text-ink outline-none placeholder:text-ink-faint sm:text-sm"
      />
    </div>
  );
}

export function IncomeForm({ bankAccounts = [], initialValue, onSubmit, onCancel }) {
  const defaultBankAccountId = useMemo(
    () => initialValue?.bankAccountId || bankAccounts.find((account) => account.isMain)?.id || bankAccounts[0]?.id || '',
    [bankAccounts, initialValue?.bankAccountId],
  );
  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    bankAccountId: defaultBankAccountId,
    accountingMonth: initialValue?.accountingMonth || initialValue?.date?.slice(0, 7) || defaultValue.accountingMonth,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  useEffect(() => {
    if (!bankAccounts.length || form.bankAccountId) return;
    setForm((prev) => ({ ...prev, bankAccountId: defaultBankAccountId }));
  }, [bankAccounts.length, defaultBankAccountId, form.bankAccountId]);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          bankAccountId: bankAccounts.length ? form.bankAccountId || defaultBankAccountId : '',
          amountCents: Math.round(Number(form.amountCents || 0) * 100),
          payDay: Number(form.payDay),
        });
      }}
    >
      <FormSection step="1" title="PAYMENT">
        <FormField label="Date" htmlFor="income-date">
          {(props) => (
            <Input {...props} type="date" value={form.date} onChange={set('date')} />
          )}
        </FormField>

        <div className="grid gap-1.5">
          <div className="eyebrow flex items-center gap-1.5 text-ink-muted">
            <label htmlFor="income-accounting-month">Accounting month</label>
            <InfoPopover info="Month where this income appears in reports." />
          </div>
          <Input
            id="income-accounting-month"
            type="month"
            value={form.accountingMonth}
            onChange={set('accountingMonth')}
          />
        </div>
      </FormSection>

      <FormSection step="2" title="AMOUNT">
        <div className={bankAccounts.length ? '' : 'md:col-span-2'}>
          <MoneyInput
            amount={form.amountCents}
            currency={form.currency}
            onAmountChange={set('amountCents')}
            onCurrencyChange={set('currency')}
          />
        </div>
        {bankAccounts.length ? (
          <FormField label="Account" htmlFor="income-account" required>
            {(props) => (
              <Select {...props} value={form.bankAccountId || defaultBankAccountId} onChange={set('bankAccountId')} required>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.isMain ? ' (main)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        ) : null}
      </FormSection>

      <FormSection step="3" title="INCOME DETAILS">
        <div className="grid grid-cols-3 gap-4 md:col-span-2">
          <IncomeKindButton
            active={form.incomeKind === 'fixed'}
            onClick={() => setForm((prev) => ({ ...prev, incomeKind: 'fixed' }))}
          >
            Fixed
          </IncomeKindButton>
          <IncomeKindButton
            active={form.incomeKind === 'variable'}
            onClick={() => setForm((prev) => ({ ...prev, incomeKind: 'variable' }))}
          >
            Variable
          </IncomeKindButton>
          <IncomeKindButton
            active={form.incomeKind === 'dividend'}
            onClick={() => setForm((prev) => ({ ...prev, incomeKind: 'dividend' }))}
          >
            Asset-linked
          </IncomeKindButton>
        </div>

        {form.incomeKind === 'variable' ? (
          <FormField label="Source" htmlFor="income-source">
            {(props) => (
              <Select {...props} value={form.variableSourceType || 'client'} onChange={set('variableSourceType')}>
                <option value="employer">Employer</option>
                <option value="client">Client</option>
              </Select>
            )}
          </FormField>
        ) : form.incomeKind === 'fixed' ? (
          <FormField
            label="Employer / payer"
            htmlFor="income-source"
          >
            {(props) => <Input {...props} value={form.source} onChange={set('source')} placeholder="e.g. Iberia MRO" />}
          </FormField>
        ) : null}

        {form.incomeKind === 'variable' ? (
          <FormField label={(form.variableSourceType || 'client') === 'employer' ? 'Employer / payer' : 'Client / payer'} htmlFor="income-client">
            {(props) => <Input {...props} value={form.client} onChange={set('client')} placeholder="e.g. Iberia MRO" />}
          </FormField>
        ) : null}

        {form.incomeKind === 'dividend' ? (
          <FormField label="Asset ticker" htmlFor="income-asset">
            {(props) => (
              <Input
                {...props}
                value={form.assetTicker}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assetTicker: event.target.value.toUpperCase() }))
                }
                placeholder="e.g. VWCE"
              />
            )}
          </FormField>
        ) : null}

        {form.incomeKind === 'fixed' ? (
          <>
            <FormField label="Frequency" htmlFor="income-frequency">
              {(props) => (
                <Select {...props} value={form.frequency} onChange={set('frequency')}>
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </Select>
              )}
            </FormField>
            <FormField label="Pay day" htmlFor="income-payday" hint="Day of the month">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="1"
                  max="31"
                  value={form.payDay}
                  onChange={set('payDay')}
                />
              )}
            </FormField>
          </>
        ) : null}

        {form.incomeKind === 'variable' ? (
          <>
          {(form.variableSourceType || 'client') === 'client' ? (
            <FormField label="Invoice status" htmlFor="income-status">
              {(props) => (
                <Select {...props} value={form.invoiceStatus} onChange={set('invoiceStatus')}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </Select>
              )}
            </FormField>
          ) : null}
          </>
        ) : null}

        {form.incomeKind === 'dividend' ? (
          <p className="md:col-span-2 rounded-md border border-rule bg-surface-raised px-3 py-2 text-xs text-ink-muted">
            Asset-linked income is linked to the ticker for portfolio yield reporting.
          </p>
        ) : null}
      </FormSection>

      <div className="flex justify-end gap-2 border-t border-rule pt-5">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          Save income
        </Button>
      </div>
    </form>
  );
}

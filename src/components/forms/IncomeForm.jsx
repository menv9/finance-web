import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Select, Button } from '../ui';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  accountingMonth: normalizeDateInput(new Date()).slice(0, 7),
  amountCents: '',
  currency: 'EUR',
  incomeKind: 'fixed',
  source: '',
  variableSourceType: 'client',
  frequency: 'monthly',
  payDay: 1,
  client: '',
  invoiceStatus: 'draft',
  assetTicker: '',
};

export function IncomeForm({ initialValue, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    accountingMonth: initialValue?.accountingMonth || initialValue?.date?.slice(0, 7) || defaultValue.accountingMonth,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          amountCents: Math.round(Number(form.amountCents || 0) * 100),
          payDay: Number(form.payDay),
        });
      }}
    >
      <FormField label="Date" htmlFor="income-date">
        {(props) => <Input {...props} type="date" value={form.date} onChange={set('date')} />}
      </FormField>

      <FormField label="Accounting month" htmlFor="income-accounting-month" hint="Month where this income appears in reports">
        {(props) => <Input {...props} type="month" value={form.accountingMonth} onChange={set('accountingMonth')} />}
      </FormField>

      <FormField label="Amount" htmlFor="income-amount" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.01"
            value={form.amountCents}
            onChange={set('amountCents')}
            placeholder="0.00"
          />
        )}
      </FormField>

      <FormField label="Income type" htmlFor="income-kind">
        {(props) => (
          <Select {...props} value={form.incomeKind} onChange={set('incomeKind')}>
            <option value="fixed">Fixed income</option>
            <option value="variable">Variable income</option>
            <option value="dividend">Dividend interest</option>
          </Select>
        )}
      </FormField>

      {form.incomeKind === 'variable' ? (
        <FormField label="Source" htmlFor="income-source">
          {(props) => (
            <Select {...props} value={form.variableSourceType || 'client'} onChange={set('variableSourceType')}>
              <option value="employer">Employer</option>
              <option value="client">Client</option>
            </Select>
          )}
        </FormField>
      ) : form.incomeKind !== 'dividend' ? (
        <FormField
          label="Source"
          htmlFor="income-source"
          hint="Employer, client, or asset name"
        >
          {(props) => <Input {...props} value={form.source} onChange={set('source')} />}
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
          <FormField label={(form.variableSourceType || 'client') === 'employer' ? 'Employer' : 'Client'} htmlFor="income-client">
            {(props) => <Input {...props} value={form.client} onChange={set('client')} />}
          </FormField>
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

      <FormField label="Currency" htmlFor="income-currency">
        {(props) => (
          <Select {...props} value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </Select>
        )}
      </FormField>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {initialValue ? 'Save changes' : 'Add income'}
        </Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Select, Button, InfoPopover } from '../ui';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  accountingMonth: normalizeDateInput(new Date()).slice(0, 7),
  amountCents: '',
  ticker: '',
  currency: 'EUR',
  bankAccountId: '',
};

export function DividendForm({ holdings, bankAccounts = [], initialValue, onSubmit, onCancel }) {
  const defaultBankAccountId = initialValue?.bankAccountId || bankAccounts.find((account) => account.isMain)?.id || bankAccounts[0]?.id || '';
  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    accountingMonth: initialValue?.accountingMonth || initialValue?.date?.slice(0, 7) || defaultValue.accountingMonth,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
    bankAccountId: initialValue?.bankAccountId || defaultBankAccountId,
  });

  const tickers = [...new Set(holdings.map((holding) => holding.ticker))];

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const onDateChange = (event) => {
    const nextDate = event.target.value;
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
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          amountCents: Math.round(Number(form.amountCents || 0) * 100),
        });
      }}
    >
      <FormField label="Date" htmlFor="dividend-date">
        {(props) => <Input {...props} type="date" value={form.date} onChange={onDateChange} />}
      </FormField>

      <div className="grid gap-1.5">
        <div className="eyebrow flex items-center gap-1.5 text-ink-muted">
          <label htmlFor="dividend-accounting-month">Reporting month</label>
          <InfoPopover info="Which month this dividend counts toward in reports. Defaults to the received date; change it only for accrual accounting." />
        </div>
        <Input
          id="dividend-accounting-month"
          type="month"
          value={form.accountingMonth}
          onChange={set('accountingMonth')}
        />
      </div>

      {monthsDiffer ? (
        <div className="md:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          Reporting a {formatMonth(form.date.slice(0, 7))} dividend as {formatMonth(form.accountingMonth)} income (accrual).
        </div>
      ) : null}

      <FormField label="Amount" htmlFor="dividend-amount" required>
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

      <FormField label="Ticker" htmlFor="dividend-ticker" hint="Autocompleted from your holdings">
        {(props) => (
          <>
            <Input
              {...props}
              list="holding-tickers"
              value={form.ticker}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))
              }
              placeholder="VWCE"
              className="font-mono"
            />
            <datalist id="holding-tickers">
              {tickers.map((ticker) => (
                <option key={ticker} value={ticker} />
              ))}
            </datalist>
          </>
        )}
      </FormField>

      <FormField label="Currency" htmlFor="dividend-currency">
        {(props) => (
          <Select {...props} value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </Select>
        )}
      </FormField>

      {bankAccounts.length ? (
        <FormField label="Destination bank" htmlFor="dividend-bank" required className="md:col-span-2">
          {(props) => (
            <Select
              {...props}
              value={form.bankAccountId || defaultBankAccountId}
              onChange={set('bankAccountId')}
              required
            >
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isMain ? ' (main)' : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {initialValue ? 'Save changes' : 'Add dividend'}
        </Button>
      </div>
    </form>
  );
}

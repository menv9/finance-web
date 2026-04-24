import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Select, Button } from '../ui';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  amountCents: '',
  ticker: '',
  currency: 'EUR',
};

export function DividendForm({ holdings, initialValue, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  const tickers = [...new Set(holdings.map((holding) => holding.ticker))];

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
        });
      }}
    >
      <FormField label="Date" htmlFor="dividend-date">
        {(props) => <Input {...props} type="date" value={form.date} onChange={set('date')} />}
      </FormField>

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

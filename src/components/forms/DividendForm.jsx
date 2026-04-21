import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';

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

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          amountCents: Math.round(Number(form.amountCents || 0) * 100),
        });
      }}
    >
      <div className="md:col-span-2 text-lg font-semibold">{initialValue ? 'Edit dividend' : 'Add dividend'}</div>
      <div className="field">
        <label htmlFor="dividend-date">Date</label>
        <input id="dividend-date" type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor="dividend-amount">Amount</label>
        <input id="dividend-amount" type="number" step="0.01" value={form.amountCents} onChange={(event) => setForm((prev) => ({ ...prev, amountCents: event.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor="dividend-ticker">Ticker</label>
        <input
          id="dividend-ticker"
          list="holding-tickers"
          value={form.ticker}
          onChange={(event) => setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))}
        />
        <datalist id="holding-tickers">
          {tickers.map((ticker) => <option key={ticker} value={ticker} />)}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="dividend-currency">Currency</label>
        <select id="dividend-currency" value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        {onCancel ? <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button> : null}
        <button type="submit" className="button-primary">Save dividend</button>
      </div>
    </form>
  );
}

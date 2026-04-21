import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';

const defaultValue = {
  date: normalizeDateInput(new Date()),
  amountCents: '',
  currency: 'EUR',
  incomeKind: 'fixed',
  source: '',
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
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
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
      <div className="md:col-span-2 text-lg font-semibold">{initialValue ? 'Edit income' : 'Add income'}</div>
      <div className="field">
        <label htmlFor="income-date">Date</label>
        <input
          id="income-date"
          type="date"
          value={form.date}
          onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="income-amount">Amount</label>
        <input
          id="income-amount"
          type="number"
          step="0.01"
          value={form.amountCents}
          onChange={(event) => setForm((prev) => ({ ...prev, amountCents: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="income-kind">Income type</label>
        <select
          id="income-kind"
          value={form.incomeKind}
          onChange={(event) => setForm((prev) => ({ ...prev, incomeKind: event.target.value }))}
        >
          <option value="fixed">Fixed income</option>
          <option value="variable">Variable / freelance</option>
          <option value="dividend">Dividend / interest</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="income-source">Source</label>
        <input
          id="income-source"
          value={form.source}
          onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
        />
      </div>
      {form.incomeKind === 'fixed' ? (
        <>
          <div className="field">
            <label htmlFor="income-frequency">Frequency</label>
            <input
              id="income-frequency"
              value={form.frequency}
              onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="income-payday">Pay day</label>
            <input
              id="income-payday"
              type="number"
              min="1"
              max="31"
              value={form.payDay}
              onChange={(event) => setForm((prev) => ({ ...prev, payDay: event.target.value }))}
            />
          </div>
        </>
      ) : null}
      {form.incomeKind === 'variable' ? (
        <>
          <div className="field">
            <label htmlFor="income-client">Client</label>
            <input
              id="income-client"
              value={form.client}
              onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="income-status">Invoice status</label>
            <select
              id="income-status"
              value={form.invoiceStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, invoiceStatus: event.target.value }))}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </>
      ) : null}
      {form.incomeKind === 'dividend' ? (
        <div className="field md:col-span-2">
          <label htmlFor="income-asset">Asset ticker</label>
          <input
            id="income-asset"
            value={form.assetTicker}
            onChange={(event) => setForm((prev) => ({ ...prev, assetTicker: event.target.value }))}
          />
        </div>
      ) : null}
      <div className="md:col-span-2 flex justify-end gap-2">
        {onCancel ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button-primary">
          Save income
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';

const defaultValue = {
  ticker: '',
  name: '',
  platform: 'Trade Republic',
  quantity: '',
  averageBuyPriceCents: '',
  currentPriceCents: '',
};

export function HoldingForm({ initialValue, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    averageBuyPriceCents: initialValue?.averageBuyPriceCents ? `${initialValue.averageBuyPriceCents / 100}` : '',
    currentPriceCents: initialValue?.currentPriceCents ? `${initialValue.currentPriceCents / 100}` : '',
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          quantity: Number(form.quantity || 0),
          averageBuyPriceCents: Math.round(Number(form.averageBuyPriceCents || 0) * 100),
          currentPriceCents: Math.round(Number(form.currentPriceCents || 0) * 100),
        });
      }}
    >
      <div className="md:col-span-2 text-lg font-semibold">{initialValue ? 'Edit holding' : 'Add holding'}</div>
      <div className="field">
        <label htmlFor="holding-ticker">Ticker</label>
        <input
          id="holding-ticker"
          value={form.ticker}
          onChange={(event) => setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))}
        />
      </div>
      <div className="field">
        <label htmlFor="holding-name">Name</label>
        <input
          id="holding-name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="holding-platform">Platform</label>
        <select
          id="holding-platform"
          value={form.platform}
          onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
        >
          <option value="Trade Republic">Trade Republic</option>
          <option value="IBKR">IBKR</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="holding-quantity">Quantity</label>
        <input
          id="holding-quantity"
          type="number"
          step="0.0001"
          value={form.quantity}
          onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="holding-buy">Average buy price</label>
        <input
          id="holding-buy"
          type="number"
          step="0.01"
          value={form.averageBuyPriceCents}
          onChange={(event) => setForm((prev) => ({ ...prev, averageBuyPriceCents: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="holding-current">Current price</label>
        <input
          id="holding-current"
          type="number"
          step="0.01"
          value={form.currentPriceCents}
          onChange={(event) => setForm((prev) => ({ ...prev, currentPriceCents: event.target.value }))}
        />
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        {onCancel ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button-primary">
          Save holding
        </button>
      </div>
    </form>
  );
}

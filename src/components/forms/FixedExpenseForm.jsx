import { useState } from 'react';

const defaultValue = {
  name: '',
  amountCents: '',
  currency: 'EUR',
  chargeDay: 1,
  category: 'Vivienda',
  active: true,
  alerts: true,
};

export function FixedExpenseForm({ categories, initialValue, onSubmit, onCancel }) {
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
          chargeDay: Number(form.chargeDay),
        });
      }}
    >
      <div className="md:col-span-2 text-lg font-semibold">{initialValue ? 'Edit fixed expense' : 'Add fixed expense'}</div>
      <div className="field">
        <label htmlFor="fixed-name">Name</label>
        <input id="fixed-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor="fixed-amount">Amount</label>
        <input id="fixed-amount" type="number" step="0.01" value={form.amountCents} onChange={(event) => setForm((prev) => ({ ...prev, amountCents: event.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor="fixed-category">Category</label>
        <select id="fixed-category" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="fixed-day">Charge day</label>
        <input id="fixed-day" type="number" min="1" max="31" value={form.chargeDay} onChange={(event) => setForm((prev) => ({ ...prev, chargeDay: event.target.value }))} />
      </div>
      <label className="flex items-center gap-3 rounded-[18px] bg-[var(--bg-muted)] px-4 py-3 text-sm">
        <input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
        Active
      </label>
      <label className="flex items-center gap-3 rounded-[18px] bg-[var(--bg-muted)] px-4 py-3 text-sm">
        <input type="checkbox" checked={form.alerts} onChange={(event) => setForm((prev) => ({ ...prev, alerts: event.target.checked }))} />
        Optional alerts
      </label>
      <div className="md:col-span-2 flex justify-end gap-2">
        {onCancel ? <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button> : null}
        <button type="submit" className="button-primary">Save fixed expense</button>
      </div>
    </form>
  );
}

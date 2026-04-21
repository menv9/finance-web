import { useMemo, useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';

const initialState = {
  date: normalizeDateInput(new Date()),
  amountCents: '',
  currency: 'EUR',
  category: 'Otros',
  subcategory: '',
  description: '',
  isRecurring: false,
};

export function ExpenseForm({ categories, initialValue, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    ...initialState,
    ...initialValue,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });

  const title = useMemo(() => (initialValue ? 'Edit expense' : 'Add expense'), [initialValue]);

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
      <div className="md:col-span-2">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="field">
        <label htmlFor="expense-date">Date</label>
        <input
          id="expense-date"
          type="date"
          value={form.date}
          onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="expense-amount">Amount</label>
        <input
          id="expense-amount"
          type="number"
          step="0.01"
          value={form.amountCents}
          onChange={(event) => setForm((prev) => ({ ...prev, amountCents: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="expense-category">Category</label>
        <select
          id="expense-category"
          value={form.category}
          onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="expense-subcategory">Subcategory</label>
        <input
          id="expense-subcategory"
          value={form.subcategory}
          onChange={(event) => setForm((prev) => ({ ...prev, subcategory: event.target.value }))}
        />
      </div>
      <div className="field md:col-span-2">
        <label htmlFor="expense-description">Description</label>
        <textarea
          id="expense-description"
          rows="3"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="expense-currency">Currency</label>
        <select
          id="expense-currency"
          value={form.currency}
          onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
      </div>
      <label className="flex items-center gap-3 rounded-[18px] bg-[var(--bg-muted)] px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={form.isRecurring}
          onChange={(event) => setForm((prev) => ({ ...prev, isRecurring: event.target.checked }))}
        />
        Mark as recurring
      </label>
      <div className="md:col-span-2 flex justify-end gap-2">
        {onCancel ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button-primary">
          Save expense
        </button>
      </div>
    </form>
  );
}

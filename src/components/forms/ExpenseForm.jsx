import { useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Select, Textarea, Checkbox, Button } from '../ui';

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

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="grid gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          amountCents: Math.round(Number(form.amountCents || 0) * 100),
        });
      }}
    >
      <FormField label="Date" htmlFor="expense-date">
        {(props) => (
          <Input {...props} type="date" value={form.date} onChange={set('date')} />
        )}
      </FormField>

      <FormField label="Amount" htmlFor="expense-amount" required>
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

      <FormField label="Category" htmlFor="expense-category">
        {(props) => (
          <Select {...props} value={form.category} onChange={set('category')}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Subcategory" htmlFor="expense-subcategory">
        {(props) => (
          <Input
            {...props}
            value={form.subcategory}
            onChange={set('subcategory')}
            placeholder="Optional"
          />
        )}
      </FormField>

      <FormField label="Description" htmlFor="expense-description" className="md:col-span-2">
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="A short note for the ledger"
          />
        )}
      </FormField>

      <FormField label="Currency" htmlFor="expense-currency">
        {(props) => (
          <Select {...props} value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </Select>
        )}
      </FormField>

      <div className="flex items-center">
        <Checkbox
          label="Mark as recurring"
          checked={form.isRecurring}
          onChange={(checked) =>
            setForm((prev) => ({ ...prev, isRecurring: checked }))
          }
        />
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {initialValue ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}

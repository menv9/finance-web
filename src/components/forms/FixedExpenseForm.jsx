import { useState } from 'react';
import { FormField, Input, Select, Toggle, Button } from '../ui';

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
          chargeDay: Number(form.chargeDay),
        });
      }}
    >
      <FormField label="Name" htmlFor="fixed-name" required className="md:col-span-2">
        {(props) => (
          <Input {...props} value={form.name} onChange={set('name')} placeholder="e.g. Rent" />
        )}
      </FormField>

      <FormField label="Amount" htmlFor="fixed-amount" required>
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

      <FormField label="Charge day" htmlFor="fixed-day" hint="Day of the month">
        {(props) => (
          <Input
            {...props}
            type="number"
            min="1"
            max="31"
            value={form.chargeDay}
            onChange={set('chargeDay')}
          />
        )}
      </FormField>

      <FormField label="Category" htmlFor="fixed-category">
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

      <FormField label="Currency" htmlFor="fixed-currency">
        {(props) => (
          <Select {...props} value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </Select>
        )}
      </FormField>

      <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 border-t border-rule pt-4">
        <Toggle
          id="fixed-active"
          label="Active"
          description="Include in recurring cashflow"
          checked={form.active}
          onChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
        />
        <Toggle
          id="fixed-alerts"
          label="Alerts"
          description="Notify ahead of charge day"
          checked={form.alerts}
          onChange={(checked) => setForm((prev) => ({ ...prev, alerts: checked }))}
        />
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {initialValue ? 'Save changes' : 'Add fixed expense'}
        </Button>
      </div>
    </form>
  );
}

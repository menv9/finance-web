import { useState } from 'react';
import { FormField, Input, Select, Button } from '../ui';

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
    averageBuyPriceCents: initialValue?.averageBuyPriceCents
      ? `${initialValue.averageBuyPriceCents / 100}`
      : '',
    currentPriceCents: initialValue?.currentPriceCents
      ? `${initialValue.currentPriceCents / 100}`
      : '',
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
          quantity: Number(form.quantity || 0),
          averageBuyPriceCents: Math.round(Number(form.averageBuyPriceCents || 0) * 100),
          currentPriceCents: Math.round(Number(form.currentPriceCents || 0) * 100),
        });
      }}
    >
      <FormField label="Ticker" htmlFor="holding-ticker" required>
        {(props) => (
          <Input
            {...props}
            value={form.ticker}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))
            }
            placeholder="VWCE"
            className="font-mono"
          />
        )}
      </FormField>

      <FormField label="Name" htmlFor="holding-name">
        {(props) => (
          <Input {...props} value={form.name} onChange={set('name')} placeholder="Vanguard FTSE All-World" />
        )}
      </FormField>

      <FormField label="Platform" htmlFor="holding-platform" className="md:col-span-2">
        {(props) => (
          <Select {...props} value={form.platform} onChange={set('platform')}>
            <option value="Trade Republic">Trade Republic</option>
            <option value="IBKR">Interactive Brokers</option>
            <option value="DEGIRO">DEGIRO</option>
            <option value="Other">Other</option>
          </Select>
        )}
      </FormField>

      <FormField label="Quantity" htmlFor="holding-quantity" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.0001"
            value={form.quantity}
            onChange={set('quantity')}
            placeholder="0"
          />
        )}
      </FormField>

      <FormField label="Average buy price" htmlFor="holding-buy" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.01"
            value={form.averageBuyPriceCents}
            onChange={set('averageBuyPriceCents')}
            placeholder="0.00"
          />
        )}
      </FormField>

      <FormField label="Current price" htmlFor="holding-current" hint="Refreshed via Yahoo Finance" className="md:col-span-2">
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.01"
            value={form.currentPriceCents}
            onChange={set('currentPriceCents')}
            placeholder="0.00"
          />
        )}
      </FormField>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {initialValue ? 'Save changes' : 'Add holding'}
        </Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { FormField, Input, Select, Button } from '../ui';
import { useFinanceStore } from '../../store/useFinanceStore';

const defaultValue = {
  ticker: '',
  name: '',
  platform: 'Trade Republic',
  fundingSource: 'cashflow',
  purchaseAmountCents: '',
  quantity: '',
  quantityDecimals: 0,
  averageBuyPriceCents: '',
  currentPriceCents: '',
  feeCents: '',
};

function countDecimals(value) {
  const text = `${value ?? ''}`.trim();
  if (!text || text.toLowerCase().includes('e')) return 0;
  return Math.min((text.split('.')[1] || '').length, 20);
}

function formatQuantityForInput(value) {
  if (!value) return '';
  const decimals = Number.isInteger(value.quantityDecimals)
    ? Math.min(Math.max(value.quantityDecimals, 0), 20)
    : null;
  if (decimals !== null && Number.isFinite(value.quantity)) {
    return value.quantity.toFixed(decimals);
  }
  return `${value.quantity ?? ''}`;
}

export function HoldingForm({ initialValue, onSubmit, onCancel }) {
  const isEditing = Boolean(initialValue?.id);
  const settings = useFinanceStore((state) => state.settings);
  const configuredPlatforms = settings.holdingPlatforms?.length
    ? settings.holdingPlatforms
    : ['Trade Republic', 'IBKR', 'DEGIRO'];
  const platformOptions = initialValue?.platform && !configuredPlatforms.includes(initialValue.platform)
    ? [...configuredPlatforms, initialValue.platform]
    : configuredPlatforms;
  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    platform: initialValue?.platform || configuredPlatforms[0] || '',
    quantity: formatQuantityForInput(initialValue),
    averageBuyPriceCents: initialValue?.averageBuyPriceCents
      ? `${initialValue.averageBuyPriceCents / 100}`
      : '',
    currentPriceCents: initialValue?.currentPriceCents
      ? `${initialValue.currentPriceCents / 100}`
      : '',
    feeCents: initialValue?.feeCents ? `${initialValue.feeCents / 100}` : '',
  });

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const averageBuyPriceCents = Math.round(Number(form.averageBuyPriceCents || 0) * 100);
  const purchaseAmountCents = Math.round(Number(form.purchaseAmountCents || 0) * 100);
  const hasPurchaseAmount = !isEditing && purchaseAmountCents > 0;
  const resolvedQuantity = hasPurchaseAmount && averageBuyPriceCents > 0
    ? purchaseAmountCents / averageBuyPriceCents
    : Number(form.quantity || 0);
  const resolvedQuantityDecimals = hasPurchaseAmount
    ? countDecimals(resolvedQuantity.toFixed(12).replace(/0+$/, '').replace(/\.$/, ''))
    : countDecimals(form.quantity);

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...initialValue,
          ...form,
          quantity: resolvedQuantity,
          quantityDecimals: resolvedQuantityDecimals,
          purchaseAmountCents,
          averageBuyPriceCents,
          currentPriceCents: Math.round(Number(form.currentPriceCents || 0) * 100),
          feeCents: Math.round(Number(form.feeCents || 0) * 100),
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
            {platformOptions.map((platform) => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </Select>
        )}
      </FormField>

      {!isEditing ? (
        <>
          <FormField label="Purchase funded from" htmlFor="holding-funding-source">
            {(props) => (
              <Select {...props} value={form.fundingSource} onChange={set('fundingSource')}>
                <option value="cashflow">Monthly cashflow</option>
                <option value="savings">Savings</option>
              </Select>
            )}
          </FormField>

          <FormField label="Amount invested" htmlFor="holding-purchase-amount" hint="Before commission. If set, quantity is calculated from average buy price.">
            {(props) => (
              <Input
                {...props}
                type="number"
                step="0.01"
                min="0"
                value={form.purchaseAmountCents}
                onChange={set('purchaseAmountCents')}
                placeholder="0.00"
              />
            )}
          </FormField>
        </>
      ) : null}

      <FormField
        label="Quantity"
        htmlFor="holding-quantity"
        required={!hasPurchaseAmount}
        hint={hasPurchaseAmount && averageBuyPriceCents > 0 ? `Calculated: ${resolvedQuantity.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}` : undefined}
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            step="any"
            value={form.quantity}
            onChange={set('quantity')}
            placeholder="0"
            required={!hasPurchaseAmount}
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

      <FormField label="Commission" htmlFor="holding-fee" hint="Broker fee for this operation.">
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.01"
            min="0"
            value={form.feeCents}
            onChange={set('feeCents')}
            placeholder="0.00"
          />
        )}
      </FormField>

      <FormField label="Current price" htmlFor="holding-current" hint="Updated via Refresh prices">
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
          {isEditing ? 'Save changes' : 'Add holding'}
        </Button>
      </div>
    </form>
  );
}

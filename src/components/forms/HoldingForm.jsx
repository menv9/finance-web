import { useEffect, useRef, useState } from 'react';
import { FormField, Input, Button } from '../ui';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useConfirm } from '../ConfirmContext';

const PRICE_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD',
  'SEK', 'NOK', 'DKK', 'HKD', 'SGD', 'INR', 'CNY',
  'MXN', 'BRL', 'PLN', 'CZK', 'HUF', 'TRY',
];

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
  currency: '',
  feeCurrency: '',
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

// ── PlatformSelect ──────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}


function PlatformSelect({ id, value, onChange }) {
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const confirm = useConfirm();

  const defaultPlatforms = ['Trade Republic', 'IBKR', 'DEGIRO'];
  const platforms = settings.holdingPlatforms?.length ? settings.holdingPlatforms : defaultPlatforms;

  const [open, setOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus the add-input when dropdown opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSelect = (platform) => {
    onChange({ target: { value: platform } });
    setOpen(false);
  };

  const handleDelete = async (platform, e) => {
    e.stopPropagation();
    setOpen(false);
    const ok = await confirm({
      title: `Remove "${platform}"?`,
      description: `"${platform}" will be removed from your platform list. Existing holdings using it won't be affected.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) { setOpen(true); return; }
    const next = platforms.filter((p) => p !== platform);
    await updateSettings({ holdingPlatforms: next.length ? next : defaultPlatforms });
    if (value === platform) onChange({ target: { value: next[0] || defaultPlatforms[0] } });
  };

  const handleAdd = () => {
    const trimmed = newPlatform.trim();
    if (!trimmed || platforms.includes(trimmed)) return;
    const next = [...platforms, trimmed];
    updateSettings({ holdingPlatforms: next });
    onChange({ target: { value: trimmed } });
    setNewPlatform('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — same styles as Select from ui/Input.jsx */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="block w-full rounded-md border border-rule-strong bg-surface-raised text-ink px-3 py-2.5 text-base sm:text-sm transition-colors duration-180 hover:border-ink-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 appearance-none pr-9 cursor-pointer text-left"
      >
        <span className={value ? '' : 'text-ink-faint'}>{value || 'Select platform'}</span>
      </button>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      >
        <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-rule bg-surface shadow-md overflow-hidden">
          <ul className="max-h-52 overflow-y-auto py-1">
            {platforms.map((platform) => (
              <li
                key={platform}
                className={`group flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-surface-raised ${value === platform ? 'bg-surface-raised' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(platform)}
                  className="flex-1 text-left text-sm text-ink"
                >
                  {platform}
                  {value === platform && (
                    <span className="ml-2 text-xs text-ink-faint">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(platform, e)}
                  aria-label={`Remove ${platform}`}
                  className="shrink-0 rounded p-1 text-ink-faint opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger transition-opacity"
                >
                  <XIcon />
                </button>
              </li>
            ))}
          </ul>

          {/* Add custom platform */}
          <div className="border-t border-rule flex items-center gap-2 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Add another platform…"
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newPlatform.trim() || platforms.includes(newPlatform.trim())}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// A number input with an attached currency selector badge
function PriceInput({ id, value, onChange, currency, onCurrencyChange, currencies, placeholder, required, step, readOnlyCurrency }) {
  return (
    <div className="flex rounded-md overflow-hidden border border-rule bg-surface focus-within:ring-1 focus-within:ring-accent">
      <input
        id={id}
        type="number"
        step={step || '0.01'}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder || '0.00'}
        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none"
      />
      {readOnlyCurrency ? (
        <span className="flex shrink-0 items-center border-l border-rule bg-surface-raised px-2.5 font-mono text-xs text-ink-muted">
          {currency}
        </span>
      ) : (
        <select
          value={currency}
          onChange={onCurrencyChange}
          aria-label="Currency"
          className="shrink-0 border-l border-rule bg-surface-raised text-xs font-mono text-ink-muted px-2 outline-none cursor-pointer hover:bg-surface-sunken"
        >
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function FormSection({ step, title, children }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-rule bg-surface-raised font-mono text-xs text-ink-muted">
          {step}
        </span>
        <h3 className="font-display text-sm font-medium text-ink">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export function HoldingForm({ initialValue, onSubmit, onCancel }) {
  const isEditing = Boolean(initialValue?.id);
  const settings = useFinanceStore((state) => state.settings);
  const baseCurrency = settings.baseCurrency || 'EUR';
  // Ensure baseCurrency is always in the list
  const currencies = PRICE_CURRENCIES.includes(baseCurrency)
    ? PRICE_CURRENCIES
    : [baseCurrency, ...PRICE_CURRENCIES];

  const [form, setForm] = useState({
    ...defaultValue,
    ...initialValue,
    platform: initialValue?.platform || settings.holdingPlatforms?.[0] || 'Trade Republic',
    quantity: formatQuantityForInput(initialValue),
    averageBuyPriceCents: initialValue?.averageBuyPriceCents
      ? `${initialValue.averageBuyPriceCents / 100}`
      : '',
    currentPriceCents: initialValue?.currentPriceCents
      ? `${initialValue.currentPriceCents / 100}`
      : '',
    feeCents: initialValue?.feeCents ? `${initialValue.feeCents / 100}` : '',
    currency: initialValue?.currency || baseCurrency,
    feeCurrency: initialValue?.feeCurrency || initialValue?.currency || baseCurrency,
  });

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const setPriceCurrency = (event) => {
    const c = event.target.value;
    setForm((prev) => ({ ...prev, currency: c }));
  };

  const setFeeCurrency = (event) =>
    setForm((prev) => ({ ...prev, feeCurrency: event.target.value }));

  const averageBuyPriceCents = Math.round(Number(form.averageBuyPriceCents || 0) * 100);
  const purchaseAmountCents = Math.round(Number(form.purchaseAmountCents || 0) * 100);
  const hasPurchaseAmount = !isEditing && purchaseAmountCents > 0;
  const resolvedQuantity = hasPurchaseAmount && averageBuyPriceCents > 0
    ? purchaseAmountCents / averageBuyPriceCents
    : Number(form.quantity || 0);
  const resolvedQuantityDecimals = hasPurchaseAmount
    ? countDecimals(resolvedQuantity.toFixed(12).replace(/0+$/, '').replace(/\.$/, ''))
    : countDecimals(form.quantity);

  const priceCurrency = form.currency || baseCurrency;
  const feeCurrency = form.feeCurrency || priceCurrency;
  const isForeignPrice = priceCurrency !== baseCurrency;

  return (
    <form
      className="space-y-5"
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
          currency: priceCurrency,
          feeCurrency,
        });
      }}
    >
      <FormSection step="1" title="Asset">
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
          {() => (
            <PlatformSelect
              id="holding-platform"
              value={form.platform}
              onChange={set('platform')}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection step="2" title="Purchase">
        {!isEditing ? (
          <FormField
            label={`Amount invested (${priceCurrency})`}
            htmlFor="holding-purchase-amount"
            hint="Before commission. If set, quantity is calculated from average buy price."
          >
            {() => (
              <PriceInput
                id="holding-purchase-amount"
                value={form.purchaseAmountCents}
                onChange={set('purchaseAmountCents')}
                currency={priceCurrency}
                onCurrencyChange={setPriceCurrency}
                currencies={currencies}
                placeholder="0.00"
              />
            )}
          </FormField>
        ) : null}

        <FormField
          label={`Average buy price (${priceCurrency})`}
          htmlFor="holding-buy"
          required
          hint={isForeignPrice ? `Avg buy price and current price share the same currency` : undefined}
        >
          {() => (
            <PriceInput
              id="holding-buy"
              value={form.averageBuyPriceCents}
              onChange={set('averageBuyPriceCents')}
              currency={priceCurrency}
              onCurrencyChange={setPriceCurrency}
              currencies={currencies}
              required
            />
          )}
        </FormField>

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

        <FormField
          label={`Commission (${feeCurrency})`}
          htmlFor="holding-fee"
          hint="Broker fee for this operation."
        >
          {() => (
            <PriceInput
              id="holding-fee"
              value={form.feeCents}
              onChange={set('feeCents')}
              currency={feeCurrency}
              onCurrencyChange={setFeeCurrency}
              currencies={currencies}
              placeholder="0.00"
            />
          )}
        </FormField>
      </FormSection>

      <FormSection step="3" title="Market">
        <FormField
          label={`Current price (${priceCurrency})`}
          htmlFor="holding-current"
          hint="Updated via Refresh prices. Uses the same currency as avg buy price."
          className="md:col-span-2"
        >
          {() => (
            <PriceInput
              id="holding-current"
              value={form.currentPriceCents}
              onChange={set('currentPriceCents')}
              currency={priceCurrency}
              readOnlyCurrency
              currencies={currencies}
              placeholder="0.00"
            />
          )}
        </FormField>

        {isForeignPrice && (
          <p className="md:col-span-2 text-xs text-ink-muted rounded-md border border-rule bg-surface-raised px-3 py-2">
            Prices are in <span className="font-mono font-medium">{priceCurrency}</span>. Value and P&amp;L will be shown in <span className="font-mono font-medium">{baseCurrency}</span> using the latest exchange rate from price refresh.
          </p>
        )}
      </FormSection>

      <div className="flex justify-end gap-2 border-t border-rule pt-5">
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

import { useMemo, useState } from 'react';
import { parseCsv, parseAmountToCents, parseCsvDate } from '../utils/csv';
import { Button, FormField, Select, Input } from './ui';

// ── MCC → default category map ────────────────────────────────────────────────
// Maps Merchant Category Codes to the app's default category names.
// Falls back to the user's categories if an exact match isn't found.
const MCC_CATEGORY = {
  // Alimentacion — food & grocery
  5411: 'Alimentacion', 5412: 'Alimentacion', 5422: 'Alimentacion',
  5441: 'Alimentacion', 5451: 'Alimentacion', 5462: 'Alimentacion',
  5499: 'Alimentacion', 5814: 'Alimentacion',
  // Ocio — restaurants, bars, entertainment, hotels
  5812: 'Ocio', 5813: 'Ocio', 5942: 'Ocio', 5945: 'Ocio',
  7832: 'Ocio', 7922: 'Ocio', 7941: 'Ocio', 7991: 'Ocio',
  7993: 'Ocio', 7011: 'Ocio', 7012: 'Ocio',
  // Transporte — transit, taxis, airlines, fuel
  4111: 'Transporte', 4112: 'Transporte', 4121: 'Transporte',
  4131: 'Transporte', 4411: 'Transporte', 4511: 'Transporte',
  5172: 'Transporte', 5541: 'Transporte', 5542: 'Transporte', 7523: 'Transporte',
  // Salud — health, pharmacy, beauty/personal care
  5122: 'Salud', 5912: 'Salud', 7230: 'Salud', 7231: 'Salud',
  7298: 'Salud', 8011: 'Salud', 8021: 'Salud', 8049: 'Salud', 8099: 'Salud',
  // Suscripciones — telecom, software, streaming
  4812: 'Suscripciones', 4814: 'Suscripciones', 4816: 'Suscripciones',
  7372: 'Suscripciones', 7375: 'Suscripciones',
  // Vivienda — utilities, home improvement, furniture
  4900: 'Vivienda', 5200: 'Vivienda', 5211: 'Vivienda', 5251: 'Vivienda',
  5712: 'Vivienda', 5719: 'Vivienda', 5731: 'Vivienda',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normHeader(s) {
  return `${s ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function findHeader(headers, ...aliases) {
  return (
    headers.find((h) => aliases.some((a) => normHeader(h) === normHeader(a))) ||
    headers.find((h) => aliases.some((a) => normHeader(h).includes(normHeader(a)))) ||
    ''
  );
}

function detectRevolut(headers) {
  const h = headers.map((x) => x.toLowerCase());
  return h.includes('type') && h.includes('mcc_code') && h.includes('name');
}

function autoMapping(headers) {
  return {
    date: findHeader(headers, 'date', 'fecha', 'datum', 'booking date', 'transaction date'),
    amount: findHeader(headers, 'amount', 'importe', 'betrag', 'monto', 'transaction amount'),
    description: findHeader(headers, 'name', 'description', 'descripcion', 'merchant', 'concepto', 'details', 'text'),
    currency: findHeader(headers, 'currency', 'moneda', 'wahrung'),
    mcc: findHeader(headers, 'mcc_code', 'mcc', 'category code', 'mcc code'),
  };
}

function resolveCategory(mccRaw, userCategories) {
  const suggested = MCC_CATEGORY[Number(mccRaw)];
  if (!suggested) return userCategories.includes('Otros') ? 'Otros' : userCategories[0] ?? 'Otros';
  if (userCategories.includes(suggested)) return suggested;
  const close = userCategories.find((c) => c.toLowerCase().includes(suggested.toLowerCase()));
  return close ?? (userCategories.includes('Otros') ? 'Otros' : userCategories[0] ?? 'Otros');
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Smart bank CSV importer.
 * Splits rows into expenses (negative amount) and incomes (positive amount).
 * Auto-detects Revolut format and uses MCC codes to pre-assign categories.
 * Lets the user remap auto-assigned categories before committing.
 */
export function SmartBankImport({ categories, onImportExpenses, onImportIncomes }) {
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [isRevolut, setIsRevolut] = useState(false);
  const [categoryOverrides, setCategoryOverrides] = useState({}); // { autoCategory → userCategory }
  const [status, setStatus] = useState(null); // null | 'importing' | { expenses: N, incomes: N }

  // Build the split whenever rows or mapping change
  const split = useMemo(() => {
    if (!mapping || !rawRows.length) return { expenses: [], incomes: [], skipped: 0 };
    const expenses = [];
    const incomes = [];
    let skipped = 0;

    for (const row of rawRows) {
      const date = parseCsvDate(row[mapping.date]);
      const rawAmount = parseAmountToCents(row[mapping.amount]);
      if (!date || !Number.isFinite(rawAmount) || rawAmount === 0) { skipped++; continue; }

      const currency = row[mapping.currency] || 'EUR';
      const description = row[mapping.description] || '';

      if (rawAmount < 0) {
        const autoCategory = mapping.mcc && row[mapping.mcc]
          ? resolveCategory(row[mapping.mcc], categories)
          : (categories.includes('Otros') ? 'Otros' : categories[0] ?? 'Otros');
        expenses.push({
          date,
          amountCents: Math.abs(rawAmount),
          currency,
          description,
          autoCategory, // used for the override UI — stripped before import
          isRecurring: false,
        });
      } else {
        incomes.push({
          date,
          amountCents: rawAmount,
          currency,
          incomeKind: 'variable',
          source: description || 'Bank transfer',
          client: '',
          invoiceStatus: 'received',
        });
      }
    }

    return { expenses, incomes, skipped };
  }, [rawRows, mapping, categories]);

  // Unique auto-categories with row counts — for the override table
  const autoCategories = useMemo(() => {
    const counts = {};
    for (const e of split.expenses) {
      counts[e.autoCategory] = (counts[e.autoCategory] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]); // [name, count]
  }, [split.expenses]);

  // Final expense rows with overrides applied
  const finalExpenses = useMemo(
    () =>
      split.expenses.map(({ autoCategory, ...rest }) => ({
        ...rest,
        category: categoryOverrides[autoCategory] ?? autoCategory,
      })),
    [split.expenses, categoryOverrides],
  );

  const totalToImport = finalExpenses.length + split.incomes.length;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    setIsRevolut(detectRevolut(parsed.headers));
    setMapping(autoMapping(parsed.headers));
    setCategoryOverrides({});
    setStatus(null);
  };

  const handleReset = () => {
    setHeaders([]);
    setRawRows([]);
    setMapping(null);
    setIsRevolut(false);
    setCategoryOverrides({});
    setStatus(null);
  };

  const handleImport = async () => {
    setStatus('importing');
    for (const row of finalExpenses) await onImportExpenses([row]);
    for (const row of split.incomes) await onImportIncomes([row]);
    setStatus({ expenses: finalExpenses.length, incomes: split.incomes.length });
  };

  return (
    <div className="grid gap-6">
      {/* ── File upload ── */}
      <FormField
        label="Bank export CSV"
        htmlFor="smart-csv"
        hint="Supports Revolut, N26, ING, and most standard bank exports."
      >
        {(props) => (
          <Input
            {...props}
            type="file"
            accept=".csv,text/csv"
            className="file:mr-3 file:rounded-sm file:border file:border-rule-strong file:bg-surface-raised file:px-3 file:py-1 file:text-xs file:text-ink-muted hover:file:text-ink cursor-pointer"
            onChange={handleFileChange}
          />
        )}
      </FormField>

      {rawRows.length > 0 && mapping && (
        <>
          {/* ── Format badge ── */}
          {isRevolut && (
            <p className="inline-flex items-center gap-1.5 text-xs text-positive">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-positive" />
              Revolut format detected — columns pre-filled automatically
            </p>
          )}

          {/* ── Column mapping ── */}
          <div>
            <p className="eyebrow mb-3">Column mapping</p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                { key: 'date', label: 'Date' },
                { key: 'amount', label: 'Amount' },
                { key: 'description', label: 'Description / merchant' },
                { key: 'currency', label: 'Currency' },
                { key: 'mcc', label: 'MCC / category code' },
              ].map(({ key, label }) => (
                <FormField key={key} label={label} htmlFor={`sbi-${key}`}>
                  {(props) => (
                    <Select
                      {...props}
                      value={mapping[key] || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </Select>
                  )}
                </FormField>
              ))}
            </div>
          </div>

          {/* ── Summary ── */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-rule bg-surface-sunken px-4 py-3 text-sm">
            <span>
              <span className="font-medium text-danger">{split.expenses.length}</span>
              <span className="text-ink-muted"> expenses</span>
            </span>
            <span className="text-rule-strong select-none">·</span>
            <span>
              <span className="font-medium text-positive">{split.incomes.length}</span>
              <span className="text-ink-muted"> income entries</span>
            </span>
            {split.skipped > 0 && (
              <>
                <span className="text-rule-strong select-none">·</span>
                <span className="text-ink-faint">{split.skipped} skipped (zero or unparseable)</span>
              </>
            )}
          </div>

          {/* ── Category remapping ── */}
          {autoCategories.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Auto-assigned categories</p>
              <p className="mb-3 text-xs text-ink-muted">
                Adjust before importing. Changes apply to all rows with that auto-assigned category.
              </p>
              <div className="grid gap-2 rounded-lg border border-rule divide-y divide-rule overflow-hidden">
                {autoCategories.map(([auto, count]) => (
                  <div
                    key={auto}
                    className="flex items-center justify-between gap-4 bg-surface px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded bg-surface-sunken px-1.5 font-mono text-xs text-ink-muted">
                        {count}
                      </span>
                      <span className="text-sm text-ink truncate">{auto}</span>
                    </div>
                    <div className="w-44 shrink-0">
                      <Select
                        value={categoryOverrides[auto] ?? auto}
                        onChange={(e) =>
                          setCategoryOverrides((prev) => ({ ...prev, [auto]: e.target.value }))
                        }
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Expense preview ── */}
          {split.expenses.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Expenses <span className="text-ink-faint normal-case font-normal">({finalExpenses.length})</span></p>
              <PreviewTable
                rows={finalExpenses}
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'description', label: 'Description' },
                  { key: 'category', label: 'Category' },
                  { key: 'amountCents', label: 'Amount', render: (r) => `${(r.amountCents / 100).toFixed(2)} ${r.currency}` },
                ]}
              />
            </div>
          )}

          {/* ── Income preview ── */}
          {split.incomes.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Incomes <span className="text-ink-faint normal-case font-normal">({split.incomes.length})</span></p>
              <PreviewTable
                rows={split.incomes}
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'source', label: 'Source' },
                  { key: 'amountCents', label: 'Amount', render: (r) => `${(r.amountCents / 100).toFixed(2)} ${r.currency}` },
                ]}
              />
            </div>
          )}

          {/* ── Import button + status ── */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              disabled={totalToImport === 0 || status === 'importing'}
              loading={status === 'importing'}
              onClick={handleImport}
            >
              {totalToImport > 0
                ? `Import ${finalExpenses.length > 0 ? `${finalExpenses.length} expense${finalExpenses.length !== 1 ? 's' : ''}` : ''}${finalExpenses.length > 0 && split.incomes.length > 0 ? ' + ' : ''}${split.incomes.length > 0 ? `${split.incomes.length} income${split.incomes.length !== 1 ? 's' : ''}` : ''}`
                : 'Import'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={status === 'importing'}
              onClick={handleReset}
            >
              Cancel
            </Button>
            {status && status !== 'importing' && (
              <p className="text-sm text-positive">
                ✓ Imported {status.expenses} expense{status.expenses !== 1 ? 's' : ''} and {status.incomes} income{status.incomes !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared mini preview table with pagination ─────────────────────────────────

const PAGE_SIZE = 10;

function PreviewTable({ rows, columns }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border border-rule">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="eyebrow border-b border-rule bg-surface px-3 py-2 text-left">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} className="border-b border-rule last:border-0 hover:bg-surface-raised">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-ink-muted">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-ink-faint">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={
                  'rounded px-2 py-1 text-xs transition-colors ' +
                  (i === page
                    ? 'bg-ink text-ink-inverse font-medium'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-raised')
                }
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page === totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

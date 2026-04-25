import { useState } from 'react';
import { parseAmountToCents, parseCsv, parseCsvDate } from '../utils/csv';
import { FormField, Input, Select, Button } from './ui';

const HEADER_ALIASES = {
  date: ['date', 'fecha', 'datum', 'booking date', 'transaction date', 'value date', 'valuta', 'buchungstag'],
  amount: ['amount', 'importe', 'betrag', 'monto', 'valor', 'debit', 'credit', 'transaction amount'],
  category: ['category', 'categoria', 'categoría', 'kategorie'],
  description: ['description', 'descripcion', 'descripción', 'concepto', 'details', 'merchant', 'name', 'text', 'verwendungszweck'],
  currency: ['currency', 'moneda', 'wahrung', 'währung', 'ccy'],
};

function normalizeHeader(header) {
  return `${header ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function detectMapping(headers, fallbackMapping) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));
  return Object.fromEntries(
    Object.entries(fallbackMapping).map(([field, fallbackColumn]) => {
      const aliases = HEADER_ALIASES[field] || [field];
      const exact = normalizedHeaders.find((item) =>
        aliases.some((alias) => item.normalized === normalizeHeader(alias)),
      );
      const partial = normalizedHeaders.find((item) =>
        aliases.some((alias) => item.normalized.includes(normalizeHeader(alias))),
      );
      return [field, exact?.header || partial?.header || (headers.includes(fallbackColumn) ? fallbackColumn : headers[0] || fallbackColumn)];
    }),
  );
}

export function CsvImportCard({ mapping, categories, onImport }) {
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [localMapping, setLocalMapping] = useState(mapping);
  const [delimiter, setDelimiter] = useState(',');
  const [amountMode, setAmountMode] = useState('signed');
  const [validation, setValidation] = useState([]);

  const buildRows = (rows) =>
    rows.map((row, index) => {
      const parsedAmount = parseAmountToCents(row[localMapping.amount]);
      const normalizedDate = parseCsvDate(row[localMapping.date]);
      const normalizedAmount =
        amountMode === 'expense-positive'
          ? Math.abs(parsedAmount)
          : amountMode === 'income-negative'
            ? -Math.abs(parsedAmount)
            : parsedAmount;
      const hasValidDate = Boolean(normalizedDate);
      const hasValidAmount = Number.isFinite(normalizedAmount) && normalizedAmount !== 0;

      return {
        row,
        index,
        normalized: {
          date: normalizedDate,
          amountCents: normalizedAmount,
          currency: row[localMapping.currency] || 'EUR',
          category:
            row[localMapping.category] && categories.includes(row[localMapping.category])
              ? row[localMapping.category]
              : 'Otros',
          subcategory: '',
          description: row[localMapping.description] || '',
          isRecurring: false,
        },
        valid: hasValidDate && hasValidAmount,
        issues: [
          !hasValidDate ? 'Invalid date. Accepted: YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, or DD-MM-YYYY' : null,
          !hasValidAmount ? 'Amount could not be parsed or resolved to zero' : null,
        ].filter(Boolean),
      };
    });

  return (
    <div className="grid gap-5">
      <FormField label="CSV file" htmlFor="csv-file" hint="Comma, semicolon, or tab-delimited exports supported.">
        {(props) => (
          <Input
            {...props}
            type="file"
            accept=".csv,text/csv"
            className="file:mr-3 file:rounded-sm file:border file:border-rule-strong file:bg-surface-raised file:px-3 file:py-1 file:text-xs file:text-ink-muted hover:file:text-ink cursor-pointer"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const parsed = parseCsv(text);
              setPreview(parsed.rows);
              setHeaders(parsed.headers);
              setDelimiter(parsed.delimiter);
              setLocalMapping(detectMapping(parsed.headers, mapping));
              setValidation([]);
            }}
          />
        )}
      </FormField>

      {preview.length ? (
        <>
          <p className="eyebrow">
            Detected delimiter: <span className="font-mono text-ink">{delimiter === '\t' ? 'tab' : delimiter}</span>
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(localMapping).map(([field, value]) => (
              <FormField label={field} htmlFor={`map-${field}`} key={field}>
                {(props) => (
                  <Select
                    {...props}
                    value={value}
                    onChange={(event) =>
                      setLocalMapping((prev) => ({ ...prev, [field]: event.target.value }))
                    }
                  >
                    {headers.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ))}
            <FormField label="Amount interpretation" htmlFor="amount-mode">
              {(props) => (
                <Select {...props} value={amountMode} onChange={(event) => setAmountMode(event.target.value)}>
                  <option value="signed">Use CSV sign as-is</option>
                  <option value="expense-positive">Force positive expenses</option>
                  <option value="income-negative">Force negative values</option>
                </Select>
              )}
            </FormField>
          </div>

          <div className="overflow-x-auto rounded-md border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken">
                  {headers.map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="eyebrow px-3 py-2 text-left text-ink-muted"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-b border-rule last:border-0">
                    {headers.map((header) => (
                      <td key={header} className="px-3 py-2 text-ink-muted">
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validation.length ? (
            <div className="rounded-md border border-rule px-4 py-3">
              <p className="eyebrow">Validation summary</p>
              <p className="mt-1 text-sm text-ink-muted">
                <span className="text-positive">{validation.filter((item) => item.valid).length} valid</span>
                {' · '}
                <span className="text-danger">{validation.filter((item) => !item.valid).length} invalid</span>
              </p>
              {validation.filter((item) => !item.valid).slice(0, 5).map((item) => (
                <p key={item.index} className="mt-2 text-xs text-danger">
                  Row {item.index + 2}: {item.issues.join('; ')}
                </p>
              ))}
            </div>
          ) : null}

          <Button
            variant="primary"
            size="sm"
            className="w-fit"
            onClick={() => {
              const built = buildRows(preview);
              setValidation(built);
              onImport(built.filter((item) => item.valid).map((item) => item.normalized));
            }}
          >
            Import valid rows
          </Button>
        </>
      ) : null}
    </div>
  );
}

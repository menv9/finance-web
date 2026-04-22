import { useState } from 'react';
import { parseAmountToCents, parseCsv } from '../utils/csv';
import { FormField, Input, Select, Button } from './ui';

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
      const normalizedAmount =
        amountMode === 'expense-positive'
          ? Math.abs(parsedAmount)
          : amountMode === 'income-negative'
            ? -Math.abs(parsedAmount)
            : parsedAmount;
      const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test((row[localMapping.date] || '').trim());
      const hasValidAmount = Number.isFinite(normalizedAmount) && normalizedAmount !== 0;

      return {
        row,
        index,
        normalized: {
          date: row[localMapping.date],
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
          !hasValidDate ? 'Invalid date format, expected YYYY-MM-DD' : null,
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

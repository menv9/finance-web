import { useState } from 'react';
import { parseAmountToCents, parseCsv } from '../utils/csv';

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
    <div className="grid gap-4">
      <div className="field">
        <label htmlFor="csv-file">CSV import</label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
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
      </div>

      {preview.length ? (
        <>
          <div className="rounded-[18px] bg-[var(--bg-muted)] px-4 py-4 text-sm text-[var(--text-muted)]">
            <p>Detected delimiter: {delimiter === '\t' ? 'tab' : delimiter}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(localMapping).map(([field, value]) => (
              <div className="field" key={field}>
                <label htmlFor={`map-${field}`}>{field}</label>
                <select
                  id={`map-${field}`}
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
                </select>
              </div>
            ))}
            <div className="field">
              <label htmlFor="amount-mode">Amount interpretation</label>
              <select id="amount-mode" value={amountMode} onChange={(event) => setAmountMode(event.target.value)}>
                <option value="signed">Use CSV sign as-is</option>
                <option value="expense-positive">Force positive expenses</option>
                <option value="income-negative">Force negative values</option>
              </select>
            </div>
          </div>

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    {headers.map((header) => (
                      <td key={header}>{row[header]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validation.length ? (
            <div className="rounded-[18px] border border-[var(--border-soft)] px-4 py-4">
              <p className="text-sm font-semibold">Validation summary</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {validation.filter((item) => item.valid).length} valid rows, {validation.filter((item) => !item.valid).length} invalid rows.
              </p>
              {validation.filter((item) => !item.valid).slice(0, 5).map((item) => (
                <p key={item.index} className="mt-2 text-sm text-[var(--danger)]">
                  Row {item.index + 2}: {item.issues.join('; ')}
                </p>
              ))}
            </div>
          ) : null}

          <button
            className="button-primary w-fit"
            onClick={() => {
              const built = buildRows(preview);
              setValidation(built);
              onImport(built.filter((item) => item.valid).map((item) => item.normalized));
            }}
          >
            Import valid rows
          </button>
        </>
      ) : null}
    </div>
  );
}

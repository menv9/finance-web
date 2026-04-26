import { cn } from './cn';

/**
 * columns: Array<{ key, header, align?: 'left'|'right'|'center', width?, numeric?, render?(row), hideOnMobile? }>
 * rows: Array<{ id, ...data }>
 *
 * Batch-select props (all optional — pass together to enable):
 *   selectable:     boolean              — show checkbox column
 *   selectedIds:    Set<string>          — set of currently checked row ids
 *   onToggleRow:    (id: string) => void — called when a row checkbox changes
 *   onToggleAll:    () => void           — called when the header checkbox changes
 *   isRowSelectable:(row) => boolean     — rows returning false get an empty cell instead of a checkbox
 */
export function Table({
  columns,
  rows,
  empty,
  loading,
  density = 'comfortable',
  caption,
  className,
  onRowClick,
  // batch select
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  isRowSelectable,
}) {
  const pad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-rule bg-surface overflow-hidden', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn('flex gap-3', pad, i < 4 && 'border-b border-rule')}>
            {columns.map((c) => (
              <div
                key={c.key}
                className="h-3 flex-1 rounded bg-rule animate-pulse"
                style={{ maxWidth: c.width || undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return empty || null;
  }

  // Derive "check all" / indeterminate state from the rows that are actually selectable
  const selectableRows = selectable && isRowSelectable ? rows.filter(isRowSelectable) : rows;
  const allChecked =
    selectable && selectableRows.length > 0 && selectableRows.every((r) => selectedIds?.has(r.id));
  const someChecked = selectable && !allChecked && selectableRows.some((r) => selectedIds?.has(r.id));

  return (
    <div className={cn('rounded-lg border border-rule bg-surface overflow-auto', className)}>
      <table className="w-full border-collapse">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {selectable && (
              <th
                scope="col"
                style={{ width: 44 }}
                className={cn('sticky top-0 z-10 bg-surface border-b border-rule', pad)}
              >
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer rounded accent-[color:var(--accent)]"
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width, textAlign: c.align || (c.numeric ? 'right' : 'left') }}
                className={cn(
                  'sticky top-0 z-10 bg-surface',
                  'border-b border-rule',
                  'eyebrow font-medium',
                  pad,
                  c.hideOnMobile && 'hidden sm:table-cell',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const canSelect = !selectable || !isRowSelectable || isRowSelectable(row);
            const isChecked = selectable && selectedIds?.has(row.id);

            return (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-rule last:border-b-0 transition-colors duration-120',
                  isChecked ? 'bg-accent-soft' : 'hover:bg-surface-raised',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {selectable && (
                  <td className={cn(pad, 'w-11')}>
                    {canSelect ? (
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={isChecked}
                        onChange={() => onToggleRow?.(row.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer rounded accent-[color:var(--accent)]"
                      />
                    ) : (
                      <span className="block h-4 w-4" />
                    )}
                  </td>
                )}
                {columns.map((c) => {
                  const content = c.render ? c.render(row) : row[c.key];
                  return (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align || (c.numeric ? 'right' : 'left') }}
                      className={cn(
                        pad,
                        'text-sm text-ink',
                        c.numeric && 'font-mono tabular text-ink',
                        c.hideOnMobile && 'hidden sm:table-cell',
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

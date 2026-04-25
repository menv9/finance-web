import { cn } from './cn';

/**
 * columns: Array<{ key, header, align?: 'left'|'right'|'center', width?, numeric?, render?(row) }>
 * rows: Array<{ id, ...data }>
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

  return (
    <div className={cn('rounded-lg border border-rule bg-surface overflow-auto', className)}>
      <table className="w-full border-collapse">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
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
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-rule last:border-b-0 transition-colors duration-120',
                'hover:bg-surface-raised',
                onRowClick && 'cursor-pointer',
              )}
            >
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

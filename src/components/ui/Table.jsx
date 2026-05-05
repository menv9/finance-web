import { useRef, useState } from 'react';
import { cn } from './cn';

/**
 * columns: Array<{
 *   key, header,
 *   align?: 'left'|'right'|'center',
 *   width?, numeric?,
 *   render?(row),
 *   hideOnMobile?,
 *   sortable?,        ← makes the header clickable for sorting
 * }>
 * rows: Array<{ id, ...data }>
 *
 * Sort props (all optional — pass together to enable):
 *   sortKey:      string               — currently active sort column key
 *   sortDir:      'asc' | 'desc'       — current sort direction
 *   onSort:       (key: string) => void
 *
 * Batch-select props (all optional — pass together to enable):
 *   selectable:     boolean              — show checkbox column
 *   selectedIds:    Set<string>          — set of currently checked row ids
 *   onToggleRow:    (id: string) => void
 *   onToggleAll:    () => void
 *   isRowSelectable:(row) => boolean     — rows returning false get an empty cell
 */

function SortIcon({ active, dir }) {
  if (!active) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 8 12"
        className="ml-1 inline-block h-2.5 w-1.5 shrink-0 text-ink-faint opacity-40"
      >
        <path d="M4 0L1 4h6L4 0z" fill="currentColor" />
        <path d="M4 12L1 8h6L4 12z" fill="currentColor" />
      </svg>
    );
  }
  return dir === 'asc' ? (
    <svg
      aria-hidden
      viewBox="0 0 8 8"
      className="ml-1 inline-block h-2 w-1.5 shrink-0 text-accent"
    >
      <path d="M4 0L1 6h6L4 0z" fill="currentColor" />
    </svg>
  ) : (
    <svg
      aria-hidden
      viewBox="0 0 8 8"
      className="ml-1 inline-block h-2 w-1.5 shrink-0 text-accent"
    >
      <path d="M4 8L1 2h6L4 8z" fill="currentColor" />
    </svg>
  );
}

export function Table({
  columns,
  rows,
  empty,
  loading,
  density = 'comfortable',
  caption,
  className,
  onRowClick,
  // sort
  sortKey,
  sortDir,
  onSort,
  // batch select
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  isRowSelectable,
  allowHorizontalScroll = true,
  stickyFirstColumn = false,
}) {
  const touchPreviewTimer = useRef(null);
  const pointerStart = useRef(null);
  const [touchPreview, setTouchPreview] = useState(null);
  const pad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const visibilityClass = (column) => cn(
    column.hideOnMobile && 'hidden sm:table-cell',
    column.hideBelow === 'md' && 'hidden md:table-cell',
    column.hideBelow === 'lg' && 'hidden lg:table-cell',
    column.hideBelow === 'xl' && 'hidden xl:table-cell',
    column.hideBelow === '2xl' && 'hidden 2xl:table-cell',
  );

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
  const clearTouchPreviewTimer = () => {
    if (touchPreviewTimer.current) {
      window.clearTimeout(touchPreviewTimer.current);
      touchPreviewTimer.current = null;
    }
  };
  const showTouchPreview = (x, y, text) => {
    if (!text) return;
    clearTouchPreviewTimer();
    setTouchPreview({
      text,
      x: Math.min(Math.max(x || window.innerWidth / 2, 24), window.innerWidth - 24),
      y: Math.min(Math.max(y || window.innerHeight / 2, 56), window.innerHeight - 56),
    });
    touchPreviewTimer.current = window.setTimeout(() => setTouchPreview(null), 1400);
  };
  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch') return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event, text) => {
    if (event.pointerType !== 'touch') return;
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    if (dx > 10 || dy > 10) return;
    showTouchPreview(event.clientX, event.clientY, text);
  };

  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-rule bg-surface overflow-y-hidden',
        allowHorizontalScroll ? 'overflow-x-auto' : 'overflow-x-hidden',
        className,
      )}
    >
      <table className={cn(
        'w-full border-collapse',
        allowHorizontalScroll ? 'min-w-[520px] table-fixed sm:min-w-full sm:table-auto' : 'min-w-0 table-fixed',
      )}>
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
            {columns.map((c, columnIndex) => {
              const isSortable = c.sortable && onSort;
              const isActive = sortKey === c.key;
              const isStickyColumn = stickyFirstColumn && columnIndex === 0;
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{
                    width: c.width,
                    textAlign: c.align || (c.numeric ? 'right' : 'left'),
                    left: isStickyColumn ? 0 : undefined,
                  }}
                  onClick={isSortable ? () => onSort(c.key) : undefined}
                  title={isSortable ? `Sort by ${c.header}` : undefined}
                  className={cn(
                    'sticky top-0 z-10 bg-surface',
                    isStickyColumn && 'z-20 border-r border-rule shadow-[6px_0_12px_-12px_rgba(0,0,0,0.45)]',
                    'border-b border-rule',
                    'eyebrow font-medium',
                    pad,
                    isSortable && 'cursor-pointer select-none hover:text-ink transition-colors duration-120',
                    isActive && 'text-ink',
                    visibilityClass(c),
                  )}
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                    <span className="min-w-0 whitespace-normal break-words leading-tight">
                      {c.header}
                    </span>
                    {isSortable && <SortIcon active={isActive} dir={sortDir} />}
                  </span>
                </th>
              );
            })}
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
                  row.rowClassName,
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
                {columns.map((c, columnIndex) => {
                  const content = c.render ? c.render(row) : row[c.key];
                  const isStickyColumn = stickyFirstColumn && columnIndex === 0;
                  const cellText = c.cellText
                    ? c.cellText(row)
                    : typeof content === 'string' || typeof content === 'number'
                      ? String(content)
                      : '';
                  return (
                    <td
                      key={c.key}
                      title={cellText}
                      style={{
                        textAlign: c.align || (c.numeric ? 'right' : 'left'),
                        left: isStickyColumn ? 0 : undefined,
                      }}
                      className={cn(
                        pad,
                        'min-w-0 text-sm text-ink',
                        isStickyColumn && 'sticky z-10 border-r border-rule bg-inherit shadow-[6px_0_12px_-12px_rgba(0,0,0,0.45)]',
                        c.noTruncate ? 'overflow-visible' : 'overflow-hidden',
                        c.numeric && 'font-mono tabular text-ink',
                        visibilityClass(c),
                      )}
                    >
                      <div className={cn(
                        'min-w-0 max-w-full',
                        c.noTruncate ? 'overflow-visible whitespace-normal' : c.numeric ? 'truncate text-right' : 'truncate',
                      )}
                        onPointerDown={onPointerDown}
                        onPointerUp={(event) => onPointerUp(event, cellText)}
                        onPointerCancel={() => { pointerStart.current = null; }}
                      >
                        {content}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {touchPreview ? (
        <div
          role="status"
          className="pointer-events-none fixed z-50 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-full rounded-md border border-rule bg-surface-raised px-3 py-2 text-sm text-ink shadow-lg"
          style={{ left: touchPreview.x, top: touchPreview.y - 12 }}
        >
          {touchPreview.text}
        </div>
      ) : null}
    </div>
  );
}

import { useState, useCallback } from 'react';

/**
 * Manages the state for batch row selection in a table.
 *
 * @param {Array}    items        - The full array of rows displayed in the table.
 * @param {Function} isSelectable - Optional predicate `(item) => bool`.
 *                                  Rows that return false won't be included in
 *                                  "select all" and can't be toggled.
 */
export function useBatchSelect(items, isSelectable) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const selectableItems = isSelectable ? items.filter(isSelectable) : items;
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((i) => selectedIds.has(i.id));

  const toggle = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = selectableItems.map((i) => i.id);
      const allChecked = ids.every((id) => prev.has(id));
      return allChecked ? new Set() : new Set(ids);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableItems]);

  const start = useCallback(() => setSelecting(true), []);

  const cancel = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
  }, []);

  return {
    selecting,
    selectedIds,
    allSelected,
    toggle,
    toggleAll,
    start,
    cancel,
  };
}

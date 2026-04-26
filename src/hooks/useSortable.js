import { useState, useCallback } from 'react';

/**
 * Manages sort state for a table — which column is sorted and in which direction.
 *
 * @param defaultKey  - column key to sort by initially
 * @param defaultDir  - 'asc' | 'desc' (defaults to 'desc')
 */
export function useSortable(defaultKey, defaultDir = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const onSort = useCallback(
    (key) => {
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc'); // new column always starts descending (highest / newest first)
      }
    },
    [sortKey],
  );

  return { sortKey, sortDir, onSort };
}

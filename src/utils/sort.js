/**
 * Returns a sorted copy of `rows` by `key` and `dir`.
 *
 * @param rows    - array of objects to sort
 * @param key     - the column key to sort by
 * @param dir     - 'asc' | 'desc'
 * @param getters - optional map of { [key]: (row) => sortValue } for columns whose
 *                  display value differs from their raw sort value (e.g. computed fields)
 */
export function sortRows(rows, key, dir, getters = {}) {
  if (!key || !rows.length) return rows;

  const getValue = getters[key] ?? ((row) => row[key]);
  const mul = dir === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);

    // Push nulls / undefineds to the bottom regardless of direction
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * mul;
    }

    return String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' }) * mul;
  });
}

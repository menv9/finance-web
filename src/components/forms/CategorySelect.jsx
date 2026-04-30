import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '../ConfirmContext';
import { useFinanceStore } from '../../store/useFinanceStore';

function XIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CategorySelect({ id, value, categories = [], onChange }) {
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSelect = (category) => {
    onChange({ target: { value: category } });
    setOpen(false);
  };

  const handleAdd = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const next = [...categories, trimmed];
    await updateSettings({ categories: next });
    onChange({ target: { value: trimmed } });
    setNewCategory('');
    setOpen(false);
  };

  const handleDelete = async (category, event) => {
    event.stopPropagation();
    setOpen(false);
    const ok = await confirm({
      title: `Remove "${category}"?`,
      description: `Existing expenses using "${category}" won't be affected.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) {
      setOpen(true);
      return;
    }

    const next = categories.filter((item) => item !== category);
    await updateSettings({ categories: next });
    if (value === category) onChange({ target: { value: next[0] || '' } });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="block w-full rounded-md border border-rule-strong bg-surface-raised text-ink px-3 py-2.5 text-base sm:text-sm transition-colors duration-180 hover:border-ink-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 appearance-none pr-9 cursor-pointer text-left"
      >
        <span className={value ? '' : 'text-ink-faint'}>{value || 'Select category'}</span>
      </button>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className={`pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      >
        <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-rule bg-surface shadow-md">
          <ul className="max-h-52 overflow-y-auto py-1">
            {categories.map((category) => (
              <li
                key={category}
                className={`group flex cursor-pointer items-center justify-between gap-2 px-3 py-2 hover:bg-surface-raised ${value === category ? 'bg-surface-raised' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(category)}
                  className="flex-1 text-left text-sm text-ink"
                >
                  {category}
                  {value === category && (
                    <span className="ml-2 text-xs text-ink-faint">Selected</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(event) => handleDelete(category, event)}
                  aria-label={`Remove ${category}`}
                  className="shrink-0 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                >
                  <XIcon />
                </button>
              </li>
            ))}
            {!categories.length && (
              <li className="px-3 py-2 text-sm text-ink-faint">No categories yet.</li>
            )}
          </ul>

          <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Add another category..."
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newCategory.trim() || categories.includes(newCategory.trim())}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

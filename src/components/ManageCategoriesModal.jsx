import { useState } from 'react';
import { useConfirm } from './ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { Modal, Button, FormField, Input } from './ui';

export function ManageCategoriesModal({ open, onClose }) {
  const confirm = useConfirm();
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const [draft, setDraft] = useState('');

  const categories = settings.categories;

  const add = () => {
    const name = draft.trim();
    if (!name || categories.includes(name)) return;
    updateSettings({ categories: [...categories, name] });
    setDraft('');
  };

  const remove = (cat) => {
    updateSettings({ categories: categories.filter((c) => c !== cat) });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Settings"
      title="Manage categories"
      description="Categories are shared across expenses and budgets."
      size="sm"
    >
      <div className="grid gap-6">
        {/* existing categories */}
        <ul className="divide-y divide-rule">
          {categories.map((cat) => (
            <li key={cat} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-ink">{cat}</span>
              <Button variant="ghost" size="sm" onClick={async () => {
                if (await confirm({ title: 'Remove category', description: `Remove "${cat}"? Existing expenses in this category won't be affected.` }))
                  remove(cat);
              }}>
                Remove
              </Button>
            </li>
          ))}
          {!categories.length && (
            <li className="py-3 text-sm text-ink-faint">No categories yet.</li>
          )}
        </ul>

        {/* add new */}
        <FormField label="Add category" htmlFor="new-cat-input">
          <div className="flex gap-2">
            <Input
              id="new-cat-input"
              type="text"
              placeholder="e.g. Caprichos"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <Button variant="primary" onClick={add}>
              Add
            </Button>
          </div>
        </FormField>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

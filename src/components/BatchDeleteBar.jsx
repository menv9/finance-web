import { Button } from './ui';

/**
 * Floating toolbar that appears below the table header when batch-select mode is active.
 * Shows how many rows are selected and exposes Delete + Cancel actions.
 */
export function BatchDeleteBar({ selecting, selectedCount, onDelete, onCancel }) {
  if (!selecting) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-surface-raised px-4 py-2.5">
      <span className="text-sm text-ink-muted">
        {selectedCount > 0 ? `${selectedCount} selected` : 'Check rows to select'}
      </span>
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:text-danger">
            Delete {selectedCount}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

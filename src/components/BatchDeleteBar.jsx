import { Button } from './ui';

/**
 * Toolbar that appears above a table when batch-select mode is active.
 * Shows how many rows are selected and exposes Delete + Cancel actions.
 * Wraps gracefully on narrow mobile screens.
 */
export function BatchDeleteBar({ selecting, selectedCount, onDelete, onCancel }) {
  if (!selecting) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-rule bg-surface-raised px-4 py-2.5 mb-3">
      <span className="text-sm text-ink-muted">
        {selectedCount > 0 ? `${selectedCount} selected` : 'Select rows'}
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

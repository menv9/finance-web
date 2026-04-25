import { useRef, useState } from 'react';
import { normalizeDateInput } from '../../utils/dates';
import { FormField, Input, Select, Textarea, Checkbox, Button } from '../ui';

const initialState = {
  date: normalizeDateInput(new Date()),
  amountCents: '',
  currency: 'EUR',
  category: 'Otros',
  subcategory: '',
  description: '',
  isRecurring: false,
};

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M13.5 7.5 7.5 13.5a4 4 0 0 1-5.657-5.657l6.364-6.364a2.5 2.5 0 0 1 3.536 3.536L5.379 11.38a1 1 0 0 1-1.415-1.415l6.364-6.364" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Shows existing attachments (when editing) — just name + size, managed via AttachmentViewer
function ExistingAttachmentPill({ attachment, onRemove }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-rule bg-surface-raised px-3 py-1 text-xs text-ink">
      <PaperclipIcon />
      <span className="truncate max-w-[140px]">{attachment.fileName}</span>
      <span className="text-ink-faint shrink-0">{formatBytes(attachment.size)}</span>
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="text-ink-faint hover:text-danger transition-colors ml-1"
        aria-label={`Remove ${attachment.fileName}`}
      >
        <XIcon />
      </button>
    </div>
  );
}

// Shows a queued (not yet uploaded) file
function PendingFilePill({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-rule bg-accent-soft px-3 py-1 text-xs text-ink">
      <PaperclipIcon />
      <span className="truncate max-w-[140px]">{file.name}</span>
      <span className="text-ink-faint shrink-0">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-ink-faint hover:text-danger transition-colors ml-1"
        aria-label={`Remove ${file.name}`}
      >
        <XIcon />
      </button>
    </div>
  );
}

export function ExpenseForm({
  categories,
  initialValue,
  existingAttachments = [],
  onRemoveAttachment,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    ...initialState,
    ...initialValue,
    amountCents: initialValue?.amountCents ? `${initialValue.amountCents / 100}` : '',
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const addFiles = (fileList) => {
    const accepted = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
    );
    setPendingFiles((prev) => [...prev, ...accepted]);
  };

  const removePending = (index) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const hasAttachments = existingAttachments.length > 0 || pendingFiles.length > 0;

  return (
    <form
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(
          {
            ...initialValue,
            ...form,
            amountCents: Math.round(Number(form.amountCents || 0) * 100),
          },
          pendingFiles,
        );
      }}
    >
      <FormField label="Date" htmlFor="expense-date">
        {(props) => (
          <Input {...props} type="date" value={form.date} onChange={set('date')} />
        )}
      </FormField>

      <FormField label="Amount" htmlFor="expense-amount" required>
        {(props) => (
          <Input
            {...props}
            type="number"
            step="0.01"
            value={form.amountCents}
            onChange={set('amountCents')}
            placeholder="0.00"
          />
        )}
      </FormField>

      <FormField label="Category" htmlFor="expense-category">
        {(props) => (
          <Select {...props} value={form.category} onChange={set('category')}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Subcategory" htmlFor="expense-subcategory">
        {(props) => (
          <Input
            {...props}
            value={form.subcategory}
            onChange={set('subcategory')}
            placeholder="Optional"
          />
        )}
      </FormField>

      <FormField label="Description" htmlFor="expense-description" className="md:col-span-2">
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="A short note for the ledger"
          />
        )}
      </FormField>

      <FormField label="Currency" htmlFor="expense-currency">
        {(props) => (
          <Select {...props} value={form.currency} onChange={set('currency')}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </Select>
        )}
      </FormField>

      <div className="flex items-center">
        <Checkbox
          label="Also add to Recurring bills"
          checked={form.isRecurring}
          onChange={(checked) =>
            setForm((prev) => ({ ...prev, isRecurring: checked }))
          }
        />
      </div>

      {/* ── Attachments ─────────────────────────────────────────────────── */}
      <div className="md:col-span-2">
        <p className="eyebrow mb-2">Attachments</p>

        {/* Existing attachments (when editing) */}
        {existingAttachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {existingAttachments.map((att) => (
              <ExistingAttachmentPill
                key={att.id}
                attachment={att}
                onRemove={onRemoveAttachment}
              />
            ))}
          </div>
        )}

        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {pendingFiles.map((file, i) => (
              <PendingFilePill key={i} file={file} onRemove={() => removePending(i)} />
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer ' +
            (dragging ? 'border-accent bg-accent-soft' : 'border-rule hover:border-rule-strong hover:bg-surface-raised')
          }
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Upload receipt or invoice"
        >
          <PaperclipIcon />
          <span className="text-xs text-ink-muted">
            Drop images or PDFs here, or <span className="text-accent">click to browse</span>
          </span>
          {hasAttachments && (
            <span className="text-xs text-ink-faint">Add more</span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-rule">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          {initialValue ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}

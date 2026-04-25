import { useEffect, useRef, useState } from 'react';
import { useConfirm } from './ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { Modal, Button, EmptyState } from './ui';

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({ attachment, onDelete }) {
  const getAttachmentUrl = useFinanceStore((state) => state.getAttachmentUrl);
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAttachmentUrl(attachment).then((resolved) => {
      if (cancelled) return;
      // Track object URLs for cleanup
      if (resolved?.startsWith('blob:')) urlRef.current = resolved;
      setUrl(resolved);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [attachment.id]);

  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';

  return (
    <div className="rounded-lg border border-rule bg-surface-raised overflow-hidden">
      {/* Preview area */}
      {loading ? (
        <div className="flex h-40 items-center justify-center bg-surface-sunken">
          <span className="text-xs text-ink-faint animate-pulse">Loading…</span>
        </div>
      ) : url && isImage ? (
        <div className="relative bg-surface-sunken cursor-pointer" onClick={() => setExpanded(true)}>
          <img
            src={url}
            alt={attachment.fileName}
            className="max-h-48 w-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
            <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">Click to expand</span>
          </div>
        </div>
      ) : url && isPdf ? (
        <div className="bg-surface-sunken">
          <embed
            src={url}
            type="application/pdf"
            className="w-full h-64"
            title={attachment.fileName}
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center bg-surface-sunken flex-col gap-2">
          <FileIcon />
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
              Open file
            </a>
          ) : (
            <span className="text-xs text-ink-faint">Preview unavailable</span>
          )}
        </div>
      )}

      {/* Footer bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-rule">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink">{attachment.fileName}</p>
          <p className="text-xs text-ink-faint">{formatBytes(attachment.size)}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
            >
              Open
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:text-danger">
            <TrashIcon />
          </Button>
        </div>
      </div>

      {/* Expanded image lightbox */}
      {expanded && isImage && url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(false)}
        >
          <img
            src={url}
            alt={attachment.fileName}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export function AttachmentViewer({ open, onClose, expenseId }) {
  const attachments = useFinanceStore((state) => state.attachments);
  const removeAttachment = useFinanceStore((state) => state.removeAttachment);
  const confirm = useConfirm();

  const expenseAttachments = attachments.filter((a) => a.expenseId === expenseId);

  const handleDelete = async (att) => {
    if (await confirm({ title: 'Delete attachment', description: `Remove "${att.fileName}"? This cannot be undone.` })) {
      await removeAttachment(att.id);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Expense"
      title="Attachments"
      description="Receipts and invoices linked to this expense."
      size="lg"
    >
      {expenseAttachments.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {expenseAttachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              onDelete={() => handleDelete(att)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No attachments"
          description="Upload a receipt or invoice via the Edit expense form."
        />
      )}
    </Modal>
  );
}

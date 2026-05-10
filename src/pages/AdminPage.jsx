import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, FormField, Input, Select, Textarea } from '../components/ui';
import { useFinanceStore } from '../store/useFinanceStore';
import { toast } from '../store/useToastStore';

const PLANNER_URL = 'https://planner.finges.xyz';

const DATE_BEARING_STORES = [
  'expenses',
  'incomes',
  'savingsEntries',
  'dividends',
  'portfolioCashflows',
  'portfolioSales',
];

function isBackupSnapshot(parsed) {
  return parsed
    && typeof parsed === 'object'
    && !Array.isArray(parsed)
    && (parsed.version || parsed.stores || parsed.settings);
}

function PlannerCard() {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink">Planner</h2>
        <p className="text-sm text-ink-muted">
          Open the standalone planner workspace in a new tab.
        </p>
        <div>
          <Button as="a" href={PLANNER_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} /> Open planner
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ImportJsonCard() {
  const importBackup = useFinanceStore((s) => s.importBackup);
  const saveEntity = useFinanceStore((s) => s.saveEntity);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleImport = async () => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      toast.error(`Invalid JSON: ${err.message}`);
      return;
    }
    setBusy(true);
    try {
      if (isBackupSnapshot(parsed)) {
        await importBackup(parsed);
        toast.success('Backup imported');
      } else if (parsed && typeof parsed === 'object') {
        let total = 0;
        for (const [storeName, records] of Object.entries(parsed)) {
          if (!Array.isArray(records)) continue;
          for (const record of records) {
            await saveEntity(storeName, record);
            total += 1;
          }
        }
        if (total === 0) {
          toast.error('No recognised store keys found in JSON');
        } else {
          toast.success(`Imported ${total} record${total === 1 ? '' : 's'}`);
          setText('');
        }
      } else {
        toast.error('JSON must be an object');
      }
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink">Import test JSON</h2>
        <p className="text-sm text-ink-muted">
          Paste a full backup snapshot, or an object keyed by store name (e.g.{' '}
          <code className="text-xs">{`{ "expenses": [...] }`}</code>). Loose records
          go through <code className="text-xs">saveEntity</code> so cascades and
          activity logging still run.
        </p>
        <FormField label="JSON">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder='{"expenses": [{"date": "2026-01-15", "amountCents": 1234, "currency": "EUR", "category": "Food"}]}'
            spellCheck={false}
            className="font-mono text-xs"
          />
        </FormField>
        <div>
          <Button onClick={handleImport} disabled={busy || !text.trim()}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ChangeDateCard() {
  const saveEntity = useFinanceStore((s) => s.saveEntity);
  const stores = useFinanceStore((s) => s);
  const [storeName, setStoreName] = useState(DATE_BEARING_STORES[0]);
  const [recordId, setRecordId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);

  const handleUpdate = async () => {
    if (!recordId.trim() || !newDate) {
      toast.error('Record id and new date are required');
      return;
    }
    const list = stores[storeName] || [];
    const record = list.find((r) => r.id === recordId.trim());
    if (!record) {
      toast.error(`No ${storeName} record found with id ${recordId.trim()}`);
      return;
    }
    setBusy(true);
    try {
      await saveEntity(storeName, { ...record, date: newDate });
      toast.success(`Updated ${storeName}/${recordId.trim()}`);
      setRecordId('');
      setNewDate('');
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink">Change record date</h2>
        <p className="text-sm text-ink-muted">
          Routes through <code className="text-xs">saveEntity</code>, so bank
          balance adjustments, sync timestamps, and activity logs all run.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Store">
            <Select value={storeName} onChange={(e) => setStoreName(e.target.value)}>
              {DATE_BEARING_STORES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Record id">
            <Input
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder="exp-…"
            />
          </FormField>
          <FormField label="New date">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </FormField>
        </div>
        <div>
          <Button onClick={handleUpdate} disabled={busy}>
            {busy ? 'Updating…' : 'Update'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const profile = useFinanceStore((s) => s.profile);

  if (!profile?.is_admin) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Admin" />
        <Card>
          <p className="text-sm text-ink-muted">Not authorised.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Admin"
        subtitle="Devtools — operates on local IndexedDB and syncs through normal channels."
      />
      <PlannerCard />
      <ImportJsonCard />
      <ChangeDateCard />
    </div>
  );
}

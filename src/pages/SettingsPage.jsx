import { useState, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useFinanceStore } from '../store/useFinanceStore';
import { Card, Button, FormField, Input, Select, Table, EmptyState } from '../components/ui';
import { rise } from '../utils/motion';

// ── Allocation Rules Card ─────────────────────────────────────────────────────

function AllocationRulesCard({ settings, updateSettings }) {
  const rules = settings.allocationRules || {};
  const [newSource, setNewSource] = useState('');

  const addSource = () => {
    const name = newSource.trim();
    if (!name || rules[name]) return;
    updateSettings({ allocationRules: { ...rules, [name]: [] } });
    setNewSource('');
  };

  const removeSource = (source) => {
    const next = { ...rules };
    delete next[source];
    updateSettings({ allocationRules: next });
  };

  const addRule = (source) => {
    updateSettings({
      allocationRules: {
        ...rules,
        [source]: [...(rules[source] || []), { toModule: 'savings', kind: 'fixed', amountCents: 0, percent: 0 }],
      },
    });
  };

  const updateRule = (source, index, patch) => {
    const updated = (rules[source] || []).map((r, i) => (i === index ? { ...r, ...patch } : r));
    updateSettings({ allocationRules: { ...rules, [source]: updated } });
  };

  const removeRule = (source, index) => {
    const updated = (rules[source] || []).filter((_, i) => i !== index);
    updateSettings({ allocationRules: { ...rules, [source]: updated } });
  };

  return (
    <Card
      id="allocation-rules"
      eyebrow="Transfers"
      title="Income allocation defaults"
      description="Suggested splits that pre-fill the Distribute dialog on income entries. You always adjust before confirming."
      className={rise(4)}
    >
      <p className="mb-5 text-xs text-ink-muted">
        Set up default amounts or percentages per income source. When you click{' '}
        <span className="font-medium text-ink">Distribute</span> on an income entry, these are pre-filled — but you
        can change them in the moment.
      </p>

      {Object.keys(rules).length === 0 && (
        <p className="mb-4 text-sm text-ink-faint">No sources defined yet.</p>
      )}

      <div className="grid gap-6">
        {Object.entries(rules).map(([source, sourceRules]) => (
          <div key={source} className="rounded-md border border-rule bg-surface-raised p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-medium text-sm text-ink">{source}</p>
              <button
                type="button"
                onClick={() => removeSource(source)}
                className="text-xs text-ink-faint hover:text-danger transition-colors"
              >
                Remove source
              </button>
            </div>

            {sourceRules.length === 0 && (
              <p className="mb-3 text-xs text-ink-faint">No rules yet — add one below.</p>
            )}

            <div className="grid gap-2">
              {sourceRules.map((rule, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <FormField label={i === 0 ? 'Destination' : undefined} htmlFor={`rule-${source}-${i}-to`}>
                    <Select
                      id={`rule-${source}-${i}-to`}
                      value={rule.toModule}
                      onChange={(e) => updateRule(source, i, { toModule: e.target.value })}
                    >
                      <option value="savings">Savings</option>
                      <option value="portfolio">Portfolio</option>
                    </Select>
                  </FormField>
                  <FormField label={i === 0 ? 'Type' : undefined} htmlFor={`rule-${source}-${i}-kind`}>
                    <Select
                      id={`rule-${source}-${i}-kind`}
                      value={rule.kind}
                      onChange={(e) => updateRule(source, i, { kind: e.target.value })}
                    >
                      <option value="fixed">Fixed amount</option>
                      <option value="percent">Percentage</option>
                    </Select>
                  </FormField>
                  <FormField
                    label={i === 0 ? (rule.kind === 'percent' ? 'Percent (%)' : `Amount (${settings.baseCurrency})`) : undefined}
                    htmlFor={`rule-${source}-${i}-val`}
                  >
                    <Input
                      id={`rule-${source}-${i}-val`}
                      type="number"
                      numeric
                      min="0"
                      max={rule.kind === 'percent' ? 100 : undefined}
                      step={rule.kind === 'percent' ? 1 : 0.01}
                      placeholder={rule.kind === 'percent' ? '0' : '0.00'}
                      value={rule.kind === 'percent' ? (rule.percent || '') : (rule.amountCents ? (rule.amountCents / 100).toFixed(2) : '')}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value || '0');
                        updateRule(source, i, rule.kind === 'percent'
                          ? { percent: v }
                          : { amountCents: Math.round(v * 100) });
                      }}
                    />
                  </FormField>
                  <button
                    type="button"
                    onClick={() => removeRule(source, i)}
                    className="mb-px flex h-10 w-10 items-center justify-center text-ink-faint hover:text-danger transition-colors"
                    aria-label="Remove rule"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addRule(source)}
              className="mt-3 text-xs text-accent hover:underline"
            >
              + Add rule
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <FormField label="Add income source" htmlFor="new-alloc-source" className="flex-1 min-w-[200px]">
          <Input
            id="new-alloc-source"
            type="text"
            placeholder="e.g. Main salary"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSource()}
          />
        </FormField>
        <Button onClick={addSource}>Add source</Button>
      </div>
    </Card>
  );
}

const sections = [
  { id: 'preferences', label: 'Preferences' },
  { id: 'categories', label: 'Categories' },
  { id: 'targets', label: 'Allocation targets' },
  { id: 'allocation-rules', label: 'Income allocation' },
  { id: 'sync', label: 'Sync' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'backup', label: 'Backup' },
];

function SectionLink({ id, label }) {
  return (
    <a
      href={`#${id}`}
      className="block py-2 pl-3 border-l border-rule text-sm text-ink-muted hover:text-ink hover:border-accent transition-colors duration-180"
    >
      {label}
    </a>
  );
}

export default function SettingsPage() {
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const exportBackup = useFinanceStore((state) => state.exportBackup);
  const importBackup = useFinanceStore((state) => state.importBackup);
  const signOutSupabase = useFinanceStore((state) => state.signOutSupabase);
  const pushToSupabase = useFinanceStore((state) => state.pushToSupabase);
  const pullFromSupabase = useFinanceStore((state) => state.pullFromSupabase);
  const supabaseConfigured = useFinanceStore((state) => state.supabaseConfigured);
  const supabaseUser = useFinanceStore((state) => state.supabaseUser);
  const supabaseSyncStatus = useFinanceStore((state) => state.supabaseSyncStatus);
  const supabaseLastSyncedAt = useFinanceStore((state) => state.supabaseLastSyncedAt);
  const supabaseError = useFinanceStore((state) => state.supabaseError);
  const conflicts = useFinanceStore((state) => state.syncMeta.conflicts);
  const resolveConflictUseRemote = useFinanceStore((state) => state.resolveConflictUseRemote);
  const resolveConflictKeepLocal = useFinanceStore((state) => state.resolveConflictKeepLocal);

  const [categoryInput, setCategoryInput] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [targetInput, setTargetInput] = useState({ ticker: '', targetWeight: '' });

  const targetColumns = [
    { key: 'ticker', header: 'Ticker', render: (r) => <span className="font-mono">{r.ticker}</span> },
    { key: 'targetWeight', header: 'Target', numeric: true, render: (r) => `${r.targetWeight}%` },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTargetInput({ ticker: r.ticker, targetWeight: `${r.targetWeight}` })}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateSettings({
                allocationTargets: settings.allocationTargets.filter((t) => t.ticker !== r.ticker),
              })
            }
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12">
      <PageHeader
        number="07"
        eyebrow="Module"
        title="Settings"
        description="Preferences, categories, allocation targets, sync, and backup. All changes persist locally; Supabase sync is optional."
      />

      <div className="grid gap-10 lg:grid-cols-12">
        {/* left rail */}
        <aside className="lg:col-span-3 lg:sticky lg:top-20 lg:self-start">
          <p className="eyebrow mb-3">On this page</p>
          <nav aria-label="Settings sections" className="flex flex-col">
            {sections.map((s) => (
              <SectionLink key={s.id} {...s} />
            ))}
          </nav>
        </aside>

        {/* content */}
        <div className="lg:col-span-9 grid gap-10">
          <Card
            id="preferences"
            eyebrow="General"
            title="Preferences"
            description="Base currency and locale affect every number shown across the app."
            className={rise(1)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Base currency" htmlFor="base-currency">
                <Select
                  id="base-currency"
                  value={settings.baseCurrency}
                  onChange={(e) => updateSettings({ baseCurrency: e.target.value })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </Select>
              </FormField>
              <FormField label="Locale" htmlFor="locale">
                <Select
                  id="locale"
                  value={settings.locale}
                  onChange={(e) => updateSettings({ locale: e.target.value })}
                >
                  <option value="de-AT">de-AT</option>
                  <option value="en-GB">en-GB</option>
                  <option value="en-US">en-US</option>
                </Select>
              </FormField>
            </div>
          </Card>

          <Card
            id="categories"
            eyebrow="Taxonomy"
            title="Expense categories"
            description="Edit, add, or remove. Categories are referenced across expense entry and filtering."
            className={rise(2)}
          >
            <div className="flex flex-wrap gap-2">
              {settings.categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface-raised px-3 py-1 text-xs text-ink"
                >
                  <span>{category}</span>
                  <button
                    type="button"
                    className="text-ink-faint hover:text-ink transition-colors"
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryInput(category);
                    }}
                  >
                    edit
                  </button>
                  {settings.categories.length > 1 ? (
                    <button
                      type="button"
                      className="text-ink-faint hover:text-danger transition-colors"
                      onClick={() =>
                        updateSettings({
                          categories: settings.categories.filter((c) => c !== category),
                        })
                      }
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <FormField label={editingCategory ? 'Edit category' : 'Add category'} className="flex-1 min-w-[220px]">
                <Input
                  value={categoryInput}
                  placeholder="e.g. Groceries"
                  onChange={(e) => setCategoryInput(e.target.value)}
                />
              </FormField>
              <Button
                onClick={() => {
                  if (!categoryInput.trim()) return;
                  const next = categoryInput.trim();
                  if (editingCategory) {
                    updateSettings({
                      categories: settings.categories.map((c) => (c === editingCategory ? next : c)),
                    });
                    setEditingCategory('');
                  } else if (!settings.categories.includes(next)) {
                    updateSettings({ categories: [...settings.categories, next] });
                  }
                  setCategoryInput('');
                }}
              >
                {editingCategory ? 'Save' : 'Add'}
              </Button>
              {editingCategory ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingCategory('');
                    setCategoryInput('');
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </Card>

          <Card
            id="targets"
            eyebrow="Portfolio"
            title="Allocation targets"
            description="Used for the actual-vs-target comparison in the Portfolio module."
            className={rise(3)}
          >
            {settings.allocationTargets?.length ? (
              <Table columns={targetColumns} rows={settings.allocationTargets.map((t) => ({ ...t, id: t.ticker }))} density="compact" />
            ) : (
              <EmptyState title="No targets set" description="Add a ticker and its target weight below." />
            )}
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <FormField label="Ticker">
                <Input
                  placeholder="e.g. VWCE"
                  value={targetInput.ticker}
                  onChange={(e) => setTargetInput((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                />
              </FormField>
              <FormField label="Weight %">
                <Input
                  type="number"
                  numeric
                  placeholder="e.g. 60"
                  value={targetInput.targetWeight}
                  onChange={(e) => setTargetInput((p) => ({ ...p, targetWeight: e.target.value }))}
                />
              </FormField>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    if (!targetInput.ticker || !targetInput.targetWeight) return;
                    updateSettings({
                      allocationTargets: [
                        ...settings.allocationTargets.filter((t) => t.ticker !== targetInput.ticker),
                        { ticker: targetInput.ticker, targetWeight: Number(targetInput.targetWeight) },
                      ],
                    });
                    setTargetInput({ ticker: '', targetWeight: '' });
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>

          <AllocationRulesCard settings={settings} updateSettings={updateSettings} />

          <Card
            id="sync"
            eyebrow="Cloud"
            title="Sync"
            description="Push or pull data between this device and the cloud. Sign in from the login page."
            action={
              <span className={'inline-flex items-center gap-1.5 text-xs ' + (supabaseUser ? 'text-positive' : 'text-ink-faint')}>
                <span aria-hidden className={'inline-block h-1.5 w-1.5 rounded-full ' + (supabaseUser ? 'bg-positive' : 'bg-ink-faint')} />
                {supabaseUser ? `Signed in as ${supabaseUser.email}` : 'Not signed in'}
              </span>
            }
            className={rise(4)}
          >
            <div className="flex flex-wrap gap-2">
              <Button disabled={!supabaseUser} onClick={() => pushToSupabase()}>
                Push local → cloud
              </Button>
              <Button variant="secondary" disabled={!supabaseUser} onClick={() => pullFromSupabase()}>
                Pull cloud → local
              </Button>
              <Button variant="ghost" disabled={!supabaseUser} onClick={() => signOutSupabase()}>
                Sign out
              </Button>
            </div>

            <dl className="mt-6 grid gap-2 rounded-md border border-rule bg-surface-sunken p-4 text-xs">
              <div className="flex gap-3">
                <dt className="eyebrow w-20">Status</dt>
                <dd className="text-ink">{supabaseSyncStatus}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="eyebrow w-20">Last</dt>
                <dd className="text-ink numeric">
                  {supabaseLastSyncedAt
                    ? new Date(supabaseLastSyncedAt).toLocaleString(settings.locale)
                    : '—'}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="eyebrow w-20">Error</dt>
                <dd className={supabaseError ? 'text-danger' : 'text-ink-muted'}>
                  {supabaseError || 'none'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card
            id="conflicts"
            eyebrow="Sync"
            title="Conflicts"
            description="Shown when the same record changed locally and remotely after the last sync."
            className={rise(5)}
          >
            {conflicts.length ? (
              <div className="grid gap-4">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-md border border-rule-strong bg-surface-raised p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm text-ink">
                          {conflict.storeName} / {conflict.recordId}
                        </p>
                        <p className="eyebrow mt-1">
                          remote updated {new Date(conflict.remoteUpdatedAt).toLocaleString(settings.locale)}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-sm bg-danger-soft px-2 py-0.5 text-xs text-danger border border-danger/30">
                        conflict
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md bg-surface-sunken p-3">
                        <p className="eyebrow mb-2">Local</p>
                        <pre className="overflow-auto whitespace-pre-wrap text-xs text-ink-muted font-mono">
                          {JSON.stringify(conflict.localTombstone || conflict.localRecord, null, 2)}
                        </pre>
                      </div>
                      <div className="rounded-md bg-surface-sunken p-3">
                        <p className="eyebrow mb-2">Remote</p>
                        <pre className="overflow-auto whitespace-pre-wrap text-xs text-ink-muted font-mono">
                          {JSON.stringify(
                            conflict.remoteDeletedAt
                              ? { deletedAt: conflict.remoteDeletedAt }
                              : conflict.remoteRecord,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => resolveConflictKeepLocal(conflict.id)}>Keep local</Button>
                      <Button variant="secondary" onClick={() => resolveConflictUseRemote(conflict.id)}>
                        Use remote
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No sync conflicts right now.</p>
            )}
          </Card>

          <Card
            id="backup"
            eyebrow="Portability"
            title="Backup and restore"
            description="Complete JSON dump for migration, device transfer, or pre-sync insurance."
            className={rise(6)}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  const backup = await exportBackup();
                  const blob = new Blob([JSON.stringify(backup, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = 'finance-tracker-backup.json';
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export JSON
              </Button>
              <label className="inline-flex">
                <Button as="span" variant="primary">
                  Import JSON
                </Button>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const snapshot = JSON.parse(await file.text());
                    await importBackup(snapshot);
                  }}
                />
              </label>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

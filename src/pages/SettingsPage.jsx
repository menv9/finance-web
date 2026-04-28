import { useState, useCallback } from 'react';
import { PageHeader } from '../components/PageHeader';
import { SmartBankImport } from '../components/SmartBankImport';
import { useFinanceStore } from '../store/useFinanceStore';
import { Card, Button, FormField, Input, Select, Table, EmptyState, Modal } from '../components/ui';
import { rise } from '../utils/motion';

const sections = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'categories', label: 'Categories' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'targets', label: 'Allocation targets' },
  { id: 'import', label: 'Bank import' },
  { id: 'sync', label: 'Sync' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'backup', label: 'Backup' },
  { id: 'danger', label: 'Danger zone' },
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
  const saveEntity = useFinanceStore((state) => state.saveEntity);
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

  const setTheme = useFinanceStore((state) => state.setTheme);
  const wipeAllData = useFinanceStore((state) => state.wipeAllData);
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);

  const handleWipe = async () => {
    setWiping(true);
    await wipeAllData();
    setWiping(false);
    setWipeModalOpen(false);
    setWipeConfirmText('');
  };

  const isEris = supabaseUser?.email === 'erisbarrancop@gmail.com';
  const isGorka = supabaseUser?.email === 'gorkaaamendiola@gmail.com';
  const isPrivileged = isEris || isGorka;
  const theme = settings.theme || 'dark';
  const appliedTheme = ['dark', 'light', 'eris', 'gorka'].includes(theme) ? theme : 'dark';

  const themeOptions = [
    { value: 'dark',  label: 'Dark',  emoji: '🌑', description: 'Deep & minimal' },
    { value: 'light', label: 'Light', emoji: '☀️', description: 'Clean & bright' },
    ...(isPrivileged ? [{ value: 'eris',  label: 'Eris',  emoji: '🌸', description: 'Lavender dreams' }] : []),
    ...(isPrivileged ? [{ value: 'gorka', label: 'Gorka', emoji: '🪩', description: 'Liquid chrome'   }] : []),
  ];

  const [categoryInput, setCategoryInput] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [platformInput, setPlatformInput] = useState('');
  const [editingPlatform, setEditingPlatform] = useState('');
  const [targetInput, setTargetInput] = useState({ ticker: '', targetWeight: '' });
  const [showApiKey, setShowApiKey] = useState(false);
  const holdingPlatforms = settings.holdingPlatforms?.length
    ? settings.holdingPlatforms
    : ['Trade Republic', 'IBKR', 'DEGIRO'];

  const targetColumns = [
    { key: 'ticker', header: 'Ticker', render: (r) => <span className="font-mono">{r.ticker}</span> },
    { key: 'targetWeight', header: 'Target', numeric: true, render: (r) => `${r.targetWeight}%` },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noTruncate: true,
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
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
    <div className="grid grid-cols-1 gap-8">
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
            id="appearance"
            eyebrow="Display"
            title="Appearance"
            description="Choose how the app looks. Special themes are tied to your account."
            className={rise(1)}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {themeOptions.map((opt) => {
                const isActive = appliedTheme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={[
                      'group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all duration-180',
                      isActive
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-rule bg-surface-raised text-ink-muted hover:border-rule-strong hover:text-ink',
                    ].join(' ')}
                  >
                    <span className="text-xl leading-none">{opt.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink leading-tight">{opt.label}</p>
                      <p className="eyebrow text-[0.6rem] mt-0.5 leading-tight">{opt.description}</p>
                    </div>
                    {isActive && (
                      <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card
            id="preferences"
            eyebrow="General"
            title="Preferences"
            description="Base currency affects every money value shown across the app."
            className={rise(1)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Alpha Vantage API key"
                hint="Used for portfolio price refresh. Free key at alphavantage.co"
                htmlFor="av-key"
                className="md:col-span-2"
              >
                <div className="flex gap-2">
                  <Input
                    id="av-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="e.g. ABCDEF123456"
                    value={settings.alphaVantageApiKey || ''}
                    onChange={(e) => updateSettings({ alphaVantageApiKey: e.target.value.trim() })}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowApiKey((v) => !v)}
                    type="button"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </FormField>
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
                      x
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
            id="platforms"
            eyebrow="Portfolio"
            title="Portfolio platforms"
            description="Edit, add, or remove the platform options shown when creating or editing holdings."
            className={rise(3)}
          >
            <div className="flex flex-wrap gap-2">
              {holdingPlatforms.map((platform) => (
                <span
                  key={platform}
                  className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface-raised px-3 py-1 text-xs text-ink"
                >
                  <span>{platform}</span>
                  <button
                    type="button"
                    className="text-ink-faint hover:text-ink transition-colors"
                    onClick={() => {
                      setEditingPlatform(platform);
                      setPlatformInput(platform);
                    }}
                  >
                    edit
                  </button>
                  {holdingPlatforms.length > 1 ? (
                    <button
                      type="button"
                      className="text-ink-faint hover:text-danger transition-colors"
                      onClick={() =>
                        updateSettings({
                          holdingPlatforms: holdingPlatforms.filter((item) => item !== platform),
                        })
                      }
                    >
                      x
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <FormField label={editingPlatform ? 'Edit platform' : 'Add platform'} className="flex-1 min-w-[220px]">
                <Input
                  value={platformInput}
                  placeholder="e.g. Trade Republic"
                  onChange={(e) => setPlatformInput(e.target.value)}
                />
              </FormField>
              <Button
                onClick={() => {
                  if (!platformInput.trim()) return;
                  const next = platformInput.trim();
                  if (editingPlatform) {
                    const renamed = holdingPlatforms.map((item) => (item === editingPlatform ? next : item));
                    updateSettings({ holdingPlatforms: [...new Set(renamed)] });
                    setEditingPlatform('');
                  } else if (!holdingPlatforms.includes(next)) {
                    updateSettings({ holdingPlatforms: [...holdingPlatforms, next] });
                  }
                  setPlatformInput('');
                }}
              >
                {editingPlatform ? 'Save' : 'Add'}
              </Button>
              {editingPlatform ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingPlatform('');
                    setPlatformInput('');
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
            className={rise(4)}
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

          <Card
            id="import"
            eyebrow="Import"
            title="Bank import"
            description="Upload a CSV export from your bank. Detects income vs expenses by amount sign, and auto-categorizes using MCC codes."
            className={rise(5)}
          >
            <SmartBankImport
              categories={settings.categories}
              onImportExpenses={async (rows) => {
                for (const row of rows) await saveEntity('expenses', row);
              }}
              onImportIncomes={async (rows) => {
                for (const row of rows) await saveEntity('incomes', row);
              }}
            />
          </Card>

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
            className={rise(6)}
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
            className={rise(7)}
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
            description="Export or import data as JSON — full backup or per module."
            className={rise(8)}
          >
            {(() => {
              const doExport = async (stores, filename) => {
                const backup = await exportBackup(stores);
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
              };
              const doImport = async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                event.target.value = '';
                await importBackup(JSON.parse(await file.text()));
              };
              const modules = [
                { label: 'Expenses',  stores: ['expenses', 'fixedExpenses', 'budgets', 'rollovers'],                    file: 'expenses-backup.json' },
                { label: 'Income',    stores: ['incomes'],                                                               file: 'income-backup.json' },
                { label: 'Portfolio', stores: ['holdings', 'dividends', 'portfolioCashflows', 'portfolioSales'],         file: 'portfolio-backup.json' },
                { label: 'Savings',   stores: ['savings', 'savingsEntries'],                                             file: 'savings-backup.json' },
                { label: 'Transfers', stores: ['transfers'],                                                             file: 'transfers-backup.json' },
              ];
              return (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="eyebrow mb-2">Full backup</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => doExport(null, 'finance-tracker-backup.json')}>Export all</Button>
                      <label className="inline-flex">
                        <Button as="span" variant="primary">Import</Button>
                        <input type="file" accept="application/json" className="hidden" onChange={doImport} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow mb-3">By module</p>
                    <div className="flex flex-col divide-y divide-rule rounded-md border border-rule">
                      {modules.map(({ label, stores, file }) => (
                        <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-sm text-ink">{label}</span>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => doExport(stores, file)}>Export</Button>
                            <label className="inline-flex">
                              <Button as="span" variant="ghost" size="sm">Import</Button>
                              <input type="file" accept="application/json" className="hidden" onChange={doImport} />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
          <Card
            id="danger"
            eyebrow="Danger zone"
            title="Wipe all data"
            description="Permanently deletes all financial records from this device. Settings (currency and API keys) are kept. This cannot be undone."
            className={rise(9)}
          >
            <Button variant="danger" size="sm" onClick={() => { setWipeModalOpen(true); setWipeConfirmText(''); }}>
              Erase all data
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={wipeModalOpen}
        onClose={() => { setWipeModalOpen(false); setWipeConfirmText(''); }}
        eyebrow="Danger zone"
        title="Erase all data"
        description="This will permanently delete every expense, income, saving, holding, and transfer on this device. It cannot be undone."
        size="sm"
      >
        <div className="grid gap-4">
          <p className="text-sm text-ink-muted">
            Type <span className="font-mono font-medium text-danger select-all">  ERASE ALL DATA </span> to confirm.
          </p>
          <Input
            autoFocus
            placeholder="ERASE ALL DATA"
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setWipeModalOpen(false); setWipeConfirmText(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={wipeConfirmText !== 'ERASE ALL DATA' || wiping}
              loading={wiping}
              onClick={handleWipe}
            >
              Erase all data
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

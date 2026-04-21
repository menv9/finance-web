import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { useFinanceStore } from '../store/useFinanceStore';

export default function SettingsPage() {
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const saveSupabaseSettings = useFinanceStore((state) => state.saveSupabaseSettings);
  const exportBackup = useFinanceStore((state) => state.exportBackup);
  const importBackup = useFinanceStore((state) => state.importBackup);
  const sendMagicLink = useFinanceStore((state) => state.sendMagicLink);
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
  const [supabaseInput, setSupabaseInput] = useState({
    url: settings.supabaseUrl || '',
    anonKey: settings.supabaseAnonKey || '',
    email: '',
  });

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Settings" title="Preferences and backup" description="User-editable categories, allocation targets, base currency, theme and full JSON backup." />

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="General preferences">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="base-currency">Base currency</label>
              <select id="base-currency" value={settings.baseCurrency} onChange={(event) => updateSettings({ baseCurrency: event.target.value })}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="locale">Locale</label>
              <select id="locale" value={settings.locale} onChange={(event) => updateSettings({ locale: event.target.value })}>
                <option value="de-AT">de-AT</option>
                <option value="en-GB">en-GB</option>
                <option value="en-US">en-US</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Categories">
          <div className="flex flex-wrap gap-2">
            {settings.categories.map((category) => (
              <span key={category} className="badge">
                {category}
                <button
                  className="button-ghost !p-0 text-xs"
                  onClick={() => {
                    setEditingCategory(category);
                    setCategoryInput(category);
                  }}
                >
                  Edit
                </button>
                {settings.categories.length > 1 ? (
                  <button
                    className="button-ghost !p-0 text-xs"
                    onClick={() =>
                      updateSettings({
                        categories: settings.categories.filter((item) => item !== category),
                      })
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input className="flex-1 rounded-[14px] border border-[var(--border-soft)] bg-[var(--bg-surface-strong)] px-4 py-3" value={categoryInput} placeholder="Add category" onChange={(event) => setCategoryInput(event.target.value)} />
            <button className="button-primary" onClick={() => {
              if (!categoryInput.trim()) return;
              const nextCategory = categoryInput.trim();
              if (editingCategory) {
                updateSettings({
                  categories: settings.categories.map((item) => (item === editingCategory ? nextCategory : item)),
                });
                setEditingCategory('');
              } else if (!settings.categories.includes(nextCategory)) {
                updateSettings({ categories: [...settings.categories, nextCategory] });
              }
              setCategoryInput('');
            }}>{editingCategory ? 'Save' : 'Add'}</button>
            {editingCategory ? (
              <button className="button-secondary" onClick={() => {
                setEditingCategory('');
                setCategoryInput('');
              }}>Cancel</button>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Allocation targets" subtitle="Used for actual vs target comparison in portfolio.">
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Target weight</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {settings.allocationTargets.map((target) => (
                <tr key={target.ticker}>
                  <td>{target.ticker}</td>
                  <td>{target.targetWeight}%</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="button-ghost" onClick={() => setTargetInput({ ticker: target.ticker, targetWeight: `${target.targetWeight}` })}>Edit</button>
                      <button className="button-ghost" onClick={() => updateSettings({
                        allocationTargets: settings.allocationTargets.filter((item) => item.ticker !== target.ticker),
                      })}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <input className="rounded-[14px] border border-[var(--border-soft)] bg-[var(--bg-surface-strong)] px-4 py-3" placeholder="Ticker" value={targetInput.ticker} onChange={(event) => setTargetInput((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))} />
          <input className="rounded-[14px] border border-[var(--border-soft)] bg-[var(--bg-surface-strong)] px-4 py-3" placeholder="Weight %" type="number" value={targetInput.targetWeight} onChange={(event) => setTargetInput((prev) => ({ ...prev, targetWeight: event.target.value }))} />
          <button className="button-primary" onClick={() => {
            if (!targetInput.ticker || !targetInput.targetWeight) return;
            updateSettings({
              allocationTargets: [...settings.allocationTargets.filter((target) => target.ticker !== targetInput.ticker), { ticker: targetInput.ticker, targetWeight: Number(targetInput.targetWeight) }],
            });
            setTargetInput({ ticker: '', targetWeight: '' });
          }}>Save target</button>
        </div>
      </SectionCard>

      <SectionCard title="Supabase sync (v2)" subtitle="Optional auth and device sync layered on top of the local-first data model.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            <div className="field">
              <label htmlFor="supabase-url">Project URL</label>
              <input
                id="supabase-url"
                value={supabaseInput.url}
                placeholder="https://your-project.supabase.co"
                onChange={(event) => setSupabaseInput((prev) => ({ ...prev, url: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="supabase-key">Publishable / anon key</label>
              <input
                id="supabase-key"
                value={supabaseInput.anonKey}
                placeholder="sb_publishable_..."
                onChange={(event) => setSupabaseInput((prev) => ({ ...prev, anonKey: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="button-primary"
                onClick={() => saveSupabaseSettings({ supabaseUrl: supabaseInput.url.trim(), supabaseAnonKey: supabaseInput.anonKey.trim() })}
              >
                Save Supabase config
              </button>
              <span className="badge">{supabaseConfigured ? 'Configured' : 'Local only'}</span>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="field">
              <label htmlFor="supabase-email">Sign in with magic link</label>
              <input
                id="supabase-email"
                type="email"
                value={supabaseInput.email}
                placeholder="you@example.com"
                onChange={(event) => setSupabaseInput((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="button-secondary"
                disabled={!supabaseConfigured || !supabaseInput.email}
                onClick={() => sendMagicLink(supabaseInput.email)}
              >
                Send magic link
              </button>
              <button className="button-secondary" disabled={!supabaseUser} onClick={() => signOutSupabase()}>
                Sign out
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {supabaseUser ? `Signed in as ${supabaseUser.email}` : 'No authenticated Supabase session yet.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="button-primary" disabled={!supabaseUser} onClick={() => pushToSupabase()}>
            Push local data to Supabase
          </button>
          <button className="button-secondary" disabled={!supabaseUser} onClick={() => pullFromSupabase()}>
            Pull latest snapshot from Supabase
          </button>
        </div>

        <div className="mt-4 rounded-[18px] bg-[var(--bg-muted)] px-4 py-4 text-sm text-[var(--text-muted)]">
          <p>Status: {supabaseSyncStatus}</p>
          <p>{supabaseLastSyncedAt ? `Last sync: ${new Date(supabaseLastSyncedAt).toLocaleString(settings.locale)}` : 'Last sync: not yet'}</p>
          <p>{supabaseError ? `Error: ${supabaseError}` : 'No sync errors recorded.'}</p>
        </div>
      </SectionCard>

      <SectionCard title="Sync conflicts" subtitle="Shown when the same record changed locally and remotely after the last sync.">
        {conflicts.length ? (
          <div className="grid gap-4">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--bg-surface-strong)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{conflict.storeName} / {conflict.recordId}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Remote updated {new Date(conflict.remoteUpdatedAt).toLocaleString(settings.locale)}
                    </p>
                  </div>
                  <span className="badge">Conflict</span>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[16px] bg-[var(--bg-muted)] p-3">
                    <p className="text-sm font-semibold">Local</p>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{JSON.stringify(conflict.localTombstone || conflict.localRecord, null, 2)}</pre>
                  </div>
                  <div className="rounded-[16px] bg-[var(--bg-muted)] p-3">
                    <p className="text-sm font-semibold">Remote</p>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">{JSON.stringify(conflict.remoteDeletedAt ? { deletedAt: conflict.remoteDeletedAt } : conflict.remoteRecord, null, 2)}</pre>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="button-primary" onClick={() => resolveConflictKeepLocal(conflict.id)}>Keep local version</button>
                  <button className="button-secondary" onClick={() => resolveConflictUseRemote(conflict.id)}>Use remote version</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No sync conflicts detected right now.</p>
        )}
      </SectionCard>

      <SectionCard title="Backup and restore" subtitle="Complete JSON dump for migration or sync prep.">
        <div className="flex flex-wrap gap-3">
          <button className="button-secondary" onClick={async () => {
            const backup = await exportBackup();
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'finance-tracker-backup.json';
            anchor.click();
            URL.revokeObjectURL(url);
          }}>Export backup JSON</button>
          <label className="button-primary">
            Import backup JSON
            <input type="file" accept="application/json" className="hidden" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const snapshot = JSON.parse(await file.text());
              await importBackup(snapshot);
            }} />
          </label>
        </div>
      </SectionCard>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { SmartBankImport } from '../components/SmartBankImport';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { Card, Table, Button, FormField, Input, Select, EmptyState, Modal, Toggle, Checkbox } from '../components/ui';
import { rise } from '../utils/motion';
import { formatCurrency } from '../utils/formatters';
import { useTour } from '../components/tour/TourContext';
import { useTranslation, resolveLanguage } from '../i18n/useTranslation';

const TABS = [
  { id: 'general', label: 'General', hint: 'Appearance, currency, modules' },
  { id: 'data',    label: 'Data',    hint: 'Categories, platforms, targets, import' },
  { id: 'sync',    label: 'Activity', hint: 'Cloud sync, conflicts, activity' },
  { id: 'backup',  label: 'Backup',  hint: 'Export, import, danger zone' },
];

// Maps section anchor id -> tab id (for hash deep-linking)
const SECTION_TO_TAB = {
  appearance: 'general',
  preferences: 'general',
  modules: 'general',
  categories: 'data',
  platforms: 'data',
  targets: 'data',
  import: 'data',
  sync: 'sync',
  conflicts: 'sync',
  history: 'sync',
  backup: 'backup',
  danger: 'backup',
};

// Maps tour stop id -> tab id (so tour auto-switches tabs)
const TOUR_TO_TAB = {
  'settings-appearance': 'general',
  'settings-modules': 'general',
  'settings-history': 'sync',
  'settings-backup': 'backup',
};

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <path d="M14.5 12.8A6.2 6.2 0 1 1 7.2 5.5a5 5 0 0 0 7.3 7.3z" fill="currentColor" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <circle cx="10" cy="10" r="3.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
      </g>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <path
        d="M10 2c.3 2.7 1.3 4.6 3 5.6 1.7 1 3.3 1.4 5 1.4-2.7.4-4.6 1.4-5.6 3-1 1.7-1.4 3.3-1.4 5-.4-2.7-1.4-4.6-3-5.6-1.7-1-3.3-1.4-5-1.4 2.7-.4 4.6-1.4 5.6-3 1-1.7 1.4-3.3 1.4-5z"
        fill="currentColor"
      />
    </svg>
  );
}

function DiscIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <circle cx="10" cy="10" r="7" fill="currentColor" opacity="0.85" />
      <circle cx="7.5" cy="7.5" r="2.2" fill="white" opacity="0.55" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function FlagENIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <rect x="2" y="4" width="16" height="12" rx="1.5" fill="#012169" />
      <path d="M2 4l16 12M18 4L2 16" stroke="white" strokeWidth="1.6" />
      <path d="M2 4l16 12M18 4L2 16" stroke="#C8102E" strokeWidth="0.7" />
      <path d="M10 4v12M2 10h16" stroke="white" strokeWidth="2.4" />
      <path d="M10 4v12M2 10h16" stroke="#C8102E" strokeWidth="1.2" />
    </svg>
  );
}

function FlagESIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      <rect x="2" y="4" width="16" height="3" fill="#AA151B" />
      <rect x="2" y="7" width="16" height="6" fill="#F1BF00" />
      <rect x="2" y="13" width="16" height="3" fill="#AA151B" />
    </svg>
  );
}

const HISTORY_PAGE_SIZE = 5;

function currentRecordFromState(state, log) {
  if (!log) return null;
  if (log.recordType === 'settings') return { id: 'settings', ...state.settings };
  if (log.recordType === 'savings') return state.savingsConfig;
  return (state[log.recordType] || []).find((item) => item.id === log.recordId) || null;
}

function undoPreviewText(log, currentRecord) {
  if (!log) return [];
  const label = log.label || log.recordId;
  const lines = [];
  if (log.action === 'create') {
    lines.push(`This will delete ${label}.`);
  } else if (log.action === 'update') {
    lines.push(`This will restore the previous version of ${label}.`);
  } else if (log.action === 'delete') {
    lines.push(`This will recreate ${label}.`);
  }
  const changedAfter =
    currentRecord &&
    log.after?.updatedAt &&
    currentRecord.updatedAt &&
    currentRecord.updatedAt !== log.after.updatedAt;
  if (changedAfter) {
    lines.push('This item has changed since this history entry, so undo may overwrite newer edits.');
  }
  return lines;
}

function getUndoAmountDelta(log) {
  if (!log) return null;
  const beforeAmount = Number(log.before?.amountCents || 0);
  const afterAmount = Number(log.after?.amountCents || 0);
  if (log.action === 'create' && log.after?.amountCents != null) return -afterAmount;
  if (log.action === 'delete' && log.before?.amountCents != null) return beforeAmount;
  if (log.action === 'update' && (log.before?.amountCents != null || log.after?.amountCents != null)) {
    return beforeAmount - afterAmount;
  }
  return null;
}

function movementDirection(delta) {
  if (delta > 0) return 'increases';
  if (delta < 0) return 'decreases';
  return 'does not change';
}

function moneyMovementText(log, locale, baseCurrency) {
  const delta = getUndoAmountDelta(log);
  if (delta == null) return 'No direct money movement is recorded for this undo.';
  const record = log.before || log.after || {};
  const currency = record.currency || baseCurrency || 'EUR';
  const amount = formatCurrency(Math.abs(delta), currency, locale);

  if (log.recordType === 'expenses') {
    return `Money movement: expenses ${movementDirection(delta)} by ${amount}; cash available ${movementDirection(-delta)} by ${amount}.`;
  }
  if (log.recordType === 'incomes') {
    return `Money movement: income ${movementDirection(delta)} by ${amount}; cash available ${movementDirection(delta)} by ${amount}.`;
  }
  if (log.recordType === 'savingsEntries') {
    return `Money movement: savings balance ${movementDirection(delta)} by ${amount}.`;
  }
  if (log.recordType === 'portfolioCashflows') {
    return `Money movement: portfolio cashflow ${movementDirection(delta)} by ${amount}.`;
  }
  if (log.recordType === 'transfers') {
    const direction = [record.fromModule, record.toModule].filter(Boolean).join(' to ');
    return `Money movement: ${log.action === 'create' ? 'removes' : 'restores'} a ${amount}${direction ? ` ${direction}` : ''} transfer.`;
  }
  return `Money movement: recorded amount ${movementDirection(delta)} by ${amount}.`;
}

export default function SettingsPage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const { t } = useTranslation();
  const settings = useFinanceStore((state) => state.settings);
  const updateSettings = useFinanceStore((state) => state.updateSettings);
  const navigate = useNavigate();
  const { startTour, currentStop } = useTour();
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
  const enableLocalOnlyMode = useFinanceStore((state) => state.enableLocalOnlyMode);
  const disableLocalOnlyMode = useFinanceStore((state) => state.disableLocalOnlyMode);
  const localOnlyMode = Boolean(settings.localOnlyMode);
  const activityLog = useFinanceStore((state) => state.activityLog);
  const undoActivityLog = useFinanceStore((state) => state.undoActivityLog);

  const setTheme = useFinanceStore((state) => state.setTheme);
  const wipeAllData = useFinanceStore((state) => state.wipeAllData);
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipeResetAccount, setWipeResetAccount] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [historyModule, setHistoryModule] = useState('all');
  const [historyAction, setHistoryAction] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [undoTarget, setUndoTarget] = useState(null);
  const [undoing, setUndoing] = useState(false);

  const handleWipe = async () => {
    setWiping(true);
    try {
      await wipeAllData({ resetAccountSetup: wipeResetAccount });
      setWipeModalOpen(false);
      setWipeConfirmText('');
      setWipeResetAccount(false);
      if (wipeResetAccount) {
        startTour();
      }
    } catch (error) {
      await alert({ title: 'Unable to erase data', description: error.message || 'Something went wrong.' });
    } finally {
      setWiping(false);
    }
  };

  const theme = settings.theme || 'dark';
  const appliedTheme = ['dark', 'light', 'eris', 'gorka', 'gorka-light'].includes(theme) ? theme : 'dark';

  const themeOptions = [
    { value: 'dark',  label: t('theme.dark.label'),  Icon: MoonIcon,    description: t('theme.dark.hint') },
    { value: 'light', label: t('theme.light.label'), Icon: SunIcon,     description: t('theme.light.hint') },
    { value: 'eris',  label: t('theme.eris.label'),  Icon: SparkleIcon, description: t('theme.eris.hint') },
    { value: 'gorka', label: t('theme.gorka.label'), Icon: DiscIcon,    description: t('theme.gorka.hint') },
    { value: 'gorka-light', label: t('theme.gorkaLight.label'), Icon: DiscIcon, description: t('theme.gorkaLight.hint') },
  ];

  const language = resolveLanguage(settings.language);
  const languageOptions = [
    { value: 'en', label: t('settings.language.english.label'), Icon: FlagENIcon, description: t('settings.language.english.hint') },
    { value: 'es', label: t('settings.language.spanish.label'), Icon: FlagESIcon, description: t('settings.language.spanish.hint') },
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

  const historyModules = useMemo(
    () => ['all', ...Array.from(new Set(activityLog.map((item) => item.module).filter(Boolean))).sort()],
    [activityLog],
  );
  const historyActions = useMemo(
    () => ['all', ...Array.from(new Set(activityLog.map((item) => item.action).filter(Boolean))).sort()],
    [activityLog],
  );
  const filteredHistory = useMemo(
    () =>
      [...activityLog]
        .filter((item) => historyModule === 'all' || item.module === historyModule)
        .filter((item) => historyAction === 'all' || item.action === historyAction)
        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)),
    [activityLog, historyAction, historyModule],
  );
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const pagedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  );
  const undoCurrentRecord = currentRecordFromState(useFinanceStore.getState(), undoTarget);
  const undoPreview = undoPreviewText(undoTarget, undoCurrentRecord);
  const undoMoneyMovement = moneyMovementText(undoTarget, settings.locale, settings.baseCurrency);

  const initialTab = (() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (TABS.some((t) => t.id === hash)) return hash;
    if (SECTION_TO_TAB[hash]) return SECTION_TO_TAB[hash];
    return 'general';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Tour-driven tab switching: ensure the right tab is mounted before the spotlight measures.
  useEffect(() => {
    const tab = TOUR_TO_TAB[currentStop?.tourId];
    if (tab && tab !== activeTab) setActiveTab(tab);
  }, [currentStop, activeTab]);

  // Hash deep-linking: react to hash changes (e.g. browser back/forward).
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      const tab = TABS.some((t) => t.id === hash) ? hash : SECTION_TO_TAB[hash];
      if (tab) setActiveTab(tab);
      const target = hash && document.getElementById(hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectTab = (id) => {
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        number="07"
        eyebrow={t('settings.pageEyebrow')}
        title={t('settings.pageTitle')}
        description={t('settings.pageDescription')}
      />

      {/* Tab bar */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-rule bg-canvas/85 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border sm:bg-surface/80 sm:px-2">
        <nav aria-label="Settings tabs" className="flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors duration-180',
                  isActive
                    ? 'bg-accent-soft text-ink'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                ].join(' ')}
              >
                <span className={['text-sm font-medium', isActive ? 'text-ink' : ''].join(' ')}>
                  {tab.label}
                </span>
                <span className="hidden text-[0.7rem] leading-tight text-ink-muted sm:block">
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="grid gap-8">
        {activeTab === 'general' && (<>
          <Card
            id="appearance"
            data-tour="settings-appearance"
            eyebrow={t('settings.appearance.eyebrow')}
            title={t('settings.appearance.title')}
            description={t('settings.appearance.description')}
            className={rise(1)}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                    <span className={isActive ? 'text-accent' : 'text-ink-faint group-hover:text-ink'}><opt.Icon /></span>
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
            eyebrow={t('settings.preferences.eyebrow')}
            title={t('settings.preferences.title')}
            description={t('settings.preferences.description')}
            className={rise(1)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={t('settings.preferences.finnhubLabel')}
                hint={t('settings.preferences.finnhubHint')}
                htmlFor="fh-key"
                className="md:col-span-2"
              >
                <div className="flex gap-2">
                  <Input
                    id="fh-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={t('settings.preferences.finnhubPlaceholder')}
                    value={settings.finnhubApiKey || ''}
                    onChange={(e) => updateSettings({ finnhubApiKey: e.target.value.trim() })}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowApiKey((v) => !v)}
                    type="button"
                  >
                    {showApiKey ? t('common.hide') : t('common.show')}
                  </Button>
                </div>
              </FormField>
              <FormField label={t('settings.preferences.baseCurrency')} htmlFor="base-currency">
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
            id="language"
            eyebrow={t('settings.language.eyebrow')}
            title={t('settings.language.title')}
            description={t('settings.language.description')}
            className={rise(1)}
          >
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              {languageOptions.map((opt) => {
                const isActive = language === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSettings({ language: opt.value })}
                    className={[
                      'group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all duration-180',
                      isActive
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-rule bg-surface-raised text-ink-muted hover:border-rule-strong hover:text-ink',
                    ].join(' ')}
                  >
                    <span className={isActive ? 'text-accent' : 'text-ink-faint group-hover:text-ink'}><opt.Icon /></span>
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
            id="cloud-sync"
            eyebrow="Cloud"
            title="Cloud sync"
            description="When off, this device works fully offline. Data stays in your browser; nothing is sent to Supabase."
            className={rise(2)}
          >
            <Toggle
              id="cloud-sync-toggle"
              checked={!localOnlyMode}
              onChange={async (checked) => {
                if (checked) {
                  await disableLocalOnlyMode();
                  if (!supabaseUser) navigate('/login');
                  return;
                }
                const ok = await confirm({
                  title: 'Switch to local-only mode?',
                  description: supabaseUser
                    ? 'You will be signed out on this device. Local data stays here, but no further changes will sync to the cloud until you sign in again.'
                    : 'No further changes will sync to the cloud until you sign in again.',
                  confirmLabel: 'Switch to local-only',
                  confirmVariant: 'primary',
                });
                if (ok) await enableLocalOnlyMode();
              }}
              label={localOnlyMode ? 'Local-only mode' : 'Cloud sync enabled'}
              description={
                localOnlyMode
                  ? 'No data is leaving this device. Turn on to sign in and sync.'
                  : supabaseUser
                    ? `Signed in as ${supabaseUser.email}.`
                    : 'Sign in from the login page to start syncing.'
              }
            />
          </Card>

          <Card
            id="modules"
            data-tour="settings-modules"
            eyebrow="Workspace"
            title="Modules"
            description="Choose which optional modules appear in the app navigation."
            className={rise(2)}
          >
            <div className="grid gap-4">
              <Toggle
                id="module-portfolio"
                checked={settings.modules?.portfolio !== false}
                onChange={(checked) =>
                  updateSettings({
                    modules: {
                      ...(settings.modules || {}),
                      portfolio: checked,
                    },
                  })
                }
                label="Portfolio"
                description="Show or hide the Portfolio module in the header navigation."
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-surface-raised p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Onboarding assessment</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Restart the setup wizard without deleting existing records.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    updateSettings({ onboardingTutorialCompleted: false });
                    startTour();
                  }}
                >
                  Restart onboarding
                </Button>
              </div>
            </div>
          </Card>

        </>)}

        {activeTab === 'data' && (<>
          <Card
            id="categories"
            eyebrow="Taxonomy"
            title="Expense categories"
            description="Edit, add, or remove. Categories are referenced across expense entry and filtering."
            className={rise(3)}
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

        </>)}

        {activeTab === 'sync' && (<>
          <Card
            id="history"
            data-tour="settings-history"
            eyebrow="Audit"
            title="Activity history"
            description="Every user-facing change is recorded here. Undo shows a confirmation before touching your data."
            className={rise(6)}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <FormField label="Module">
                <Select
                  value={historyModule}
                  onChange={(event) => {
                    setHistoryModule(event.target.value);
                    setHistoryPage(1);
                  }}
                >
                  {historyModules.map((module) => (
                    <option key={module} value={module}>
                      {module === 'all' ? 'All modules' : module}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Action">
                <Select
                  value={historyAction}
                  onChange={(event) => {
                    setHistoryAction(event.target.value);
                    setHistoryPage(1);
                  }}
                >
                  {historyActions.map((action) => (
                    <option key={action} value={action}>
                      {action === 'all' ? 'All actions' : action}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {pagedHistory.length ? (
              <>
                <ul className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
                  {pagedHistory.map((row) => {
                    const dateLabel = row.createdAt
                      ? new Date(row.createdAt).toLocaleString(settings.locale)
                      : '-';
                    const meta = [row.module, row.action, dateLabel].filter(Boolean).join(' · ');
                    return (
                      <li key={row.id} className="transition-colors duration-120 hover:bg-surface-raised">
                        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-baseline justify-between gap-4">
                              <p className="min-w-0 truncate text-sm text-ink">
                                {row.summary || row.label || 'Activity'}
                              </p>
                              {row.undoneAt ? (
                                <span className="shrink-0 text-xs text-ink-muted">undone</span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center justify-between gap-4">
                              <p className="min-w-0 truncate eyebrow">
                                {row.label || 'Activity'} · {meta}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 self-center font-medium text-danger transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!row.undoable || Boolean(row.undoneAt)}
                            onClick={() => setUndoTarget(row)}
                          >
                            Undo
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-ink-muted">
                    Page {safeHistoryPage} of {historyPageCount} · {filteredHistory.length} records
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={safeHistoryPage <= 1}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={safeHistoryPage >= historyPageCount}
                      onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="No history yet" description="New changes will appear here automatically." />
            )}
          </Card>

          {localOnlyMode ? (
            <Card
              id="sync"
              eyebrow="Cloud"
              title="Local-only mode"
              description="This device is not connected to cloud sync. All data stays in your browser."
              action={
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-faint" />
                  Offline
                </span>
              }
              className={rise(7)}
            >
              <p className="text-sm text-ink-muted leading-relaxed">
                Sign in to enable cloud sync. Your existing local data will be uploaded
                automatically once you sign in.
              </p>
              <div className="mt-4">
                <Button
                  onClick={async () => {
                    await disableLocalOnlyMode();
                    navigate('/login');
                  }}
                >
                  Sign in to enable cloud sync
                </Button>
              </div>
            </Card>
          ) : (
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
              className={rise(7)}
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

              <div className="mt-6 pt-4 border-t border-rule">
                <button
                  type="button"
                  className="text-xs text-ink-faint hover:text-ink underline-offset-2 hover:underline transition-colors duration-180"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Switch to local-only mode?',
                      description: supabaseUser
                        ? 'You will be signed out on this device. Your local data stays here, but no further changes will sync to the cloud until you sign in again.'
                        : 'No further changes will sync to the cloud until you sign in again.',
                      confirmLabel: 'Switch to local-only',
                      confirmVariant: 'primary',
                    });
                    if (ok) await enableLocalOnlyMode();
                  }}
                >
                  Switch to local-only mode
                </button>
              </div>
            </Card>
          )}

          {!localOnlyMode && (
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
          )}

        </>)}

        {activeTab === 'backup' && (<>
          <Card
            id="backup"
            data-tour="settings-backup"
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
                { label: 'Accounts',  stores: ['bankAccounts'],                                                          file: 'accounts-backup.json' },
                { label: 'Portfolio', stores: ['holdings', 'dividends', 'portfolioCashflows', 'portfolioSales'],         file: 'portfolio-backup.json' },
                { label: 'Savings',   stores: ['savings', 'savingsEntries', 'savingsGoals'],                             file: 'savings-backup.json' },
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
            <Button variant="danger" size="sm" onClick={() => { setWipeModalOpen(true); setWipeConfirmText(''); setWipeResetAccount(false); }}>
              Erase all data
            </Button>
          </Card>
        </>)}
      </div>

      <Modal
        open={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        eyebrow="Activity history"
        title="Confirm undo"
        description={undoTarget?.summary || ''}
        size="sm"
      >
        <div className="grid gap-4">
          <div className="rounded-md border border-rule bg-surface-sunken p-4">
            <p className="eyebrow mb-2">What will happen</p>
            <ul className="grid gap-2 text-sm text-ink-muted">
              <li className="text-ink">{undoMoneyMovement}</li>
              {(undoPreview.length ? undoPreview : ['This history item cannot be undone.']).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setUndoTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!undoTarget?.undoable || Boolean(undoTarget?.undoneAt) || undoing}
              loading={undoing}
              onClick={async () => {
                if (!undoTarget) return;
                setUndoing(true);
                try {
                  await undoActivityLog(undoTarget.id);
                  setUndoTarget(null);
                } finally {
                  setUndoing(false);
                }
              }}
            >
              Confirm undo
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={wipeModalOpen}
        onClose={() => { setWipeModalOpen(false); setWipeConfirmText(''); setWipeResetAccount(false); }}
        eyebrow="Danger zone"
        title="Erase all data"
        description="This will permanently delete every expense, income, saving, holding, transfer, and account balance on this device. It cannot be undone."
        size="sm"
      >
        <div className="grid gap-4">
          <p className="text-sm text-ink-muted">
            Type <span className="font-mono font-medium text-danger select-all">ERASE ALL DATA</span> to confirm.
          </p>
          <div className="rounded-md border border-rule bg-surface-raised p-3">
            <Checkbox
              id="wipe-reset-account"
              checked={wipeResetAccount}
              onChange={setWipeResetAccount}
              label="Also reset setup and start as a newly created account"
            />
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Resets default categories, then starts the product tour. After the tour you'll be taken to the initial setup to configure the account from zero.
            </p>
          </div>
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
              onClick={() => { setWipeModalOpen(false); setWipeConfirmText(''); setWipeResetAccount(false); }}
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

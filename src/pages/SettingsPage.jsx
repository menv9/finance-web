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

const TAB_IDS = ['general', 'data', 'sync', 'backup'];

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

function undoPreviewText(log, currentRecord, t) {
  if (!log) return [];
  const label = log.label || log.recordId;
  const lines = [];
  if (log.action === 'create') {
    lines.push(t('settings.history.undoWillDelete', { label }));
  } else if (log.action === 'update') {
    lines.push(t('settings.history.undoWillRestore', { label }));
  } else if (log.action === 'delete') {
    lines.push(t('settings.history.undoWillRecreate', { label }));
  }
  const changedAfter =
    currentRecord &&
    log.after?.updatedAt &&
    currentRecord.updatedAt &&
    currentRecord.updatedAt !== log.after.updatedAt;
  if (changedAfter) {
    lines.push(t('settings.history.undoChangedWarning'));
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

function moneyMovementText(log, locale, baseCurrency, t) {
  const delta = getUndoAmountDelta(log);
  if (delta == null) return t('settings.history.moneyMovementNone');
  const record = log.before || log.after || {};
  const currency = record.currency || baseCurrency || 'EUR';
  const amount = formatCurrency(Math.abs(delta), currency, locale);
  const dir = movementDirection(delta);
  const dirInv = movementDirection(-delta);

  if (log.recordType === 'expenses') {
    return t('settings.history.moneyMovementExpenses', { dir, dirInv, amount });
  }
  if (log.recordType === 'incomes') {
    return t('settings.history.moneyMovementIncome', { dir, amount });
  }
  if (log.recordType === 'savingsEntries') {
    return t('settings.history.moneyMovementSavings', { dir, amount });
  }
  if (log.recordType === 'portfolioCashflows') {
    return t('settings.history.moneyMovementPortfolio', { dir, amount });
  }
  if (log.recordType === 'transfers') {
    const direction = [record.fromModule, record.toModule].filter(Boolean).join(' to ');
    const verb = log.action === 'create' ? t('settings.history.transferRemoves') : t('settings.history.transferRestores');
    return t('settings.history.moneyMovementTransfer', { verb, amount, direction: direction ? ` ${direction}` : '' });
  }
  return t('settings.history.moneyMovementGeneric', { dir, amount });
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
      await alert({ title: t('settings.danger.unableToErase'), description: error.message || t('shell.modals.somethingWentWrong') });
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
    { key: 'ticker', header: t('settings.targets.ticker'), render: (r) => <span className="font-mono">{r.ticker}</span> },
    { key: 'targetWeight', header: t('settings.targets.target'), numeric: true, render: (r) => `${r.targetWeight}%` },
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
            {t('common.edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateSettings({
                allocationTargets: settings.allocationTargets.filter((tgt) => tgt.ticker !== r.ticker),
              })
            }
          >
            {t('common.remove')}
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
  const undoPreview = undoPreviewText(undoTarget, undoCurrentRecord, t);
  const undoMoneyMovement = moneyMovementText(undoTarget, settings.locale, settings.baseCurrency, t);

  const tabs = TAB_IDS.map((id) => ({
    id,
    label: t(`settings.tabs.${id}.label`),
    hint: t(`settings.tabs.${id}.hint`),
  }));

  const initialTab = (() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (TAB_IDS.includes(hash)) return hash;
    if (SECTION_TO_TAB[hash]) return SECTION_TO_TAB[hash];
    return 'general';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Tour-driven tab switching: ensure the right tab is mounted before the spotlight measures.
  useEffect(() => {
    const tab = TOUR_TO_TAB[currentStop?.tourId];
    if (tab && tab !== activeTab) setActiveTab(tab); // eslint-disable-line react-hooks/exhaustive-deps
  }, [currentStop, activeTab]);

  // Hash deep-linking: react to hash changes (e.g. browser back/forward).
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      const tab = TAB_IDS.includes(hash) ? hash : SECTION_TO_TAB[hash];
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
        <nav aria-label={t('settings.tabsAriaLabel')} className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
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
            eyebrow={t('settings.cloudSync.eyebrow')}
            title={t('settings.cloudSync.title')}
            description={t('settings.cloudSync.description')}
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
                  title: t('settings.cloudSync.switchTitle'),
                  description: supabaseUser
                    ? t('settings.cloudSync.switchDescriptionSignedIn')
                    : t('settings.cloudSync.switchDescriptionAnon'),
                  confirmLabel: t('settings.cloudSync.switchConfirm'),
                  confirmVariant: 'primary',
                });
                if (ok) await enableLocalOnlyMode();
              }}
              label={localOnlyMode ? t('settings.cloudSync.localOnly') : t('settings.cloudSync.enabled')}
              description={
                localOnlyMode
                  ? t('settings.cloudSync.offDescription')
                  : supabaseUser
                    ? t('settings.cloudSync.signedInAs', { email: supabaseUser.email })
                    : t('settings.cloudSync.signInPrompt')
              }
            />
          </Card>

          <Card
            id="modules"
            data-tour="settings-modules"
            eyebrow={t('settings.modules.eyebrow')}
            title={t('settings.modules.title')}
            description={t('settings.modules.description')}
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
                label={t('settings.modules.portfolio')}
                description={t('settings.modules.portfolioHint')}
              />
              <Toggle
                id="module-social"
                checked={settings.modules?.social !== false}
                onChange={(checked) =>
                  updateSettings({
                    modules: {
                      ...(settings.modules || {}),
                      social: checked,
                    },
                  })
                }
                label={t('settings.modules.social')}
                description={t('settings.modules.socialHint')}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-surface-raised p-4">
                <div>
                  <p className="text-sm font-medium text-ink">{t('settings.modules.onboarding')}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('settings.modules.onboardingHint')}
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
                  {t('settings.modules.restartOnboarding')}
                </Button>
              </div>
            </div>
          </Card>

        </>)}

        {activeTab === 'data' && (<>
          <Card
            id="categories"
            eyebrow={t('settings.categories.eyebrow')}
            title={t('settings.categories.title')}
            description={t('settings.categories.description')}
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
              <FormField label={editingCategory ? t('settings.categories.editLabel') : t('settings.categories.addLabel')} className="flex-1 min-w-[220px]">
                <Input
                  value={categoryInput}
                  placeholder={t('settings.categories.placeholder')}
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
                {editingCategory ? t('common.save') : t('common.add')}
              </Button>
              {editingCategory ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingCategory('');
                    setCategoryInput('');
                  }}
                >
                  {t('common.cancel')}
                </Button>
              ) : null}
            </div>
          </Card>

          <Card
            id="platforms"
            eyebrow={t('settings.platforms.eyebrow')}
            title={t('settings.platforms.title')}
            description={t('settings.platforms.description')}
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
              <FormField label={editingPlatform ? t('settings.platforms.editLabel') : t('settings.platforms.addLabel')} className="flex-1 min-w-[220px]">
                <Input
                  value={platformInput}
                  placeholder={t('settings.platforms.placeholder')}
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
                {editingPlatform ? t('common.save') : t('common.add')}
              </Button>
              {editingPlatform ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingPlatform('');
                    setPlatformInput('');
                  }}
                >
                  {t('common.cancel')}
                </Button>
              ) : null}
            </div>
          </Card>

          <Card
            id="targets"
            eyebrow={t('settings.targets.eyebrow')}
            title={t('settings.targets.title')}
            description={t('settings.targets.description')}
            className={rise(4)}
          >
            {settings.allocationTargets?.length ? (
              <Table columns={targetColumns} rows={settings.allocationTargets.map((tgt) => ({ ...tgt, id: tgt.ticker }))} density="compact" />
            ) : (
              <EmptyState title={t('settings.targets.empty')} description={t('settings.targets.emptyDescription')} />
            )}
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <FormField label={t('settings.targets.ticker')}>
                <Input
                  placeholder={t('settings.targets.tickerPlaceholder')}
                  value={targetInput.ticker}
                  onChange={(e) => setTargetInput((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                />
              </FormField>
              <FormField label={t('settings.targets.weight')}>
                <Input
                  type="number"
                  numeric
                  placeholder={t('settings.targets.weightPlaceholder')}
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
                        ...settings.allocationTargets.filter((tgt) => tgt.ticker !== targetInput.ticker),
                        { ticker: targetInput.ticker, targetWeight: Number(targetInput.targetWeight) },
                      ],
                    });
                    setTargetInput({ ticker: '', targetWeight: '' });
                  }}
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            id="import"
            eyebrow={t('settings.import.eyebrow')}
            title={t('settings.import.title')}
            description={t('settings.import.description')}
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
            eyebrow={t('settings.history.eyebrow')}
            title={t('settings.history.title')}
            description={t('settings.history.description')}
            className={rise(6)}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <FormField label={t('settings.history.moduleLabel')}>
                <Select
                  value={historyModule}
                  onChange={(event) => {
                    setHistoryModule(event.target.value);
                    setHistoryPage(1);
                  }}
                >
                  {historyModules.map((module) => (
                    <option key={module} value={module}>
                      {module === 'all' ? t('settings.history.allModules') : module}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t('settings.history.actionLabel')}>
                <Select
                  value={historyAction}
                  onChange={(event) => {
                    setHistoryAction(event.target.value);
                    setHistoryPage(1);
                  }}
                >
                  {historyActions.map((action) => (
                    <option key={action} value={action}>
                      {action === 'all' ? t('settings.history.allActions') : action}
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
                                <span className="shrink-0 text-xs text-ink-muted">{t('settings.history.undone')}</span>
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
                            {t('settings.history.undo')}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-ink-muted">
                    {t('settings.history.page', { page: safeHistoryPage, total: historyPageCount, count: filteredHistory.length })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={safeHistoryPage <= 1}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={safeHistoryPage >= historyPageCount}
                      onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title={t('settings.history.empty')} description={t('settings.history.emptyDescription')} />
            )}
          </Card>

          {localOnlyMode ? (
            <Card
              id="sync"
              eyebrow={t('settings.sync.eyebrow')}
              title={t('settings.sync.localOnlyTitle')}
              description={t('settings.sync.localOnlyDescription')}
              action={
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-faint" />
                  {t('settings.sync.offline')}
                </span>
              }
              className={rise(7)}
            >
              <p className="text-sm text-ink-muted leading-relaxed">
                {t('settings.sync.localOnlyExplain')}
              </p>
              <div className="mt-4">
                <Button
                  onClick={async () => {
                    await disableLocalOnlyMode();
                    navigate('/login');
                  }}
                >
                  {t('settings.sync.signInToEnable')}
                </Button>
              </div>
            </Card>
          ) : (
            <Card
              id="sync"
              eyebrow={t('settings.sync.eyebrow')}
              title={t('settings.sync.title')}
              description={t('settings.sync.description')}
              action={
                <span className={'inline-flex items-center gap-1.5 text-xs ' + (supabaseUser ? 'text-positive' : 'text-ink-faint')}>
                  <span aria-hidden className={'inline-block h-1.5 w-1.5 rounded-full ' + (supabaseUser ? 'bg-positive' : 'bg-ink-faint')} />
                  {supabaseUser ? t('settings.sync.signedInAs', { email: supabaseUser.email }) : t('settings.sync.notSignedIn')}
                </span>
              }
              className={rise(7)}
            >
              <div className="flex flex-wrap gap-2">
                <Button disabled={!supabaseUser} onClick={() => pushToSupabase()}>
                  {t('settings.sync.push')}
                </Button>
                <Button variant="secondary" disabled={!supabaseUser} onClick={() => pullFromSupabase()}>
                  {t('settings.sync.pull')}
                </Button>
                <Button variant="ghost" disabled={!supabaseUser} onClick={() => signOutSupabase()}>
                  {t('common.signOut')}
                </Button>
              </div>

              <dl className="mt-6 grid gap-2 rounded-md border border-rule bg-surface-sunken p-4 text-xs">
                <div className="flex gap-3">
                  <dt className="eyebrow w-20">{t('settings.sync.status')}</dt>
                  <dd className="text-ink">{supabaseSyncStatus}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="eyebrow w-20">{t('settings.sync.last')}</dt>
                  <dd className="text-ink numeric">
                    {supabaseLastSyncedAt
                      ? new Date(supabaseLastSyncedAt).toLocaleString(settings.locale)
                      : '—'}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="eyebrow w-20">{t('settings.sync.error')}</dt>
                  <dd className={supabaseError ? 'text-danger' : 'text-ink-muted'}>
                    {supabaseError || t('common.none')}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 pt-4 border-t border-rule">
                <button
                  type="button"
                  className="text-xs text-ink-faint hover:text-ink underline-offset-2 hover:underline transition-colors duration-180"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('settings.cloudSync.switchTitle'),
                      description: supabaseUser
                        ? t('settings.cloudSync.switchDescriptionSignedIn')
                        : t('settings.cloudSync.switchDescriptionAnon'),
                      confirmLabel: t('settings.cloudSync.switchConfirm'),
                      confirmVariant: 'primary',
                    });
                    if (ok) await enableLocalOnlyMode();
                  }}
                >
                  {t('settings.sync.switchToLocalOnly')}
                </button>
              </div>
            </Card>
          )}

          {!localOnlyMode && (
          <Card
            id="conflicts"
            eyebrow={t('settings.conflicts.eyebrow')}
            title={t('settings.conflicts.title')}
            description={t('settings.conflicts.description')}
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
                          {t('settings.conflicts.remoteUpdated', { when: new Date(conflict.remoteUpdatedAt).toLocaleString(settings.locale) })}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-sm bg-danger-soft px-2 py-0.5 text-xs text-danger border border-danger/30">
                        {t('settings.conflicts.badge')}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md bg-surface-sunken p-3">
                        <p className="eyebrow mb-2">{t('settings.conflicts.local')}</p>
                        <pre className="overflow-auto whitespace-pre-wrap text-xs text-ink-muted font-mono">
                          {JSON.stringify(conflict.localTombstone || conflict.localRecord, null, 2)}
                        </pre>
                      </div>
                      <div className="rounded-md bg-surface-sunken p-3">
                        <p className="eyebrow mb-2">{t('settings.conflicts.remote')}</p>
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
                      <Button onClick={() => resolveConflictKeepLocal(conflict.id)}>{t('settings.conflicts.keepLocal')}</Button>
                      <Button variant="secondary" onClick={() => resolveConflictUseRemote(conflict.id)}>
                        {t('settings.conflicts.useRemote')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{t('settings.conflicts.none')}</p>
            )}
          </Card>
          )}

        </>)}

        {activeTab === 'backup' && (<>
          <Card
            id="backup"
            data-tour="settings-backup"
            eyebrow={t('settings.backup.eyebrow')}
            title={t('settings.backup.title')}
            description={t('settings.backup.description')}
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
                { labelKey: 'settings.backup.modules.expenses',  stores: ['expenses', 'fixedExpenses', 'budgets', 'rollovers'],                    file: 'expenses-backup.json' },
                { labelKey: 'settings.backup.modules.income',    stores: ['incomes'],                                                               file: 'income-backup.json' },
                { labelKey: 'settings.backup.modules.accounts',  stores: ['bankAccounts'],                                                          file: 'accounts-backup.json' },
                { labelKey: 'settings.backup.modules.portfolio', stores: ['investmentPortfolios', 'holdings', 'dividends', 'portfolioCashflows', 'portfolioSales', 'portfolioSnapshots'], file: 'portfolio-backup.json' },
                { labelKey: 'settings.backup.modules.savings',   stores: ['savings', 'savingsEntries', 'savingsGoals'],                             file: 'savings-backup.json' },
              ];
              return (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="eyebrow mb-2">{t('settings.backup.full')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => doExport(null, 'finance-tracker-backup.json')}>{t('settings.backup.exportAll')}</Button>
                      <label className="inline-flex">
                        <Button as="span" variant="primary">{t('settings.backup.import')}</Button>
                        <input type="file" accept="application/json" className="hidden" onChange={doImport} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow mb-3">{t('settings.backup.byModule')}</p>
                    <div className="flex flex-col divide-y divide-rule rounded-md border border-rule">
                      {modules.map(({ labelKey, stores, file }) => (
                        <div key={labelKey} className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <span className="text-sm text-ink">{t(labelKey)}</span>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => doExport(stores, file)}>{t('settings.backup.export')}</Button>
                            <label className="inline-flex">
                              <Button as="span" variant="ghost" size="sm">{t('settings.backup.import')}</Button>
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
            eyebrow={t('settings.danger.eyebrow')}
            title={t('settings.danger.title')}
            description={t('settings.danger.description')}
            className={rise(9)}
          >
            <Button variant="danger" size="sm" onClick={() => { setWipeModalOpen(true); setWipeConfirmText(''); setWipeResetAccount(false); }}>
              {t('settings.danger.eraseButton')}
            </Button>
          </Card>
        </>)}
      </div>

      <Modal
        open={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        eyebrow={t('settings.history.activity')}
        title={t('settings.history.confirmTitle')}
        description={undoTarget?.summary || ''}
        size="sm"
      >
        <div className="grid gap-4">
          <div className="rounded-md border border-rule bg-surface-sunken p-4">
            <p className="eyebrow mb-2">{t('settings.history.whatHappens')}</p>
            <ul className="grid gap-2 text-sm text-ink-muted">
              <li className="text-ink">{undoMoneyMovement}</li>
              {(undoPreview.length ? undoPreview : [t('settings.history.cannotUndo')]).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setUndoTarget(null)}>
              {t('common.cancel')}
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
              {t('settings.history.confirmUndo')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={wipeModalOpen}
        onClose={() => { setWipeModalOpen(false); setWipeConfirmText(''); setWipeResetAccount(false); }}
        eyebrow={t('settings.danger.eyebrow')}
        title={t('settings.danger.eraseButton')}
        description={t('settings.danger.modalDescription')}
        size="sm"
      >
        <div className="grid gap-4">
          <p className="text-sm text-ink-muted">
            {(() => {
              const phrase = t('settings.danger.confirmPhrase');
              const parts = t('settings.danger.typeToConfirm', { phrase: '\x00' }).split('\x00');
              return <>{parts[0]}<span className="font-mono font-medium text-danger select-all">{phrase}</span>{parts[1]}</>;
            })()}
          </p>
          <div className="rounded-md border border-rule bg-surface-raised p-3">
            <Checkbox
              id="wipe-reset-account"
              checked={wipeResetAccount}
              onChange={setWipeResetAccount}
              label={t('settings.danger.resetSetup')}
            />
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t('settings.danger.resetSetupHint')}
            </p>
          </div>
          <Input
            autoFocus
            placeholder={t('settings.danger.confirmPhrase')}
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setWipeModalOpen(false); setWipeConfirmText(''); setWipeResetAccount(false); }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={wipeConfirmText !== t('settings.danger.confirmPhrase') || wiping}
              loading={wiping}
              onClick={handleWipe}
            >
              {t('settings.danger.eraseButton')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

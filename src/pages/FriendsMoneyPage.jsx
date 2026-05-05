import { useEffect, useState } from 'react';
import { Check, HandCoins, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, FormField, Input, Modal, SectionDivider, Skeleton } from '../components/ui';
import { useConfirm } from '../components/ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from '../i18n/useTranslation';

function Avatar({ profile, size = 32 }) {
  const initials = (profile?.display_name || profile?.username || '?')
    .replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '').join('');
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        className="rounded-full border border-rule object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-rule bg-surface-raised text-ink font-display"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials || '·'}
    </div>
  );
}

function displayName(profile) {
  return profile?.display_name || profile?.username || '?';
}

function LedgerRow({ entry, currentUserId, onSettle, onCancel }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const iAmCreditor = entry.creditor_id === currentUserId;
  const counterpart = iAmCreditor ? entry.debtor : entry.creditor;
  const isPending = entry.status === 'pending';
  const isCreator = entry.created_by === currentUserId;

  const date = new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  async function handleSettle() {
    setBusy(true);
    try { await onSettle(entry.id); } finally { setBusy(false); }
  }

  async function handleCancel() {
    setBusy(true);
    try { await onCancel(entry.id); } finally { setBusy(false); }
  }

  return (
    <li className="flex items-start gap-3 py-3 border-b border-rule last:border-0">
      <Avatar profile={counterpart} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink font-medium truncate">{displayName(counterpart)}</p>
        {entry.note && <p className="text-xs text-ink-muted truncate">{entry.note}</p>}
        <p className="text-xs text-ink-muted">{date}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={`text-sm font-semibold tabular-nums ${iAmCreditor ? 'text-success' : 'text-danger'}`}>
          {iAmCreditor ? '+' : '-'}{formatCurrency(entry.amount_cents, entry.currency)}
        </span>
        {isPending && (
          <div className="flex gap-1.5">
            <Button size="xs" variant="ghost" onClick={handleSettle} disabled={busy} title={t('friendsMoney.settle')}>
              <Check size={13} />
            </Button>
            {isCreator && (
              <Button size="xs" variant="ghost" onClick={handleCancel} disabled={busy} title={t('friendsMoney.cancel')}>
                <X size={13} />
              </Button>
            )}
          </div>
        )}
        {!isPending && (
          <span className="text-xs text-ink-muted capitalize">{t(`friendsMoney.status.${entry.status}`)}</span>
        )}
      </div>
    </li>
  );
}

function CreateIOUModal({ open, onClose }) {
  const { t } = useTranslation();
  const friends = useFinanceStore((s) => s.friends);
  const createManualIOU = useFinanceStore((s) => s.createManualIOU);
  const settings = useFinanceStore((s) => s.settings);
  const currency = settings.currency || 'EUR';

  const [friendId, setFriendId] = useState('');
  const [amount, setAmount] = useState('');
  const [iOweTheme, setIOweTheme] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setFriendId('');
    setAmount('');
    setIOweTheme(false);
    setNote('');
    setError('');
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const cents = Math.round(parseFloat(amount) * 100);
    if (!friendId) { setError(t('friendsMoney.form.errorFriend')); return; }
    if (!cents || cents <= 0) { setError(t('friendsMoney.form.errorAmount')); return; }
    setBusy(true);
    try {
      await createManualIOU({ friendId, amountCents: cents, currency, note: note.trim(), iOweTheme });
      handleClose();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('friendsMoney.createIOU')} size="sm">
      <form onSubmit={handleSubmit} className="grid gap-4 pt-1">
        <FormField label={t('friendsMoney.form.friend')}>
          <select
            className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
          >
            <option value="">{t('friendsMoney.form.selectFriend')}</option>
            {friends.map((f) => (
              <option key={f.otherId} value={f.otherId}>
                {f.profile?.display_name || f.profile?.username || f.otherId}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label={t('friendsMoney.form.direction')}>
          <div className="flex rounded-md border border-rule overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setIOweTheme(false)}
              className={`flex-1 py-2 px-3 transition-colors ${!iOweTheme ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-muted hover:bg-surface-raised'}`}
            >
              {t('friendsMoney.form.theyOweMe')}
            </button>
            <button
              type="button"
              onClick={() => setIOweTheme(true)}
              className={`flex-1 py-2 px-3 transition-colors ${iOweTheme ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-muted hover:bg-surface-raised'}`}
            >
              {t('friendsMoney.form.iOweThem')}
            </button>
          </div>
        </FormField>

        <FormField label={t('friendsMoney.form.amount')}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>

        <FormField label={t('friendsMoney.form.note')}>
          <Input
            type="text"
            placeholder={t('friendsMoney.form.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </FormField>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t('common.loading') : t('friendsMoney.form.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const TABS = ['oweYou', 'youOwe', 'history'];

export default function FriendsMoneyPage() {
  const { t } = useTranslation();
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const friendLedger = useFinanceStore((s) => s.friendLedger);
  const loadFriendLedger = useFinanceStore((s) => s.loadFriendLedger);
  const settleLedgerEntry = useFinanceStore((s) => s.settleLedgerEntry);
  const cancelLedgerEntry = useFinanceStore((s) => s.cancelLedgerEntry);

  const [tab, setTab] = useState('oweYou');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriendLedger().finally(() => setLoading(false));
  }, [loadFriendLedger]);

  const uid = supabaseUser?.id;

  const oweYouEntries = friendLedger.filter((e) => e.creditor_id === uid && e.status === 'pending');
  const youOweEntries = friendLedger.filter((e) => e.debtor_id === uid && e.status === 'pending');
  const historyEntries = friendLedger.filter((e) => e.status !== 'pending');

  const tabEntries = { oweYou: oweYouEntries, youOwe: youOweEntries, history: historyEntries };
  const entries = tabEntries[tab] || [];

  const oweYouTotal = oweYouEntries.reduce((s, e) => s + e.amount_cents, 0);
  const youOweTotal = youOweEntries.reduce((s, e) => s + e.amount_cents, 0);
  const currency = friendLedger[0]?.currency || useFinanceStore.getState().settings.currency || 'EUR';

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.social')}
        title={t('friendsMoney.title')}
        description={t('friendsMoney.description')}
        actions={
          supabaseUser && (
            <Button onClick={() => setModalOpen(true)}>
              <HandCoins size={15} className="mr-1.5" />
              {t('friendsMoney.createIOU')}
            </Button>
          )
        }
      />

      {supabaseUser && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-xs text-ink-muted mb-1">{t('friendsMoney.oweYouLabel')}</p>
            <p className="text-xl font-semibold text-success tabular-nums">
              {formatCurrency(oweYouTotal, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-ink-muted mb-1">{t('friendsMoney.youOweLabel')}</p>
            <p className="text-xl font-semibold text-danger tabular-nums">
              {formatCurrency(youOweTotal, currency)}
            </p>
          </Card>
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-rule">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t(`friendsMoney.tabs.${key}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title={t('friendsMoney.emptyTitle')}
          description={t(`friendsMoney.emptyDesc.${tab}`)}
        />
      ) : (
        <Card className="px-4">
          <ul className="divide-y divide-rule">
            {entries.map((entry) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                currentUserId={uid}
                onSettle={settleLedgerEntry}
                onCancel={cancelLedgerEntry}
              />
            ))}
          </ul>
        </Card>
      )}

      <CreateIOUModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

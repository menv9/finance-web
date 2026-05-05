import { useEffect, useState } from 'react';
import {
  BadgeCheck, Car, Cpu, GraduationCap, Handshake, Heart, Home,
  Music, Palmtree, Pencil, Plane, Plus, ShoppingBag, Trash2, Trophy, X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, FormField, Input, Modal, SectionDivider, Skeleton, Textarea } from '../components/ui';
import { useAlert, useConfirm } from '../components/ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from '../i18n/useTranslation';

const GOAL_ICONS = [
  { key: 'plane',    Icon: Plane },
  { key: 'home',     Icon: Home },
  { key: 'car',      Icon: Car },
  { key: 'trophy',   Icon: Trophy },
  { key: 'heart',    Icon: Heart },
  { key: 'palmtree', Icon: Palmtree },
  { key: 'shopping', Icon: ShoppingBag },
  { key: 'music',    Icon: Music },
  { key: 'edu',      Icon: GraduationCap },
  { key: 'tech',     Icon: Cpu },
];

function GoalIconPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {GOAL_ICONS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-colors ${
            value === key
              ? 'border-accent bg-accent text-accent-ink shadow-sm'
              : 'border-rule bg-surface-raised text-ink-muted hover:border-accent/50 hover:text-ink'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

function GoalIcon({ iconKey, size = 16 }) {
  const found = GOAL_ICONS.find((g) => g.key === iconKey);
  if (!found) return null;
  const { Icon } = found;
  return <Icon size={size} />;
}

function Avatar({ profile, size = 28 }) {
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

function ProgressBar({ valueCents, targetCents }) {
  const pct = Math.min(100, Math.round((valueCents / targetCents) * 100));
  return (
    <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
      <div
        className="h-full rounded-full bg-accent transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Create / Edit goal modal ──────────────────────────────────────────────────

function GoalFormModal({ open, onClose, goal, friends, currency, onSave }) {
  const { t } = useTranslation();
  const alert = useAlert();
  const isEdit = !!goal;

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [desc, setDesc] = useState('');
  const [emoji, setEmoji] = useState(GOAL_ICONS[0].key);
  const [inviteIds, setInviteIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(goal?.name || '');
      setTarget(goal ? String(goal.target_cents / 100) : '');
      setDesc(goal?.description || '');
      setEmoji(goal?.emoji || GOAL_ICONS[0].key);
      setInviteIds(
        isEdit
          ? (goal.shared_goal_participants || [])
              .map((p) => p.user_id)
              .filter((id) => id !== goal.creator_id)
          : []
      );
    }
  }, [open, goal, isEdit]);

  const toggleFriend = (id) =>
    setInviteIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = async () => {
    const targetCents = Math.round(parseFloat(target || '0') * 100);
    if (!name.trim()) return alert({ title: 'Name required', description: 'Please enter a goal name.' });
    if (targetCents <= 0) return alert({ title: 'Invalid target', description: 'Target must be greater than zero.' });
    setSaving(true);
    try {
      await onSave({ name: name.trim(), targetCents, currency, description: desc.trim() || null, emoji: emoji.trim() || null, inviteIds });
      onClose();
    } catch (err) {
      await alert({ title: 'Error', description: err.message || 'Could not save goal.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t('sharedGoals.editGoal') : t('sharedGoals.newGoal')} size="sm">
      <div className="space-y-4">
        <FormField label={t('sharedGoals.goalName')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('sharedGoals.goalNamePlaceholder')} maxLength={100} />
        </FormField>
        <FormField label={t('sharedGoals.icon')}>
          <GoalIconPicker value={emoji} onChange={setEmoji} />
        </FormField>
        <FormField label={t('sharedGoals.target')}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.00"
          />
        </FormField>
        <FormField label={t('sharedGoals.description')}>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder={t('sharedGoals.descriptionPlaceholder')} maxLength={200} />
        </FormField>
        {!isEdit && friends.length > 0 && (
          <>
            <SectionDivider />
            <p className="text-xs eyebrow text-ink-muted">{t('sharedGoals.inviteFriends')}</p>
            <div className="space-y-2">
              {friends.map((f) => (
                <label key={f.otherId} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteIds.includes(f.otherId)}
                    onChange={() => toggleFriend(f.otherId)}
                    className="accent-accent"
                  />
                  <Avatar profile={f.profile} />
                  <span className="text-sm text-ink">{f.profile?.display_name || f.profile?.username}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add contribution modal ────────────────────────────────────────────────────

function ContributionModal({ open, onClose, goal, currency, onAdd }) {
  const { t } = useTranslation();
  const alert = useAlert();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setAmount(''); setNote(''); } }, [open]);

  const handleAdd = async () => {
    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (amountCents <= 0) return alert({ title: 'Invalid amount', description: 'Enter an amount greater than zero.' });
    setSaving(true);
    try {
      await onAdd(goal.id, amountCents, note.trim());
      onClose();
    } catch (err) {
      await alert({ title: 'Error', description: err.message || 'Could not add contribution.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('sharedGoals.addContribution')} size="xs">
      <div className="space-y-4">
        <FormField label={t('sharedGoals.amount')}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </FormField>
        <FormField label={t('sharedGoals.note')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sharedGoals.notePlaceholder')} maxLength={100} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleAdd} disabled={saving}>{t('common.add')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Goal detail expanded view ─────────────────────────────────────────────────

function GoalDetail({ goal, currentUserId, friends, currency, onContribute, onDeleteContrib, onAddParticipant, onRemoveParticipant }) {
  const { t } = useTranslation();
  const contributions = goal.shared_goal_contributions || [];
  const participants = goal.shared_goal_participants || [];
  const totalCents = contributions.reduce((s, c) => s + c.amount_cents, 0);

  const getProfile = (uid) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.profiles || null;
  };

  const nonParticipantFriends = friends.filter(
    (f) => !participants.some((p) => p.user_id === f.otherId)
  );

  return (
    <div className="mt-4 space-y-4">
      <SectionDivider />

      {/* Participants */}
      <div>
        <p className="text-xs eyebrow text-ink-muted mb-2">{t('sharedGoals.participants')}</p>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <div key={p.user_id} className="flex items-center gap-1.5 rounded-full border border-rule bg-surface-raised px-2.5 py-1 text-xs text-ink">
              <Avatar profile={p.profiles} size={18} />
              {p.profiles?.display_name || p.profiles?.username || '…'}
              {goal.creator_id === currentUserId && p.user_id !== currentUserId && (
                <button
                  onClick={() => onRemoveParticipant(goal.id, p.user_id)}
                  className="ml-1 flex items-center text-ink-faint hover:text-danger"
                ><X size={12} /></button>
              )}
            </div>
          ))}
          {goal.creator_id === currentUserId && nonParticipantFriends.map((f) => (
            <button
              key={f.otherId}
              onClick={() => onAddParticipant(goal.id, f.otherId)}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-rule bg-surface px-2.5 py-1 text-xs text-ink-muted hover:border-accent/40 hover:text-ink transition-colors"
            >
              <Avatar profile={f.profile} size={18} />
              <Plus size={10} />
              {f.profile?.display_name || f.profile?.username}
            </button>
          ))}
        </div>
      </div>

      {/* Contributions */}
      <div>
        <p className="text-xs eyebrow text-ink-muted mb-2">{t('sharedGoals.contributions')}</p>
        {contributions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('sharedGoals.noContributions')}</p>
        ) : (
          <div className="space-y-1.5">
            {contributions.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar profile={getProfile(c.user_id)} size={20} />
                  <span className="text-sm text-ink truncate">
                    {getProfile(c.user_id)?.display_name || getProfile(c.user_id)?.username || '…'}
                  </span>
                  {c.note && <span className="text-xs text-ink-muted truncate">· {c.note}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm numeric text-ink">+{formatCurrency(c.amount_cents / 100, goal.currency || currency)}</span>
                  {c.user_id === currentUserId && (
                    <button
                      onClick={() => onDeleteContrib(goal.id, c.id)}
                      className="hidden group-hover:flex items-center text-ink-faint hover:text-danger"
                    ><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-between items-center text-sm font-medium text-ink border-t border-rule pt-2">
          <span>{t('sharedGoals.total')}</span>
          <span className="numeric">{formatCurrency(totalCents / 100, goal.currency || currency)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onContribute}><Plus size={12} /> {t('sharedGoals.addContribution')}</Button>
      </div>
    </div>
  );
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, currentUserId, friends, currency, onEdit, onDelete, onContribute, onDeleteContrib, onAddParticipant, onRemoveParticipant }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const contributions = goal.shared_goal_contributions || [];
  const totalCents = contributions.reduce((s, c) => s + c.amount_cents, 0);
  const pct = Math.min(100, Math.round((totalCents / goal.target_cents) * 100));
  const isComplete = !!goal.completed_at;
  const isCreator = goal.creator_id === currentUserId;
  const participants = goal.shared_goal_participants || [];

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {goal.emoji && <span className="text-ink-muted shrink-0"><GoalIcon iconKey={goal.emoji} size={18} /></span>}
            <div className="min-w-0">
              <p className="font-medium text-ink truncate">
                {goal.name}
                {isComplete && <span className="ml-2 inline-flex items-center gap-1 text-xs text-positive"><BadgeCheck size={13} />{t('sharedGoals.completed')}</span>}
              </p>
              {goal.description && <p className="text-xs text-ink-muted truncate">{goal.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex -space-x-1">
              {participants.slice(0, 3).map((p) => (
                <Avatar key={p.user_id} profile={p.profiles} size={22} />
              ))}
              {participants.length > 3 && (
                <span className="text-xs text-ink-muted ml-1">+{participants.length - 3}</span>
              )}
            </div>
            {isCreator && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onEdit(goal)} aria-label="Edit goal"><Pencil size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(goal.id)} className="text-danger hover:text-danger" aria-label="Delete goal"><Trash2 size={14} /></Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          <ProgressBar valueCents={totalCents} targetCents={goal.target_cents} />
          <div className="flex justify-between text-xs text-ink-muted">
            <span className="numeric">{formatCurrency(totalCents / 100, goal.currency || currency)}</span>
            <span className="numeric">{pct}% · {formatCurrency(goal.target_cents / 100, goal.currency || currency)}</span>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-ink-muted hover:text-ink transition-colors"
        >
          {expanded ? t('sharedGoals.hideDetails') : t('sharedGoals.showDetails')}
        </button>

        {expanded && (
          <GoalDetail
            goal={goal}
            currentUserId={currentUserId}
            friends={friends}
            currency={currency}
            onContribute={() => setContributeOpen(true)}
            onDeleteContrib={onDeleteContrib}
            onAddParticipant={onAddParticipant}
            onRemoveParticipant={onRemoveParticipant}
          />
        )}

        {!expanded && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={() => setContributeOpen(true)}>
              <Plus size={12} /> {t('sharedGoals.addContribution')}
            </Button>
          </div>
        )}
      </Card>

      <ContributionModal
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
        goal={goal}
        currency={currency}
        onAdd={onContribute}
      />
    </>
  );
}

// ── Goal invitation card ──────────────────────────────────────────────────────

export function GoalInvitationCard({ goal, onAccept, onDecline }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const creatorProfile = (goal.shared_goal_participants || [])
    .find((p) => p.user_id === goal.creator_id)?.profiles || null;
  const creatorName = creatorProfile?.display_name || creatorProfile?.username || '…';

  const handle = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="eyebrow text-accent mb-0.5">{t('sharedGoals.invitationEyebrow')}</p>
        <p className="text-sm font-medium text-ink truncate">
          {goal.emoji && <span className="mr-1.5"><GoalIcon iconKey={goal.emoji} size={14} /></span>}
          {goal.name}
        </p>
        <p className="text-xs text-ink-muted mt-0.5">
          {t('sharedGoals.invitationDesc').replace('{name}', creatorName)}
        </p>
        {goal.description && (
          <p className="text-xs text-ink-faint mt-1 truncate">{goal.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <Button size="sm" onClick={() => handle(onAccept)} disabled={busy}>
          {t('sharedGoals.invitationAccept')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handle(onDecline)} disabled={busy}>
          {t('sharedGoals.invitationDecline')}
        </Button>
      </div>
    </div>
  );
}

// ── Shared goals body — usable as a standalone section ───────────────────────

export function SharedGoalsSection({
  formOpen: formOpenProp,
  setFormOpen: setFormOpenProp,
  editingGoal: editingGoalProp,
  setEditingGoal: setEditingGoalProp,
  hideNewButton = false,
} = {}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const friends = useFinanceStore((s) => s.friends);
  const sharedGoals = useFinanceStore((s) => s.sharedGoals);
  const goalInvitations = useFinanceStore((s) => s.goalInvitations);
  const socialStatus = useFinanceStore((s) => s.socialStatus);
  const settings = useFinanceStore((s) => s.settings);
  const currency = settings?.defaultCurrency || 'EUR';

  const loadSharedGoals = useFinanceStore((s) => s.loadSharedGoals);
  const acceptGoalInvitation = useFinanceStore((s) => s.acceptGoalInvitation);
  const declineGoalInvitation = useFinanceStore((s) => s.declineGoalInvitation);
  const createSharedGoal = useFinanceStore((s) => s.createSharedGoal);
  const updateSharedGoal = useFinanceStore((s) => s.updateSharedGoal);
  const deleteSharedGoal = useFinanceStore((s) => s.deleteSharedGoal);
  const addContribution = useFinanceStore((s) => s.addContribution);
  const deleteContribution = useFinanceStore((s) => s.deleteContribution);
  const addGoalParticipant = useFinanceStore((s) => s.addGoalParticipant);
  const removeGoalParticipant = useFinanceStore((s) => s.removeGoalParticipant);

  const [formOpenLocal, setFormOpenLocal] = useState(false);
  const [editingGoalLocal, setEditingGoalLocal] = useState(null);

  const controlled = formOpenProp !== undefined;
  const formOpen = controlled ? formOpenProp : formOpenLocal;
  const setFormOpen = controlled ? setFormOpenProp : setFormOpenLocal;
  const editingGoal = controlled ? editingGoalProp : editingGoalLocal;
  const setEditingGoal = controlled ? setEditingGoalProp : setEditingGoalLocal;

  useEffect(() => { loadSharedGoals(); }, [loadSharedGoals]);

  const handleSave = async (data) => {
    if (editingGoal) {
      await updateSharedGoal(editingGoal.id, data);
    } else {
      await createSharedGoal(data);
    }
  };

  const handleDelete = async (goalId) => {
    const ok = await confirm({ title: t('sharedGoals.confirmDelete'), description: t('sharedGoals.confirmDeleteDesc') });
    if (!ok) return;
    await deleteSharedGoal(goalId);
  };

  const handleEdit = (goal) => { setEditingGoal(goal); setFormOpen(true); };
  const handleCloseForm = () => { setFormOpen(false); setEditingGoal(null); };

  const socialError = useFinanceStore((s) => s.socialError);
  const loading = socialStatus === 'loading' && sharedGoals.length === 0;
  const active = sharedGoals.filter((g) => !g.completed_at);
  const completed = sharedGoals.filter((g) => !!g.completed_at);

  return (
    <div className="space-y-4">
      {!hideNewButton && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setEditingGoal(null); setFormOpen(true); }}>
            <Plus size={12} /> {t('sharedGoals.newGoal')}
          </Button>
        </div>
      )}

      {goalInvitations.length > 0 && (
        <div className="space-y-2">
          {goalInvitations.map((goal) => (
            <GoalInvitationCard
              key={goal.id}
              goal={goal}
              onAccept={() => acceptGoalInvitation(goal.id)}
              onDecline={() => declineGoalInvitation(goal.id)}
            />
          ))}
        </div>
      )}

      {socialStatus === 'error' && socialError && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {socialError}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : sharedGoals.length === 0 ? (
        <EmptyState
          icon={<Handshake size={32} />}
          title={t('sharedGoals.emptyTitle')}
          description={t('sharedGoals.emptyDescription')}
          action={<Button onClick={() => setFormOpen(true)}>{t('sharedGoals.newGoal')}</Button>}
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  currentUserId={supabaseUser?.id}
                  friends={friends}
                  currency={currency}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onContribute={addContribution}
                  onDeleteContrib={deleteContribution}
                  onAddParticipant={addGoalParticipant}
                  onRemoveParticipant={removeGoalParticipant}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <>
              <SectionDivider label={t('sharedGoals.completedGoals')} />
              <div className="space-y-3 opacity-70">
                {completed.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currentUserId={supabaseUser?.id}
                    friends={friends}
                    currency={currency}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onContribute={addContribution}
                    onDeleteContrib={deleteContribution}
                    onAddParticipant={addGoalParticipant}
                    onRemoveParticipant={removeGoalParticipant}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <GoalFormModal
        open={formOpen}
        onClose={handleCloseForm}
        goal={editingGoal}
        friends={friends}
        currency={currency}
        onSave={handleSave}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SharedGoalsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('sharedGoals.title')}
        description={t('sharedGoals.description')}
      />
      <div data-tour="shared-goals-list"><SharedGoalsSection /></div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flag,
  Flame,
  Hand,
  Heart,
  MessageCircle,
  PartyPopper,
  Pin,
  Plus,
  Radio,
  Settings2,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, Checkbox, EmptyState, FormField, Modal, SectionDivider, Skeleton } from '../components/ui';
import { useFinanceStore } from '../store/useFinanceStore';
import { ACTIVITY_TYPES } from '../utils/socialApi';
import { useTranslation } from '../i18n/useTranslation';
import { GoalInvitationCard } from './SharedGoalsPage';
import { formatCurrency } from '../utils/formatters';

const QUICK_REACTIONS = [
  { key: 'party',    Icon: PartyPopper, label: 'Celebrate' },
  { key: 'flame',    Icon: Flame,       label: 'Fire' },
  { key: 'heart',    Icon: Heart,       label: 'Love' },
  { key: 'thumbsup', Icon: ThumbsUp,    label: 'Nice' },
  { key: 'clap',     Icon: Hand,        label: 'Clap' },
];

const REACTION_ICON = Object.fromEntries(QUICK_REACTIONS.map((r) => [r.key, r.Icon]));

const ACTIVITY_META = {
  goal_reached:        { Icon: Trophy,       color: 'text-positive' },
  debt_paid:           { Icon: CheckCircle2, color: 'text-positive' },
  savings_milestone:   { Icon: TrendingUp,   color: 'text-accent'   },
  goal_created:        { Icon: Flag,         color: 'text-ink-muted' },
  shared_goal_created: { Icon: Users,        color: 'text-accent'   },
  shared_goal_reached: { Icon: Award,        color: 'text-positive' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ profile, size = 36 }) {
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

function ReactionBar({ activity, currentUserId, onAdd, onRemove }) {
  const reactions = activity.activity_reactions || [];
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.user_id);
    return acc;
  }, {});
  const myReaction = reactions.find((r) => r.user_id === currentUserId);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {Object.entries(grouped).map(([key, users]) => {
        const ReactionIcon = REACTION_ICON[key];
        const ismine = myReaction?.emoji === key;
        return (
          <button
            key={key}
            onClick={() => ismine ? onRemove(activity.id) : onAdd(activity.id, key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              ismine
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-rule bg-surface-raised text-ink-muted hover:border-accent/40'
            }`}
          >
            {ReactionIcon ? <ReactionIcon size={12} /> : null}
            <span className="numeric">{users.length}</span>
          </button>
        );
      })}
      <div className="relative group">
        <button className="inline-flex items-center justify-center rounded-full border border-rule bg-surface-raised text-ink-muted hover:border-accent/40 w-6 h-6 transition-colors">
          <Plus size={12} />
        </button>
        <div className="absolute bottom-full left-0 hidden group-hover:flex gap-1 bg-surface border border-rule rounded-lg shadow-lg p-1.5 z-10">
          {QUICK_REACTIONS.map(({ key, Icon: RIcon, label }) => (
            <button
              key={key}
              onClick={() => myReaction?.emoji === key ? onRemove(activity.id) : onAdd(activity.id, key)}
              title={label}
              className="flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
            >
              <RIcon size={16} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentThread({ activity, currentUserId, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const comments = activity.activity_comments || [];
  const count = comments.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(activity.id, text.trim());
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
      >
        <MessageCircle size={12} />
        {count > 0 ? `${count} comment${count !== 1 ? 's' : ''}` : 'Comment'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 group">
              <Avatar profile={c.profiles} size={24} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-ink">
                  {c.profiles?.display_name || c.profiles?.username || 'Unknown'}
                </span>
                <span className="text-xs text-ink-muted ml-1.5">{c.body}</span>
              </div>
              {c.user_id === currentUserId && (
                <button
                  onClick={() => onDelete(activity.id, c.id)}
                  className="hidden group-hover:flex items-center justify-center text-ink-faint hover:text-danger shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <form onSubmit={handleSubmit} className="flex gap-2 mt-1">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Write a comment…"
              className="flex-1 text-xs bg-surface-sunken border border-rule rounded-lg px-3 py-1.5 text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button size="sm" type="submit" disabled={!text.trim() || submitting}>
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity, currentUserId, friends, profile, onReact, onUnreact, onComment, onDeleteComment, onDelete }) {
  const meta = ACTIVITY_META[activity.type] || { Icon: Pin, color: 'text-ink-muted' };
  const ActivityIcon = meta.Icon;
  const isOwn = activity.user_id === currentUserId;
  const friendProfile = isOwn ? profile : friends.find((f) => f.otherId === activity.user_id)?.profile;
  const { t } = useTranslation();

  const label = (() => {
    const name = isOwn ? t('activity.you') : (friendProfile?.display_name || friendProfile?.username || t('activity.friend'));
    const p = activity.payload || {};
    switch (activity.type) {
      case 'goal_reached':        return `${name} reached the savings goal "${p.goalName || ''}"`;
      case 'debt_paid':           return `${name} paid off "${p.debtName || 'a debt'}"`;
      case 'savings_milestone':   return `${name} hit a savings milestone${p.amountCents ? ` of ${formatCurrency(p.amountCents / 100, p.currency || 'EUR')}` : ''}`;
      case 'goal_created':        return `${name} created a savings goal "${p.goalName || ''}"`;
      case 'shared_goal_created': return `${name} started a shared goal "${p.goalName || ''}"`;
      case 'shared_goal_reached': return `${name} and friends reached the shared goal "${p.goalName || ''}"`;
      default:                    return `${name} did something`;
    }
  })();

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar profile={isOwn ? profile : friendProfile} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-ink leading-snug flex items-center gap-1.5">
              <span className={`shrink-0 ${meta.color}`}><ActivityIcon size={14} /></span>
              {label}
            </p>
            <span className="text-xs text-ink-faint shrink-0">{timeAgo(activity.created_at)}</span>
          </div>
          <ReactionBar activity={activity} currentUserId={currentUserId} onAdd={onReact} onRemove={onUnreact} />
          <CommentThread activity={activity} currentUserId={currentUserId} onAdd={onComment} onDelete={onDeleteComment} />
        </div>
        {isOwn && (
          <button
            onClick={() => onDelete(activity.id)}
            className="flex items-center justify-center text-ink-faint hover:text-danger transition-colors shrink-0 mt-0.5"
            aria-label="Delete"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </Card>
  );
}

function PrivacyModal({ open, onClose, privacy, onSave }) {
  const { t } = useTranslation();
  const [feedEnabled, setFeedEnabled] = useState(privacy?.feed_enabled ?? true);
  const [visibleTypes, setVisibleTypes] = useState(privacy?.visible_types ?? ACTIVITY_TYPES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFeedEnabled(privacy?.feed_enabled ?? true);
      setVisibleTypes(privacy?.visible_types ?? ACTIVITY_TYPES);
    }
  }, [open, privacy]);

  const toggle = (type) => setVisibleTypes((prev) =>
    prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
  );

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ feed_enabled: feedEnabled, visible_types: visibleTypes }); onClose(); }
    finally { setSaving(false); }
  };

  const TYPE_LABELS = {
    goal_reached:        'Savings goal reached',
    debt_paid:           'Debt paid off',
    savings_milestone:   'Savings milestone',
    goal_created:        'New savings goal',
    shared_goal_created: 'New shared goal',
    shared_goal_reached: 'Shared goal reached',
  };

  return (
    <Modal open={open} onClose={onClose} title={t('activity.privacyTitle')} size="sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">{t('activity.feedEnabled')}</p>
            <p className="text-xs text-ink-muted">{t('activity.feedEnabledHint')}</p>
          </div>
          <Checkbox checked={feedEnabled} onChange={(e) => setFeedEnabled(e.target.checked)} />
        </div>
        {feedEnabled && (
          <>
            <SectionDivider />
            <p className="text-xs eyebrow text-ink-muted">{t('activity.visibleTo')}</p>
            <div className="space-y-2">
              {ACTIVITY_TYPES.map((type) => {
                const m = ACTIVITY_META[type];
                const TypeIcon = m?.Icon;
                return (
                  <label key={type} className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox checked={visibleTypes.includes(type)} onChange={() => toggle(type)} />
                    <span className="inline-flex items-center gap-2 text-sm text-ink">
                      {TypeIcon && <span className={m.color}><TypeIcon size={14} /></span>}
                      {TYPE_LABELS[type] || type}
                    </span>
                  </label>
                );
              })}
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

export default function ActivityFeedPage() {
  const { t } = useTranslation();
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const profile = useFinanceStore((s) => s.profile);
  const friends = useFinanceStore((s) => s.friends);
  const activityFeed = useFinanceStore((s) => s.activityFeed);
  const activityPrivacy = useFinanceStore((s) => s.activityPrivacy);
  const socialStatus = useFinanceStore((s) => s.socialStatus);
  const goalInvitations = useFinanceStore((s) => s.goalInvitations);
  const acceptGoalInvitation = useFinanceStore((s) => s.acceptGoalInvitation);
  const declineGoalInvitation = useFinanceStore((s) => s.declineGoalInvitation);

  const loadActivityFeed = useFinanceStore((s) => s.loadActivityFeed);
  const loadSharedGoals = useFinanceStore((s) => s.loadSharedGoals);
  const deleteActivity = useFinanceStore((s) => s.deleteActivity);
  const updateActivityPrivacy = useFinanceStore((s) => s.updateActivityPrivacy);
  const addReaction = useFinanceStore((s) => s.addReaction);
  const removeReaction = useFinanceStore((s) => s.removeReaction);
  const addComment = useFinanceStore((s) => s.addComment);
  const deleteComment = useFinanceStore((s) => s.deleteComment);

  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => { loadActivityFeed(); loadSharedGoals(); }, [loadActivityFeed, loadSharedGoals]);

  const loading = socialStatus === 'loading' && activityFeed.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        data-tour="activity-privacy"
        title={t('activity.title')}
        description={t('activity.description')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setPrivacyOpen(true)}>
            <Settings2 size={14} className="mr-1.5" />
            {t('activity.privacy')}
          </Button>
        }
      />

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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : activityFeed.length === 0 ? (
        <EmptyState
          icon={<Radio size={32} />}
          title={t('activity.emptyTitle')}
          description={t('activity.emptyDescription')}
        />
      ) : (
        <div data-tour="activity-feed" className="space-y-3">
          {activityFeed.map((item) => (
            <ActivityCard
              key={item.id}
              activity={item}
              currentUserId={supabaseUser?.id}
              friends={friends}
              profile={profile}
              onReact={addReaction}
              onUnreact={removeReaction}
              onComment={addComment}
              onDeleteComment={deleteComment}
              onDelete={deleteActivity}
            />
          ))}
        </div>
      )}

      <PrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        privacy={activityPrivacy}
        onSave={updateActivityPrivacy}
      />
    </div>
  );
}

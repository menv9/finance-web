import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Input } from '../components/ui';
import { useFinanceStore } from '../store/useFinanceStore';
import { useTranslation } from '../i18n/useTranslation';

function Avatar({ profile, size = 40 }) {
  const initials = (profile?.display_name || profile?.username || '?')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        className="rounded-full border border-rule object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="inline-flex items-center justify-center rounded-full border border-rule bg-surface-raised text-ink font-display"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || '·'}
    </div>
  );
}

function ProfileLine({ profile, trailing }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink truncate">{profile?.display_name || profile?.username || '—'}</p>
        <p className="text-xs text-ink-muted truncate">@{profile?.username}</p>
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

function FriendsList() {
  const { t } = useTranslation();
  const friends = useFinanceStore((s) => s.friends);
  const removeFriend = useFinanceStore((s) => s.removeFriend);
  const [busyId, setBusyId] = useState(null);

  if (!friends.length) {
    return <EmptyState title={t('profile.friends.empty')} description={t('profile.friends.emptyDescription')} />;
  }
  return (
    <ul className="grid gap-3">
      {friends.map((f) => (
        <li key={f.otherId} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
          <ProfileLine
            profile={f.profile}
            trailing={
              <Button
                variant="ghost"
                size="sm"
                loading={busyId === f.otherId}
                onClick={async () => {
                  setBusyId(f.otherId);
                  try { await removeFriend(f.otherId); } finally { setBusyId(null); }
                }}
              >
                {t('profile.friends.remove')}
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function PendingRequests() {
  const { t } = useTranslation();
  const incoming = useFinanceStore((s) => s.pendingIncoming);
  const outgoing = useFinanceStore((s) => s.pendingOutgoing);
  const accept = useFinanceStore((s) => s.acceptFriendRequest);
  const decline = useFinanceStore((s) => s.declineFriendRequest);
  const cancel = useFinanceStore((s) => s.cancelFriendRequest);
  const [busyId, setBusyId] = useState(null);

  if (!incoming.length && !outgoing.length) {
    return <p className="text-sm text-ink-muted">{t('profile.pending.none')}</p>;
  }

  const guarded = (id, fn) => async () => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  return (
    <div className="grid gap-5">
      {incoming.length ? (
        <div className="grid gap-2">
          <p className="eyebrow text-ink-muted">{t('profile.pending.incoming', { count: incoming.length })}</p>
          <ul className="grid gap-2">
            {incoming.map((r) => (
              <li key={r.requesterId} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
                <ProfileLine
                  profile={r.profile}
                  trailing={
                    <>
                      <Button size="sm" loading={busyId === r.requesterId} onClick={guarded(r.requesterId, () => accept(r.requesterId))}>
                        {t('profile.pending.accept')}
                      </Button>
                      <Button variant="ghost" size="sm" loading={busyId === r.requesterId} onClick={guarded(r.requesterId, () => decline(r.requesterId))}>
                        {t('profile.pending.decline')}
                      </Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {outgoing.length ? (
        <div className="grid gap-2">
          <p className="eyebrow text-ink-muted">{t('profile.pending.sent', { count: outgoing.length })}</p>
          <ul className="grid gap-2">
            {outgoing.map((r) => (
              <li key={r.addresseeId} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
                <ProfileLine
                  profile={r.profile}
                  trailing={
                    <Button variant="ghost" size="sm" loading={busyId === r.addresseeId} onClick={guarded(r.addresseeId, () => cancel(r.addresseeId))}>
                      {t('profile.pending.cancel')}
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FindFriends() {
  const { t } = useTranslation();
  const searchByUsername = useFinanceStore((s) => s.searchUsersByUsername);
  const searchByEmail = useFinanceStore((s) => s.searchUserByEmail);
  const sendRequest = useFinanceStore((s) => s.sendFriendRequest);
  const friends = useFinanceStore((s) => s.friends);
  const pendingIncoming = useFinanceStore((s) => s.pendingIncoming);
  const pendingOutgoing = useFinanceStore((s) => s.pendingOutgoing);

  const [mode, setMode] = useState('username');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const relationStatus = useMemo(() => {
    const map = new Map();
    for (const f of friends) map.set(f.otherId, 'friend');
    for (const r of pendingOutgoing) map.set(r.addresseeId, 'sent');
    for (const r of pendingIncoming) map.set(r.requesterId, 'incoming');
    return map;
  }, [friends, pendingIncoming, pendingOutgoing]);

  const tabs = [
    { id: 'username', label: t('profile.findFriends.tabUsername') },
    { id: 'email', label: t('profile.findFriends.tabEmail') },
  ];

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSearching(true);
    setSearched(true);
    try {
      if (mode === 'username') {
        const rows = await searchByUsername(query);
        setResults(rows);
      } else {
        const row = await searchByEmail(query);
        setResults(row ? [row] : []);
      }
    } catch (err) {
      setError(err?.message || t('profile.findFriends.errorSearch'));
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const sendTo = async (userId) => {
    setBusyId(userId);
    try {
      await sendRequest(userId);
    } catch (err) {
      setError(err?.message || t('profile.findFriends.errorSend'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="inline-flex rounded-md border border-rule p-0.5 w-max text-xs">
        {tabs.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => { setMode(opt.id); setResults([]); setSearched(false); setError(''); }}
            className={`px-3 py-1.5 rounded-[5px] transition-colors ${mode === opt.id ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type={mode === 'email' ? 'email' : 'text'}
          placeholder={mode === 'email' ? t('profile.findFriends.placeholderEmail') : t('profile.findFriends.placeholderUsername')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Button type="submit" loading={searching} disabled={!query.trim()}>{t('profile.findFriends.search')}</Button>
      </form>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {searched && !searching ? (
        results.length ? (
          <ul className="grid gap-2">
            {results.map((profile) => {
              const rel = relationStatus.get(profile.user_id);
              return (
                <li key={profile.user_id} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
                  <ProfileLine
                    profile={profile}
                    trailing={
                      rel === 'friend' ? (
                        <span className="text-xs text-ink-muted">{t('profile.findFriends.statusFriend')}</span>
                      ) : rel === 'sent' ? (
                        <span className="text-xs text-ink-muted">{t('profile.findFriends.statusSent')}</span>
                      ) : rel === 'incoming' ? (
                        <span className="text-xs text-ink-muted">{t('profile.findFriends.statusIncoming')}</span>
                      ) : (
                        <Button size="sm" loading={busyId === profile.user_id} onClick={() => sendTo(profile.user_id)}>
                          {t('profile.findFriends.addFriend')}
                        </Button>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">{t('profile.findFriends.noMatches')}</p>
        )
      ) : null}
    </div>
  );
}

export default function FriendsPage() {
  const { t } = useTranslation();
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const friends = useFinanceStore((s) => s.friends);
  const loadFriendships = useFinanceStore((s) => s.loadFriendships);

  useEffect(() => {
    if (!supabaseUser) return;
    loadFriendships().catch(() => {});
  }, [supabaseUser, loadFriendships]);

  return (
    <div className="grid gap-8">
      <PageHeader title={t('nav.friends')} description={t('profile.friends.pageDescription')} />

      <Card data-tour="friends-search" title={t('profile.findFriends.title')} eyebrow={t('profile.findFriends.eyebrow')} description={t('profile.findFriends.description')}>
        <FindFriends />
      </Card>

      <Card data-tour="friends-pending" title={t('profile.pending.title')} eyebrow={t('profile.pending.eyebrow')}>
        <PendingRequests />
      </Card>

      <Card data-tour="friends-list" title={`${t('profile.friends.title')}${friends.length ? ` (${friends.length})` : ''}`} eyebrow={t('profile.friends.eyebrow')}>
        <FriendsList />
      </Card>
    </div>
  );
}

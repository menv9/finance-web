import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, FormField, Input, Textarea } from '../components/ui';
import { useAlert } from '../components/ConfirmContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { AVATAR_LIMITS, validateUsername } from '../utils/profilesApi';
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

function ProfileHero({ profile }) {
  const { t } = useTranslation();
  const setAvatar = useFinanceStore((s) => s.setAvatar);
  const clearAvatar = useFinanceStore((s) => s.clearAvatar);
  const alert = useAlert();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onPick = () => fileRef.current?.click();

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      await alert({
        title: t('profile.avatar.errorNotImage.title'),
        description: t('profile.avatar.errorNotImage.description'),
      });
      return;
    }
    if (file.size > AVATAR_LIMITS.maxBytes) {
      await alert({
        title: t('profile.avatar.errorTooLarge.title'),
        description: t('profile.avatar.errorTooLarge.description'),
      });
      return;
    }
    setBusy(true);
    try {
      await setAvatar(file);
    } catch (err) {
      await alert({
        title: t('profile.avatar.errorUpload.title'),
        description: err?.message || t('profile.avatar.errorUpload.description'),
      });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      await clearAvatar();
    } catch (err) {
      await alert({
        title: t('profile.avatar.errorRemove.title'),
        description: err?.message || t('profile.avatar.errorRemove.description'),
      });
    } finally {
      setBusy(false);
    }
  };

  const displayName = profile?.display_name?.trim() || profile?.username || '—';

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        aria-label={t('profile.avatar.ariaChange')}
        className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60"
      >
        <Avatar profile={profile} size={128} />
        <span className="absolute inset-0 rounded-full border border-rule-strong opacity-0 group-hover:opacity-100 group-hover:bg-canvas/40 transition-opacity flex items-center justify-center eyebrow text-ink">
          {t('profile.avatar.changeOverlay')}
        </span>
      </button>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h2 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight text-ink break-words">
          {displayName}
        </h2>
        {profile?.username ? (
          <p className="mt-1 text-sm text-ink-muted">@{profile.username}</p>
        ) : null}
        {profile?.bio ? (
          <p className="mt-3 text-sm text-ink whitespace-pre-wrap break-words">{profile.bio}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Button variant="secondary" size="sm" onClick={onPick} loading={busy}>
            {profile?.avatar_url ? t('profile.avatar.replacePhoto') : t('profile.avatar.uploadPhoto')}
          </Button>
          {profile?.avatar_url ? (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
              {t('profile.avatar.remove')}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-ink-faint">{t('profile.avatar.hint')}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={AVATAR_LIMITS.acceptMime}
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}

function ProfileEditor() {
  const { t } = useTranslation();
  const profile = useFinanceStore((s) => s.profile);
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const [form, setForm] = useState({ username: '', display_name: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      username: profile.username || '',
      display_name: profile.display_name || '',
      bio: profile.bio || '',
    });
  }, [profile]);

  if (!profile) {
    return <p className="text-sm text-ink-muted">{t('profile.loadingProfile')}</p>;
  }

  const dirty =
    form.username !== (profile.username || '') ||
    form.display_name !== (profile.display_name || '') ||
    form.bio !== (profile.bio || '');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const usernameError = validateUsername(form.username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        username: form.username.trim().toLowerCase(),
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim() || null,
      });
      setSavedAt(Date.now());
    } catch (err) {
      const msg = err?.message || t('profile.form.errorSave');
      setError(/duplicate|unique/i.test(msg) ? t('profile.form.errorTaken') : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <ProfileHero profile={profile} />
      <div className="h-px bg-rule" />
      <form onSubmit={submit} className="grid gap-4">
        <FormField label={t('profile.form.username')} hint={t('profile.form.usernameHint')}>
          {(p) => (
            <Input
              {...p}
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
            />
          )}
        </FormField>
        <FormField label={t('profile.form.displayName')} hint={t('profile.form.displayNameHint')}>
          {(p) => (
            <Input
              {...p}
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              maxLength={60}
            />
          )}
        </FormField>
        <FormField label={t('profile.form.bio')}>
          {(p) => (
            <Textarea
              {...p}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              maxLength={280}
            />
          )}
        </FormField>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || saving} loading={saving}>
            {t('profile.form.save')}
          </Button>
          {savedAt && !dirty ? <span className="text-xs text-ink-muted">{t('profile.saved')}</span> : null}
        </div>
      </form>
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

export default function ProfilePage() {
  const { t } = useTranslation();
  const supabaseUser = useFinanceStore((s) => s.supabaseUser);
  const profileStatus = useFinanceStore((s) => s.profileStatus);
  const profileError = useFinanceStore((s) => s.profileError);
  const loadProfile = useFinanceStore((s) => s.loadProfile);
  const loadFriendships = useFinanceStore((s) => s.loadFriendships);
  const friends = useFinanceStore((s) => s.friends);

  useEffect(() => {
    if (!supabaseUser) return;
    loadProfile().catch(() => {});
    loadFriendships().catch(() => {});
  }, [supabaseUser, loadProfile, loadFriendships]);

  if (!supabaseUser) {
    return (
      <div className="grid gap-8">
        <PageHeader title={t('profile.pageTitle')} description={t('profile.pageDescriptionAnon')} />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t('profile.pageTitle')}
        description={t('profile.pageDescription')}
      />
      {profileError ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {profileError}
        </div>
      ) : null}

      <Card title={t('profile.myProfile.title')} eyebrow={t('profile.myProfile.eyebrow')}>
        {profileStatus === 'loading' ? (
          <p className="text-sm text-ink-muted">{t('profile.loading')}</p>
        ) : (
          <ProfileEditor />
        )}
      </Card>

      <Card title={`Friends${friends.length ? ` (${friends.length})` : ''}`} eyebrow={t('profile.friends.eyebrow')}>
        <FriendsList />
      </Card>

      <Card title={t('profile.pending.title')} eyebrow={t('profile.pending.eyebrow')}>
        <PendingRequests />
      </Card>

      <Card title={t('profile.findFriends.title')} eyebrow={t('profile.findFriends.eyebrow')} description={t('profile.findFriends.description')}>
        <FindFriends />
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, FormField, Input, Textarea } from '../components/ui';
import { useFinanceStore } from '../store/useFinanceStore';
import { validateUsername } from '../utils/profilesApi';

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

function ProfileEditor() {
  const profile = useFinanceStore((s) => s.profile);
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const [form, setForm] = useState({ username: '', display_name: '', bio: '', avatar_url: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      username: profile.username || '',
      display_name: profile.display_name || '',
      bio: profile.bio || '',
      avatar_url: profile.avatar_url || '',
    });
  }, [profile]);

  if (!profile) {
    return <p className="text-sm text-ink-muted">Loading profile…</p>;
  }

  const dirty =
    form.username !== (profile.username || '') ||
    form.display_name !== (profile.display_name || '') ||
    form.bio !== (profile.bio || '') ||
    form.avatar_url !== (profile.avatar_url || '');

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
        avatar_url: form.avatar_url.trim() || null,
      });
      setSavedAt(Date.now());
    } catch (err) {
      const msg = err?.message || 'Could not save profile';
      setError(/duplicate|unique/i.test(msg) ? 'That username is taken.' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex items-center gap-4">
        <Avatar profile={{ ...profile, ...form }} size={56} />
        <div className="min-w-0">
          <p className="text-sm text-ink truncate">{form.display_name || form.username}</p>
          <p className="text-xs text-ink-muted truncate">@{form.username}</p>
        </div>
      </div>
      <FormField label="Username" hint="3–20 lowercase letters, numbers, or underscores.">
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
      <FormField label="Display name" hint="What friends see. Optional.">
        {(p) => (
          <Input
            {...p}
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            maxLength={60}
          />
        )}
      </FormField>
      <FormField label="Bio">
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
      <FormField label="Avatar URL" hint="Paste a link to an image. Upload coming later.">
        {(p) => (
          <Input
            {...p}
            type="url"
            placeholder="https://…"
            value={form.avatar_url}
            onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
          />
        )}
      </FormField>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || saving} loading={saving}>
          Save
        </Button>
        {savedAt && !dirty ? <span className="text-xs text-ink-muted">Saved.</span> : null}
      </div>
    </form>
  );
}

function FriendsList() {
  const friends = useFinanceStore((s) => s.friends);
  const removeFriend = useFinanceStore((s) => s.removeFriend);
  const [busyId, setBusyId] = useState(null);

  if (!friends.length) {
    return <EmptyState title="No friends yet" description="Find someone in the section below and send them a request." />;
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
                Remove
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function PendingRequests() {
  const incoming = useFinanceStore((s) => s.pendingIncoming);
  const outgoing = useFinanceStore((s) => s.pendingOutgoing);
  const accept = useFinanceStore((s) => s.acceptFriendRequest);
  const decline = useFinanceStore((s) => s.declineFriendRequest);
  const cancel = useFinanceStore((s) => s.cancelFriendRequest);
  const [busyId, setBusyId] = useState(null);

  if (!incoming.length && !outgoing.length) {
    return <p className="text-sm text-ink-muted">No pending requests.</p>;
  }

  const guarded = (id, fn) => async () => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  return (
    <div className="grid gap-5">
      {incoming.length ? (
        <div className="grid gap-2">
          <p className="eyebrow text-ink-muted">Incoming ({incoming.length})</p>
          <ul className="grid gap-2">
            {incoming.map((r) => (
              <li key={r.requesterId} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
                <ProfileLine
                  profile={r.profile}
                  trailing={
                    <>
                      <Button size="sm" loading={busyId === r.requesterId} onClick={guarded(r.requesterId, () => accept(r.requesterId))}>
                        Accept
                      </Button>
                      <Button variant="ghost" size="sm" loading={busyId === r.requesterId} onClick={guarded(r.requesterId, () => decline(r.requesterId))}>
                        Decline
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
          <p className="eyebrow text-ink-muted">Sent ({outgoing.length})</p>
          <ul className="grid gap-2">
            {outgoing.map((r) => (
              <li key={r.addresseeId} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
                <ProfileLine
                  profile={r.profile}
                  trailing={
                    <Button variant="ghost" size="sm" loading={busyId === r.addresseeId} onClick={guarded(r.addresseeId, () => cancel(r.addresseeId))}>
                      Cancel
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
      setError(err?.message || 'Search failed');
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
      setError(err?.message || 'Could not send request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="inline-flex rounded-md border border-rule p-0.5 w-max text-xs">
        {[
          { id: 'username', label: 'Username' },
          { id: 'email', label: 'Email' },
        ].map((opt) => (
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
          placeholder={mode === 'email' ? 'friend@example.com' : 'username'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Button type="submit" loading={searching} disabled={!query.trim()}>Search</Button>
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
                        <span className="text-xs text-ink-muted">Friends</span>
                      ) : rel === 'sent' ? (
                        <span className="text-xs text-ink-muted">Request sent</span>
                      ) : rel === 'incoming' ? (
                        <span className="text-xs text-ink-muted">They sent you a request</span>
                      ) : (
                        <Button size="sm" loading={busyId === profile.user_id} onClick={() => sendTo(profile.user_id)}>
                          Add friend
                        </Button>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No matches.</p>
        )
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
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
        <PageHeader title="Profile" description="Sign in to set up your profile and find friends." />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Profile"
        description="Your public-facing identity and your friends. Your finance data stays private."
      />
      {profileError ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {profileError}
        </div>
      ) : null}

      <Card title="My profile" eyebrow="Identity">
        {profileStatus === 'loading' ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <ProfileEditor />
        )}
      </Card>

      <Card title={`Friends${friends.length ? ` (${friends.length})` : ''}`} eyebrow="People">
        <FriendsList />
      </Card>

      <Card title="Pending" eyebrow="Requests">
        <PendingRequests />
      </Card>

      <Card title="Find friends" eyebrow="Discovery" description="Search by username or email.">
        <FindFriends />
      </Card>
    </div>
  );
}

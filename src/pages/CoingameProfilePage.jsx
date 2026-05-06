import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InfoTooltip from '../components/coingame/InfoTooltip';
import { useFinanceStore } from '../store/useFinanceStore';
import { AVATAR_LIMITS, validateUsername } from '../utils/profilesApi';
import { spotPrice } from '../utils/coingameApi';

function FC({ amount, decimals = 2 }) {
  const value = Number(amount ?? 0);
  return (
    <span>
      {value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      <span className="cg-unit">FC</span>
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function profileInitials(profile) {
  return (profile?.display_name || profile?.username || '?')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

function AvatarEditor({ profile }) {
  const setAvatar = useFinanceStore((s) => s.setAvatar);
  const clearAvatar = useFinanceStore((s) => s.clearAvatar);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('Avatar must be an image.');
      return;
    }
    if (file.size > AVATAR_LIMITS.maxBytes) {
      setError('Avatar must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setAvatar(file);
    } catch (err) {
      setError(err?.message || 'Could not update avatar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    setError('');
    try {
      await clearAvatar();
    } catch (err) {
      setError(err?.message || 'Could not remove avatar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cg-profile-avatar-card">
      <button
        type="button"
        className="cg-profile-avatar-button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label="Change avatar"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="cg-profile-avatar-img" />
        ) : (
          <span>{profileInitials(profile)}</span>
        )}
      </button>
      <div className="cg-profile-avatar-actions">
        <button type="button" className="cg-btn cg-btn-secondary cg-btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading...' : 'Upload'}
        </button>
        {profile?.avatar_url && (
          <button type="button" className="cg-btn cg-btn-danger cg-btn-sm" onClick={handleClear} disabled={busy}>
            Remove
          </button>
        )}
      </div>
      {error && <div className="cg-error">{error}</div>}
      <input ref={fileRef} type="file" accept={AVATAR_LIMITS.acceptMime} onChange={handleFile} hidden />
    </div>
  );
}

function ProfileForm({ profile }) {
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const loadCoingame = useFinanceStore((s) => s.loadCoingame);
  const [form, setForm] = useState({ username: '', display_name: '', bio: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      username: profile?.username || '',
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
    });
    setSaved(false);
    setError('');
  }, [profile]);

  const dirty =
    form.username !== (profile?.username || '') ||
    form.display_name !== (profile?.display_name || '') ||
    form.bio !== (profile?.bio || '');

  async function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    const username = form.username.trim().toLowerCase();
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile({
        username,
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim() || null,
      });
      await loadCoingame();
      setSaved(true);
    } catch (err) {
      const message = err?.message || 'Could not save profile.';
      setError(/duplicate|unique/i.test(message) ? 'That username is already taken.' : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cg-profile-form" onSubmit={handleSubmit}>
      <label>
        <span className="cg-label">Username</span>
        <input
          className="cg-input"
          value={form.username}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))}
        />
      </label>
      <label>
        <span className="cg-label">Display name</span>
        <input
          className="cg-input"
          value={form.display_name}
          maxLength={60}
          onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
        />
      </label>
      <label className="cg-profile-form-wide">
        <span className="cg-label">Bio</span>
        <textarea
          className="cg-input cg-textarea"
          value={form.bio}
          rows={4}
          maxLength={280}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
        />
        <span className="cg-input-hint">{form.bio.length}/280</span>
      </label>
      {error && <div className="cg-error cg-profile-form-wide">{error}</div>}
      <div className="cg-profile-form-actions">
        <button type="submit" className="cg-btn cg-btn-primary" disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        {saved && !dirty && <span className="cg-save-note">Saved</span>}
      </div>
    </form>
  );
}

function CoinForm({ ownCoin }) {
  const coingameCreateCoin = useFinanceStore((s) => s.coingameCreateCoin);
  const status = useFinanceStore((s) => s.coingameStatus);
  const [coinName, setCoinName] = useState(ownCoin?.coin_name || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCoinName(ownCoin?.coin_name || '');
    setSaved(false);
    setError('');
  }, [ownCoin?.coin_name]);

  const cleanName = coinName.trim();
  const dirty = cleanName !== (ownCoin?.coin_name || '');

  async function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    if (cleanName.length < 2 || cleanName.length > 32) {
      setError('Use 2-32 characters for your coin name.');
      return;
    }
    setError('');
    try {
      await coingameCreateCoin(cleanName);
      setSaved(true);
    } catch (err) {
      setError(err?.message || 'Could not save coin.');
    }
  }

  return (
    <form className="cg-profile-form" onSubmit={handleSubmit}>
      <label className="cg-profile-form-wide">
        <span className="cg-label">Coin name</span>
        <input
          className="cg-input"
          value={coinName}
          maxLength={32}
          onChange={(event) => setCoinName(event.target.value)}
        />
        <span className="cg-input-hint">{cleanName.length}/32</span>
      </label>
      {error && <div className="cg-error cg-profile-form-wide">{error}</div>}
      <div className="cg-profile-form-actions">
        <button type="submit" className="cg-btn cg-btn-primary" disabled={!dirty || status === 'loading'}>
          {status === 'loading' ? 'Saving...' : 'Save coin'}
        </button>
        {ownCoin?.coin_id && (
          <Link className="cg-btn cg-btn-secondary" to={`/coingame/coin/${ownCoin.coin_id}`}>
            Open coin
          </Link>
        )}
        {saved && !dirty && <span className="cg-save-note">Saved</span>}
      </div>
    </form>
  );
}

export default function CoingameProfilePage() {
  const loadProfile = useFinanceStore((s) => s.loadProfile);
  const loadCoingame = useFinanceStore((s) => s.loadCoingame);
  const profile = useFinanceStore((s) => s.profile);
  const profileStatus = useFinanceStore((s) => s.profileStatus);
  const profileError = useFinanceStore((s) => s.profileError);
  const wallet = useFinanceStore((s) => s.coingameWallet);
  const ownCoin = useFinanceStore((s) => s.coingameOwnCoin);
  const holdings = useFinanceStore((s) => s.coingameHoldings);
  const transactions = useFinanceStore((s) => s.coingameTransactions);
  const coingameError = useFinanceStore((s) => s.coingameError);

  useEffect(() => {
    loadProfile().catch(() => {});
    loadCoingame().catch(() => {});
  }, [loadProfile, loadCoingame]);

  const stats = useMemo(() => {
    const holdingsValue = holdings.reduce((sum, item) => {
      const coin = item.coingame_coins;
      const price = spotPrice(Number(coin?.tokens_minted ?? 0), Number(coin?.base_price ?? 1));
      return sum + price * Number(item.tokens_held ?? 0);
    }, 0);
    const invested = holdings.reduce((sum, item) => sum + Number(item.avg_buy_price ?? 0) * Number(item.tokens_held ?? 0), 0);
    const casinoBets = transactions.filter((tx) => ['gamble_bet', 'gamble_win', 'gamble_loss'].includes(tx.tx_type)).length;
    const rewards = transactions
      .filter((tx) => ['reward', 'starter_grant'].includes(tx.tx_type))
      .reduce((sum, tx) => sum + Number(tx.fc_amount ?? 0), 0);
    const ownPrice = ownCoin ? spotPrice(Number(ownCoin.tokens_minted ?? 0), Number(ownCoin.base_price ?? 1)) : 0;
    return {
      holdingsValue,
      pnl: holdingsValue - invested,
      casinoBets,
      rewards,
      ownPrice,
      marketCap: ownPrice * Number(ownCoin?.tokens_minted ?? 0),
    };
  }, [holdings, ownCoin, transactions]);

  const loading = profileStatus === 'loading' && !profile;

  return (
    <div className="cg-page cg-profile-page">
      <div className="cg-profile-header">
        <div>
          <h1 className="cg-heading-with-info">
            Profile
            <InfoTooltip text="Manage your public social profile, Coingame stats, wallet balance, and personal coin." />
          </h1>
          <p>Stats, wallet and user coin controls</p>
        </div>
        <Link className="cg-btn cg-btn-secondary" to="/coingame/history">History</Link>
      </div>

      {(profileError || coingameError) && <div className="cg-error">{profileError || coingameError}</div>}

      {loading ? (
        <div className="cg-skeleton" style={{ height: 520 }} />
      ) : (
        <>
          <section className="cg-profile-hero">
            <AvatarEditor profile={profile} />
            <div className="cg-profile-identity">
              <div className="cg-coin-eyebrow">COINGAME IDENTITY</div>
              <h2>{profile?.display_name || profile?.username || 'Player'}</h2>
              <div className="cg-profile-meta">
                <span>@{profile?.username || 'username'}</span>
                <span>Joined {formatDate(profile?.created_at)}</span>
                <span>{wallet?.login_streak ?? 0} day streak</span>
              </div>
              {profile?.bio && <p>{profile.bio}</p>}
            </div>
          </section>

          <section className="cg-stat-row cg-profile-stats">
            <div className="cg-stat-card">
              <div className="cg-stat-label">Wallet balance</div>
              <div className="cg-stat-value accent"><FC amount={wallet?.fc_balance} /></div>
            </div>
            <div className="cg-stat-card">
              <div className="cg-stat-label">Holdings value</div>
              <div className="cg-stat-value"><FC amount={stats.holdingsValue} /></div>
              <div className="cg-stat-sub" style={{ color: stats.pnl >= 0 ? 'var(--cg-positive)' : 'var(--cg-danger)' }}>
                {stats.pnl >= 0 ? '+' : ''}<FC amount={stats.pnl} /> P/L
              </div>
            </div>
            <div className="cg-stat-card">
              <div className="cg-stat-label">Transactions</div>
              <div className="cg-stat-value">{transactions.length}</div>
              <div className="cg-stat-sub">{stats.casinoBets} casino records</div>
            </div>
            <div className="cg-stat-card">
              <div className="cg-stat-label">Rewards earned</div>
              <div className="cg-stat-value"><FC amount={stats.rewards} /></div>
            </div>
          </section>

          <section className="cg-profile-grid">
            <div className="cg-table">
              <div className="cg-table-header">
                <span className="cg-table-title">
                  Manage profile
                  <InfoTooltip text="This profile is used across social pages and Coingame market identity." />
                </span>
              </div>
              <div className="cg-profile-panel-body">
                <ProfileForm profile={profile} />
              </div>
            </div>

            <div className="cg-table">
              <div className="cg-table-header">
                <span className="cg-table-title">
                  Manage coin
                  <InfoTooltip text="Your personal coin name is public in the market and on leaderboards." />
                </span>
              </div>
              <div className="cg-profile-panel-body">
                <div className="cg-profile-coin-preview">
                  <div className="cg-setup-coin-face">{(ownCoin?.coin_name?.[0] || profile?.username?.[0] || 'C').toUpperCase()}</div>
                  <div>
                    <strong>{ownCoin?.coin_name || 'Your coin'}</strong>
                    <span>{Number(ownCoin?.tokens_minted ?? 0).toLocaleString()} minted</span>
                  </div>
                </div>
                <div className="cg-profile-coin-metrics">
                  <div><span>Price</span><strong><FC amount={stats.ownPrice} decimals={6} /></strong></div>
                  <div><span>Market cap</span><strong><FC amount={stats.marketCap} /></strong></div>
                  <div><span>Status</span><strong>{ownCoin?.status || 'starter'}</strong></div>
                </div>
                <CoinForm ownCoin={ownCoin} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

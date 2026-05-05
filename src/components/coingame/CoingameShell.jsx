import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import FaultyTerminal from './FaultyTerminal';
import CoinEntryAnimation from './CoinEntryAnimation';
import { useFinanceStore } from '../../store/useFinanceStore';
import '../../styles/coingame.css';

const NAV = [
  { to: '/coingame',             end: true, icon: '⌂', label: 'Home' },
  { to: '/coingame/market',      end: false, icon: '◈', label: 'Market' },
  { to: '/coingame/leaderboard', end: false, icon: '▲', label: 'Rankings' },
  { to: '/coingame/history',     end: false, icon: '◎', label: 'History' },
];

function CoinSetupModal() {
  const profile = useFinanceStore((s) => s.profile);
  const createCoin = useFinanceStore((s) => s.coingameCreateCoin);
  const status = useFinanceStore((s) => s.coingameStatus);
  const error = useFinanceStore((s) => s.coingameError);
  const fallbackName = useMemo(() => profile?.username || 'my_coin', [profile?.username]);
  const [coinName, setCoinName] = useState(fallbackName);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setCoinName(fallbackName);
  }, [fallbackName]);

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = coinName.trim();
    if (cleanName.length < 2 || cleanName.length > 32) {
      setLocalError('Use 2-32 characters for your coin name.');
      return;
    }
    setLocalError('');
    try {
      await createCoin(cleanName);
    } catch {
      // Store error is rendered in the modal.
    }
  }

  return (
    <div className="cg-overlay cg-setup-overlay">
      <form className="cg-modal cg-setup-modal" onSubmit={handleSubmit}>
        <div className="cg-modal-header">
          <span className="cg-modal-title">Your coin is ready</span>
        </div>

        <div className="cg-modal-body">
          <div className="cg-setup-coin">
            <div className="cg-setup-coin-face">
              {(coinName.trim()[0] || fallbackName[0] || 'C').toUpperCase()}
            </div>
          </div>

          <p className="cg-setup-copy">
            This is your personal market coin. Pick the name people will see before it goes live.
          </p>

          <label className="cg-label" htmlFor="cg-coin-name">Coin name</label>
          <input
            id="cg-coin-name"
            className="cg-input"
            value={coinName}
            maxLength={32}
            onChange={(event) => setCoinName(event.target.value)}
            autoFocus
          />
          <div className="cg-input-hint">{coinName.trim().length}/32</div>

          {(localError || error) && (
            <div className="cg-error">{localError || error}</div>
          )}
        </div>

        <div className="cg-modal-footer">
          <button className="cg-btn cg-btn-primary" style={{ justifyContent: 'center' }} type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Creating...' : 'Launch coin'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CoingameShell({ children }) {
  const loadCoingame = useFinanceStore((s) => s.loadCoingame);
  const needsCoinSetup = useFinanceStore((s) => s.coingameNeedsCoinSetup);
  const [showCoin, setShowCoin] = useState(
    () => sessionStorage.getItem('cg_intro') !== '1'
  );

  useEffect(() => {
    loadCoingame();
  }, [loadCoingame]);

  return (
    <div className="coingame-theme cg-shell">
      {/* WebGL background */}
      <div className="cg-bg-layer">
        <FaultyTerminal
          scale={2.1}
          timeScale={0.2}
          tint="#1cff00"
          gridMul={[2, 1]}
          digitSize={1.5}
          scanlineIntensity={0.25}
          glitchAmount={0.8}
          flickerAmount={0.4}
          noiseAmp={0.8}
          curvature={0.06}
          chromaticAberration={0}
          mouseReact
          mouseStrength={0.1}
          brightness={0.22}
          pageLoadAnimation
        />
      </div>

      {/* Coin entry animation — first visit only */}
      {showCoin && (
        <CoinEntryAnimation onComplete={() => setShowCoin(false)} />
      )}

      {needsCoinSetup && !showCoin && <CoinSetupModal />}

      {/* Sidebar */}
      <aside className="cg-sidebar">
        <div className="cg-sidebar-logo">
          <div className="cg-sidebar-logo-icon">CG</div>
          <span className="cg-sidebar-logo-text">COINGAME</span>
        </div>

        <nav className="cg-sidebar-nav">
          {NAV.map(({ to, end, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `cg-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="cg-nav-item-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="cg-sidebar-bottom">
          <Link to="/dashboard" className="cg-back-link">
            <span className="cg-nav-item-icon">←</span>
            <span>Back to Finges</span>
          </Link>
        </div>
      </aside>

      {/* Main scrollable area */}
      <main className="cg-main-area">
        {children}
      </main>
    </div>
  );
}

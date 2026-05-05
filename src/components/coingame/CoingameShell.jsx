import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import FaultyTerminal from './FaultyTerminal';
import CoinEntryAnimation from './CoinEntryAnimation';
import '../../styles/coingame.css';

const NAV = [
  { to: '/coingame',             end: true, icon: '⌂', label: 'Home' },
  { to: '/coingame/market',      end: false, icon: '◈', label: 'Market' },
  { to: '/coingame/leaderboard', end: false, icon: '▲', label: 'Rankings' },
  { to: '/coingame/history',     end: false, icon: '◎', label: 'History' },
];

export default function CoingameShell({ children }) {
  const [showCoin, setShowCoin] = useState(
    () => sessionStorage.getItem('cg_intro') !== '1'
  );

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

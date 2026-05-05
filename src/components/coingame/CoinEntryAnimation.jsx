import { useRef } from 'react';

export default function CoinEntryAnimation({ onComplete }) {
  const coinRef = useRef(null);

  function handleAnimationEnd() {
    sessionStorage.setItem('cg_intro', '1');
    onComplete?.();
  }

  return (
    <div className="cg-coin-overlay">
      <div className="cg-coin-scene">
        <div
          ref={coinRef}
          className="cg-coin"
          onAnimationEnd={handleAnimationEnd}
        >
          {/* Front face: FINGES */}
          <div className="cg-coin-face">
            <div className="cg-coin-ring" />
            {/* Outer decorative ring */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}
              viewBox="0 0 180 180"
            >
              <circle cx="90" cy="90" r="82" fill="none" stroke="#1cff00" strokeWidth="0.5" strokeDasharray="4 3" />
              <circle cx="90" cy="90" r="72" fill="none" stroke="#1cff00" strokeWidth="0.3" />
            </svg>
            <span className="cg-coin-label">FINGES</span>
            <span className="cg-coin-sub">VIRTUAL ECONOMY</span>
          </div>

          {/* Back face: FC */}
          <div className="cg-coin-face cg-coin-face-back">
            <div className="cg-coin-ring" />
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}
              viewBox="0 0 180 180"
            >
              <circle cx="90" cy="90" r="82" fill="none" stroke="#1cff00" strokeWidth="0.5" strokeDasharray="4 3" />
              <circle cx="90" cy="90" r="72" fill="none" stroke="#1cff00" strokeWidth="0.3" />
            </svg>
            <span className="cg-coin-label" style={{ fontSize: '2.2rem' }}>FC</span>
            <span className="cg-coin-sub">FINGESCOIN</span>
          </div>
        </div>
      </div>
    </div>
  );
}

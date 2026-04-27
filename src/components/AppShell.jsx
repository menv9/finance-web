import { NavLink } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency } from '../utils/formatters';
import { cn } from './ui/cn';
import LiquidChrome from './LiquidChrome';
import ElectricBorder from './ElectricBorder';
import SakuraPetals from './SakuraPetals';

const links = [
  { to: '/dashboard', label: 'Dashboard', num: '01' },
  { to: '/expenses', label: 'Expenses', num: '02' },
  { to: '/income', label: 'Income', num: '03' },
  { to: '/portfolio', label: 'Portfolio', num: '04' },
  { to: '/savings', label: 'Savings', num: '05' },
  { to: '/transfers', label: 'Transfers', num: '06' },
  { to: '/settings', label: 'Settings', num: '07' },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle cx="10" cy="10" r="3.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d="M14.5 12.8A6.2 6.2 0 1 1 7.2 5.5a5 5 0 0 0 7.3 7.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
      {open ? (
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function FinanceIcon({ theme }) {
  const isDark = theme === 'dark' || theme === 'gorka';
  const isGorka = theme === 'gorka';
  const isEris = theme === 'eris';

  // Card background
  const cardFrom = isDark ? '#1B2434' : isEris ? '#FFF6FA' : '#FFFFFF';
  const cardTo   = isDark ? '#141B26' : isEris ? '#FEF0F5' : '#E8EFFE';

  // Coin face
  const coinFrom = isDark ? '#232E42' : isEris ? '#FFF0F7' : '#FFFFFF';
  const coinTo   = isDark ? '#1B2434' : isEris ? '#FFE0EE' : '#EEF2FF';

  // Coin ring
  const ringFrom = isDark ? '#2A3A58' : isEris ? '#FFD6EA' : '#E0E8FF';
  const ringTo   = isDark ? '#1E2C46' : isEris ? '#FFBAD8' : '#C8D8F8';

  // Euro stroke color
  const euroColor     = isGorka ? '#C084FC' : isEris ? '#D4607A' : '#1B3A7A';
  const euroShadow    = isGorka ? 'rgba(80,0,120,0.4)' : isEris ? 'rgba(80,0,30,0.25)' : 'rgba(0,20,60,0.35)';
  const euroHighlight = isGorka ? 'rgba(220,180,255,0.4)' : isEris ? 'rgba(255,140,180,0.35)' : 'rgba(100,160,255,0.35)';

  // Card drop shadow color
  const cardShadow = isGorka ? '#9060D8' : isEris ? '#E8A0B8' : '#8AAAD8';

  return (
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="h-7 w-7">
      <defs>
        <linearGradient id="fi-bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={cardFrom} />
          <stop offset="100%" stopColor={cardTo} />
        </linearGradient>
        <linearGradient id="fi-g1" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#52E8A8" />
          <stop offset="100%" stopColor="#28B87A" />
        </linearGradient>
        <linearGradient id="fi-g2" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#3ED8E8" />
          <stop offset="100%" stopColor="#1A9ECC" />
        </linearGradient>
        <linearGradient id="fi-g3" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#60A8FF" />
          <stop offset="100%" stopColor="#1A5FE8" />
        </linearGradient>
        <linearGradient id="fi-sh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.52)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="fi-bsh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.14)" />
        </linearGradient>
        <linearGradient id="fi-coinbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={coinFrom} />
          <stop offset="100%" stopColor={coinTo} />
        </linearGradient>
        <linearGradient id="fi-coinring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ringFrom} />
          <stop offset="100%" stopColor={ringTo} />
        </linearGradient>
        <filter id="fi-cardshadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="20" stdDeviation="32" floodColor={cardShadow} floodOpacity="0.28" />
        </filter>
        <filter id="fi-bardepth" x="-20%" y="-10%" width="150%" height="130%">
          <feDropShadow dx="4" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.16" />
        </filter>
        <filter id="fi-coinshadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#5577BB" floodOpacity="0.22" />
        </filter>
        <filter id="fi-lineglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="fi-dotglow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="8" floodColor="#fff" floodOpacity="0.9" />
        </filter>
      </defs>

      <rect x="72" y="72" width="880" height="880" rx="196" fill="url(#fi-bg)" filter="url(#fi-cardshadow)" />

      <g filter="url(#fi-bardepth)">
        <rect x="230" y="530" width="155" height="325" rx="36" fill="url(#fi-g1)" />
        <rect x="230" y="530" width="155" height="325" rx="36" fill="url(#fi-bsh)" />
        <rect x="230" y="530" width="52"  height="325" rx="36" fill="url(#fi-sh)" opacity="0.9" />
      </g>
      <g filter="url(#fi-bardepth)">
        <rect x="415" y="390" width="155" height="465" rx="36" fill="url(#fi-g2)" />
        <rect x="415" y="390" width="155" height="465" rx="36" fill="url(#fi-bsh)" />
        <rect x="415" y="390" width="52"  height="465" rx="36" fill="url(#fi-sh)" opacity="0.9" />
      </g>
      <g filter="url(#fi-bardepth)">
        <rect x="600" y="210" width="160" height="645" rx="36" fill="url(#fi-g3)" />
        <rect x="600" y="210" width="160" height="645" rx="36" fill="url(#fi-bsh)" />
        <rect x="600" y="210" width="54"  height="645" rx="36" fill="url(#fi-sh)" opacity="0.9" />
      </g>

      <path d="M307 668 C390 600 460 450 492 432 C530 412 590 358 680 310"
            stroke="rgba(255,255,255,0.32)" strokeWidth="32" fill="none" strokeLinecap="round" filter="url(#fi-lineglow)" />
      <path d="M307 668 C390 600 460 450 492 432 C530 412 590 358 680 310"
            stroke="white" strokeWidth="18" fill="none" strokeLinecap="round" />

      <circle cx="307" cy="668" r="30" fill="white" filter="url(#fi-dotglow)" />
      <circle cx="307" cy="668" r="15" fill="#3ABDE0" />
      <circle cx="492" cy="432" r="30" fill="white" filter="url(#fi-dotglow)" />
      <circle cx="492" cy="432" r="15" fill="#3ABDE0" />
      <circle cx="680" cy="310" r="30" fill="white" filter="url(#fi-dotglow)" />
      <circle cx="680" cy="310" r="15" fill="#4B8EF5" />

      <g filter="url(#fi-coinshadow)">
        <circle cx="724" cy="748" r="118" fill="url(#fi-coinring)" />
        <circle cx="724" cy="748" r="100" fill="url(#fi-coinbg)" />
        <circle cx="724" cy="748" r="100" fill="none" stroke="rgba(100,130,200,0.18)" strokeWidth="12" />
        <circle cx="724" cy="748" r="109" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3"
                strokeDasharray="180 600" strokeDashoffset="-60" strokeLinecap="round" />
        <ellipse cx="690" cy="712" rx="52" ry="36" fill="rgba(255,255,255,0.18)" />
        <circle cx="724" cy="748" r="100" fill="none" stroke="rgba(180,200,240,0.6)" strokeWidth="2" />
        <path d="M758 692 A62 62 0 1 0 758 804" fill="none" stroke={euroShadow} strokeWidth="28" strokeLinecap="round" />
        <path d="M758 692 A62 62 0 1 0 758 804" fill="none" stroke={euroColor} strokeWidth="22" strokeLinecap="round" />
        <path d="M758 692 A62 62 0 1 0 758 804" fill="none" stroke={euroHighlight} strokeWidth="8" strokeLinecap="round" />
        <line x1="650" y1="732" x2="725" y2="732" stroke={euroShadow} strokeWidth="22" strokeLinecap="round" />
        <line x1="650" y1="732" x2="725" y2="732" stroke={euroColor} strokeWidth="16" strokeLinecap="round" />
        <line x1="650" y1="729" x2="725" y2="729" stroke={euroHighlight} strokeWidth="5" strokeLinecap="round" />
        <line x1="650" y1="764" x2="725" y2="764" stroke={euroShadow} strokeWidth="22" strokeLinecap="round" />
        <line x1="650" y1="764" x2="725" y2="764" stroke={euroColor} strokeWidth="16" strokeLinecap="round" />
        <line x1="650" y1="761" x2="725" y2="761" stroke={euroHighlight} strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const LOGO_GRADIENTS = {
  dark:  [{ o: '0%', c: '#28B87A' }, { o: '45%', c: '#1A9ECC' }, { o: '100%', c: '#2563EB' }],
  light: [{ o: '0%', c: '#1F4B3A' }, { o: '45%', c: '#0F6E56' }, { o: '100%', c: '#085041' }],
  eris:  [{ o: '0%', c: '#D4607A' }, { o: '45%', c: '#B84362' }, { o: '100%', c: '#8A1A45' }],
  gorka: [{ o: '0%', c: '#C084FC' }, { o: '45%', c: '#818CF8' }, { o: '100%', c: '#60A5FA' }],
};

const FIN_COLORS = {
  dark:  '#FAF9F5',
  light: '#1B1712',
  eris:  '#2A1218',
  gorka: '#FFFFFF',
};

const TAGLINE_COLORS = {
  dark:  '#C2C0B6',
  light: '#524A40',
  eris:  '#8A4F65',
  gorka: 'rgba(255,255,255,0.55)',
};

function FinGesWordmark({ theme }) {
  const stops = LOGO_GRADIENTS[theme] ?? LOGO_GRADIENTS.dark;
  const finColor = FIN_COLORS[theme] ?? FIN_COLORS.dark;
  const taglineColor = TAGLINE_COLORS[theme] ?? TAGLINE_COLORS.dark;
  const id = `lgw-${theme}`;

  return (
    <svg viewBox="50 75 530 160" role="img" xmlns="http://www.w3.org/2000/svg" className="h-11 w-auto">
      <title>FinGes</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map(s => <stop key={s.o} offset={s.o} stopColor={s.c} />)}
        </linearGradient>
        <filter id={`glow-g-${theme}`} x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#28E87A" floodOpacity="0.7"/>
        </filter>
        <filter id={`glow-r-${theme}`} x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FF4444" floodOpacity="0.7"/>
        </filter>
        <filter id={`lglow-${theme}`} x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* 6→7 behind, red */}
      <line x1="301" y1="99" x2="364" y2="185" stroke="rgba(255,68,68,0.22)" strokeWidth="12" strokeLinecap="round" filter={`url(#lglow-${theme})`}/>
      <line x1="301" y1="99" x2="364" y2="185" stroke="#E74C3C" strokeWidth="4" strokeLinecap="round"/>
      {/* 8→9 behind, red */}
      <line x1="395" y1="127" x2="457" y2="185" stroke="rgba(255,68,68,0.22)" strokeWidth="12" strokeLinecap="round" filter={`url(#lglow-${theme})`}/>
      <line x1="395" y1="127" x2="457" y2="185" stroke="#E74C3C" strokeWidth="4" strokeLinecap="round"/>

      <text x="60" y="188" fontFamily="'Fraunces', Georgia, serif" fontSize="130" fontWeight="400" fill={finColor} opacity="0.9" letterSpacing="-3">Fin</text>
      <text x="253" y="188" fontFamily="'Fraunces', Georgia, serif" fontSize="130" fontWeight="600" fill={`url(#${id})`} letterSpacing="-3">Ges</text>

      {/* 7→8 in front, green */}
      <line x1="364" y1="185" x2="395" y2="127" stroke="rgba(40,232,122,0.22)" strokeWidth="12" strokeLinecap="round" filter={`url(#lglow-${theme})`}/>
      <line x1="364" y1="185" x2="395" y2="127" stroke="#2ECC71" strokeWidth="4" strokeLinecap="round"/>

      {/* Dots */}
      <circle cx="301" cy="99"  r="10" fill="white" filter={`url(#glow-g-${theme})`}/><circle cx="301" cy="99"  r="6" fill="#2ECC71"/>
      <circle cx="364" cy="185" r="10" fill="white" filter={`url(#glow-r-${theme})`}/><circle cx="364" cy="185" r="6" fill="#E74C3C"/>
      <circle cx="395" cy="127" r="10" fill="white" filter={`url(#glow-g-${theme})`}/><circle cx="395" cy="127" r="6" fill="#2ECC71"/>
      <circle cx="457" cy="185" r="10" fill="white" filter={`url(#glow-r-${theme})`}/><circle cx="457" cy="185" r="6" fill="#E74C3C"/>

      <text x="61" y="220" fontFamily="'Instrument Sans', system-ui, sans-serif" fontSize="15" fontWeight="500" letterSpacing="6" fill={taglineColor}>QUARTERLY LEDGER</text>
    </svg>
  );
}

function Logo({ theme }) {
  return (
    <NavLink to="/dashboard" className="flex items-center group" aria-label="Finance Tracker — home">
      <FinGesWordmark theme={theme} />
    </NavLink>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 15l3-5-3-5" />
      <path d="M16 10H7" />
      <path d="M7 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  );
}

const FAVICON_TOKENS = {
  dark:  { cardFrom: '#1B2434', cardTo: '#141B26', coinFrom: '#232E42', coinTo: '#1B2434', ringFrom: '#2A3A58', ringTo: '#1E2C46', euroColor: '#5FB394', cardShadow: '#9060D8' },
  light: { cardFrom: '#FFFFFF', cardTo: '#E8EFFE', coinFrom: '#FFFFFF', coinTo: '#EEF2FF', ringFrom: '#E0E8FF', ringTo: '#C8D8F8', euroColor: '#1B3A7A', cardShadow: '#8AAAD8' },
  eris:  { cardFrom: '#FFF6FA', cardTo: '#FEF0F5', coinFrom: '#FFF0F7', coinTo: '#FFE0EE', ringFrom: '#FFD6EA', ringTo: '#FFBAD8', euroColor: '#D4607A', cardShadow: '#E8A0B8' },
  gorka: { cardFrom: '#1B2434', cardTo: '#141B26', coinFrom: '#232E42', coinTo: '#1B2434', ringFrom: '#2A3A58', ringTo: '#1E2C46', euroColor: '#C084FC', cardShadow: '#9060D8' },
};

function buildFaviconSVG(theme) {
  const t = FAVICON_TOKENS[theme] ?? FAVICON_TOKENS.dark;
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${t.cardFrom}"/>
      <stop offset="100%" stop-color="${t.cardTo}"/>
    </linearGradient>
    <linearGradient id="g1" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#52E8A8"/><stop offset="100%" stop-color="#28B87A"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#3ED8E8"/><stop offset="100%" stop-color="#1A9ECC"/>
    </linearGradient>
    <linearGradient id="g3" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#60A8FF"/><stop offset="100%" stop-color="#1A5FE8"/>
    </linearGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.52)"/>
      <stop offset="55%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="bsh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.14)"/>
    </linearGradient>
    <linearGradient id="coinbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.coinFrom}"/>
      <stop offset="100%" stop-color="${t.coinTo}"/>
    </linearGradient>
    <linearGradient id="coinring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.ringFrom}"/>
      <stop offset="100%" stop-color="${t.ringTo}"/>
    </linearGradient>
    <filter id="cardshadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="20" stdDeviation="32" flood-color="${t.cardShadow}" flood-opacity="0.28"/>
    </filter>
    <filter id="bardepth" x="-20%" y="-10%" width="150%" height="130%">
      <feDropShadow dx="4" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.16"/>
    </filter>
    <filter id="coinshadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#5577BB" flood-opacity="0.22"/>
    </filter>
    <filter id="lineglow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dotglow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#fff" flood-opacity="0.9"/>
    </filter>
  </defs>
  <rect x="72" y="72" width="880" height="880" rx="196" fill="url(#bg)" filter="url(#cardshadow)"/>
  <g filter="url(#bardepth)">
    <rect x="230" y="530" width="155" height="325" rx="36" fill="url(#g1)"/>
    <rect x="230" y="530" width="155" height="325" rx="36" fill="url(#bsh)"/>
    <rect x="230" y="530" width="52"  height="325" rx="36" fill="url(#sh)" opacity="0.9"/>
  </g>
  <g filter="url(#bardepth)">
    <rect x="415" y="390" width="155" height="465" rx="36" fill="url(#g2)"/>
    <rect x="415" y="390" width="155" height="465" rx="36" fill="url(#bsh)"/>
    <rect x="415" y="390" width="52"  height="465" rx="36" fill="url(#sh)" opacity="0.9"/>
  </g>
  <g filter="url(#bardepth)">
    <rect x="600" y="210" width="160" height="645" rx="36" fill="url(#g3)"/>
    <rect x="600" y="210" width="160" height="645" rx="36" fill="url(#bsh)"/>
    <rect x="600" y="210" width="54"  height="645" rx="36" fill="url(#sh)" opacity="0.9"/>
  </g>
  <path d="M307 668 C390 600 460 450 492 432 C530 412 590 358 680 310" stroke="rgba(255,255,255,0.32)" stroke-width="32" fill="none" stroke-linecap="round" filter="url(#lineglow)"/>
  <path d="M307 668 C390 600 460 450 492 432 C530 412 590 358 680 310" stroke="white" stroke-width="18" fill="none" stroke-linecap="round"/>
  <circle cx="307" cy="668" r="30" fill="white" filter="url(#dotglow)"/>
  <circle cx="307" cy="668" r="15" fill="#3ABDE0"/>
  <circle cx="492" cy="432" r="30" fill="white" filter="url(#dotglow)"/>
  <circle cx="492" cy="432" r="15" fill="#3ABDE0"/>
  <circle cx="680" cy="310" r="30" fill="white" filter="url(#dotglow)"/>
  <circle cx="680" cy="310" r="15" fill="#4B8EF5"/>
  <g filter="url(#coinshadow)">
    <circle cx="724" cy="748" r="118" fill="url(#coinring)"/>
    <circle cx="724" cy="748" r="100" fill="url(#coinbg)"/>
    <circle cx="724" cy="748" r="100" fill="none" stroke="rgba(180,200,240,0.6)" stroke-width="2"/>
    <path d="M748 692 A62 62 0 1 0 748 804" fill="none" stroke="${t.euroColor}" stroke-width="28" stroke-linecap="round"/>
    <line x1="650" y1="732" x2="715" y2="732" stroke="${t.euroColor}" stroke-width="22" stroke-linecap="round"/>
    <line x1="650" y1="764" x2="715" y2="764" stroke="${t.euroColor}" stroke-width="22" stroke-linecap="round"/>
  </g>
</svg>`;
}

export function AppShell({ children }) {
  const theme = useFinanceStore((state) => state.settings.theme);
  const toggleTheme = useFinanceStore((state) => state.toggleTheme);
  const setTheme = useFinanceStore((state) => state.setTheme);
  const metrics = useFinanceStore((state) => state.derived.dashboard);
  const baseCurrency = useFinanceStore((state) => state.settings.baseCurrency);
  const supabaseUser = useFinanceStore((state) => state.supabaseUser);
  const supabaseConfigured = useFinanceStore((state) => state.supabaseConfigured);
  const signOutSupabase = useFinanceStore((state) => state.signOutSupabase);
  const locale = useMemo(() => 'de-AT', []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const gorkaBaseColor = useMemo(() => [0.427, 0, 1.0], []);

  const userHandle = supabaseUser?.email?.split('@')[0] ?? null;

  const isEris = supabaseUser?.email === 'erisbarrancop@gmail.com';
  const isGorka = supabaseUser?.email === 'gorkaaamendiola@gmail.com';
  const isPrivileged = isEris || isGorka;

  // One-time auto-init: when a special user logs in for the first time on this device,
  // save their theme so 'dark' and 'light' remain explicitly selectable afterward.
  useEffect(() => {
    if (!isEris && !isGorka) return;
    const initialized = localStorage.getItem('pft-theme-identity-set');
    if (initialized) return;
    if (isEris) setTheme('eris');
    else if (isGorka) setTheme('gorka');
    localStorage.setItem('pft-theme-identity-set', '1');
  }, [isEris, isGorka, setTheme]);

  // Simple: theme value is applied directly. No mapping.
  const appliedTheme = ['dark', 'light', 'eris', 'gorka'].includes(theme) ? theme : 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.body.dataset.theme = appliedTheme;
  }, [appliedTheme]);

  useEffect(() => {
    const favicon = buildFaviconSVG(appliedTheme);
    const encoded = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = encoded;
  }, [appliedTheme]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen">
      {/* Eris: falling sakura petals */}
      {appliedTheme === 'eris' && <SakuraPetals />}

      {/* Gorka: full-page liquid chrome background fixed behind everything.
          Background colour prevents the white flash before WebGL first renders. */}
      {appliedTheme === 'gorka' && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: '#060412' }}>
          <LiquidChrome baseColor={gorkaBaseColor} speed={0.12} amplitude={0.3} interactive={false} />
        </div>
      )}

      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-accent-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-wide items-center justify-between gap-6 px-4 lg:px-10">
          <div className="flex items-center gap-6 min-w-0">
            <Logo theme={appliedTheme} />
          </div>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'group relative inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-180',
                    isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="numeric text-[0.65rem] text-ink-faint">{link.num}</span>
                    <span className="font-sans">{link.label}</span>
                    <span
                      aria-hidden
                      className={cn(
                        'absolute bottom-0 left-3 right-3 h-px origin-center bg-accent transition-transform duration-220 ease-editorial',
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-baseline gap-2 border-l border-rule pl-4">
              <span className="eyebrow text-[0.6rem]">Net</span>
              <span className="numeric text-sm text-ink">
                {formatCurrency(metrics.netWorthCents, baseCurrency, locale)}
              </span>
            </div>

            {/* User pill + sign-out — only when Supabase auth is active */}
            {supabaseConfigured && supabaseUser && (
              <div className="hidden sm:flex items-center gap-2 border-l border-rule pl-3">
                <span
                  className="eyebrow text-[0.6rem] text-ink-faint max-w-[96px] truncate"
                  title={supabaseUser.email}
                >
                  {userHandle}
                </span>
                <button
                  type="button"
                  onClick={signOutSupabase}
                  aria-label="Sign out"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors duration-180 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <SignOutIcon />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={appliedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted transition-colors duration-180 hover:text-ink hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {appliedTheme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-rule bg-surface animate-rise">
            <nav aria-label="Primary mobile" className="mx-auto flex max-w-wide flex-col px-4 py-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 py-3 border-b border-rule last:border-b-0 transition-colors duration-120',
                      isActive ? 'text-ink' : 'text-ink-muted',
                    )
                  }
                >
                  <span className="numeric text-xs text-ink-faint w-6">{link.num}</span>
                  <span className="font-display text-lg">{link.label}</span>
                </NavLink>
              ))}
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-rule">
                <div className="flex items-baseline gap-2">
                  <span className="eyebrow text-[0.6rem]">Net worth</span>
                  <span className="numeric text-sm text-ink">
                    {formatCurrency(metrics.netWorthCents, baseCurrency, locale)}
                  </span>
                </div>
                {supabaseConfigured && supabaseUser && (
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); signOutSupabase(); }}
                    className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-danger transition-colors duration-180"
                  >
                    <SignOutIcon />
                    <span className="eyebrow text-[0.6rem]">Sign out</span>
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto max-w-wide px-4 py-10 lg:px-10 lg:py-14 overflow-x-clip">
        <div className="min-w-0">{children}</div>
      </main>

      <footer className="mx-auto max-w-wide border-t border-rule px-4 py-8 lg:px-10 mt-20">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <p className="font-display italic">Finance — a private ledger.</p>
          <p className="numeric text-ink-faint">
            {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date())}
          </p>
        </div>
      </footer>
    </div>
  );
}
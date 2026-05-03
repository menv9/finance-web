import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';

const LAST_UPDATED = 'May 2025';

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    icon: '◐',
    content: `This app is a local-first personal finance tracker. By design, your financial data lives on your device — it is never transmitted to our servers, never sold, and never used to build a profile about you. This policy explains what little data we do handle and why.`,
  },
  {
    id: 'data-collected',
    title: 'Data We Collect',
    icon: '↗',
    items: [
      {
        label: 'Nothing financial',
        body: 'Account balances, transactions, budgets, and goals are stored exclusively in your browser\'s local storage. We have no access to them.',
      },
      {
        label: 'Anonymous analytics (optional)',
        body: 'If you opt in, we collect aggregate usage signals — page views, feature interactions — to improve the product. No personally identifiable information is attached.',
      },
      {
        label: 'Error reports (optional)',
        body: 'Crash reports help us fix bugs. These contain stack traces and device metadata (browser version, OS). They are never linked to your identity.',
      },
      {
        label: 'Contact information',
        body: 'If you reach out to support via email, we retain your email address solely to respond to your inquiry.',
      },
    ],
  },
  {
    id: 'local-storage',
    title: 'Local Storage & Your Device',
    icon: '◇',
    content: `All financial data is persisted using your browser's IndexedDB and localStorage APIs. This means your data is stored on your own device, under your control. Clearing your browser data will erase it. We recommend using the built-in export feature to back up your data regularly.`,
  },
  {
    id: 'third-parties',
    title: 'Third-Party Services',
    icon: '→',
    items: [
      {
        label: 'Font delivery',
        body: 'We load fonts from Google Fonts. Google may log the request (IP address, browser headers) per their own privacy policy.',
      },
      {
        label: 'Hosting',
        body: 'The app is served via a CDN. Server access logs (IP, timestamp, URL) are retained for up to 30 days for security purposes and then deleted.',
      },
      {
        label: 'No advertising networks',
        body: 'We do not use advertising SDKs, tracking pixels, or any third-party analytics that monetise your behaviour.',
      },
    ],
  },
  {
    id: 'data-sharing',
    title: 'Data Sharing',
    icon: '⊕',
    content: `We do not sell, rent, or trade your personal information. We may disclose information only if required by law (e.g. a valid court order) or to protect the rights, property, or safety of users and the public. In such cases we will notify you unless prohibited by law.`,
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    icon: '◈',
    items: [
      { label: 'Access & portability', body: 'Export all your data at any time from Settings → Export Data.' },
      { label: 'Deletion', body: 'Clearing your browser data removes all financial data instantly. For any server-side records (error logs, support emails), contact us and we will delete them within 30 days.' },
      { label: 'Opt-out', body: 'Disable analytics and error reporting at any time from Settings → Privacy.' },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    icon: '○',
    content: `We use a single functional cookie to remember your theme preference across sessions. We do not use tracking cookies or third-party cookies. No cookie consent banner is required because we set no non-essential cookies.`,
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    icon: '↻',
    content: `We may update this policy as the product evolves. Material changes will be communicated via an in-app notice. The "Last updated" date at the top of this page always reflects the current version. Continued use after changes are posted constitutes acceptance.`,
  },
  {
    id: 'contact',
    title: 'Contact',
    icon: '✉',
    content: `Questions about this policy? Reach us at privacy@finges.xyz. We aim to respond within 5 business days.`,
  },
];

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy';
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="pp-root">
        {/* Nav */}
        <nav className="pp-nav">
          <Link to="/" className="pp-nav-back">
            <svg viewBox="0 0 16 16" className="pp-nav-arrow" fill="none" aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <Link to="/terms" className="pp-nav-link">Terms of Service →</Link>
        </nav>

        <main className="pp-main">
          {/* Header */}
          <header className="pp-header lp-rise lp-rise-1">
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>Legal</p>
            <h1 className="pp-title">Privacy Policy</h1>
            <p className="pp-subtitle">
              Your finances are yours. Here is exactly how we handle data — and what we deliberately don't collect.
            </p>
            <div className="pp-meta">
              <span className="pp-meta-badge">Last updated: {LAST_UPDATED}</span>
            </div>
          </header>

          {/* TL;DR callout */}
          <div className="pp-tldr lp-rise lp-rise-2">
            <span className="pp-tldr-label eyebrow">tl;dr</span>
            <p className="pp-tldr-text">
              Your financial data never leaves your device. We collect no personal information unless you opt in to anonymous analytics or contact support.
            </p>
          </div>

          {/* Sections */}
          <div className="pp-sections lp-rise lp-rise-3">
            {SECTIONS.map((section, i) => (
              <section key={section.id} id={section.id} className="pp-section">
                <div className="pp-section-header">
                  <span className="pp-section-icon" aria-hidden>{section.icon}</span>
                  <h2 className="pp-section-title">{section.title}</h2>
                </div>
                {section.content && (
                  <p className="pp-section-body">{section.content}</p>
                )}
                {section.items && (
                  <ul className="pp-item-list">
                    {section.items.map((item, j) => (
                      <li key={j} className="pp-item">
                        <span className="pp-item-label">{item.label}</span>
                        <span className="pp-item-body">{item.body}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Footer nav */}
          <footer className="pp-footer lp-rise lp-rise-4">
            <p className="lp-foot-tag">Your data. Your device. Your rules.</p>
            <div className="pp-footer-links">
              <Link to="/terms" className="lp-foot-link">Terms of Service</Link>
              <span className="lp-foot-meta">·</span>
              <Link to="/" className="lp-foot-link">← Back to Home</Link>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* ─── Rise animation (matches global) ────── */
@keyframes lp-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.lp-rise { opacity: 0; animation: lp-rise 640ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
.lp-rise-1 { animation-delay: 60ms; }
.lp-rise-2 { animation-delay: 140ms; }
.lp-rise-3 { animation-delay: 220ms; }
.lp-rise-4 { animation-delay: 320ms; }

/* ─── Layout ───────────────────────────── */
.pp-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.pp-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 52px;
  background: color-mix(in srgb, var(--canvas) 82%, transparent);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border-bottom: 1px solid var(--rule);
}

.pp-nav-back {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.85rem;
  color: var(--ink-muted);
  transition: color 180ms ease;
}
.pp-nav-back:hover { color: var(--ink); }
.pp-nav-arrow { width: 14px; height: 14px; }

.pp-nav-link {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--ink-faint);
  transition: color 180ms ease;
}
.pp-nav-link:hover { color: var(--accent); }

.pp-main {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  width: 100%;
}

/* ─── Header ───────────────────────────── */
.pp-header { margin-bottom: 2.5rem; }

.pp-title {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 144, 'SOFT' 0;
  font-weight: 400;
  font-size: clamp(2.4rem, 5vw, 3.5rem);
  letter-spacing: -0.03em;
  color: var(--ink);
  line-height: 1.05;
  margin-bottom: 1rem;
}

.pp-subtitle {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 1.05rem;
  color: var(--ink-muted);
  line-height: 1.6;
  max-width: 520px;
  margin-bottom: 1.25rem;
}

.pp-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pp-meta-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
}

/* ─── TL;DR ────────────────────────────── */
.pp-tldr {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 12px;
  margin-bottom: 3rem;
}

.pp-tldr-label {
  flex-shrink: 0;
  margin-top: 1px;
}

.pp-tldr-text {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.92rem;
  color: var(--ink);
  line-height: 1.55;
}

/* ─── Sections ─────────────────────────── */
.pp-sections {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.pp-section {
  padding: 2rem 0;
  border-bottom: 1px solid var(--rule);
}
.pp-section:last-child { border-bottom: none; }

.pp-section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.pp-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--rule-strong);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--ink-muted);
  background: var(--surface);
  flex-shrink: 0;
}

.pp-section-title {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 72;
  font-weight: 500;
  font-size: 1.15rem;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.pp-section-body {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.9375rem;
  color: var(--ink-muted);
  line-height: 1.65;
  padding-left: 2.5rem;
}

/* ─── Item list ────────────────────────── */
.pp-item-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pp-item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 1rem;
  align-items: baseline;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 8px;
}

.pp-item-label {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.01em;
}

.pp-item-body {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--ink-muted);
  line-height: 1.55;
}

/* ─── Footer ───────────────────────────── */
.pp-footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--rule);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.pp-footer-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* ─── Mobile ───────────────────────────── */
@media (max-width: 640px) {
  .pp-main { padding: 2.5rem 1.25rem 4rem; }
  .pp-nav { padding: 0 1.25rem; }
  .pp-item { grid-template-columns: 1fr; gap: 0.25rem; }
  .pp-item-list { padding-left: 0; }
  .pp-section-body { padding-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lp-rise { animation: none; opacity: 1; }
}
`;

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LAST_UPDATED = 'May 2025';

const SECTIONS = [
  {
    id: 'acceptance',
    icon: '◐',
    title: 'Acceptance of Terms',
    content: `By downloading, installing, or using FinGes, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the application. These terms apply to all users worldwide.`,
  },
  {
    id: 'description',
    icon: '↗',
    title: 'Description of Service',
    content: `This application is a personal finance management tool that operates locally on your device. Core features include account tracking, expense categorisation, budget management, savings goal tracking, investment portfolio monitoring, and financial reporting. The application is provided "as-is" and we reserve the right to modify, suspend, or discontinue any feature at any time.`,
  },
  {
    id: 'your-data',
    icon: '◇',
    title: 'Your Data & Responsibility',
    items: [
      {
        label: 'Data ownership',
        body: 'All financial data you enter belongs to you. We claim no ownership or rights over your personal financial information.',
      },
      {
        label: 'Data accuracy',
        body: 'You are responsible for the accuracy of data you enter. Financial figures, account balances, and transactions are only as reliable as the information you provide.',
      },
      {
        label: 'Backup responsibility',
        body: 'Because data is stored locally on your device, you are responsible for backing up your data using the export feature. We cannot recover data lost due to browser data clearing, device failure, or accidental deletion.',
      },
      {
        label: 'No financial advice',
        body: 'The application displays calculations and projections for informational purposes only. Nothing in this app constitutes financial, investment, legal, or tax advice. Consult a qualified professional before making financial decisions.',
      },
    ],
  },
  {
    id: 'acceptable-use',
    icon: '→',
    title: 'Acceptable Use',
    content: `You agree to use the application only for lawful personal finance management. You may not attempt to reverse-engineer, decompile, or tamper with the application; use it to facilitate illegal financial activity; or distribute it without our express written permission. Violation of these restrictions may result in termination of your access and legal action.`,
  },
  {
    id: 'disclaimer',
    icon: '⊕',
    title: 'Disclaimer of Warranties',
    content: `The application is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the application will be error-free, uninterrupted, or fit for any particular purpose. Financial projections and calculations are estimates only and should not be relied upon for binding financial decisions.`,
  },
  {
    id: 'liability',
    icon: '◈',
    title: 'Limitation of Liability',
    content: `To the fullest extent permitted by applicable law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of profits, data, or goodwill — arising from your use of or inability to use the application. Our total liability to you for any claim shall not exceed the amount you paid for the application in the 12 months preceding the claim.`,
  },
  {
    id: 'intellectual-property',
    icon: '○',
    title: 'Intellectual Property',
    content: `The application, its design, code, and all associated content are protected by copyright and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable licence to use the application for personal, non-commercial purposes. All rights not expressly granted are reserved.`,
  },
  {
    id: 'termination',
    icon: '↻',
    title: 'Termination',
    content: `You may stop using the application at any time by deleting it. We may terminate or suspend access for violation of these terms. Upon termination, provisions that by their nature should survive (Disclaimer, Limitation of Liability, Governing Law) remain in effect.`,
  },
  {
    id: 'governing-law',
    icon: '⚖',
    title: 'Governing Law',
    content: `These terms are governed by and construed in accordance with applicable laws. Any disputes shall be resolved through good-faith negotiation, and if unsuccessful, through binding arbitration in accordance with standard arbitration rules. You waive the right to participate in a class action lawsuit.`,
  },
  {
    id: 'changes',
    icon: '✦',
    title: 'Changes to Terms',
    content: `We may revise these terms at any time. We will notify you of material changes via an in-app notice. Your continued use of the application after changes take effect constitutes your acceptance of the revised terms. If you do not agree to the revised terms, please stop using the application and export your data.`,
  },
  {
    id: 'contact',
    icon: '✉',
    title: 'Contact',
    content: `Questions about these terms? Contact us at legal@finges.xyz. We will respond within 5 business days.`,
  },
];

export default function TermsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Service';
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="tp-root">
        {/* Nav */}
        <nav className="tp-nav">
          <Link to="/" className="tp-nav-back">
            <svg viewBox="0 0 16 16" className="tp-nav-arrow" fill="none" aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <Link to="/privacy" className="tp-nav-link">Privacy Policy →</Link>
        </nav>

        <main className="tp-main">
          {/* Header */}
          <header className="tp-header lp-rise lp-rise-1">
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>Legal</p>
            <h1 className="tp-title">Terms of Service</h1>
            <p className="tp-subtitle">
              Plain language. No legalese traps. Here is what you agree to when using FinGes.
            </p>
            <div className="tp-meta">
              <span className="tp-meta-badge">Last updated: {LAST_UPDATED}</span>
            </div>
          </header>

          {/* TL;DR */}
          <div className="tp-tldr lp-rise lp-rise-2">
            <span className="eyebrow tp-tldr-label">tl;dr</span>
            <p className="tp-tldr-text">
              Use the app honestly, don't rely on it as professional financial advice, and back up your data. That's the spirit of these terms.
            </p>
          </div>

          {/* Sections */}
          <div className="tp-sections lp-rise lp-rise-3">
            {SECTIONS.map((section, i) => (
              <section key={section.id} id={section.id} className="tp-section">
                <div className="tp-section-header">
                  <span className="tp-section-icon" aria-hidden>{section.icon}</span>
                  <h2 className="tp-section-title">{section.title}</h2>
                </div>
                {section.content && (
                  <p className="tp-section-body">{section.content}</p>
                )}
                {section.items && (
                  <ul className="tp-item-list">
                    {section.items.map((item, j) => (
                      <li key={j} className="tp-item">
                        <span className="tp-item-label">{item.label}</span>
                        <span className="tp-item-body">{item.body}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Footer */}
          <footer className="tp-footer lp-rise lp-rise-4">
            <p className="lp-foot-tag">Built with transparency in mind.</p>
            <div className="tp-footer-links">
              <Link to="/privacy" className="lp-foot-link">Privacy Policy</Link>
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

@keyframes lp-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.lp-rise { opacity: 0; animation: lp-rise 640ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
.lp-rise-1 { animation-delay: 60ms; }
.lp-rise-2 { animation-delay: 140ms; }
.lp-rise-3 { animation-delay: 220ms; }
.lp-rise-4 { animation-delay: 320ms; }

.tp-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.tp-nav {
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

.tp-nav-back {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.85rem;
  color: var(--ink-muted);
  transition: color 180ms ease;
}
.tp-nav-back:hover { color: var(--ink); }
.tp-nav-arrow { width: 14px; height: 14px; }

.tp-nav-link {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--ink-faint);
  transition: color 180ms ease;
}
.tp-nav-link:hover { color: var(--accent); }

.tp-main {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  width: 100%;
}

.tp-header { margin-bottom: 2.5rem; }

.tp-title {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 144, 'SOFT' 0;
  font-weight: 400;
  font-size: clamp(2.4rem, 5vw, 3.5rem);
  letter-spacing: -0.03em;
  color: var(--ink);
  line-height: 1.05;
  margin-bottom: 1rem;
}

.tp-subtitle {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 1.05rem;
  color: var(--ink-muted);
  line-height: 1.6;
  max-width: 520px;
  margin-bottom: 1.25rem;
}

.tp-meta { display: flex; align-items: center; gap: 0.75rem; }

.tp-meta-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
}

.tp-tldr {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: 12px;
  margin-bottom: 3rem;
}

.tp-tldr-label { flex-shrink: 0; margin-top: 1px; }

.tp-tldr-text {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.92rem;
  color: var(--ink);
  line-height: 1.55;
}

.tp-sections {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tp-section {
  padding: 2rem 0;
  border-bottom: 1px solid var(--rule);
}
.tp-section:last-child { border-bottom: none; }

.tp-section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.tp-section-icon {
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

.tp-section-title {
  font-family: 'Fraunces', serif;
  font-variation-settings: 'opsz' 72;
  font-weight: 500;
  font-size: 1.15rem;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.tp-section-body {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.9375rem;
  color: var(--ink-muted);
  line-height: 1.65;
  padding-left: 2.5rem;
}

.tp-item-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tp-item {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 1rem;
  align-items: baseline;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 8px;
}

.tp-item-label {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.01em;
}

.tp-item-body {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--ink-muted);
  line-height: 1.55;
}

.tp-footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--rule);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.tp-footer-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .tp-main { padding: 2.5rem 1.25rem 4rem; }
  .tp-nav { padding: 0 1.25rem; }
  .tp-item { grid-template-columns: 1fr; gap: 0.25rem; }
  .tp-item-list { padding-left: 0; }
  .tp-section-body { padding-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lp-rise { animation: none; opacity: 1; }
}
`;

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Contact — FinGes';
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('https://formsubmit.co/ajax/contact@finges.xyz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
          _captcha: 'false',
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="cp-root">
        <nav className="pp-nav">
          <Link to="/landing" className="pp-nav-back">
            <svg viewBox="0 0 16 16" className="pp-nav-arrow" fill="none" aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <Link to="/privacy" className="pp-nav-link">Privacy Policy →</Link>
        </nav>

        <main className="cp-main">
          <header className="cp-header lp-rise lp-rise-1">
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>Support</p>
            <h1 className="pp-title">Get in touch</h1>
            <p className="pp-subtitle">
              Questions, feedback, or just want to say hi? We read every message.
            </p>
          </header>

          {status === 'sent' ? (
            <div className="cp-success lp-rise lp-rise-2">
              <span className="cp-success-icon">✓</span>
              <div>
                <p className="cp-success-title">Message sent!</p>
                <p className="cp-success-body">We'll get back to you at {form.email} within a few business days.</p>
              </div>
            </div>
          ) : (
            <form className="cp-form lp-rise lp-rise-2" onSubmit={handleSubmit} noValidate>
              <div className="cp-row cp-row-2">
                <div className="cp-field">
                  <label className="cp-label" htmlFor="name">Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="cp-input"
                    placeholder="Your name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    disabled={status === 'sending'}
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="cp-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    disabled={status === 'sending'}
                  />
                </div>
              </div>

              <div className="cp-field">
                <label className="cp-label" htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  className="cp-input"
                  placeholder="What's this about?"
                  value={form.subject}
                  onChange={handleChange}
                  required
                  disabled={status === 'sending'}
                />
              </div>

              <div className="cp-field">
                <label className="cp-label" htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  className="cp-input cp-textarea"
                  placeholder="Tell us everything..."
                  value={form.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  disabled={status === 'sending'}
                />
              </div>

              {status === 'error' && (
                <p className="cp-error">Something went wrong. Try again or email us directly at contact@finges.xyz.</p>
              )}

              <button type="submit" className="cp-submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </main>
      </div>
    </>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500;600&display=swap');

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

@keyframes lp-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.lp-rise { opacity: 0; animation: lp-rise 640ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
.lp-rise-1 { animation-delay: 60ms; }
.lp-rise-2 { animation-delay: 140ms; }

.cp-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.cp-main {
  flex: 1;
  max-width: 680px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  width: 100%;
}

.cp-header { margin-bottom: 2.5rem; }

.cp-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cp-row {
  display: grid;
  gap: 1.25rem;
}
.cp-row-2 { grid-template-columns: 1fr 1fr; }

.cp-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.cp-label {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cp-input {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.9375rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  outline: none;
  resize: none;
}
.cp-input::placeholder { color: var(--ink-faint); }
.cp-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
.cp-input:disabled { opacity: 0.5; cursor: not-allowed; }

.cp-textarea { line-height: 1.6; }

.cp-submit {
  align-self: flex-start;
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--canvas);
  background: var(--ink);
  border: none;
  border-radius: 10px;
  padding: 0.75rem 1.75rem;
  cursor: pointer;
  transition: opacity 160ms ease, transform 120ms ease;
  margin-top: 0.25rem;
}
.cp-submit:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
.cp-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.cp-error {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.875rem;
  color: var(--red, #e53e3e);
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--red, #e53e3e) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--red, #e53e3e) 25%, transparent);
  border-radius: 8px;
}

.cp-success {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 12px;
}

.cp-success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 1rem;
  flex-shrink: 0;
}

.cp-success-title {
  font-family: 'Fraunces', serif;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 0.3rem;
}

.cp-success-body {
  font-family: 'Instrument Sans', sans-serif;
  font-size: 0.9rem;
  color: var(--ink-muted);
  line-height: 1.55;
}

@media (max-width: 560px) {
  .cp-main { padding: 2.5rem 1.25rem 4rem; }
  .cp-row-2 { grid-template-columns: 1fr; }
  .cp-submit { width: 100%; text-align: center; }
}

@media (prefers-reduced-motion: reduce) {
  .lp-rise { animation: none; opacity: 1; }
}
`;

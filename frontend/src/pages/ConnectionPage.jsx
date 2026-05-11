import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ConnectionPage.module.css';

function ConnectionPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ base_url: '', email: '', api_token: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/jira/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail?.message || data?.message || 'Connection failed.');
        return;
      }
      if (data.user) sessionStorage.setItem('jira_user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch {
      setError('Cannot reach the server. Check your network.');
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    if (loading) return;
    setModalOpen(false);
    setError('');
  }

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.heroGrid}>
        <div className={styles.heroLeft}>
          <div className={styles.taglineRow}>
            <div className={styles.taglineLine}></div>
            <span className={styles.taglineText}>BRIDGE · ANALYZE · RESOLVE</span>
          </div>
          <h1 className={styles.heroHeading}>
            Where<br />Software Tester<br />meets insight.
          </h1>
          <p className={styles.heroSubtext}>
            JIRA Bug Summary syncs your Jira workflow with a precision-built
            analytical engine—turning ticket noise into measurable velocity.
          </p>
        </div>

        <div className={styles.loginCard}>
          <div className={styles.appIconWrap}>
            <div className={styles.appIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2L4.09347 12.6879C3.74465 13.1064 3.57024 13.3157 3.56709 13.4925C3.56434 13.6461 3.63257 13.7923 3.75168 13.8889C3.88863 14 4.15924 14 4.70046 14H12L11 22L19.9065 11.3121C20.2554 10.8936 20.4298 10.6843 20.4329 10.5075C20.4357 10.3539 20.3674 10.2077 20.2483 10.1111C20.1114 10 19.8408 10 19.2995 10H12L13 2Z"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <h2 className={styles.cardTitle}>JIRA Bug Summary</h2>
          <p className={styles.cardSubtitle}>
            Bridge your Jira workflow with Jira Bug Summary analytical engine.
          </p>

          <button className={styles.ctaBtn} onClick={() => setModalOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Continue with Atlassian
          </button>

          <div className={styles.securityBadge}>
            <div className={styles.securityIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12L11 14L15 10M20.618 5.984C17.45 5.772 14.496 4.749 12 3C9.504 4.749 6.55 5.772 3.382 5.984C3.128 7.01 3 8.083 3 9.187C3 14.817 6.824 19.536 12 21C17.176 19.536 21 14.817 21 9.187C21 8.083 20.872 7.01 20.618 5.984Z"
                  stroke="rgba(27,67,50,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.securityText}>
              <strong>API Token + AES-256.</strong> Tokens are encrypted at rest.
              Your credentials never leave your server.
            </p>
          </div>

          <div className={styles.cardDivider}></div>
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerCopy}>© 2024 JIRA Bug Summary Enterprise. All rights reserved.</span>
        <nav className={styles.footerLinks}>
          <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Security</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Status</a>
        </nav>
      </footer>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Connect to Jira</h3>
              <p className={styles.modalSubtitle}>
                Enter your Jira credentials.{' '}
                <a
                  href="https://id.atlassian.com/manage/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.modalLink}
                >
                  Generate API token →
                </a>
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="base_url">Jira Base URL</label>
                <input
                  id="base_url"
                  name="base_url"
                  type="url"
                  className={styles.fieldInput}
                  placeholder="https://yourcompany.atlassian.net"
                  value={form.base_url}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  autoComplete="off"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={styles.fieldInput}
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="api_token">API Token</label>
                <input
                  id="api_token"
                  name="api_token"
                  type="password"
                  className={styles.fieldInput}
                  placeholder="Paste your API token"
                  value={form.api_token}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              {error && <p className={styles.modalError}>{error}</p>}

              <button
                type="submit"
                className={styles.modalSubmit}
                disabled={loading}
              >
                {loading ? (
                  <span className={styles.spinner} />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Connect
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionPage;

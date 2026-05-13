import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ConnectionPage.module.css';

const OAUTH_URL = 'http://localhost:8000/api/auth/atlassian';

const ERROR_MESSAGES = {
  oauth_not_configured: 'OAuth is not configured on the server.',
  invalid_state: 'Security check failed — please try again.',
  token_exchange_failed: 'Authorization failed — please try again.',
  resources_failed: 'Could not retrieve your Jira sites — please try again.',
  no_jira_access: 'Your Atlassian account has no accessible Jira sites.',
};

function ConnectionPage() {
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(ERROR_MESSAGES[err] || `Authentication error: ${err}`);
      window.history.replaceState({}, '', '/');
      setChecking(false);
      return;
    }
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          if (data.user) sessionStorage.setItem('jira_user', JSON.stringify(data.user));
          navigate('/dashboard', { replace: true });
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f9ff' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #c3c6d6', borderTopColor: '#065b41', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
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

          {error && <p className={styles.oauthError}>{error}</p>}

          <button className={styles.ctaBtn} onClick={() => { window.location.href = OAUTH_URL; }}>
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
              <strong>OAuth 2.0 + AES-256.</strong> Tokens are encrypted at rest.
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
    </div>
  );
}

export default ConnectionPage;

import { useState } from 'react';
import StatusBanner from '../StatusBanner/StatusBanner';
import SuccessModal from '../SuccessModal/SuccessModal';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import styles from './ConnectionForm.module.css';

const DEFAULT_FIELDS = { base_url: '', email: '', api_token: '' };

/**
 * ConnectionForm — 3-field form (D-01). Handles all connection states.
 * Props:
 *   initialError: {error: string, message: string} | null  — from App.jsx startup verify
 *   apiBase: string — e.g. "http://localhost:8000"
 */
function ConnectionForm({ initialError = null, apiBase = 'http://localhost:8000' }) {
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);   // {error: string, message: string} | null
  const [showSuccess, setShowSuccess] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null); // WR-05: clear stale error as soon as user edits
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/jira/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();

      if (!res.ok) {
        // D-11: preserve base_url and email; clear api_token on error
        setFields((prev) => ({ ...prev, api_token: '' }));
        // FastAPI error shape: {detail: {ok, error, message}}
        const errDetail = data.detail || data;
        setError({ error: errDetail.error || 'unknown', message: errDetail.message || 'An error occurred.' });
      } else {
        // D-10: show SuccessModal; auto-redirect handled inside modal
        setShowSuccess(true);
      }
    } catch {
      // Network error (backend unreachable)
      setFields((prev) => ({ ...prev, api_token: '' }));
      setError({ error: 'network_error', message: 'Cannot reach backend. Is the server running?' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showSuccess && <SuccessModal />}
      <div className={styles.loginCard}>
        {/* App icon */}
        <div className={styles.appIconWrap}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 4L4 28h8l4-8 4 8h8L16 4z" fill="#ffffff" />
          </svg>
        </div>

        <h2 className={styles.cardTitle}>JIRA Bug Summary</h2>
        <p className={styles.cardSubtitle}>Connect your Jira workspace to get started.</p>

        {/* Status banner — loading or error (D-11, D-12) */}
        {loading && (
          <StatusBanner variant="loading" message="Connecting to Jira…" />
        )}
        {!loading && error && (
          <StatusBanner variant="error" message={error.message} />
        )}

        <form onSubmit={handleSubmit} noValidate className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="base_url" className={styles.label}>Jira Base URL</label>
            <input
              id="base_url"
              name="base_url"
              type="url"
              className={styles.input}
              placeholder="https://yourcompany.atlassian.net"
              value={fields.base_url}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="url"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.input}
              placeholder="you@company.com"
              value={fields.email}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="api_token" className={styles.label}>API Token</label>
            <input
              id="api_token"
              name="api_token"
              type="password"
              className={styles.input}
              placeholder="••••••••••••"
              value={fields.api_token}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className={styles.ctaBtn}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={18} /> : null}
            Connect to Jira
          </button>
        </form>

        {/* Security badge */}
        <div className={styles.securityBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                  stroke="#1b4332" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span>Your API token is encrypted at rest and never shared.</span>
        </div>
      </div>
    </>
  );
}

export default ConnectionForm;

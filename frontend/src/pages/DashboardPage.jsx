import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import styles from './DashboardPage.module.css';

function DashboardPage() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const [projectKey, setProjectKey] = useState(() => {
    // Resolve active project from sessionStorage (set during NoProjectPage auto-sync)
    try { return sessionStorage.getItem('active_project_key') || ''; } catch { return ''; }
  });

  // Projects grid state
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  // Per-card bug stats: { [projectKey]: { open: number, critical: number, loading: boolean } }
  const [bugStats, setBugStats] = useState({});

  // Connect section state
  const [connectInput, setConnectInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState({ type: '', message: '' });
  // type: '' | 'loading' | 'success' | 'error'

  // Show inline fallback when arriving at /dashboard without a project selected
  const [noProjectWarning, setNoProjectWarning] = useState(false);
  useEffect(() => {
    if (!projectKey) {
      setNoProjectWarning(true);
    }
  }, [projectKey]);

  useEffect(() => {
    if (user) return;
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.user) {
          sessionStorage.setItem('jira_user', JSON.stringify(data.user));
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch /api/projects on mount
  useEffect(() => {
    setLoadingProjects(true);
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setProjects(data.projects);
        } else {
          setProjectsError('Could not load projects. Check your connection and reload.');
        }
      })
      .catch(() => {
        setProjectsError('Could not load projects. Check your connection and reload.');
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  // Fetch /api/bugs/{key} per project in parallel
  useEffect(() => {
    if (!projects.length) return;
    const initial = {};
    projects.forEach(p => { initial[p.key] = { open: 0, critical: 0, loading: true }; });
    setBugStats(initial);

    projects.forEach(project => {
      fetch(`/api/bugs/${project.key}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            const bugs = data.bugs;
            const open = bugs.filter(b =>
              ['open', 'to do'].includes((b.status || '').toLowerCase())
            ).length;
            const critical = bugs.filter(b =>
              ['critical', 'highest'].includes((b.priority || '').toLowerCase())
            ).length;
            setBugStats(prev => ({
              ...prev,
              [project.key]: { open, critical, loading: false }
            }));
          } else {
            setBugStats(prev => ({
              ...prev,
              [project.key]: { open: 0, critical: 0, loading: false }
            }));
          }
        })
        .catch(() => {
          setBugStats(prev => ({
            ...prev,
            [project.key]: { open: 0, critical: 0, loading: false }
          }));
        });
    });
  }, [projects]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('jira_user');
    window.location.href = '/';
  }

  async function handleSync() {
    if (!projectKey || syncing) return;
    setSyncing(true);
    setSyncError('');
    setSyncSuccess('');
    try {
      const resp = await fetch(`/api/sync/${projectKey}`, { method: 'POST' });
      const data = await resp.json();
      if (data.ok) {
        setLastSynced(data.synced_at);
        setSyncSuccess('Sync complete');
        // Re-fetch bugs for the active project and update its card stats
        if (projectKey) {
          fetch(`/api/bugs/${projectKey}`)
            .then(r => r.json())
            .then(d => {
              if (d.ok) {
                const bugs = d.bugs;
                const open = bugs.filter(b => ['open', 'to do'].includes((b.status || '').toLowerCase())).length;
                const critical = bugs.filter(b => ['critical', 'highest'].includes((b.priority || '').toLowerCase())).length;
                setBugStats(prev => ({ ...prev, [projectKey]: { open, critical, loading: false } }));
              }
            })
            .catch(() => {});
        }
        setTimeout(() => setSyncSuccess(''), 2000);
      } else {
        setSyncError('Sync failed. Try again or check your Jira connection.');
      }
    } catch {
      setSyncError('Sync failed. Try again or check your Jira connection.');
    } finally {
      setSyncing(false);
    }
  }

  function extractProjectKey(input) {
    const trimmed = input.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').filter(Boolean);
      return parts[parts.length - 1].toUpperCase();
    }
    return trimmed.toUpperCase();
  }

  async function handleConnect() {
    if (!connectInput.trim() || connecting) return;
    const key = extractProjectKey(connectInput);
    setConnecting(true);
    setConnectStatus({ type: 'loading', message: 'Connecting…' });
    try {
      const resp = await fetch(`/api/sync/${key}`, { method: 'POST' });
      const data = await resp.json();
      if (data.ok) {
        setConnectStatus({ type: 'success', message: `Project ${key} synced successfully.` });
        setConnectInput('');
        fetch('/api/projects')
          .then(r => r.json())
          .then(d => { if (d.ok) setProjects(d.projects); })
          .catch(() => {});
      } else {
        setConnectStatus({ type: 'error', message: `${data.detail || 'Sync failed'}. Check project key and try again.` });
      }
    } catch {
      setConnectStatus({ type: 'error', message: 'Connection failed. Check project key and try again.' });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#414944', background: '#f0f2f5', minHeight: '100vh' }}>
      <main className={styles.mainContent}>

        {/* PageHeader */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Active Projects</h1>
          <p className={styles.pageSubtitle}>
            Currently monitoring {projects.length} project(s).
          </p>
        </div>

        {/* SyncRow — keep existing Sync button block exactly as-is with all inline styles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSync}
            disabled={syncing || !projectKey}
            aria-busy={syncing}
            aria-disabled={syncing || !projectKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: syncing || !projectKey ? '#1b4332' : '#1b4332',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              minHeight: '48px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: syncing || !projectKey ? 'not-allowed' : 'pointer',
              opacity: syncing || !projectKey ? 0.7 : 1,
              transition: 'background 0.2s, transform 0.15s',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => { if (!syncing && projectKey) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {syncing && <LoadingSpinner size={16} />}
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {/* Last synced timestamp */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '24px' }}>
          {/* Clock icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#c3c6d6" strokeWidth="2"/>
            <polyline points="12 6 12 12 16 14" stroke="#c3c6d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>
            Last synced: {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}
          </span>
        </div>

        {/* noProjectWarning banner */}
        {noProjectWarning && !projectKey && (
          <div role="alert" style={{ fontSize: '13px', color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '8px 12px', marginBottom: '8px' }}>
            No project selected. <a href="/no-project" style={{ color: '#b45309', fontWeight: 700 }}>Go to project selection</a>
          </div>
        )}

        {/* Sync success inline message */}
        {syncSuccess && (
          <div
            role="alert"
            style={{
              background: 'rgba(227,239,234,0.6)',
              color: '#1b4332',
              fontSize: '13px',
              padding: '8px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
              display: 'inline-block',
            }}
          >
            {syncSuccess}
          </div>
        )}

        {/* Sync error banner */}
        {syncError && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '12px',
              padding: '8px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
            }}
          >
            {syncError}
          </div>
        )}

        {/* Existing user card — preserved unchanged */}
        {user ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            background: '#f0f7f4', border: '1px solid #c1e0d5',
            borderRadius: '10px', padding: '12px 18px', marginBottom: '24px',
          }}>
            {user.avatar && (
              <img src={user.avatar} alt="" width={36} height={36}
                style={{ borderRadius: '50%', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontWeight: 600, color: '#002d1c', fontSize: '15px' }}>{user.name}</div>
              <div style={{ fontSize: '13px', color: '#5a7a6a' }}>{user.email}</div>
            </div>
            <div style={{
              marginLeft: '8px', fontSize: '12px', color: '#1b7a4a',
              background: '#d1fae5', borderRadius: '6px', padding: '3px 10px', fontWeight: 500,
            }}>
              Connected
            </div>
            <button onClick={handleLogout} style={{
              marginLeft: '12px', fontSize: '13px', color: '#dc2626', background: 'none',
              border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 12px',
              cursor: 'pointer', fontWeight: 500,
            }}>
              Sign out
            </button>
          </div>
        ) : (
          <p style={{ marginBottom: '24px', color: '#8b9196' }}>Connecting to Jira…</p>
        )}

        {/* ProjectsGrid */}
        <div className={styles.projectsGrid}>
          {loadingProjects ? (
            <div className={styles.gridLoading}>
              <LoadingSpinner size={24} />
              <span>Loading projects…</span>
            </div>
          ) : projectsError ? (
            <div role="alert" className={styles.errorBanner}>{projectsError}</div>
          ) : projects.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyHeading}>No projects synced yet</p>
              <p className={styles.emptyBody}>Use the form below to add your first Jira project.</p>
            </div>
          ) : (
            projects.map(project => {
              const stats = bugStats[project.key] || { open: 0, critical: 0, loading: true };
              const hasCritical = !stats.loading && stats.critical > 0;
              return (
                <button
                  key={project.key}
                  className={styles.projectCard}
                  aria-label={`${project.name} — ${stats.loading ? 'loading' : `${stats.open} open bugs, ${stats.critical} critical`}`}
                  onClick={() => {
                    try { sessionStorage.setItem('active_project_key', project.key); } catch {}
                  }}
                >
                  <div className={`${styles.cardBar} ${hasCritical ? styles.barCritical : styles.barNormal}`} />
                  <div className={styles.cardContent}>
                    <div className={styles.cardHeader}>
                      <span className={styles.projectName}>{project.name}</span>
                      <span className={styles.projectCode}>{project.key}</span>
                    </div>
                    <div className={styles.statBoxes}>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>OPEN BUGS</span>
                        <span className={styles.statVal}>
                          {stats.loading ? '—' : stats.open}
                        </span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>CRITICAL</span>
                        <span className={`${styles.statVal} ${
                          stats.loading ? '' :
                          stats.critical === 0 ? styles.statZero :
                          styles.statCritical
                        }`}>
                          {stats.loading ? '—' : stats.critical}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ConnectSection */}
        <div className={styles.connectSection}>
          <div className={styles.connectLeft}>
            <div className={styles.connectIconWrap}>
              {/* Package/box SVG from dashboard.html */}
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="22.08" x2="12" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className={styles.connectTitle}>Connect to Jira</h3>
            <p className={styles.connectSubtitle}>Synchronize your existing Jira tickets and workflow seamlessly.</p>
          </div>

          <div className={styles.connectRight}>
            <h2 className={styles.addTitle}>Add New Project</h2>
            <p className={styles.addDesc}>
              Provide your Jira project key (e.g. SAM) to begin syncing.
              JIRA Bug Summary will pull all bugs from the project.
            </p>

            <label className={styles.inputLabel} htmlFor="jiraInput">Jira Project Link</label>
            <div className={styles.inputRow}>
              <input
                id="jiraInput"
                className={styles.jiraInput}
                type="text"
                placeholder="https://your-company.atlassian.net/projects/ABC"
                value={connectInput}
                onChange={e => setConnectInput(e.target.value)}
                disabled={connecting}
                aria-describedby="jiraInputHint jiraConnectStatus"
              />
              <button
                className={styles.btnConnect}
                onClick={handleConnect}
                disabled={connecting || !connectInput.trim()}
                aria-busy={connecting}
              >
                {connecting ? (
                  <><LoadingSpinner size={14} /> Connecting…</>
                ) : (
                  <>Connect Project
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M13 2L4.09347 12.6879C3.74465 13.1064 3.57024 13.3157 3.56709 13.4925C3.56434 13.6461 3.63257 13.7923 3.75168 13.8889C3.88863 14 4.15924 14 4.70046 14H12L11 22L19.9065 11.3121C20.2554 10.8936 20.4298 10.6843 20.4329 10.5075C20.4357 10.3539 20.3674 10.2077 20.2483 10.1111C20.1114 10 19.8408 10 19.2995 10H12L13 2Z"
                        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="white"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
            <p id="jiraInputHint" className={styles.inputHint}>
              Requires Jira project key (e.g. SAM, SCIL)
            </p>

            {connectStatus.message && (
              <p
                id="jiraConnectStatus"
                className={`${styles.connectStatus} ${styles[connectStatus.type]}`}
                role={connectStatus.type === 'error' ? 'alert' : 'status'}
              >
                {connectStatus.message}
              </p>
            )}

            <div className={styles.featuresDivider} />

            <div className={styles.features}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  {/* Auto-sync SVG from dashboard.html */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="1 20 1 14 7 14" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Auto-Syncing</span>
                  <p className={styles.featureDesc}>Real-time updates between tools.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  {/* Shield SVG from dashboard.html */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Enterprise Encryption</span>
                  <p className={styles.featureDesc}>256-bit AES for all data in transit.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default DashboardPage;

import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';

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
  const [bugs, setBugs] = useState([]);
  const [loadingBugs, setLoadingBugs] = useState(false);

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

  async function fetchBugs(key) {
    if (!key) return;
    setLoadingBugs(true);
    try {
      const resp = await fetch(`/api/bugs/${key}`);
      const data = await resp.json();
      if (data.ok) setBugs(data.bugs);
    } catch {}
    finally { setLoadingBugs(false); }
  }

  useEffect(() => { fetchBugs(projectKey); }, [projectKey]);

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
        fetchBugs(projectKey);
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

  const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#434654', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '10px 12px', color: '#002d1c', verticalAlign: 'middle' };
  const badgeStyle = { display: 'inline-block', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' };

  function statusColor(status) {
    switch ((status || '').toLowerCase()) {
      case 'done': case 'closed': case 'resolved': return { background: '#d1fae5', color: '#065f46' };
      case 'in progress': case 'in review': return { background: '#dbeafe', color: '#1e40af' };
      case 'open': case 'to do': return { background: '#f3f4f6', color: '#374151' };
      default: return { background: '#f3f4f6', color: '#374151' };
    }
  }

  function priorityColor(priority) {
    switch ((priority || '').toLowerCase()) {
      case 'highest': case 'critical': return { background: '#fee2e2', color: '#991b1b' };
      case 'high': return { background: '#ffedd5', color: '#9a3412' };
      case 'medium': return { background: '#fef9c3', color: '#854d0e' };
      case 'low': case 'lowest': return { background: '#f0f9ff', color: '#075985' };
      default: return { background: '#f3f4f6', color: '#374151' };
    }
  }

  return (
    <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif', color: '#414944' }}>

      {/* Page header: title + sync controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <h1 style={{ color: '#002d1c', margin: 0, fontSize: '32px', fontWeight: 700 }}>Dashboard</h1>
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

      {/* Bug list */}
      {loadingBugs ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
          <LoadingSpinner size={18} /> Loading bugs…
        </div>
      ) : bugs.length === 0 && projectKey ? (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>No bugs found for {projectKey}. Try syncing.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr style={{ background: '#f8f9ff', borderBottom: '2px solid #c3c6d6' }}>
                <th style={thStyle}>Key</th>
                <th style={thStyle}>Summary</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Sprint</th>
                <th style={thStyle}>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((bug, idx) => (
                <tr key={bug.issue_key} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8f9ff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: '#065b41', whiteSpace: 'nowrap' }}>{bug.issue_key}</span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '340px' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bug.summary}>
                      {bug.summary || '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, ...statusColor(bug.status) }}>{bug.status || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, ...priorityColor(bug.priority) }}>{bug.priority || '—'}</span>
                  </td>
                  <td style={tdStyle}>{bug.sprint_name || '—'}</td>
                  <td style={tdStyle}>{bug.assignee || 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>{bugs.length} issue{bugs.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;

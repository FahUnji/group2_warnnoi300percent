import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import Sidebar from '../components/Sidebar/Sidebar';
import styles from './SprintPage.module.css';

const SPRINTS_PER_PAGE = 10;

function sprintBadgeLabel(state) {
  if (state === 'active') return 'ACTIVE';
  if (state === 'upcoming') return 'UPCOMING';
  if (state === 'released') return 'COMPLETED';
  return 'ARCHIVED';
}

function SprintPage() {
  const [searchParams] = useSearchParams();
  const projectKey = searchParams.get('project') || '';

  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [syncedAt, setSyncedAt] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [stale, setStale] = useState(false);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const exportRef = useRef(null);

  // Close export menu on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (user) return;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (data.ok && data.user) {
          sessionStorage.setItem('jira_user', JSON.stringify(data.user));
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [user]);

  // Fetch project name from /api/projects
  useEffect(() => {
    if (!projectKey) return;
    fetch('/api/projects', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (data.ok && Array.isArray(data.projects)) {
          const match = data.projects.find(p => p.key === projectKey);
          if (match) setProjectName(match.name);
          else setProjectName(projectKey);
        }
      })
      .catch(() => setProjectName(projectKey));
  }, [projectKey]);

  async function fetchSprints() {
    setLoading(true);
    setError('');
    setErrorCode('');
    setStale(false);
    try {
      await fetch(`/api/sync/${encodeURIComponent(projectKey)}`, { method: 'POST', credentials: 'include' }).catch(() => {});
      const resp = await fetch(`/api/sprints/${encodeURIComponent(projectKey)}`, { credentials: 'include' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setErrorCode(err.detail?.error || '');
        setError(err.detail?.message || err.message || `HTTP ${resp.status} — could not load sprints.`);
        return;
      }
      const data = await resp.json();
      if (data.ok && Array.isArray(data.sprints)) {
        const stateOrder = { active: 0, upcoming: 1, released: 2, archived: 3 };
        const sorted = [...data.sprints].sort((a, b) => {
          const oa = stateOrder[a.state] ?? 3;
          const ob = stateOrder[b.state] ?? 3;
          if (oa !== ob) return oa - ob;
          return b.sprint_id - a.sprint_id;
        });
        setSprints(sorted);
        setSyncedAt(data.synced_at || null);
        setStale(data.stale === true);
        const activeIds = new Set(
          sorted.filter(s => s.state === 'active').map(s => s.sprint_id)
        );
        setExpandedIds(activeIds);
        setCurrentPage(1);
      } else {
        setError('Could not load sprints. Try refreshing.');
      }
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectKey) fetchSprints();
    else setLoading(false);
  }, [projectKey]);

  function formatSyncedAgo(isoString) {
    if (!isoString) return 'never';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  function toggleSprint(sprintId) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(sprintId)) next.delete(sprintId);
      else next.add(sprintId);
      return next;
    });
  }

  function calcProgress(found, resolved) {
    if (!found) return 0;
    return Math.round((resolved / found) * 100);
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function handleExport(format) {
    setExportOpen(false);
    setExportLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const url = `/api/export/sprint/${format}?project_key=${encodeURIComponent(projectKey)}`;
      const downloadName = `${projectKey}-all-sprints-${today}.${format}`;
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setError(err.detail?.message || err.message || 'Export failed. Please try again.');
        return;
      }
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    sessionStorage.removeItem('jira_user');
    window.location.href = '/';
  }

  function handleBackToDashboard() {
    setIsLeaving(true);
    setTimeout(() => { window.location.href = '/dashboard'; }, 280);
  }

  // Pagination
  const totalPages = Math.ceil(sprints.length / SPRINTS_PER_PAGE);
  const pagedSprints = sprints.slice(
    (currentPage - 1) * SPRINTS_PER_PAGE,
    currentPage * SPRINTS_PER_PAGE
  );

  function renderPagination() {
    if (totalPages <= 1) return null;

    const pages = [];
    // Build page number list with ellipsis
    const visiblePages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) visiblePages.push(i);
    } else {
      visiblePages.push(1);
      if (currentPage > 3) visiblePages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) visiblePages.push(i);
      if (currentPage < totalPages - 2) visiblePages.push('...');
      visiblePages.push(totalPages);
    }

    pages.push(
      <button
        key="prev"
        className={styles.pageBtn}
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </button>
    );

    visiblePages.forEach((p, idx) => {
      if (p === '...') {
        pages.push(
          <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>...</span>
        );
      } else {
        pages.push(
          <button
            key={p}
            className={`${styles.pageBtn}${currentPage === p ? ' ' + styles.active : ''}`}
            onClick={() => setCurrentPage(p)}
          >
            {p}
          </button>
        );
      }
    });

    pages.push(
      <button
        key="next"
        className={styles.pageBtn}
        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    );

    return <div className={styles.pagination}>{pages}</div>;
  }

  // No project key selected
  if (!projectKey) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>
        No project selected. Go to Dashboard and select a project.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#f0f2f5', minHeight: '100vh' }}>

      <Navbar user={user} onLogout={handleLogout} onMenuToggle={() => setSidebarOpen(v => !v)} menuOpen={sidebarOpen} onLogoClick={handleBackToDashboard} />

      <div className={styles.layout}>
        <Sidebar projectKey={projectKey} projectName={projectName} activePage="sprint" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLeaving={isLeaving} />

        <main className={`${styles.mainContent}${isLeaving ? ' ' + styles.mainContentLeaving : ''}`}>

          {/* Page header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Sprints</h1>
              <p className={styles.pageSubtitle}>
                {projectName || projectKey} &middot; {sprints.length} sprints &middot; Last synced {formatSyncedAgo(syncedAt)}
              </p>
            </div>
            <div className={styles.pageHeaderRight}>
              {/* Export dropdown */}
              <div className={styles.exportWrap} ref={exportRef}>
                <button
                  className={styles.btnOutline}
                  onClick={() => setExportOpen(v => !v)}
                  disabled={exportLoading}
                  aria-expanded={exportOpen}
                  aria-haspopup="true"
                >
                  {exportLoading ? 'Exporting...' : 'Export Report'}
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                    <path d="M1 1L5 5L9 1" stroke="#065b41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className={`${styles.exportMenu}${exportOpen ? ' ' + styles.exportMenuOpen : ''}`} role="menu">
                  <button
                    className={styles.exportItem}
                    role="menuitem"
                    onClick={() => handleExport('docx')}
                  >
                    <div className={styles.exportItemIcon}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="14 2 14 8 20 8" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="16" y1="13" x2="8" y2="13" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="16" y1="17" x2="8" y2="17" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className={styles.exportItemText}>
                      <span className={styles.exportItemLabel}>Export as Word</span>
                      <span className={styles.exportItemExt}>(.docx)</span>
                    </div>
                  </button>
                  <button
                    className={styles.exportItem}
                    role="menuitem"
                    onClick={() => handleExport('xlsx')}
                  >
                    <div className={styles.exportItemIcon}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#374151" strokeWidth="2"/>
                        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className={styles.exportItemText}>
                      <span className={styles.exportItemLabel}>Export as Excel</span>
                      <span className={styles.exportItemExt}>(.xlsx)</span>
                    </div>
                  </button>
                </div>
              </div>

              <button className={styles.btnPrimary} onClick={fetchSprints} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              {error}
              {errorCode === 'invalid_credentials' && (
                <a href="/" className={styles.reconnectLink}>Reconnect</a>
              )}
            </div>
          )}

          {/* Stale data warning */}
          {stale && (
            <div className={styles.staleBanner} role="status">
              Showing cached data — could not reach Jira. Click Refresh Data to retry.
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className={styles.emptyState}>Loading sprints...</div>
          )}

          {/* Sprint list */}
          {!loading && !error && sprints.length === 0 && (
            <div className={styles.emptyState}>No sprints found for this project.</div>
          )}

          {!loading && sprints.length > 0 && (
            <>
              <div className={styles.sprintList}>
                {pagedSprints.map(s => {
                  const isExpanded = expandedIds.has(s.sprint_id);
                  const isActive = s.state === 'active';
                  const isDone = s.state !== 'active';
                  const pct = calcProgress(s.found, s.resolved);
                  const dateRange = (s.start_date || s.end_date)
                    ? `${formatDate(s.start_date)} – ${formatDate(s.end_date)}`
                    : '';

                  return (
                    <div
                      key={s.sprint_id}
                      className={`${styles.sprintCard}${isExpanded ? ' ' + styles.expanded : ''}`}
                    >
                      <button
                        className={styles.sprintRow}
                        onClick={() => toggleSprint(s.sprint_id)}
                        aria-expanded={isExpanded}
                      >
                        <div className={styles.sprintIdentity}>
                          <div className={`${styles.sprintBar} ${isActive ? styles.barActive : styles.barDone}`} />
                          <div className={styles.sprintMeta}>
                            <span className={styles.sprintName}>{s.sprint_name}</span>
                            {dateRange && (
                              <span className={styles.sprintDates}>{dateRange}</span>
                            )}
                          </div>
                          <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeDone}`}>
                            {sprintBadgeLabel(s.state)}
                          </span>
                        </div>

                        <div className={styles.sprintStatsMini}>
                          <div className={styles.statMini}>
                            <span className={styles.statMiniLabel}>Found</span>
                            <span className={styles.statMiniVal}>{s.found}</span>
                          </div>
                          <div className={styles.statMini}>
                            <span className={styles.statMiniLabel}>Resolved</span>
                            <span className={`${styles.statMiniVal} ${styles.valResolved}`}>{s.resolved}</span>
                          </div>
                        </div>

                        <div className={styles.sprintProgressWrap}>
                          <div className={styles.progressLabels}>
                            <span className={styles.progressLabel}>Progress</span>
                            <span className={pct === 100 ? styles.progressPctComplete : isActive ? styles.progressPct : styles.progressPctFull}>
                              {pct}%
                            </span>
                          </div>
                          <div className={styles.progressTrack}>
                            <div
                              className={`${styles.progressFill}${pct === 100 ? ' ' + styles.progressFillComplete : isDone ? ' ' + styles.progressFillDone : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <span
                          className={`${styles.chevron}${!isExpanded ? ' ' + styles.chevronRight : ''}`}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" fill="none">
                            <path d="M1 1L6 6L11 1" stroke="#434654" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </button>

                      {/* Expanded detail — always rendered, controlled by CSS */}
                      <div className={styles.sprintDetail}>
                        <div className={styles.detailHeader}>
                          <span className={styles.detailHeading}>Bug Severity Distribution</span>
                        </div>
                        <div className={styles.severityCards}>
                          <div className={styles.severityItem}>
                            <div className={styles.severityIndicator} style={{ background: '#dc2626' }} />
                            <div className={styles.severityBody}>
                              <span className={styles.severityLabel}>Critical</span>
                              <span className={styles.severityVal}>{s.critical}</span>
                            </div>
                          </div>
                          <div className={styles.severityItem}>
                            <div className={styles.severityIndicator} style={{ background: '#f59e0b' }} />
                            <div className={styles.severityBody}>
                              <span className={styles.severityLabel}>High</span>
                              <span className={styles.severityVal}>{s.high}</span>
                            </div>
                          </div>
                          <div className={styles.severityItem}>
                            <div className={styles.severityIndicator} style={{ background: '#eab308' }} />
                            <div className={styles.severityBody}>
                              <span className={styles.severityLabel}>Medium</span>
                              <span className={styles.severityVal}>{s.medium}</span>
                            </div>
                          </div>
                          <div className={styles.severityItem}>
                            <div className={styles.severityIndicator} style={{ background: '#a5b4fc' }} />
                            <div className={styles.severityBody}>
                              <span className={styles.severityLabel}>Low</span>
                              <span className={styles.severityVal}>{s.low}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {renderPagination()}
            </>
          )}

        </main>
      </div>
    </div>
  );
}

export default SprintPage;

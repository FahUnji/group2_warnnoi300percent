import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import Sidebar from '../components/Sidebar/Sidebar';
import styles from './BugReportPage.module.css';

const DONE_KEYWORDS = ['done', 'closed', 'resolved', "won't fix", 'wontfix', 'duplicate', 'fixed'];
const IN_PROGRESS_KEYWORDS = ['progress', 'review', 'testing', 'development', 'in dev'];

function isResolved(status) {
  const s = (status || '').toLowerCase();
  return DONE_KEYWORDS.some(k => s.includes(k));
}

function isInProgress(status) {
  if (isResolved(status)) return false;
  const s = (status || '').toLowerCase();
  return IN_PROGRESS_KEYWORDS.some(k => s.includes(k));
}

const P_CIRCUMFERENCE = 653.45; // r=104
const S_CIRCUMFERENCE = 502.65; // r=80

function calcArcs(counts, keys, circumference) {
  const total = keys.reduce((s, k) => s + (counts[k] || 0), 0);
  if (!total) return keys.map(k => ({ key: k, pct: 0, dash: 0, offset: 0 }));
  let cumDash = 0;
  return keys.map(key => {
    const pct = (counts[key] || 0) / total;
    const dash = pct * circumference;
    const arc = { key, pct: Math.round(pct * 100), dash, offset: -cumDash };
    cumDash += dash;
    return arc;
  });
}

const P_COLORS = { critical: '#ba1a1a', high: '#f57c00', medium: '#fbc02d', low: '#b2c5ff' };
const S_COLORS = { todo: '#d1d5db', inProgress: '#f59e0b', done: '#065b41' };

function BugReportPage() {
  const [searchParams] = useSearchParams();
  const projectKey = searchParams.get('project') || '';

  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [projectFullName, setProjectFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [animated, setAnimated] = useState(false);
  const [donutTip, setDonutTip] = useState({ visible: false, label: '', pct: 0, color: '', x: 0, y: 0 });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const exportRef = useRef(null);

  useEffect(() => {
    if (user) return;
    fetch('/api/auth/me')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (data.ok && data.user) {
          sessionStorage.setItem('jira_user', JSON.stringify(data.user));
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (projectKey) fetchStats();
    else setLoading(false);
  }, [projectKey]);

  useEffect(() => {
    if (!projectKey) return;
    fetch(`/api/projects/${encodeURIComponent(projectKey)}`)
      .then(r => r.json())
      .then(data => { if (data.ok && data.project_name) setProjectFullName(data.project_name); })
      .catch(() => {});
  }, [projectKey]);

  async function fetchStats() {
    setLoading(true);
    setAnimated(false);
    setError('');
    try {
      // Sync from Jira before reading local DB
      await fetch(`/api/sync/${encodeURIComponent(projectKey)}`, { method: 'POST' }).catch(() => {});
      const r = await fetch(`/api/bugs/${encodeURIComponent(projectKey)}`);
      const data = await r.json();
      if (!r.ok) {
        setError(data?.message || 'Failed to load bug report.');
        return;
      }
      const bugs = data.bugs || [];
      const total = bugs.length;

      const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      const statusCounts = { todo: 0, inProgress: 0, done: 0 };

      bugs.forEach(b => {
        const p = (b.priority || '').toLowerCase();
        if (p.includes('critical') || p.includes('blocker')) priorityCounts.critical++;
        else if (p.includes('high') || p.includes('major')) priorityCounts.high++;
        else if (p.includes('medium') || p.includes('normal') || p.includes('minor')) priorityCounts.medium++;
        else priorityCounts.low++;

        if (isResolved(b.status)) statusCounts.done++;
        else if (isInProgress(b.status)) statusCounts.inProgress++;
        else statusCounts.todo++;
      });

      setStats({ total, open: total - statusCounts.done, resolved: statusCounts.done, priorityCounts, statusCounts });
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function handler(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleExport(format) {
    setExportOpen(false);
    setExportLoading(true);
    try {
      const url = `/api/export/bugs/${format}?project_key=${encodeURIComponent(projectKey)}`;
      const r = await fetch(url);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setError(err.detail?.message || err.message || 'Export failed. Please try again.');
        return;
      }
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `${projectKey}-bug-report-${today}.${format}`;
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

  function handleLogout() {
    sessionStorage.clear();
    window.location.href = '/';
  }

  function handleBackToDashboard() {
    setIsLeaving(true);
    setTimeout(() => { window.location.href = '/dashboard'; }, 280);
  }

  function showTip(e, label, pct, color) {
    setDonutTip({ visible: true, label, pct, color, x: e.clientX, y: e.clientY });
  }
  function moveTip(e) {
    setDonutTip(t => ({ ...t, x: e.clientX, y: e.clientY }));
  }
  function hideTip() {
    setDonutTip(t => ({ ...t, visible: false }));
  }

  const pArcs = stats ? calcArcs(stats.priorityCounts, ['critical', 'high', 'medium', 'low'], P_CIRCUMFERENCE) : [];
  const sArcs = stats ? calcArcs(stats.statusCounts, ['todo', 'inProgress', 'done'], S_CIRCUMFERENCE) : [];
  const doneArc = sArcs.find(a => a.key === 'done');

  return (
    <div className={styles.root}>
      <Navbar user={user} onLogout={handleLogout} onMenuToggle={() => setSidebarOpen(v => !v)} menuOpen={sidebarOpen} onLogoClick={handleBackToDashboard} />

      <div className={styles.layout}>
        <Sidebar projectKey={projectKey} projectName={projectFullName} activePage="bug-report" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLeaving={isLeaving} />

        <main className={`${styles.mainContent}${isLeaving ? ' ' + styles.mainContentLeaving : ''}`}>
          <div className={styles.pageHeader}>
            <div className={styles.pageHeaderLeft}>
              <h1 className={styles.pageTitle}>Bug Report Summary</h1>
              <p className={styles.pageSubtitle}>
                {projectKey ? `Real-time status of ${projectKey} project` : 'No project selected'} 
              </p>
            </div>
            <div className={styles.pageHeaderRight}>
              <div className={styles.exportWrap} ref={exportRef}>
                <button className={styles.btnOutline} onClick={() => setExportOpen(v => !v)} disabled={exportLoading} aria-expanded={exportOpen}>
                  {exportLoading ? 'Exporting...' : 'Export Report'}
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="#065b41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {exportOpen && (
                  <div className={styles.exportMenu}>
                    <button className={styles.exportItem} onClick={() => handleExport('docx')}>
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
                    <button className={styles.exportItem} onClick={() => handleExport('xlsx')}>
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
                )}
              </div>
              <button className={styles.btnPrimary} onClick={fetchStats}>Refresh Data</button>
            </div>
          </div>

          {error && <div className={styles.errorBanner} role="alert">{error}</div>}

          {!projectKey ? (
            <div className={styles.emptyState}>No project selected. Navigate from the Dashboard.</div>
          ) : loading ? (
            <div className={styles.loadingState}>Loading bug data…</div>
          ) : stats ? (
            <>
              <div className={styles.statRow}>
                <div className={styles.statCard} style={{ '--card-index': 0 }}>
                  <div className={styles.statCardTop}>
                    <span className={styles.statCardLabel}>Total Bugs</span>
                    <div className={`${styles.statIcon} ${styles.statIconBug}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M8 2l1.5 1.5M16 2l-1.5 1.5M12 6a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0v-4a4 4 0 0 0-4-4zM4 10h2M18 10h2M4 14h2M18 14h2M8 20l-1.5 1.5M16 20l1.5 1.5" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9.5 3.5A3.5 3.5 0 0 1 12 3a3.5 3.5 0 0 1 2.5.5" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className={`${styles.statCardValue} ${styles.valRed}`}>{stats.total.toLocaleString()}</div>
                </div>

                <div className={styles.statCard} style={{ '--card-index': 1 }}>
                  <div className={styles.statCardTop}>
                    <span className={styles.statCardLabel}>Open</span>
                    <div className={`${styles.statIcon} ${styles.statIconOpen}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="2"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="9" y1="9" x2="9.01" y2="9" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                        <line x1="15" y1="9" x2="15.01" y2="9" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className={`${styles.statCardValue} ${styles.valOrange}`}>{stats.open.toLocaleString()}</div>
                  <p className={styles.statCardSub}>Active development queue</p>
                </div>

                <div className={styles.statCard} style={{ '--card-index': 2 }}>
                  <div className={styles.statCardTop}>
                    <span className={styles.statCardLabel}>Resolved</span>
                    <div className={`${styles.statIcon} ${styles.statIconResolved}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="22 4 12 14.01 9 11.01" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className={`${styles.statCardValue} ${styles.valDark}`}>{stats.resolved.toLocaleString()}</div>
                  {stats.total > 0 && (
                    <p className={`${styles.statCardSub} ${styles.subGreen}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <polyline points="20 6 9 17 4 12" stroke="#065b41" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {Math.round((stats.resolved / stats.total) * 100)}% completion rate
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.chartsRow}>
                <div className={`${styles.chartCard} ${styles.chartPriority}`} style={{ '--chart-index': 0 }}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Bugs by Priority</h3>
                    <div className={styles.priorityLegend}>
                      {['critical', 'high', 'medium', 'low'].map(k => (
                        <span key={k} className={styles.legendItem}>
                          <span className={`${styles.dot} ${styles['dot' + k.charAt(0).toUpperCase() + k.slice(1)]}`} />
                          {k.charAt(0).toUpperCase() + k.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.chartBody}>
                    <div className={styles.donutWrap}>
                      <svg viewBox="0 0 240 240" width="240" height="240">
                        <circle cx="120" cy="120" r="104" fill="none" stroke="#f3f4f6" strokeWidth="28"/>
                        {pArcs.map(arc => arc.dash > 0 && (
                          <circle key={arc.key} cx="120" cy="120" r="104" fill="none"
                            stroke={P_COLORS[arc.key]}
                            strokeWidth="28"
                            strokeDasharray={`${animated ? arc.dash : 0} ${P_CIRCUMFERENCE}`}
                            strokeDashoffset={arc.offset}
                            transform="rotate(-90 120 120)"
                            className={styles.donutArc}
                            onMouseEnter={e => showTip(e, arc.key.charAt(0).toUpperCase() + arc.key.slice(1), arc.pct, P_COLORS[arc.key])}
                            onMouseMove={moveTip}
                            onMouseLeave={hideTip}
                          />
                        ))}
                      </svg>
                      <div className={styles.donutCenter}>
                        <span className={`${styles.donutValue} ${styles.donutRed}`}>{stats.total.toLocaleString()}</span>
                        <span className={styles.donutLabel}>Total Bugs</span>
                      </div>
                    </div>
                    <div className={styles.priorityStats}>
                      {pArcs.map(arc => (
                        <div key={arc.key} className={styles.priorityItem}>
                          <span className={`${styles.dot} ${styles['dot' + arc.key.charAt(0).toUpperCase() + arc.key.slice(1)]}`} />
                          <span className={styles.priorityName}>{arc.key.charAt(0).toUpperCase() + arc.key.slice(1)}</span>
                          <span className={styles.priorityPct}>{arc.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${styles.chartCard} ${styles.chartStatus}`} style={{ '--chart-index': 1 }}>
                  <h3 className={styles.chartTitle}>Status Distribution</h3>
                  <div className={styles.statusChartBody}>
                    <div className={styles.donutWrap}>
                      <svg viewBox="0 0 192 192" width="160" height="160">
                        <circle cx="96" cy="96" r="80" fill="none" stroke="#e7f4f0" strokeWidth="16"/>
                        {sArcs.map(arc => arc.dash > 0 && (
                          <circle key={arc.key} cx="96" cy="96" r="80" fill="none"
                            stroke={S_COLORS[arc.key]}
                            strokeWidth="16"
                            strokeDasharray={`${animated ? arc.dash : 0} ${S_CIRCUMFERENCE}`}
                            strokeDashoffset={arc.offset}
                            transform="rotate(-90 96 96)"
                            className={styles.donutArc}
                            onMouseEnter={e => showTip(e, arc.key === 'todo' ? 'To Do' : arc.key === 'inProgress' ? 'In Progress' : 'Done', arc.pct, S_COLORS[arc.key])}
                            onMouseMove={moveTip}
                            onMouseLeave={hideTip}
                          />
                        ))}
                      </svg>
                      <div className={styles.donutCenter}>
                        <span className={`${styles.donutValue} ${styles.donutDark}`}>{doneArc?.pct ?? 0}%</span>
                        <span className={styles.donutLabel}>Done</span>
                      </div>
                    </div>
                    <div className={styles.statusLegend}>
                      {sArcs.map(arc => (
                        <div key={arc.key} className={styles.statusItem}>
                          <span className={`${styles.dot} ${styles['dot' + arc.key.charAt(0).toUpperCase() + arc.key.slice(1)]}`} />
                          <span className={styles.statusName}>
                            {arc.key === 'todo' ? 'To Do' : arc.key === 'inProgress' ? 'In Progress' : 'Done'}
                          </span>
                          <span className={`${styles.statusPct}${arc.key === 'done' ? ' ' + styles.pctGreen : ''}`}>{arc.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      {donutTip.visible && (
        <div
          className={styles.donutTooltip}
          style={{ left: donutTip.x + 14, top: donutTip.y - 10, borderLeft: `3px solid ${donutTip.color}` }}
        >
          {donutTip.label} · {donutTip.pct}%
        </div>
      )}
    </div>
  );
}

export default BugReportPage;

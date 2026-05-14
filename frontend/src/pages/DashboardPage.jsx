import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import Navbar from '../components/Navbar/Navbar';
import styles from './DashboardPage.module.css';

function DashboardPage() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  const [bugStats, setBugStats] = useState({});

  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addSyncing, setAddSyncing] = useState(false);
  const [addSelectedKey, setAddSelectedKey] = useState('');
  const [addError, setAddError] = useState('');

  const [openCardMenu, setOpenCardMenu] = useState(null);
  const [removingKey, setRemovingKey] = useState(null);
  const [syncingKey, setSyncingKey] = useState(null);
  const [isLeavingDashboard, setIsLeavingDashboard] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addSearchRef = useRef(null);

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

  useEffect(() => {
    setLoadingProjects(true);
    fetch('/api/projects', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (data.ok && Array.isArray(data.projects)) setProjects(data.projects);
        else setProjectsError('Could not load projects. Check your connection and reload.');
      })
      .catch(() => setProjectsError('Could not load projects. Check your connection and reload.'))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!projects.length) return;
    const initial = {};
    projects.forEach(p => { initial[p.key] = { total: 0, open: 0, critical: 0, loading: true }; });
    setBugStats(initial);
    projects.forEach(project => {
      fetch(`/api/bugs/${project.key}`, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => {
          if (data.ok) {
            const bugs = data.bugs;
            const total = bugs.length;
            const isNotDone = b => (b.status || '').toLowerCase() !== 'done';
            const open = bugs.filter(isNotDone).length;
            const critical = bugs.filter(b =>
              isNotDone(b) &&
              ['critical', 'highest'].includes((b.priority || '').toLowerCase())
            ).length;
            setBugStats(prev => ({ ...prev, [project.key]: { total, open, critical, loading: false } }));
          } else {
            setBugStats(prev => ({ ...prev, [project.key]: { total: 0, open: 0, critical: 0, loading: false } }));
          }
        })
        .catch(() => setBugStats(prev => ({ ...prev, [project.key]: { total: 0, open: 0, critical: 0, loading: false } })));
    });
  }, [projects]);

  // Debounced search for Add Project section
  useEffect(() => {
    if (!addQuery.trim()) {
      setAddResults([]);
      setShowAddDropdown(false);
      return;
    }
    setShowAddDropdown(true);
    const timer = setTimeout(() => {
      setAddLoading(true);
      fetch(`/api/projects/search?q=${encodeURIComponent(addQuery)}`, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { if (data.ok) setAddResults(data.projects); })
        .catch(() => {})
        .finally(() => setAddLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [addQuery]);

  // Close dropdown / user menu on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (addSearchRef.current && !addSearchRef.current.contains(e.target)) setShowAddDropdown(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Close card kebab menu on outside click
  useEffect(() => {
    if (!openCardMenu) return;
    function close() { setOpenCardMenu(null); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openCardMenu]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    sessionStorage.removeItem('jira_user');
    window.location.href = '/';
  }

  async function handleAddProject(project) {
    if (addSyncing) return;
    setAddSelectedKey(project.key);
    setAddSyncing(true);
    setAddError('');
    try {
      const resp = await fetch(`/api/sync/${project.key}`, { method: 'POST', credentials: 'include' });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      if (data.ok) {
        setAddQuery('');
        setAddResults([]);
        const r = await fetch('/api/projects', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d.ok && Array.isArray(d.projects)) setProjects(d.projects);
      } else {
        setAddError('Sync failed. Select the project again to retry.');
        setAddSelectedKey('');
      }
    } catch {
      setAddError('Sync failed. Select the project again to retry.');
      setAddSelectedKey('');
    } finally {
      setAddSyncing(false);
    }
  }

  async function handleSyncProject(key) {
    setOpenCardMenu(null);
    setSyncingKey(key);
    try {
      await fetch(`/api/sync/${key}`, { method: 'POST', credentials: 'include' });
      const r = await fetch(`/api/bugs/${key}`, { credentials: 'include' });
      const data = await r.json();
      if (data.ok) {
        const bugs = data.bugs || [];
        const isNotDone = b => (b.status || '').toLowerCase() !== 'done';
        const total = bugs.length;
        const open = bugs.filter(isNotDone).length;
        const critical = bugs.filter(b =>
          isNotDone(b) && ['critical', 'highest'].includes((b.priority || '').toLowerCase())
        ).length;
        setBugStats(prev => ({ ...prev, [key]: { total, open, critical, loading: false } }));
      }
    } catch {
      // silent — stale stats remain visible
    } finally {
      setSyncingKey(null);
    }
  }

  async function handleDeleteProject(key) {
    setOpenCardMenu(null);
    try {
      const resp = await fetch(`/api/projects/${key}`, { method: 'DELETE', credentials: 'include' });
      if (!resp.ok) {
        return;
      }
      const remaining = projects.filter(p => p.key !== key);
      setRemovingKey(key);
      if (remaining.length === 0) {
        // card exit → then main content exit → then switch to no-project
        setTimeout(() => setIsLeavingDashboard(true), 240);
        setTimeout(() => {
          setProjects([]);
          setRemovingKey(null);
          setIsLeavingDashboard(false);
        }, 560);
      } else {
        setTimeout(() => {
          setProjects(remaining);
          setRemovingKey(null);
        }, 260);
      }
    } catch {
      setRemovingKey(null);
    }
  }

  return (
    <div className={styles.pageWrapper}>

      <Navbar user={user} onLogout={handleLogout} />

      {loadingProjects ? (
        <div className={styles.pageLoadingCenter}><LoadingSpinner size={32} /></div>
      ) : projects.length === 0 ? (

        <main className={styles.noProjectMain}>
          <div className={styles.noProjectCard}>

            <div className={styles.emptyHero}>
              <div className={styles.emptyIconWrap}>
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className={styles.emptyTitle}>Connect your first JIRA Project</h1>
              <p className={styles.emptySubtitle}>
                JIRA Bug Summary bridges the gap between your engineering workflow and automated bug
                reporting. Connect your Jira instance to start monitoring issues in real-time.
              </p>
            </div>

            <div className={styles.noProjectConnectArea}>
              <span className={styles.noProjectConnectLabel}>SELECT A PROJECT</span>

              {projectsError && (
                <div className={styles.errorBanner} role="alert">{projectsError}</div>
              )}
              {addError && (
                <div className={styles.errorBanner} role="alert">{addError}</div>
              )}

              {addSyncing ? (
                <div className={styles.addSyncBar}>
                  <LoadingSpinner size={20} />
                  <span>Syncing {addSelectedKey}…</span>
                </div>
              ) : (
                <div className={styles.addSearchWrap} ref={addSearchRef}>
                  <svg className={styles.addSearchIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" stroke="#6b7280" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input
                    className={styles.addSearchInput}
                    type="search"
                    placeholder="Search projects…"
                    value={addQuery}
                    onChange={e => setAddQuery(e.target.value)}
                    aria-label="Search projects"
                    autoComplete="off"
                    onFocus={() => addQuery.trim() && setShowAddDropdown(true)}
                  />
                  {addQuery.trim() && showAddDropdown && (
                    <div className={styles.addDropdown}>
                      {addLoading ? (
                        <div className={styles.addDropdownLoading}>
                          <LoadingSpinner size={16} />
                          <span>Searching…</span>
                        </div>
                      ) : addResults.length === 0 ? (
                        <p className={styles.addDropdownEmpty}>No projects match &ldquo;{addQuery}&rdquo;</p>
                      ) : (
                        <ul className={styles.addProjectList} role="list" aria-label="Jira projects">
                          {addResults.map((project, idx) => (
                            <li key={project.key} role="listitem">
                              <button
                                className={`${styles.addProjectRow}${addSelectedKey === project.key ? ' ' + styles.addProjectRowSelected : ''}`}
                                onClick={() => handleAddProject(project)}
                                aria-pressed={addSelectedKey === project.key}
                                style={{ borderBottom: idx < addResults.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                              >
                                <div className={styles.addProjectAvatar} aria-hidden="true">
                                  {project.name.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.addProjectInfo}>
                                  <span className={styles.addProjectName}>{project.name}</span>
                                  <span className={styles.addProjectKey}>{project.key}</span>
                                </div>
                                <svg className={styles.addProjectChevron} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M9 18l6-6-6-6" stroke="#c3c6d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.stepsGrid}>
              <div className={styles.step}>
                <span className={styles.stepNum}>01</span>
                <h3 className={styles.stepTitle}>Provide Link</h3>
                <p className={styles.stepDesc}>Paste your Jira project URL or specific board key to initialize the handshake.</p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>02</span>
                <h3 className={styles.stepTitle}>Authorize Access</h3>
                <p className={styles.stepDesc}>Grant JIRA Bug Summary read permissions via API token to sync bug tickets automatically.</p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>03</span>
                <h3 className={styles.stepTitle}>Analyze &amp; Track</h3>
                <p className={styles.stepDesc}>Your dashboard will populate with historical data and real-time bug lifecycle metrics.</p>
              </div>
            </div>

          </div>
        </main>

      ) : (

        <div className={styles.layout}>

        <main className={`${styles.mainContent}${isLeavingDashboard ? ' ' + styles.mainContentLeaving : ''}`}>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Active Projects</h1>
          <p className={styles.pageSubtitle}>Currently monitoring {projects.length} project(s).</p>
        </div>

        <div className={styles.projectsGrid}>
          {loadingProjects ? (
            <div className={styles.gridLoading}>
              <LoadingSpinner size={24} />
              <span>Loading projects…</span>
            </div>
          ) : projectsError ? (
            <div role="alert" className={styles.errorBanner}>{projectsError}</div>
          ) : (
            projects.map((project, idx) => {
              const stats = bugStats[project.key] || { total: 0, open: 0, critical: 0, loading: true };
              const hasCritical = !stats.loading && stats.critical > 0;
              const menuOpen = openCardMenu === project.key;
              return (
                <div key={project.key} className={`${styles.projectCardWrap}${removingKey === project.key ? ' ' + styles.projectCardWrapRemoving : ''}`} style={{ '--card-index': idx }}>
                  <button
                    className={styles.projectCard}
                    aria-label={`${project.name} — ${stats.loading ? 'loading' : `${stats.open} open bugs, ${stats.critical} critical`}`}
                    onClick={() => { window.location.href = `/bug-report?project=${project.key}`; }}
                  >
                    <div className={`${styles.cardBar} ${hasCritical ? styles.barCritical : styles.barNormal}`} />
                    <div className={styles.cardContent}>
                      <div className={styles.cardHeader}>
                        <span className={styles.projectName}>{project.name}</span>
                        <span className={styles.projectCode}>{project.key}</span>
                      </div>
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>TOTAL BUGS</span>
                        <span className={styles.statVal}>{stats.loading ? '—' : stats.total}</span>
                      </div>
                      <div className={styles.statBoxes}>
                        <div className={styles.statBox}>
                          <span className={styles.statLabel}>OPEN BUGS</span>
                          <span className={styles.statVal}>{stats.loading ? '—' : stats.open}</span>
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
                  <button
                    className={`${styles.cardMenuBtn}${menuOpen ? ' ' + styles.cardMenuBtnOpen : ''}`}
                    aria-label={`Options for ${project.name}`}
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => setOpenCardMenu(k => k === project.key ? null : project.key)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.5"/>
                      <circle cx="12" cy="12" r="1.5"/>
                      <circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </button>
                  {menuOpen && (
                    <div
                      className={styles.cardMenuDropdown}
                      role="menu"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <button
                        className={styles.cardMenuSync}
                        role="menuitem"
                        onClick={() => handleSyncProject(project.key)}
                        disabled={syncingKey === project.key}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M3.51 15a9 9 0 1 0 .49-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {syncingKey === project.key ? 'Syncing…' : 'Sync now'}
                      </button>
                      <button
                        className={styles.cardMenuSync}
                        role="menuitem"
                        onClick={() => { window.location.href = `/sprint?project=${project.key}`; }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        View Sprints
                      </button>
                      <button
                        className={styles.cardMenuDelete}
                        role="menuitem"
                        onClick={() => handleDeleteProject(project.key)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Remove project
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ConnectSection */}
        <div className={styles.connectSection}>
          <div className={styles.connectLeft}>
            <div className={styles.connectIconWrap}>
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
              Search and select a Jira project to start syncing bugs. Provide your project key or name — JIRA Bug Summary will automatically sync your issues and display real-time bug metrics on your dashboard.
            </p>

            {addError && <div className={styles.errorBanner} role="alert">{addError}</div>}

            {addSyncing ? (
              <div className={styles.addSyncBar}>
                <LoadingSpinner size={18} />
                <span>Syncing {addSelectedKey}…</span>
              </div>
            ) : (
              <div className={styles.addSearchWrap} ref={addSearchRef}>
                <svg className={styles.addSearchIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" stroke="#6b7280" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  className={styles.addSearchInput}
                  type="search"
                  placeholder="Search projects…"
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  aria-label="Search projects to add"
                  autoComplete="off"
                  onFocus={() => addQuery.trim() && setShowAddDropdown(true)}
                />
                {addQuery.trim() && showAddDropdown && (
                  <div className={styles.addDropdown}>
                    {addLoading ? (
                      <div className={styles.addDropdownLoading}>
                        <LoadingSpinner size={16} />
                        <span>Searching…</span>
                      </div>
                    ) : addResults.length === 0 ? (
                      <p className={styles.addDropdownEmpty}>No projects match &ldquo;{addQuery}&rdquo;</p>
                    ) : (
                      <ul className={styles.addProjectList} role="list" aria-label="Jira projects">
                        {addResults.map((project, idx) => (
                          <li key={project.key} role="listitem">
                            <button
                              className={`${styles.addProjectRow}${addSelectedKey === project.key ? ' ' + styles.addProjectRowSelected : ''}`}
                              onClick={() => handleAddProject(project)}
                              aria-pressed={addSelectedKey === project.key}
                              style={{ borderBottom: idx < addResults.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                            >
                              <div className={styles.addProjectAvatar} aria-hidden="true">
                                {project.name.charAt(0).toUpperCase()}
                              </div>
                              <div className={styles.addProjectInfo}>
                                <span className={styles.addProjectName}>{project.name}</span>
                                <span className={styles.addProjectKey}>{project.key}</span>
                              </div>
                              <svg className={styles.addProjectChevron} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M9 18l6-6-6-6" stroke="#c3c6d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={styles.features}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
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

      )}
    </div>
  );
}

export default DashboardPage;

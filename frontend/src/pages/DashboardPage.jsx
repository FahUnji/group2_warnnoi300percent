import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import styles from './DashboardPage.module.css';

function DashboardPage() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  const [bugStats, setBugStats] = useState({});

  const [connectInput, setConnectInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState({ type: '', message: '' });

  // Navbar search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [connectingKey, setConnectingKey] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef(null);
  const userMenuRef = useRef(null);

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

  useEffect(() => {
    setLoadingProjects(true);
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setProjects(data.projects);
        else setProjectsError('Could not load projects. Check your connection and reload.');
      })
      .catch(() => setProjectsError('Could not load projects. Check your connection and reload.'))
      .finally(() => setLoadingProjects(false));
  }, []);

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
            const open = bugs.filter(b => ['open', 'to do'].includes((b.status || '').toLowerCase())).length;
            const critical = bugs.filter(b => ['critical', 'highest'].includes((b.priority || '').toLowerCase())).length;
            setBugStats(prev => ({ ...prev, [project.key]: { open, critical, loading: false } }));
          } else {
            setBugStats(prev => ({ ...prev, [project.key]: { open: 0, critical: 0, loading: false } }));
          }
        })
        .catch(() => setBugStats(prev => ({ ...prev, [project.key]: { open: 0, critical: 0, loading: false } })));
    });
  }, [projects]);

  // Debounced search for Jira projects
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/projects/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            setSearchResults(data.projects);
            setShowDropdown(true);
          }
        })
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown / user menu on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('jira_user');
    window.location.href = '/';
  }

  async function handleSelectProject(project) {
    setShowDropdown(false);
    setSearchQuery('');
    setConnectingKey(project.key);
    try {
      const resp = await fetch(`/api/sync/${project.key}`, { method: 'POST' });
      const data = await resp.json();
      if (data.ok) {
        const r = await fetch('/api/projects');
        const d = await r.json();
        if (d.ok) setProjects(d.projects);
      }
    } catch {
      // silent — user can retry via connect form
    } finally {
      setConnectingKey('');
    }
  }

  function extractProjectKey(input) {
    const trimmed = input.trim().toUpperCase();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').filter(Boolean);
      return parts[parts.length - 1];
    }
    return trimmed;
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
        const r = await fetch('/api/projects');
        const d = await r.json();
        if (d.ok) setProjects(d.projects);
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

      {/* Top NavBar */}
      <header className={styles.topnav}>
        <div className={styles.topnavLeft}>
          <div className={styles.navLogo}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4.09347 12.6879C3.74465 13.1064 3.57024 13.3157 3.56709 13.4925C3.56434 13.6461 3.63257 13.7923 3.75168 13.8889C3.88863 14 4.15924 14 4.70046 14H12L11 22L19.9065 11.3121C20.2554 10.8936 20.4298 10.6843 20.4329 10.5075C20.4357 10.3539 20.3674 10.2077 20.2483 10.1111C20.1114 10 19.8408 10 19.2995 10H12L13 2Z"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className={styles.navBrand}>JIRA Bug Summary</span>
        </div>

        <div className={styles.topnavRight}>
          {/* Project search */}
          <div className={styles.searchWrap} ref={searchRef}>
            <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="#6b7280" strokeWidth="2"/>
              <path d="M21 21L16.65 16.65" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search Jira projects…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              aria-label="Search Jira projects"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
            />
            {searchLoading && (
              <span className={styles.searchSpinner}><LoadingSpinner size={13} /></span>
            )}
            {showDropdown && (
              <div className={styles.searchDropdown} role="listbox" aria-label="Project search results">
                {searchResults.length === 0 ? (
                  <div className={styles.searchEmpty}>No projects found</div>
                ) : (
                  searchResults.map(p => (
                    <button
                      key={p.key}
                      className={styles.searchItem}
                      role="option"
                      onClick={() => handleSelectProject(p)}
                      disabled={connectingKey === p.key}
                    >
                      <span className={styles.searchItemKey}>{p.key}</span>
                      <span className={styles.searchItemName}>{p.name}</span>
                      {connectingKey === p.key && <LoadingSpinner size={12} />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button className={styles.navBtn} aria-label="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="#434654" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.navBtn} aria-label="Help">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#434654" strokeWidth="2"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" stroke="#434654" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.navBtn} aria-label="History">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <polyline points="12 8 12 12 14 14" stroke="#434654" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.05 11a9 9 0 1 0 .5-4M3 3v4h4" stroke="#434654" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className={styles.navDivider} />

          {/* User menu */}
          <div className={styles.userMenuWrap} ref={userMenuRef}>
            <button
              className={styles.navUser}
              aria-label="User menu"
              aria-haspopup="true"
              aria-expanded={showUserMenu}
              onClick={() => setShowUserMenu(v => !v)}
            >
              <div className={styles.navAvatar}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="" width={24} height={24} style={{ borderRadius: '50%' }} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="#065b41" strokeWidth="2"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#065b41" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <span className={styles.navUsername}>{user?.name || 'Account'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path d="M1 1L5 5L9 1" stroke="#065b41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showUserMenu && (
              <div className={styles.userMenu} role="menu">
                <button className={styles.logoutItem} role="menuitem" onClick={handleLogout}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="16 17 21 12 16 7" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="21" y1="12" x2="9" y2="12" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>

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
          ) : projects.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyHeading}>No projects synced yet</p>
              <p className={styles.emptyBody}>Search for a Jira project in the search bar above, or enter a project key in the form below.</p>
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

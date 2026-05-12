import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addSyncing, setAddSyncing] = useState(false);
  const [addSelectedKey, setAddSelectedKey] = useState('');
  const [addError, setAddError] = useState('');

  // Navbar search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [connectingKey, setConnectingKey] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openCardMenu, setOpenCardMenu] = useState(null);
  const navigate = useNavigate();
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
    projects.forEach(p => { initial[p.key] = { total: 0, open: 0, critical: 0, loading: true }; });
    setBugStats(initial);
    projects.forEach(project => {
      fetch(`/api/bugs/${project.key}`)
        .then(r => r.json())
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

  // Debounced search for Add Project section
  useEffect(() => {
    if (!addQuery.trim()) {
      setAddResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setAddLoading(true);
      fetch(`/api/projects/search?q=${encodeURIComponent(addQuery)}`)
        .then(r => r.json())
        .then(data => { if (data.ok) setAddResults(data.projects); })
        .catch(() => {})
        .finally(() => setAddLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [addQuery]);

  // Close dropdown / user menu on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
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

  async function handleAddProject(project) {
    if (addSyncing) return;
    setAddSelectedKey(project.key);
    setAddSyncing(true);
    setAddError('');
    try {
      const resp = await fetch(`/api/sync/${project.key}`, { method: 'POST' });
      const data = await resp.json();
      if (data.ok) {
        setAddQuery('');
        setAddResults([]);
        const r = await fetch('/api/projects');
        const d = await r.json();
        if (d.ok) setProjects(d.projects);
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

  async function handleDeleteProject(key) {
    setOpenCardMenu(null);
    try {
      await fetch(`/api/projects/${key}`, { method: 'DELETE' });
      const updated = projects.filter(p => p.key !== key);
      setProjects(updated);
      if (updated.length === 0) {
        navigate('/no-project', { replace: true });
      }
    } catch {
      // silent — project stays in list
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
              <p className={styles.emptyBody}>Search for a Jira project using the search bar above or the Add New Project section below.</p>
            </div>
          ) : (
            projects.map(project => {
              const stats = bugStats[project.key] || { total: 0, open: 0, critical: 0, loading: true };
              const hasCritical = !stats.loading && stats.critical > 0;
              const menuOpen = openCardMenu === project.key;
              return (
                <div key={project.key} className={styles.projectCardWrap}>
                  <button
                    className={styles.projectCard}
                    aria-label={`${project.name} — ${stats.loading ? 'loading' : `${stats.open} open bugs, ${stats.critical} critical`}`}
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
              Search and select a Jira project to start syncing bugs.
            </p>

            {addError && <div className={styles.errorBanner} role="alert">{addError}</div>}

            {addSyncing ? (
              <div className={styles.addSyncBar}>
                <LoadingSpinner size={18} />
                <span>Syncing {addSelectedKey}…</span>
              </div>
            ) : (
              <>
                <div className={styles.addSearchWrap}>
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
                  />
                </div>

                {addLoading ? (
                  <div className={styles.addSyncBar}>
                    <LoadingSpinner size={18} />
                    <span style={{ color: '#6b7280' }}>Searching…</span>
                  </div>
                ) : !addQuery.trim() ? (
                  <p className={styles.addEmptyText}>Type to search your Jira projects</p>
                ) : addResults.length === 0 ? (
                  <p className={styles.addEmptyText}>No projects match &ldquo;{addQuery}&rdquo;</p>
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
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default DashboardPage;

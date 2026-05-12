import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import styles from './NoProjectPage.module.css';

function NoProjectPage() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const navigate = useNavigate();

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
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    setLoadingProjects(true);
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setProjects(data.projects);
        } else {
          setProjectsError('Could not load projects. Check your connection and reload the page.');
        }
      })
      .catch(() => {
        setProjectsError('Could not load projects. Check your connection and reload the page.');
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('jira_user');
    window.location.href = '/';
  }

  async function handleProjectSelect(project) {
    if (syncing) return;
    setSelectedKey(project.key);
    sessionStorage.setItem('active_project_key', project.key);
    setSyncing(true);
    setSyncError('');
    try {
      const resp = await fetch(`/api/sync/${project.key}`, { method: 'POST' });
      const data = await resp.json();
      if (data.ok) {
        // brief success state then navigate (500ms)
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } else {
        setSyncError('Sync failed. Select the project again to retry.');
        setSelectedKey('');
      }
    } catch {
      setSyncError('Sync failed. Select the project again to retry.');
      setSelectedKey('');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={styles.pageWrapper}>
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

        <div className={styles.navActions}>
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
          <div className={styles.navDivider}></div>
          <div className={styles.navUserWrap} ref={menuRef}>
            <button
              className={styles.navUser}
              aria-label="User menu"
              aria-expanded={showMenu}
              onClick={() => setShowMenu(v => !v)}
            >
              <div className={styles.navAvatar}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="#065b41" strokeWidth="2"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#065b41" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <span className={styles.navUsername}>{user?.name || 'Account'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="#065b41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showMenu && (
              <div className={styles.navDropdown}>
                {user && (
                  <div className={styles.navDropdownUser}>
                    <span className={styles.navDropdownName}>{user.name}</span>
                    <span className={styles.navDropdownEmail}>{user.email}</span>
                  </div>
                )}
                <button className={styles.navDropdownItem} onClick={handleLogout}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.mainArea}>
        <div className={styles.contentCard}>

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

          <div className={styles.connectArea}>
            <span className={styles.connectLabel}>SELECT A PROJECT</span>

            {projectsError && (
              <div className={styles.errorBanner} role="alert">
                {projectsError}
              </div>
            )}

            {syncError && (
              <div className={styles.errorBanner} role="alert">
                {syncError}
              </div>
            )}

            {syncing ? (
              <div className={styles.syncStatusBar}>
                <LoadingSpinner size={20} />
                <span>Syncing {projects.find(p => p.key === selectedKey)?.name || selectedKey}…</span>
              </div>
            ) : loadingProjects ? (
              <div className={styles.syncStatusBar}>
                <LoadingSpinner size={24} />
                <span style={{ color: '#6b7280' }}>Loading projects…</span>
              </div>
            ) : projects.length === 0 && !projectsError ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: '#002d1c', marginBottom: '4px' }}>No projects found</p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  Your Jira account has no accessible projects. Check your OAuth permissions and try again.
                </p>
              </div>
            ) : (
              <ul
                className={styles.projectList}
                role="list"
                aria-label="Jira projects"
              >
                {projects.map((project, idx) => (
                  <li key={project.key} role="listitem">
                    <button
                      className={`${styles.projectRow}${selectedKey === project.key ? ' ' + styles.projectRowSelected : ''}`}
                      onClick={() => handleProjectSelect(project)}
                      aria-pressed={selectedKey === project.key}
                      style={{ borderBottom: idx < projects.length - 1 ? '1px solid #c3c6d6' : 'none' }}
                    >
                      <div className={styles.projectAvatar} aria-hidden="true">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.projectInfo}>
                        <span className={styles.projectName}>{project.name}</span>
                        <span className={styles.projectKeyBadge}>{project.key}</span>
                      </div>
                      {selectedKey !== project.key && (
                        <svg
                          className={styles.projectChevron}
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" stroke="#c3c6d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
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
    </div>
  );
}

export default NoProjectPage;

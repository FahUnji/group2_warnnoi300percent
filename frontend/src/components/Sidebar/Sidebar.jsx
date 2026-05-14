import { useState } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar({ projectKey, projectName, activePage, isOpen, onClose, isLeaving }) {
  const dashboardHref = '/dashboard';
  const bugHref = projectKey ? `/bug-report?project=${projectKey}` : '/bug-report';
  const sprintHref = projectKey ? `/sprint?project=${projectKey}` : '/sprint';

  const [skipAnim] = useState(() => {
    try {
      const ref = document.referrer;
      return ref.includes('/bug-report') || ref.includes('/sprint');
    } catch {
      return false;
    }
  });

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.sidebar} ${isOpen ? styles.open : ''} ${isLeaving ? styles.sidebarLeaving : ''} ${skipAnim ? styles.sidebarNoAnim : ''}`}
        aria-label="Page navigation"
      >
        <div className={styles.sidebarProject}>
          <div className={styles.projectIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.projectInfo}>
            <span className={styles.projectName}>{projectKey || 'Project'}</span>
            <span className={styles.projectSub}>{projectName || 'Jira Cloud Instance'}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <a
            href={dashboardHref}
            className={`${styles.navLink} ${activePage === 'dashboard' ? styles.navLinkActive : ''}`}
            aria-current={activePage === 'dashboard' ? 'page' : undefined}
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </a>
          <a
            href={bugHref}
            className={`${styles.navLink} ${activePage === 'bug-report' ? styles.navLinkActive : ''}`}
            aria-current={activePage === 'bug-report' ? 'page' : undefined}
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Bug Report
          </a>
          <a
            href={sprintHref}
            className={`${styles.navLink} ${activePage === 'sprint' ? styles.navLinkActive : ''}`}
            aria-current={activePage === 'sprint' ? 'page' : undefined}
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Sprint
          </a>
        </nav>
      </aside>
    </>
  );
}

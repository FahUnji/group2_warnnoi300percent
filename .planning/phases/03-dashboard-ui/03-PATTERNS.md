# Phase 3: Dashboard UI - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 2 (1 modified + 1 created)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/pages/DashboardPage.jsx` | page component | request-response + CRUD | `frontend/src/pages/DashboardPage.jsx` (self) + `frontend/src/pages/NoProjectPage.jsx` | exact (self-modify) + role-match |
| `frontend/src/pages/DashboardPage.module.css` | CSS module | n/a | `frontend/src/pages/NoProjectPage.module.css` + `UI/css/dashboard.css` | exact CSS class names from mockup |

---

## Pattern Assignments

### `frontend/src/pages/DashboardPage.jsx` (page component, request-response + CRUD)

**Primary analog:** `frontend/src/pages/NoProjectPage.jsx`
**Secondary analog (self):** `frontend/src/pages/DashboardPage.jsx` (current content — keep listed sections, delete bug table)

---

#### Imports pattern

Copy from `frontend/src/pages/NoProjectPage.jsx` lines 1-4:

```jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import styles from './NoProjectPage.module.css';
```

Adapt for DashboardPage (drop `useNavigate`; swap module name):

```jsx
import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import styles from './DashboardPage.module.css';
```

---

#### State initialization pattern

Copy from `frontend/src/pages/DashboardPage.jsx` lines 5-18 (keep these states):

```jsx
const [user, setUser] = useState(() => {
  try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
});
const [syncing, setSyncing] = useState(false);
const [syncError, setSyncError] = useState('');
const [syncSuccess, setSyncSuccess] = useState('');
const [lastSynced, setLastSynced] = useState(null);
const [projectKey, setProjectKey] = useState(() => {
  try { return sessionStorage.getItem('active_project_key') || ''; } catch { return ''; }
});
```

Add these NEW states for Phase 3 (no analog in existing files — derive from CONTEXT.md D-05):

```jsx
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
```

---

#### Fetch /api/projects pattern

Copy and adapt from `frontend/src/pages/NoProjectPage.jsx` lines 46-61:

```jsx
// Analog source: NoProjectPage.jsx lines 46-61
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
```

---

#### Parallel fetch /api/bugs/{key} per project pattern

No direct analog — compose from existing `fetchBugs` in `DashboardPage.jsx` lines 41-50 applied in parallel:

```jsx
// Analog source: DashboardPage.jsx lines 41-50 (fetchBugs), adapted for parallel multi-project
useEffect(() => {
  if (!projects.length) return;
  // Seed loading state for all projects
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
```

---

#### handleSync (keep unchanged)

Copy verbatim from `frontend/src/pages/DashboardPage.jsx` lines 60-81:

```jsx
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
```

---

#### handleConnect (Add New Project) pattern

Compose from `NoProjectPage.jsx` handleProjectSelect (lines 69-93) + `DashboardPage.jsx` handleSync pattern. Key differences: extract project key from URL, POST /api/sync, re-fetch projects:

```jsx
// Analog source: NoProjectPage.jsx lines 69-93 (POST /api/sync pattern)
function extractProjectKey(input) {
  const trimmed = input.trim();
  // If it looks like a URL, extract the last path segment
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
      // Re-fetch projects (triggers the useEffect to re-fetch bug stats)
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
```

---

#### JSX structure — keep unchanged sections

Copy verbatim from `frontend/src/pages/DashboardPage.jsx` (keep these blocks, no edits):

- **Sync button** (lines 112-139): keep all inline styles as-is — do NOT convert to CSS Modules.
- **Last synced timestamp** (lines 143-152): keep as-is.
- **noProjectWarning banner** (lines 154-158): keep as-is.
- **syncSuccess banner** (lines 160-176): keep as-is.
- **syncError banner** (lines 178-194): keep as-is.
- **UserCard block** (lines 197-227): keep as-is.

**DELETE** from DashboardPage.jsx lines 229-275: the entire bug list section (loadingBugs / bugs.length / `<table>` block).

---

#### JSX structure — new sections (copy from dashboard.html, adapt to JSX)

**PageHeader** — from `UI/html/dashboard.html` lines 84-87:

```jsx
<div className={styles.pageHeader}>
  <h1 className={styles.pageTitle}>Active Projects</h1>
  <p className={styles.pageSubtitle}>
    Currently monitoring {projects.length} project(s).
  </p>
</div>
```

**ProjectsGrid with loading/empty/error states** — from `UI/html/dashboard.html` lines 90-159:

```jsx
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
```

**ConnectSection** — from `UI/html/dashboard.html` lines 162-227:

```jsx
<div className={styles.connectSection}>
  <div className={styles.connectLeft}>
    <div className={styles.connectIconWrap}>
      {/* Jira/package SVG from dashboard.html lines 165-169 */}
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none">
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
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
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
          {/* Auto-sync SVG from dashboard.html lines 203-207 */}
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
          {/* Shield SVG from dashboard.html lines 215-219 */}
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
```

---

### `frontend/src/pages/DashboardPage.module.css` (CSS module, n/a — CREATE NEW)

**Primary analog:** `UI/css/dashboard.css` (exact class names to port to CSS Modules camelCase)
**Secondary analog:** `frontend/src/pages/NoProjectPage.module.css` (CSS Modules file structure and pattern)

#### CSS Modules file structure pattern

Copy structure from `NoProjectPage.module.css` lines 1-7 (file-level reset not needed; just component styles):

```css
/* No global resets in CSS Modules — those live in index.css */
/* Class names below are camelCase equivalents of dashboard.css kebab-case names */
```

#### Page layout classes

From `UI/css/dashboard.css` lines 115-138 — port `.main-content`, `.page-header`, `.page-title`, `.page-subtitle`:

```css
/* CSS Modules camelCase equivalent of dashboard.css .main-content */
.mainContent {
  padding: 32px 32px 0;
  max-width: 1200px;
  margin: 0 auto;
}

.pageHeader {
  margin-bottom: 24px;
}

.pageTitle {
  font-size: 26px;
  font-weight: 700;
  color: #065b41;
  line-height: 1.2;
}

.pageSubtitle {
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
}
```

#### Projects grid classes

From `UI/css/dashboard.css` lines 141-146:

```css
.projectsGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}
```

#### Grid loading/empty/error state classes

No direct analog in dashboard.css — derive from `NoProjectPage.module.css` lines 497-516 (.syncStatusBar, .errorBanner):

```css
.gridLoading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 14px;
  grid-column: 1 / -1;
}

.errorBanner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #b91c1c;
  grid-column: 1 / -1;
}

.emptyState {
  grid-column: 1 / -1;
  text-align: center;
  padding: 32px;
}

.emptyHeading {
  font-size: 16px;
  font-weight: 700;
  color: #065b41;
  margin-bottom: 4px;
}

.emptyBody {
  font-size: 14px;
  color: #6b7280;
}
```

#### Project card classes

From `UI/css/dashboard.css` lines 149-230 (exact port to CSS Modules camelCase):

```css
.projectCard {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  min-height: 160px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
  /* Reset button defaults */
  padding: 0;
  text-align: left;
  font-family: inherit;
  width: 100%;
}
.projectCard:hover {
  transform: translateY(-2px);
  box-shadow: 0px 20px 25px -5px rgba(27,67,50,0.12), 0px 8px 10px -6px rgba(27,67,50,0.1);
}
.projectCard:active { transform: translateY(0); }
.projectCard:focus-visible { outline: 2px solid #1b4332; outline-offset: 2px; }

.cardBar {
  width: 5px;
  flex-shrink: 0;
}
.barNormal   { background: #065b41; }
.barCritical { background: #dc2626; }

.cardContent {
  flex: 1;
  padding: 20px 20px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cardHeader {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.projectName {
  font-size: 16px;
  font-weight: 700;
  color: #065b41;
  line-height: 1.3;
}

.projectCode {
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
}

.statBoxes {
  display: flex;
  gap: 10px;
}

.statBox {
  flex: 1;
  background: #e7f4f0;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.statLabel {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.statVal {
  font-size: 26px;
  font-weight: 700;
  color: #065b41;
  line-height: 1.1;
}
.statZero     { color: #111827; }
.statCritical { color: #dc2626; }
```

#### Connect section classes

From `UI/css/dashboard.css` lines 235-422 (exact port):

```css
.connectSection {
  display: flex;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 40px;
  border-top: 4px solid #065b41;
}

.connectLeft {
  width: 320px;
  flex-shrink: 0;
  background: #1b4332;
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.connectIconWrap {
  width: 72px; height: 72px;
  background: rgba(255,255,255,0.12);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.connectTitle {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
}

.connectSubtitle {
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  line-height: 1.6;
}

.connectRight {
  flex: 1;
  background: #ffffff;
  padding: 40px 40px 40px 48px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.addTitle {
  font-size: 26px;
  font-weight: 700;
  color: #065b41;
  margin-bottom: 4px;
}

.addDesc {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 4px;
}

.inputLabel {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 2px;
}

.inputRow {
  display: flex;
  gap: 10px;
  align-items: center;
}

.jiraInput {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  color: #111827;
  background: #ffffff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.jiraInput::placeholder { color: #9ca3af; }
.jiraInput:focus {
  border-color: #065b41;
  box-shadow: 0 0 0 3px rgba(27,67,50,0.1);
}
.jiraInput:disabled { opacity: 0.6; cursor: not-allowed; }

.btnConnect {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 24px;
  background: #1b4332;
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-family: inherit;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0px 20px 25px -5px rgba(27,67,50,0.1), 0px 8px 10px -6px rgba(27,67,50,0.1);
  transition: background 0.2s, transform 0.15s;
  flex-shrink: 0;
}
.btnConnect:hover  { background: #1f5040; transform: translateY(-1px); }
.btnConnect:active { transform: translateY(0); }
.btnConnect:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.btnConnect:focus-visible { outline: 2px solid #1b4332; outline-offset: 2px; }

.inputHint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: -4px;
}

/* Connect status line — applied as .connectStatus + .loading/.success/.error */
.connectStatus {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 2px;
}
.loading { background: #f3f4f6; color: #4b5563; }
.success { background: rgba(227,239,234,0.6); color: #1b4332; font-weight: 500; }
.error   { background: #fef2f2; color: #b91c1c; }

.featuresDivider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

.features {
  display: flex;
  gap: 40px;
}

.featureItem {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.featureIcon {
  width: 32px; height: 32px;
  background: #e7f4f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.featureText {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.featureTitle {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #065b41;
  line-height: 1.4;
}

.featureDesc {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
```

#### Responsive classes

From `UI/css/dashboard.css` lines 413-422:

```css
@media (max-width: 900px) {
  .projectsGrid { grid-template-columns: repeat(2, 1fr); }
  .connectLeft  { display: none; }
  .mainContent  { padding: 24px 16px 0; }
}

@media (max-width: 600px) {
  .projectsGrid { grid-template-columns: 1fr; }
}
```

---

## Shared Patterns

### LoadingSpinner Usage
**Source:** `frontend/src/components/LoadingSpinner/LoadingSpinner.jsx` lines 1-14

```jsx
// Import: already imported at top of DashboardPage
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';

// Usage — size prop controls width/height in px, component always emits role="status" aria-label="Loading"
<LoadingSpinner size={24} />   // projects grid loading area
<LoadingSpinner size={14} />   // connect button while connecting
<LoadingSpinner size={16} />   // sync button (existing — keep unchanged)
```

### Error Banner Pattern
**Source:** `frontend/src/pages/NoProjectPage.jsx` lines 190-193 + `NoProjectPage.module.css` lines 509-516
**Apply to:** projectsError display in ProjectsGrid, connectStatus.type==='error' in ConnectSection

```jsx
// JSX pattern
<div className={styles.errorBanner} role="alert">
  {projectsError}
</div>
```

```css
/* CSS pattern — already defined in errorBanner class above */
.errorBanner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #b91c1c;
}
```

### sessionStorage Access Pattern
**Source:** `frontend/src/pages/DashboardPage.jsx` lines 13-16 + `NoProjectPage.jsx` line 72
**Apply to:** onClick handler on each ProjectCard

```jsx
// Safe sessionStorage write (matches existing pattern)
try { sessionStorage.setItem('active_project_key', project.key); } catch {}
```

### fetch() with .then/.catch/.finally pattern
**Source:** `frontend/src/pages/NoProjectPage.jsx` lines 46-61
**Apply to:** All fetch calls in DashboardPage (projects fetch uses this; per-card bug fetches use it too)

```js
fetch('/api/endpoint')
  .then(r => r.json())
  .then(data => { if (data.ok) { /* success */ } else { /* set error */ } })
  .catch(() => { /* set error */ })
  .finally(() => { /* clear loading */ });
```

### Inline SVG pattern
**Source:** `frontend/src/pages/NoProjectPage.jsx` lines 100-103 and throughout
**Apply to:** All icons in new sections — no icon library, copy SVG paths directly from `UI/html/dashboard.html`

```jsx
// Always use camelCase attributes in JSX
// stroke-width → strokeWidth, stroke-linecap → strokeLinecap, etc.
// aria-hidden="true" on decorative SVGs
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="..." stroke="#065b41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
```

### CSS Modules class name convention
**Source:** `frontend/src/pages/NoProjectPage.module.css` (entire file)
**Rule:** All class names are camelCase in the .module.css file and in `className={styles.xxx}` references. Map dashboard.css kebab-case names to camelCase exactly: `.project-card` → `.projectCard`, `.card-bar` → `.cardBar`, `.bar-critical` → `.barCritical`, etc.

### Composing multiple CSS Modules classes
**Source:** `frontend/src/pages/NoProjectPage.jsx` lines 252-253

```jsx
// Template literal for conditional class composition
className={`${styles.projectRow}${selected ? ' ' + styles.projectRowSelected : ''}`}

// For Phase 3 cards — bar color and stat value color:
className={`${styles.cardBar} ${hasCritical ? styles.barCritical : styles.barNormal}`}
className={`${styles.statVal} ${stats.critical === 0 ? styles.statZero : styles.statCritical}`}
```

---

## No Analog Found

All new sections have close analogs. No files in this phase lack a pattern reference.

---

## Metadata

**Analog search scope:** `frontend/src/pages/`, `frontend/src/components/`, `UI/css/`, `UI/html/`
**Files scanned:** 6 (DashboardPage.jsx, NoProjectPage.jsx, NoProjectPage.module.css, LoadingSpinner.jsx, App.jsx, UI/css/dashboard.css, UI/html/dashboard.html)
**Pattern extraction date:** 2026-05-12

---
phase: 03-dashboard-ui
reviewed: 2026-05-12T10:22:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - frontend/src/pages/DashboardPage.jsx
  - frontend/src/pages/DashboardPage.module.css
findings:
  critical: 3
  warning: 7
  info: 3
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-12T10:22:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

DashboardPage.jsx fetches `/api/projects` then fans out parallel `/api/bugs/{key}` requests, renders project cards with OPEN BUGS / CRITICAL stats and a ConnectSection for adding new projects. The CSS Module handles layout and responsive breakpoints.

The implementation is largely coherent, but contains three blockers: two separate fetch code-paths that call `.json()` without first checking `resp.ok` (a network-level 4xx/5xx returns a JSON error body that may not match the expected shape, silently corrupting state or throwing an unhandled runtime error), one URL-injection path in `extractProjectKey` that allows a user-controlled project key to be spliced directly into a `fetch` URL without any validation, and a dangling `setTimeout` that fires `setSyncSuccess('')` after component unmount. Additionally, seven warnings cover memory-leak risks, a logic dead-code conditional, missing HTTP status checks, a stale warning that cannot reset, missing responsive CSS for the `connectRight` column, duplicate bug-filtering logic, and a colour-only critical indicator that breaks WCAG.

---

## Critical Issues

### CR-01: `extractProjectKey` allows path-traversal / URL injection into fetch call

**File:** `frontend/src/pages/DashboardPage.jsx:153-168`

**Issue:** `extractProjectKey` takes the raw user input, splits on `/`, and returns the last segment uppercased. That value is then used verbatim in `fetch(\`/api/sync/${key}\`, ...)` at line 168. A user may type `https://x.atlassian.net/projects/../../admin/reset` and `extractProjectKey` will produce `..%2FADMIN%2FRESET` (or just `..` before the URL encode), routing the POST to an unintended backend path. Even without traversal, any value that contains URL-special characters (`?`, `#`, `%`) will corrupt the request URL. The function also accepts a bare string like `/EVIL` which becomes `EVIL`—the leading slash stripping means the check passes but the intent (URL vs plain key) is ambiguous.

**Fix:**
```jsx
const VALID_KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;

function extractProjectKey(input) {
  const trimmed = input.trim();
  let candidate;
  if (trimmed.includes('/')) {
    // Accept only the final path segment of a URL
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      candidate = parts[parts.length - 1];
    } catch {
      // Not a valid URL — treat whole input as a key attempt
      candidate = trimmed;
    }
  } else {
    candidate = trimmed;
  }
  const key = candidate.toUpperCase();
  if (!VALID_KEY_RE.test(key)) {
    throw new Error(`Invalid project key: "${key}"`);
  }
  return key;
}

// In handleConnect, catch the validation error:
async function handleConnect() {
  if (!connectInput.trim() || connecting) return;
  let key;
  try {
    key = extractProjectKey(connectInput);
  } catch (err) {
    setConnectStatus({ type: 'error', message: err.message });
    return;
  }
  // ... rest unchanged
}
```

---

### CR-02: All `fetch` calls call `.json()` without checking `resp.ok` first

**File:** `frontend/src/pages/DashboardPage.jsx:44, 58-59, 81-82, 124, 131-132, 169, 174-175`

**Issue:** Every fetch chain calls `r.json()` (or `await resp.json()`) unconditionally. When the server returns a 401, 403, 500, or a rate-limit 429, the body may be an HTML error page or a differently-shaped JSON object. Calling `.json()` on an HTML body throws a `SyntaxError` that the `.catch(() => {})` silently swallows (bugs fetch) or the outer `try/catch` catches with the generic "Sync failed" message (handleSync/handleConnect). More dangerously, the `/api/projects` fetch (line 58) swallows the error silently because the catch sets `projectsError` but the `.then(data => ...)` branch will still execute if the server sends a non-2xx JSON body that lacks `data.ok`—the `else` branch correctly sets the error message, but unexpected shapes (missing `projects` field) will call `setProjects(undefined)` at line 61 and crash the `.map()` at line 334 with `TypeError: projects.map is not a function`.

**Fix:**
```js
// Wrap every fetch chain — example for /api/projects:
fetch('/api/projects')
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => {
    if (data.ok && Array.isArray(data.projects)) {
      setProjects(data.projects);
    } else {
      setProjectsError('Could not load projects. Check your connection and reload.');
    }
  })
  .catch(() => {
    setProjectsError('Could not load projects. Check your connection and reload.');
  })
  .finally(() => setLoadingProjects(false));

// Apply the same pattern (r.ok check + Array.isArray guard) to:
//   /api/bugs/{key}  (line 81) — guard data.bugs with Array.isArray
//   /api/auth/me     (line 44) — low risk but consistent
//   Post-sync re-fetch (line 131) — guard d.bugs
//   Post-connect re-fetch (line 174) — guard d.projects
```

---

### CR-03: `setTimeout` in `handleSync` fires `setSyncSuccess` after potential unmount — memory leak + React warning

**File:** `frontend/src/pages/DashboardPage.jsx:142`

**Issue:** `setTimeout(() => setSyncSuccess(''), 2000)` is never cleared. If the user navigates away from `/dashboard` within the 2-second window (e.g., clicks a project card immediately after sync completes), React will attempt to call `setSyncSuccess` on an unmounted component. In React 18 this no longer throws in production, but it produces a console warning in development, can cause subtle state corruption if the component is quickly re-mounted, and is a memory-leak pattern that will become a hard error if the codebase ever uses a stricter strict-mode setup.

**Fix:**
```jsx
// Replace the bare setTimeout with a ref-tracked timer that is cleared on unmount.
// Add at the top of the component alongside other state declarations:
const syncSuccessTimer = useRef(null);

// Inside handleSync, replace line 142:
if (syncSuccessTimer.current) clearTimeout(syncSuccessTimer.current);
syncSuccessTimer.current = setTimeout(() => setSyncSuccess(''), 2000);

// Add a cleanup effect:
useEffect(() => {
  return () => {
    if (syncSuccessTimer.current) clearTimeout(syncSuccessTimer.current);
  };
}, []);
```

---

## Warnings

### WR-01: `useEffect` auth fetch (line 41) has empty dependency array — exhaustive-deps lint violation and stale-closure risk

**File:** `frontend/src/pages/DashboardPage.jsx:41-52`

**Issue:** The effect reads `user` from the outer closure but declares `[]` as its dep array. This works at runtime because `user` is only checked as an early-exit guard and is set via `setUser` (not mutated), but it violates the exhaustive-deps rule, will generate an ESLint warning, and is a maintenance hazard: if someone adds logic inside that depends on the captured `user` value, the stale closure will silently use the initial value.

**Fix:**
```jsx
useEffect(() => {
  if (user) return;
  fetch('/api/auth/me')
    // ...
}, [user]); // add user to deps; the `if (user) return` guard prevents re-fetching
```

---

### WR-02: `noProjectWarning` state can be set to `true` but never reset to `false`

**File:** `frontend/src/pages/DashboardPage.jsx:35-39`

**Issue:** The effect fires when `projectKey` changes to a falsy value, but it never sets `noProjectWarning` back to `false` when `projectKey` becomes truthy. This is currently harmless because clicking a project card at line 343 writes to `sessionStorage` but does not call `setProjectKey`, so `projectKey` never changes after mount. However, if the `onClick` is updated to also call `setProjectKey(project.key)`, the banner would remain visible even after a key is selected. The state variable is also redundant — the render condition at line 244 already re-checks `!projectKey`, so `noProjectWarning` is just `!projectKey` at time of first render.

**Fix:** Remove the `noProjectWarning` state entirely and simplify:
```jsx
// Remove: const [noProjectWarning, setNoProjectWarning] = useState(false);
// Remove: useEffect(() => { if (!projectKey) setNoProjectWarning(true); }, [projectKey]);

// In JSX at line 244, change to:
{!projectKey && (
  <div role="alert" style={...}>
    No project selected. <a href="/no-project" ...>Go to project selection</a>
  </div>
)}
```

---

### WR-03: All in-flight `fetch` calls in parallel bug-stat effect are never aborted on unmount

**File:** `frontend/src/pages/DashboardPage.jsx:73-109`

**Issue:** The `useEffect` at line 73 fires N parallel `fetch` calls (one per project). None are attached to an `AbortController`. If the component unmounts while these requests are in-flight (e.g., user logs out, navigates), each resolved promise still calls `setBugStats(prev => ...)` on an unmounted component. With many projects this can queue many state updates on a dead component instance.

**Fix:**
```jsx
useEffect(() => {
  if (!projects.length) return;
  const controller = new AbortController();
  const initial = {};
  projects.forEach(p => { initial[p.key] = { open: 0, critical: 0, loading: true }; });
  setBugStats(initial);

  projects.forEach(project => {
    fetch(`/api/bugs/${project.key}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.ok && Array.isArray(data.bugs)) {
          const bugs = data.bugs;
          const open = bugs.filter(b =>
            ['open', 'to do'].includes((b.status || '').toLowerCase())
          ).length;
          const critical = bugs.filter(b =>
            ['critical', 'highest'].includes((b.priority || '').toLowerCase())
          ).length;
          setBugStats(prev => ({ ...prev, [project.key]: { open, critical, loading: false } }));
        } else {
          setBugStats(prev => ({ ...prev, [project.key]: { open: 0, critical: 0, loading: false } }));
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return; // expected on unmount
        setBugStats(prev => ({ ...prev, [project.key]: { open: 0, critical: 0, loading: false } }));
      });
  });

  return () => controller.abort();
}, [projects]);
```

---

### WR-04: Sync button `background` inline style always resolves to the same color — dead conditional

**File:** `frontend/src/pages/DashboardPage.jsx:210`

**Issue:**
```jsx
background: syncing || !projectKey ? '#1b4332' : '#1b4332',
```
Both branches of the ternary are identical (`'#1b4332'`). The intent was clearly to show a different (lighter) shade when disabled. This means the button provides no visual background change to signal the disabled state — only `opacity: 0.7` differentiates it. This is a visual regression bug.

**Fix:**
```jsx
background: syncing || !projectKey ? '#6b7280' : '#1b4332',
// or use a lighter green: '#4a7c59'
```

---

### WR-05: `connectSection` layout breaks at 600px — `connectRight` and `inputRow` have no small-screen rules

**File:** `frontend/src/pages/DashboardPage.module.css:267-318, 419-437`

**Issue:** The `@media (max-width: 600px)` block only adjusts the projects grid to a single column. It does not:
1. Apply `flex-direction: column` to `.connectSection` — the right panel (`connectRight`) has `padding: 40px 40px 40px 48px` which overflows a 320px viewport.
2. Apply `flex-direction: column` to `.inputRow` — the input and the wide `btnConnect` (with `white-space: nowrap` and `padding: 16px 24px`) will either overflow or compress the text input to near zero width on small screens.
3. Apply `flex-wrap` or `flex-direction: column` to `.features` — the two feature items (`gap: 40px`) will overflow on narrow viewports.

**Fix:**
```css
@media (max-width: 600px) {
  .projectsGrid {
    grid-template-columns: 1fr;
  }

  .connectSection {
    flex-direction: column;
  }

  .connectRight {
    padding: 24px 16px;
  }

  .inputRow {
    flex-direction: column;
    align-items: stretch;
  }

  .btnConnect {
    width: 100%;
  }

  .features {
    flex-direction: column;
    gap: 16px;
  }
}
```

---

### WR-06: Bug-filtering logic is duplicated verbatim between the `useEffect` (lines 85-90) and `handleSync` (lines 135-136)

**File:** `frontend/src/pages/DashboardPage.jsx:85-90, 135-136`

**Issue:** The status/priority filter logic (`['open', 'to do'].includes(...)`, `['critical', 'highest'].includes(...)`) appears in two separate places. If the bug status vocabulary changes (e.g., adding `'in progress'` to open bugs), it must be updated in both places. One copy will inevitably diverge.

**Fix:** Extract to a shared helper at module scope:
```js
function computeBugStats(bugs) {
  const open = bugs.filter(b =>
    ['open', 'to do'].includes((b.status || '').toLowerCase())
  ).length;
  const critical = bugs.filter(b =>
    ['critical', 'highest'].includes((b.priority || '').toLowerCase())
  ).length;
  return { open, critical };
}
```
Then call `computeBugStats(data.bugs)` in both places.

---

### WR-07: Color-only critical indicator on project cards breaks WCAG 1.4.1 (Use of Color)

**File:** `frontend/src/pages/DashboardPage.jsx:346`, `frontend/src/pages/DashboardPage.module.css:113-124`

**Issue:** The left colored bar on a project card (`.cardBar`) switches between green (`.barNormal`, `#065b41`) and red (`.barCritical`, `#dc2626`) solely based on whether `stats.critical > 0`. No text label, icon, or `aria-*` attribute is attached to the bar element itself. A color-blind user cannot distinguish "has critical bugs" from "no critical bugs" via the card bar alone. The `aria-label` on the card button does include the critical count (line 341), so screen reader users are covered — the gap is visual-only color distinction without a non-color cue on the bar.

**Fix:** Add a visually-hidden label and/or a small icon to the bar when critical:
```jsx
<div
  className={`${styles.cardBar} ${hasCritical ? styles.barCritical : styles.barNormal}`}
  aria-hidden="true"  // already conveyed by button aria-label
>
  {/* No change needed here since aria-label on button already announces it */}
</div>
```
The minimal fix is to add a visible icon or badge to the card header when `hasCritical` is true:
```jsx
{hasCritical && (
  <span className={styles.criticalBadge} aria-hidden="true">!</span>
)}
```
With `.criticalBadge` styled as a small red circle, so colour + shape both signal critical status.

---

## Info

### IN-01: Project card `onClick` saves to `sessionStorage` but does not update `projectKey` state or navigate

**File:** `frontend/src/pages/DashboardPage.jsx:342-344`

**Issue:** Clicking a project card writes `active_project_key` to `sessionStorage` but does not call `setProjectKey(project.key)` or navigate anywhere. This means the Sync button remains disabled if the user arrived without a key, and the `noProjectWarning` banner never clears. The card click appears non-functional from the user's perspective.

**Fix:** Add navigation or state update:
```jsx
onClick={() => {
  try { sessionStorage.setItem('active_project_key', project.key); } catch {}
  setProjectKey(project.key);
  // optionally: navigate('/dashboard') if already on dashboard, or show active state
}}
```

---

### IN-02: `styles[connectStatus.type]` dynamic lookup produces `styles['']` on initial render — no-op but fragile

**File:** `frontend/src/pages/DashboardPage.jsx:436`

**Issue:** `connectStatus` is initialized as `{ type: '', message: '' }`. The status `<p>` is conditionally rendered only when `connectStatus.message` is truthy (line 433), so `styles['']` is never applied to a visible element. However, if a future code path sets `message` without setting `type`, `styles['']` resolves to `undefined`, which React coerces to an empty string — the class lookup silently fails without error, making it easy to introduce unstyled status messages. The type `'loading'` is also used as a class name (line 353 in CSS), which conflicts with any future CSS global that may define `.loading`.

**Fix:** Use an explicit class map instead of a dynamic index:
```jsx
const STATUS_CLASS = {
  loading: styles.loading,
  success: styles.success,
  error: styles.error,
};

// In JSX:
className={`${styles.connectStatus} ${STATUS_CLASS[connectStatus.type] || ''}`}
```

---

### IN-03: `user.avatar` rendered as `<img src={user.avatar}>` with no URL validation or CSP restriction

**File:** `frontend/src/pages/DashboardPage.jsx:293-295`

**Issue:** `user.avatar` is sourced from the `/api/auth/me` response and rendered directly as an `<img src>`. If the backend ever serves an attacker-controlled avatar URL (e.g., via a compromised Jira account), this can be used for off-domain resource loading or, in combination with a broken CSP, SSRF via the browser. The `alt=""` is correct (decorative image), but there is no domain allowlist check.

**Fix:** Either validate the URL on the backend before returning it, or add a frontend check:
```jsx
{user.avatar && /^https:\/\/[^/]*\.atlassian\.net\//.test(user.avatar) && (
  <img src={user.avatar} alt="" width={36} height={36}
    style={{ borderRadius: '50%', flexShrink: 0 }} />
)}
```
Alternatively, enforce `img-src *.atlassian.net` in the Content-Security-Policy header on the server.

---

_Reviewed: 2026-05-12T10:22:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

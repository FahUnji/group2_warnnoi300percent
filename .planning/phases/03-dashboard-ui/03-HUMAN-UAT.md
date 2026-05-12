---
status: partial
phase: 03-dashboard-ui
source: [03-VERIFICATION.md]
started: 2026-05-12T10:30:00Z
updated: 2026-05-12T10:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Build confirmation
expected: `cd frontend && npm install && npm run build` exits 0 with no TypeScript/Vite errors
result: [pending]

### 2. Visual rendering
expected: "Active Projects" h1 renders in #065b41 green, card grid visible at 3-col, ConnectSection shows dark-left/white-right two-panel layout
result: [pending]

### 3. Card bug stats with live data
expected: Card stats show '—' loading state, then transition to real OPEN BUGS + CRITICAL counts after /api/bugs/{key} resolves
result: [pending]

### 4. Bar color by critical count
expected: Cards with critical > 0 show red left bar (#dc2626); cards with critical = 0 show green left bar (#065b41)
result: [pending]

### 5. Connect Project end-to-end
expected: Enter a valid Jira project key → click Connect Project → loading state shown → success message → new card appears in grid; invalid key → error state shown
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

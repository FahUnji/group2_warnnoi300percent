---
status: partial
phase: 01-jira-connection
source: [01-VERIFICATION.md]
started: 2026-05-11T16:00:00.000Z
updated: 2026-05-11T16:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end success flow
expected: Enter valid Jira credentials (real URL + email + API token) → click "Connect to Jira" → loading spinner appears on button → SuccessModal animates in with checkmark draw animation → after 2 seconds auto-redirect to /dashboard page stub
result: [pending]

### 2. Invalid credentials error
expected: Enter correct base_url + email but wrong/expired API token → submit → StatusBanner error appears inline with message "Invalid email or API token. Please check your credentials and try again." → api_token field is cleared → base_url and email are preserved in form
result: [pending]

### 3. Unreachable host error
expected: Enter a non-existent base_url (e.g. https://does-not-exist.example.com) → submit → StatusBanner shows "Cannot reach Jira at that URL. Check the base URL and your network connection." → form preserved
result: [pending]

### 4. App load auto-verify (no config)
expected: Open http://localhost:3000 with no saved Jira config in DB → brief loading spinner → ConnectionPage shows with no error banner (not_configured state should NOT surface an error to the user — form appears clean)
result: [pending]

### 5. Responsive layout at 900px breakpoint
expected: Resize browser below 900px → hero left column (tagline + heading + subtext) disappears → only the login card remains in single-column layout → form is still usable; resize above 900px → two-column layout restores
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

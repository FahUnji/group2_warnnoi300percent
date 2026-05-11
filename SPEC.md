# Jira Bug Dashboard

## Goal
A 1-week sprint to build a web dashboard where QA testers can instantly see bug health across any Jira project — without opening Jira.
 
## Tech Stack
- Frontend — React (Node.js)
- Backend — Python
- Database - MySQL 8

## Must Have Features
- **Jira Auth** — API token only, no own login. Show clear error if access is denied.
- **Manual Sync** — button in UI to sync bug data from Jira into MySQL.
- **Project Switcher** — user can access multiple projects via a project list page.
- **Bug Summary Report** — total, open, resolved counts + charts by priority and status.
- **Sprint Report** — total, open, resolved per sprint; bug count by priority in a collapsible section for each sprint.
- **Export** — download report as Excel (.xlsx) or Word (.docx).
- **Responsive** — works on mobile, tablet, and desktop.
 
## Could Have Features
- Filter by reporter
 
## Won't Have (this sprint)
- Bug detail view
- Tracking history & activity
 
## Edge Cases
| # | Risk | Impact |
|---|------|--------|
| 1 | The spec says "After confirm → cannot edit; must cancel and recreate" — but does not define what happens if the Admin navigates away using the browser back button instead of clicking "ยกเลิกการสร้าง"; data loss or partial save is possible | High |
| 2 | The spec implies Join End ≥ Join Start ("can be same date"), but no validation error message is defined for when Join Start > Join End — the constraint exists but the error behavior is unspecified | Medium |
| 3 | Individual Seller delete and Bulk delete have no confirmation modal — it is easy for Admin to accidentally delete many Seller IDs with one click, with no way to undo | Medium |
| 4 | Re-upload of Seller Excel is defined to add only new valid IDs, but there is no clear way for Admin to see which IDs were skipped (already exist) vs which were invalid — this may affect test verification | Medium |
| 5 | The spec does not define a maximum length for the Promotion Name field — a very long name could break the UI or be truncated unexpectedly | Low |
| 6 | Terms & Conditions is pre-filled but editable — there is no minimum length, no format validation, and no reset-to-default option defined | Low |

## Design
The design should following design from https://www.figma.com/design/j7cSdqhEBnIFUK2DZPTuNo/JIRA-Bug-Summary?node-id=0-1&p=f 
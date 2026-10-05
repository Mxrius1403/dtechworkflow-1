# PRD — Dentaltech Daily Flow (reorganization)

## Original problem statement
"this is my project right now. I want to organize it. Organize the whole project and make it in a framework for easier changes."
Uploaded: Dentaltech-rotas-casos-prontos.zip (Firebase + vanilla JS: app.js, logistics.js, enhancements.js, driver.js, track.js).

## Approved plan (Phase 1)
Rebuild with clean frontend/backend split (React + FastAPI + MongoDB), full feature parity, English UI, refreshed design, obvious bug fixes, read-only fixed sample data served by backend, project guide (README.md at top level — user choice).

## Users
Owner, Managers, Technicians (denture / ortho / digital), Drivers, Clinics (public tracking link). Developers changing the code.

## Architecture
- backend: core/ (config, db, models, collections), routers/ (data, catalog, logistics), seed/ (daily, date-relative demo data), data/*.json
- frontend: config/ (navigation, statuses, constants), context/ (Data, Session), lib/ (business rules), components/ (ui, common, cases, layout), pages/
- All writes call demoSave() (lib/notify.js) — Phase 2 hook.

## Implemented (Phase 1)
- 2026-10 (earlier session): backend + seed, design guidelines, libs, layout, Dashboard (manager/tech), SignIn, Receiving, Case Search, Completion Review, Attention, Production Calendar, Technicians, Owner Control, TV mode, Account.
- 2026-10-05: config/navigation.js + App routing/guards; Tooth Order + Tooth Orders; Order TDS + Material Order Requests; Holiday Requests (tech + manager, leave calendar); Other Work; Reports (preview, PDF, saved reports); Deliveries & Collections (ready cases, create route, routes + route dialog with emails/transfer/add stop/delete, clinics + CSV/JSON import, drivers); Driver app (week, start day, checklist, planning, preview, active, break, urgent stop placement, completed/scheduled); Public tracking page (/track?token=, 5s refresh, live map); README project guide + changelog.

## Backlog
- P1 Phase 2 — Saved data: real POST/PATCH endpoints replacing demoSave(), stop daily reseed.
- P2 Phase 3 — Real sign-in & roles (replace persona picker), search/filters, exports.

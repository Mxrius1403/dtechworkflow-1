# Dentaltech — Project Reorganization & Refresh

The existing Dentaltech project (routes and finished cases) is rebuilt with a clean frontend/backend split, keeping every current feature.
The interface is translated to English, gets a refreshed visual design, and obvious bugs are fixed along the way.

## Who it's for
- The project owner, who needs to make future changes quickly without digging through tangled code.
- Anyone who picks up the code later and has to find where things are and how to change them.
- The app's current users, who keep the same features with a cleaner look and in English.

## Core features and experience
- **Feature parity:** every screen, route, and feature in the uploaded project is carried over. Nothing is removed and no new features are added.
- **Clean structure:** the code is split into clearly named, single-purpose parts: pages, reusable interface pieces, data, and backend endpoints. Each part has one obvious place to live.
- **Shared building blocks:** repeated interface elements (cards, tables, buttons, status badges, headers) become reusable pieces, so a change made once shows up everywhere.
- **Demo data in one place:** the sample data the app shows today (cases, routes, and similar) moves to the backend and is served from a single source. The data stays read-only, the same as today.
- **English interface:** all labels, messages, and menus are translated to English.
- **Refreshed visual design:** a new, consistent look across all screens, with clean spacing and type, clear status colors, and layouts that work on mobile.
- **Bug fixes:** obvious problems found while rebuilding (broken links, layout breaks, console errors, logic slips) are fixed. Each fix is listed in a short changelog.
- **Documentation:** a project guide explains the folder layout, what each part does, how to add a page, how to change sample data, and how to run the project.

## User flow
1. The user opens the app and lands on the same starting screen as before, now in English with the new design.
2. The user moves between the existing sections (for example, finished cases and routes) using a clear, consistent navigation menu.
3. Each screen shows the same information and actions as the original version.
4. A developer who wants to change something opens the project guide, finds the right file straight away, and makes the edit.

## UI/UX feel
- Professional and clinical-clean, suited to a dental lab or tech workflow.
- Easy to scan: clear hierarchy, readable tables and lists, and status shown at a glance.
- Consistent across screens: the same spacing, components, and interaction patterns everywhere.
- Smooth but restrained motion on hover and screen changes.

## Implementation phases
**Phase 1 — MVP (built now)**
- Review the uploaded project and list every screen, route, and feature.
- Rebuild it on the new frontend/backend structure with full feature parity.
- Translate the interface to English and apply the refreshed design.
- Fix the obvious bugs found during the rebuild and record them in a changelog.
- Write the project guide.

**Phase 2 — Saved data**
- Let users create, edit, and update cases and routes, with changes kept in the database instead of fixed sample data.

**Phase 3 — Team use & extras**
- Sign-in and roles, search and filters, and printable or exportable route and case sheets.

## Assumptions
- The project's real content (screens, sections, features) comes from the uploaded zip. The feature list above is inferred from the project name ("rotas" = routes, "casos prontos" = finished cases) and is confirmed during the review.
- "No saved data" means the app currently uses fixed sample data. That data is kept as-is and served read-only, and real saving is left for Phase 2.
- Both "fix obvious bugs" and "refreshed visual design" are included, since both options were selected.
- "Easier changes" means clean, well-documented code. There is no admin screen and no central settings panel beyond what a clean structure naturally provides.
- The interface is English only, with no language switcher.
- The new design replaces the current look. The original branding name "Dentaltech" is kept. If a logo or brand colors exist in the project, they are kept; otherwise a neutral dental/tech palette is chosen.
- Original files that turn out to be unused or duplicated are dropped and not carried over.
- No external services, logins, or payments are added in Phase 1.

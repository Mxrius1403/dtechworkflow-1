# Dentaltech Daily Flow — Project Guide

Daily Flow runs the Dentaltech lab day to day. It covers receiving, production boards, completion review, reports, orders, holidays, deliveries and collections, a driver app and a public clinic tracking page.

It used to be one Firebase + vanilla JS bundle (`app.js`, `logistics.js`, `enhancements.js`, `driver.js`, `track.js`). It is now a **React frontend** and a **FastAPI backend** with **MongoDB**. Each part lives in one clear place.

> **Phase 1 is a read-only demo.** All data is fixed sample data served by the backend. Every "save" action (publish route, approve holiday, send order…) shows a *Demo mode — not saved* toast and changes nothing. Real saving arrives in Phase 2 (see [Next steps](#next-steps-phase-2)).

---

## 1. Run the project

| Service  | Where                        | Notes |
|----------|------------------------------|-------|
| Backend  | `backend/` → `server.py` on port 8001 | All routes start with `/api`. |
| Frontend | `frontend/` (CRA + Tailwind) on port 3000 | Calls the backend through `REACT_APP_BACKEND_URL`. |
| Database | MongoDB from `MONGO_URL` / `DB_NAME` in `backend/.env` | The sample data is filled in automatically. |

On the platform, both services run under supervisor with hot reload:

```bash
sudo supervisorctl restart backend    # only needed after .env or dependency changes
sudo supervisorctl restart frontend
```

To run them locally yourself:

```bash
cd backend  && pip install -r requirements.txt && uvicorn server:app --port 8001 --reload
cd frontend && yarn install && yarn start
```

### Demo sign-in (no passwords in Phase 1)

The start screen lists every active account. Click one to open its workspace.

| Persona | ID | What you see |
|---|---|---|
| Aoife Byrne — Owner | `OWNER001` | Everything + Owner Control |
| Ciarán Walsh — Manager | `MGR0001` | Manager dashboard, Deliveries & Collections, Case Search, orders, technicians, holidays, reports |
| Liam O'Connor / Emma Brennan — Denture | `DT001` / `DT002` | Technician board, Tooth Order, Order TDS, Holidays |
| Conor Gallagher / Róisín Kavanagh — Ortho | `DT003` / `DT004` | + Other Work |
| Darragh Quinn — Digital | `DT005` | + Digital Receiving |
| Seán Murphy / Niamh Kelly / Patrick O'Brien — Drivers | `D0001` / `D0002` / `D0003` | Driver app (`/driver`) |

The clinic tracking page is public: `/track?token=<48-hex token>`. Managers can open it from **Deliveries & Collections → Routes → Open → "Clinic page"**.

---

## 2. Folder layout

```
backend/
├── server.py              FastAPI app: registers routers, seeds data on start-up
├── core/
│   ├── config.py          Environment (MONGO_URL, DB_NAME, CORS_ORIGINS) and constants
│   ├── database.py        Mongo client (Motor)
│   ├── models.py          BaseDocument: Mongo `_id` <-> API `id`
│   └── collections.py     API name -> Mongo collection (one place to expose data)
├── routers/
│   ├── data.py            GET /api/data (everything) and /api/data/{name}
│   ├── catalog.py         GET /api/catalog (TDS materials + tooth groups)
│   └── logistics.py       GET /api/tracking/{token}, GET /api/clinics/{id}/contact
├── seed/                  Sample data builders (see section 4)
└── data/                  Static JSON: materials.json, tooth_groups.json

frontend/src/
├── App.js                 Routes: URL -> page component (SCREENS list)
├── config/
│   ├── navigation.js      Sidebar order, labels, page titles and who can open each page
│   ├── statuses.js        Every status label + colour (badges follow automatically)
│   └── constants.js       App name, logo, service types, activities, suppliers
├── context/
│   ├── DataContext.js     Loads /api/data + /api/catalog once; lookups via byId
│   └── SessionContext.js  Demo sign-in (selected persona kept in localStorage)
├── lib/                   Plain business rules, no React (easy to unit test)
│   ├── cases.js           Case status, scan/receiving rules, overdue, history
│   ├── logistics.js       Ready-for-delivery, route plans, driver week, maps links
│   ├── reports.js         Production report + "5 insights"
│   ├── leave.js           Annual-leave totals and overlap checks
│   ├── holidays.js        Irish public holidays, production-day rules
│   ├── format.js          Dates/times (Europe/Dublin), durations
│   ├── print.js           Printable PDFs (report, tooth order, material order)
│   ├── csv.js             Clinic CSV/JSON import + template
│   ├── api.js             Axios calls to the backend
│   └── notify.js          Toasts + demoSave() (the Phase 2 hook)
├── components/
│   ├── ui/                shadcn/ui primitives (button, dialog, tabs…)
│   ├── common/            Shared pieces: Panel, StatCard, DataTable, StatusBadge, Field, ScanBar, MonthCalendar, ConfirmAction
│   ├── cases/             Case card, board, case dialogs, receiving wizard
│   └── layout/            AppShell, Sidebar, TopBar, TV board, Account dialog
└── pages/                 One file or folder per screen
    ├── SignInPage.jsx
    ├── dashboard/         Manager + technician dashboards
    ├── ReceivingPage.jsx, CaseSearchPage.jsx, CompletionReviewPage.jsx,
    │   AttentionPage.jsx, ProductionCalendarPage.jsx, OwnerControlPage.jsx, OtherWorkPage.jsx
    ├── technicians/       Technician cards + staff dialog (also used for managers & drivers)
    ├── tooth/             Tooth Order (technician) + Tooth Orders (manager)
    ├── materials/         Order TDS (catalogue, cart, favourites) + Material Order Requests
    ├── holidays/          Technician + manager holiday screens, leave calendar
    ├── reports/           Report builder, preview, saved reports
    ├── logistics/         Deliveries & Collections: ready cases, create route, routes, clinics, drivers
    ├── driver/            Driver app: work week + mission stages
    └── tracking/          Public clinic tracking page
```

**Rule of thumb:** business rules go in `lib/`, shared visuals in `components/common/`, and each screen in `pages/`. Colours, labels and access rules go in `config/`.

---

## 3. Common changes

### Add a page
1. Create `frontend/src/pages/MyPage.jsx` with `export default function MyPage() { … }`. Use `Panel`, `DataTable`, `StatCard` and others from `components/common/`.
2. Add it to the `SCREENS` list in `frontend/src/App.js`: `["/my-page", MyPage]`.
3. Add an entry to `PAGES` in `frontend/src/config/navigation.js`:
   ```js
   { path: "/my-page", label: "My Page", icon: Star, access: (u) => u.isManager, nav: (u) => u.isManager },
   ```
   `nav` puts it in the sidebar. `access` decides who can open the URL. Leave both out to show it to everyone. The page title comes from `title` (or `label`).

### Change a status label or colour
Edit `frontend/src/config/statuses.js`. Every `<StatusBadge kind="…" value="…" />` updates.

### Change the look
Design tokens (colours, radius, fonts) are CSS variables in `frontend/src/index.css`. Brand files are in `frontend/public/brand/`.

### Change sample data
- People, clinics, vocabularies → `backend/seed/reference.py`
- Production cases (today's scenarios + history) → `backend/seed/production.py` (helpers in `seed/cases.py`)
- Routes, stops, driver plans, tracking links → `backend/seed/logistics.py`
- Leave, other work, orders, saved reports, settings → `backend/seed/workflow.py`
- TDS products / tooth groups → `backend/data/*.json`

Dates in the sample data are relative to today, so the demo always looks current. The data is rebuilt once a day. To apply your edits right away, raise `SEED_VERSION` in `backend/seed/loader.py` and restart the backend.

### Expose a new collection
Add `"apiName": "mongo_collection"` to `PUBLIC_COLLECTIONS` in `backend/core/collections.py`. It then appears in `GET /api/data` and in `useData()` on the frontend.

---

## 4. API (read-only)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{status, mode}` |
| GET | `/api/data` | All collections in one response + `settings` |
| GET | `/api/data/{name}` | One collection (e.g. `routes`, `cases`) or `settings` |
| GET | `/api/catalog` | `{materials, toothGroups}` |
| GET | `/api/tracking/{token}` | Public tracking record (400 invalid, 404 unknown/expired) |
| GET | `/api/clinics/{id}/contact` | Protected clinic contact fields |

---

## 5. Screen map (original → new)

| Original (`view` / file) | New URL | Page |
|---|---|---|
| `dashboard` | `/dashboard` | `pages/dashboard/*` |
| `receiving` | `/receiving` | `ReceivingPage.jsx` |
| `completionReview` | `/completion-review` | `CompletionReviewPage.jsx` |
| `attention` | `/attention` | `AttentionPage.jsx` |
| `productionCalendar` | `/calendar`, `/calendar/:date` | `ProductionCalendarPage.jsx` |
| `caseSearch` | `/case-search` | `CaseSearchPage.jsx` |
| `technicians` | `/technicians`, `/technicians/:id` | `pages/technicians/*` |
| `ownerControl` | `/owner-control` | `OwnerControlPage.jsx` |
| `toothOrder` / `toothOrders` | `/tooth-order` / `/tooth-orders` | `pages/tooth/*` |
| `orderMaterials` | `/materials` | `pages/materials/*` |
| `holidayRequests` | `/holidays` | `pages/holidays/*` |
| `otherWork` | `/other-work` | `OtherWorkPage.jsx` |
| `reports` | `/reports` | `pages/reports/*` |
| `logistics` (logistics.js) | `/logistics?tab=routes\|create\|clinics\|drivers` | `pages/logistics/*` |
| `driver.html` | `/driver` | `pages/driver/*` |
| `track.html?token=` | `/track?token=` | `pages/tracking/*` |
| TV Mode, Account | Top bar buttons (managers) | `components/layout/*` |

The items below were dropped on purpose because they only make sense with the old Firebase/Netlify setup: Firebase bootstrap and security-migration screens, the service worker, and the old "Dentaltech Routes" admin screens inside `driver.js`. Those admin screens could never be reached, because non-drivers were always redirected back to `index.html`.

---

## 6. Changelog — Phase 1 (rebuild)

**Structure**
- Split into a FastAPI backend (`core/`, `routers/`, `seed/`) and a React frontend (`config/`, `context/`, `lib/`, `components/`, `pages/`).
- The old code had duplicate definitions that silently overrode each other: `title`, `layout`, `receiving` and `render` in `app.js` + `enhancements.js`, and `transferLogStop`, `saveLogAddStop` and `deleteLogRoute` defined twice in `logistics.js`. These are now single definitions.
- One shared set of building blocks (Panel, StatCard, DataTable, StatusBadge, dialogs) replaces the repeated HTML strings.
- The whole interface is in English, with one visual design across every screen and mobile-friendly layouts.

**Bug fixes**
- **Saved reports** only appeared after you generated a new preview. They are now always listed on the Reports page.
- **Add Stop** was greyed out on *published* routes even though the action supports them. It is now available for published, started and on-break routes.
- **Tooth order quantity** used a browser prompt, so empty or text input could be saved as an invalid quantity. A dialog now checks shade and quantity.
- **Blocking browser pop-ups** (`alert`, `confirm`, `prompt`) are replaced with in-app dialogs and toasts. This affects holidays, orders, route deletion, holiday rejection reasons and the driver's route confirmation.
- **Dropdown options** are rendered so React shows no "invalid child" console warnings.

**Demo-only behaviour**
- At weekends, the driver app and logistics totals open on the next working day so the sample routes stay explorable. On weekdays this matches the original "today" behaviour.
- Each stop in the route dialog has a "Clinic page" link to its public tracking page, because tracking emails are not really sent.

---

## Next steps (Phase 2)

Every write action ends in `demoSave()` in `frontend/src/lib/notify.js`, so they are easy to find with `grep -rn demoSave frontend/src`. To make one real:
1. Add a `POST`/`PATCH` endpoint in a backend router (validate with a Pydantic model and store with `BaseDocument.to_mongo()`).
2. Add the call to `frontend/src/lib/api.js`.
3. Replace the `demoSave(…)` call with the API call, then refresh with `queryClient.invalidateQueries({ queryKey: ["data"] })`.
4. Stop the daily re-seed in `backend/seed/loader.py` so saved data is kept.

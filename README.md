# Dentaltech Daily Flow — Project Guide

Daily Flow runs the Dentaltech lab day to day. It covers receiving, production boards, completion review, reports, orders, holidays, deliveries and collections, a driver app and a public clinic tracking page.

It used to be one Firebase + vanilla JS bundle (`app.js`, `logistics.js`, `enhancements.js`, `driver.js`, `track.js`). It is now a **React frontend** and a **FastAPI backend** with **MongoDB**. Each part lives in one clear place.

> **The app uses seeded demonstration records.** Authentication, technician-account creation, and Deliveries & Collections changes are saved in MongoDB. Other workflow write actions remain demo-only. Logistics changes are retained across the daily sample-data refresh.

---

## 1. Run the project

| Service  | Where                        | Notes |
|----------|------------------------------|-------|
| Backend  | `backend/` → `server.py` on port 8001 | All routes start with `/api`. |
| Frontend | `frontend/` (CRA + Tailwind) on port 3000 | Calls `http://localhost:8001` by default; override with `REACT_APP_BACKEND_URL`. |
| Database | MongoDB from `MONGO_URL` / `DB_NAME` in `backend/.env` | The sample data is filled in automatically. |

Add the required settings from `backend/.env.example` to `backend/.env` before starting the backend. The backend refuses to start without a random `AUTH_SECRET_KEY`. On the first visit to the website, create the owner account in the setup form.

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

For a backend running on a different address, set `REACT_APP_BACKEND_URL` in `frontend/.env` (for example, `REACT_APP_BACKEND_URL=http://localhost:8001`) and restart the frontend.

### Staff sign-in

On first visit, the website prompts you to create the owner account. The password must contain 12–72 UTF-8 bytes. This one-time setup is stored in MongoDB and is disabled as soon as the owner account exists. Generate `AUTH_SECRET_KEY` with `openssl rand -hex 32`; use a different secret in each environment. In production, set `AUTH_COOKIE_SECURE=true` and configure `CORS_ORIGINS` with the exact frontend origin(s), comma-separated.

Sign-in uses a 30-minute JWT in an HttpOnly cookie. Passwords are bcrypt-hashed; session data is not stored in browser local storage. Sign-in attempts are throttled after five failures per client IP/email pair for 15 minutes. The owner can create manager accounts through **Ownership & Managers** and deactivate or reactivate manager accounts there; deactivation also invalidates existing sessions. Owners and managers can create technician accounts through **Technicians → Add Technician**. Drivers and clinics are managed separately through the **Drivers** and **Clinics** sidebar pages and selected when building routes in **Deliveries & Collections**. These are separate roles: manager accounts have no technician department and cannot be used as technicians. Accounts receive unique IDs, can sign in immediately and survive the daily demo refresh; credentials are stored in MongoDB's `auth_users` collection. Clinic contact fields and notes are AES-GCM encrypted using a key derived from `AUTH_SECRET_KEY`; keep that secret stable or existing clinic data cannot be decrypted. The owner can transfer ownership to an active manager from **Ownership & Managers**; the former owner becomes a manager, and the new owner's previous sessions are invalidated. Ownership transfer uses a MongoDB multi-document transaction, so the configured MongoDB deployment must support transactions (a replica set or sharded cluster). The old persona picker is removed: demo staff and drivers are not valid login accounts. Driver authentication is not yet included.

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
│   ├── collections.py     API name -> Mongo collection (one place to expose data)
│   └── security.py        Password hashing, signed sessions and auth dependencies
├── routers/
│   ├── auth.py            Login/logout/current user + manager and technician account administration
│   ├── data.py            GET /api/data (everything) and /api/data/{name}
│   ├── catalog.py         GET /api/catalog (TDS materials + tooth groups)
│   └── logistics.py       Public clinic tracking + authenticated logistics/clinic/driver writes
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
│   └── SessionContext.js  Cookie-backed authentication session
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
│   └── notify.js          Toasts + demoSave() for workflow actions not yet wired to the backend
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
    ├── logistics/         Deliveries & Collections: ready cases, create route and routes
    ├── clinics/           Clinic directory, editing and CSV/JSON import
    ├── drivers/           Driver directory and account management
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

Demo technician accounts and technician-linked example records are not seeded. Technician accounts created through the app remain available.

### Expose a new collection
Add `"apiName": "mongo_collection"` to `PUBLIC_COLLECTIONS` in `backend/core/collections.py`. It then appears in `GET /api/data` and in `useData()` on the frontend.

---

## 4. API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{status, mode}` |
| GET | `/api/auth/setup` | Whether the initial owner account still needs to be created |
| POST | `/api/auth/setup` | Create the one-time owner account; sets an HttpOnly session cookie |
| POST | `/api/auth/login` | Sign in with `{email, password}`; sets an HttpOnly session cookie |
| POST | `/api/auth/logout` | Revoke the current session and clear its cookie |
| GET | `/api/auth/me` | Current authenticated staff account |
| POST | `/api/auth/technicians` | **Owner only.** Create a technician account |
| GET | `/api/data` | **Authenticated.** All collections in one response + `settings` |
| GET | `/api/data/{name}` | **Authenticated.** One collection (e.g. `routes`, `cases`) or `settings` |
| GET | `/api/catalog` | **Authenticated.** `{materials, toothGroups}` |
| GET | `/api/tracking/{token}` | Public tracking record (400 invalid, 404 unknown/expired) |
| GET | `/api/clinics/{id}/contact` | **Authenticated.** Clinic contact fields |
| POST | `/api/receiving/cases` | **Manager or Digital technician.** Create a case or re-enter a completed case |
| POST | `/api/receiving/cases/{id}/restore` | **Manager or Digital technician.** Restore a removed case to the queue |
| PATCH | `/api/receiving/cases/{id}` | **Manager or Digital technician.** Update case department, status and responsible technician |
| PATCH | `/api/receiving/cases/{id}/attention` | **Manager or Digital technician.** Update attention status with a required reason (max. 100 characters) |

Technician and case department values use `prosthesis`, `ortho` or `digital`.
Existing `denture` department values are migrated to `prosthesis` at backend startup.

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
- Tracking email delivery is not configured; route dialogs provide public clinic tracking links instead.
- Logistics UI changes are persisted through the backend. The seed loader retains logistics collections across daily refreshes while refreshing time-relative production samples.

---

## Remaining backend work

Workflow write actions outside Deliveries & Collections and Receiving still end in `demoSave()` in `frontend/src/lib/notify.js`. To make one real:
1. Add a `POST`/`PATCH` endpoint in a backend router (validate with a Pydantic model and store with `BaseDocument.to_mongo()`).
2. Add the call to `frontend/src/lib/api.js`.
3. Replace the `demoSave(…)` call with the API call, then refresh with `queryClient.invalidateQueries({ queryKey: ["data"] })`.

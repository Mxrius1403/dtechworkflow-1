# PRD — Dentaltech Daily Flow (reorganization)

## Original problem statement
"this is my project right now. I want to organize it. Organize the whole project and make it in a framework for easier changes."
Uploaded: Dentaltech-rotas-casos-prontos.zip (Firebase + vanilla JS: app.js, logistics.js, enhancements.js, driver.js, track.js).

## Current product direction
Use a clean frontend/backend split (React + FastAPI + MongoDB), English UI, a consistent design, authenticated production data, and the project guide in `README.md`.

## Users
Owner, Managers, Technicians (denture / ortho / digital), Drivers, Clinics (public tracking link). Developers changing the code.

## Architecture
- backend: core/ (config, db, models, collections, production calendar), routers/, data/*.json
- frontend: config/ (navigation, statuses, constants), context/ (Data, Session), lib/ (business rules and API), components/ (ui, common, cases, layout), pages/
- Startup must not create or refresh application records.

## Implemented
- React frontend and FastAPI backend with MongoDB persistence, authenticated staff accounts, receiving, logistics management, orders, reports and public tracking.
- Production calendar and work vocabulary are implemented independently of any generated data.

## Backlog
- Implement server-backed completion review, remaining case-management actions, account profile edits, and driver route progress before relying on those workflows.
- Add search, filters, and exports as operational needs are defined.

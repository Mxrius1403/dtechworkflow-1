# Security Review

## Scope

Review of the project for vulnerabilities that could allow an attacker to access data without authorization.

## Findings

### MEDIUM — Missing role-based access control on data endpoints

- **File:** [`backend/routers/data.py`](backend/routers/data.py)
- **Lines:** 76-87, 106-130, 134-151
- **Confidence:** 9/10
- **Impact:** Authenticated technicians can retrieve collections beyond their role, including clinics, routes, stops, and drivers. The collection endpoint also serves requested public collections without checking the caller's role. In addition, drivers receive the full clinic list rather than only clinics associated with their assigned routes. This can expose clinic names, addresses, Eircodes, and logistics information to lower-privilege accounts.
- **Cause:** The API does not enforce the role restrictions applied by the frontend navigation. Client-side page restrictions do not prevent direct API requests.
- **Recommended remediation:** Enforce role-based authorization and record filtering on both data endpoints. Limit each role to the collections and records it is authorized to access; for drivers, include only clinics referenced by their assigned routes.

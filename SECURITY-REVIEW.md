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
- **Status:** Fixed in `backend/routers/data.py`. Both data endpoints now enforce role-specific collection allowlists. Driver responses include only their assigned routes, stops, and clinics referenced by those stops. Technicians receive only supplier IDs and names needed to place material orders.
- **Verification:** `backend/tests/test_data_security.py` and `backend/tests/test_logistics_routes.py` pass (20 tests).

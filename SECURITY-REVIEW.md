# Security Review

**Review date:** 2026-10-12  
**Scope:** Repository-wide review for vulnerabilities that could enable unauthorized access.

## Findings

### MEDIUM — Technicians can read manager-only saved reports

- **Location:** [`backend/routers/data.py`](./backend/routers/data.py), lines 114–141
- **Confidence:** 8/10
- **Issue:** The authenticated `GET /api/data` endpoint includes every entry in `PUBLIC_COLLECTIONS`, including saved reports, without filtering reports by role. The `GET /api/data/{name}` endpoint likewise returns any public collection to any authenticated account. These endpoints do not enforce the manager-only restriction used by the frontend and report-writing flow.
- **Impact:** An authenticated technician can directly request `GET /api/data/reports` or `GET /api/data` and read saved report contents, potentially exposing production metrics and case or technician details.
- **Status:** Fixed. The aggregate endpoint omits reports for non-managers; direct report requests return HTTP 403 unless the account is an owner or manager.
- **Validation:** `backend/tests/test_data_security.py` covers aggregate and direct access for technicians, drivers, managers, and owners.

## Review notes

This report records the actionable finding from the repository-wide security review and its remediation.

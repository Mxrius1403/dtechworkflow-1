# Security Review

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | HIGH | backend/server.py, backend/core/security.py, all routers except routers/auth.py | server.py 91-97 | CSRF: origin check only applied to `/api/auth/*` | 8/10 |
| 2 | MEDIUM | backend/routers/auth.py | 90-150 | Unauthenticated `POST /api/auth/setup` allows claiming the owner account | 7/10 |

## 1. CSRF on state-changing routes (HIGH)
`require_allowed_origin` is only used in `routers/auth.py`. In production the session cookie is `SameSite=None`, and FastAPI 0.110.1 parses JSON bodies sent as `text/plain`, so a cross-site POST needs no preflight. A logged-in owner/manager visiting an attacker page can be made to e.g. create a driver account (`POST /api/drivers`) with a known password, giving the attacker persistent access, or modify routes, clinics and orders.

**Fix:** apply the Origin/Referer check (or a CSRF token) globally to all non-GET methods, require `Content-Type: application/json`, and use `SameSite=Lax/Strict` where the frontend is same-origin via the proxy.

## 2. Open owner setup endpoint (MEDIUM)
`POST /api/auth/setup` creates the `OWNER001` account with full privileges whenever it does not exist, without any secret. On a fresh or reset deployment, the first external caller can take over the owner account.

**Fix:** require a one-time setup secret from the environment, or disable the endpoint after initial setup.

## Notes
JWT handling (pinned HS256, claims/issuer check, authVersion revocation, 32-byte min key) and secret management (`.env` untracked) are sound.

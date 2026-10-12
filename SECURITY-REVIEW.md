# Security Review

The reported vulnerabilities have been fixed.

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | HIGH | Cross-site requests could mutate API state because origin validation covered only authentication routes. | All state-changing `/api` requests now require a trusted `Origin` or `Referer` matching `CORS_ORIGINS`. |
| 2 | MEDIUM | The first caller could claim the initial owner account without authorization. | Setup now requires the configured `OWNER_SETUP_SECRET` and remains unavailable after the owner account is created. |

Set `OWNER_SETUP_SECRET` to a unique random value of at least 32 bytes. The owner setup form sends it in the `X-Setup-Secret` header, not in the request body.

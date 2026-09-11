# Same-origin API

All responses under /api are no-store. Mutating browser requests must supply exact configured Origin. Protected requests use HttpOnly fp_session. Requests use strict Zod schemas; browser org/role/employee/points/amount/fraud input is rejected.

| Endpoint | Access / purpose |
|---|---|
| POST /api/login | Station/code/password; database attempt limits |
| GET /api/me | Authenticated identity |
| POST /api/logout | Revoke current session |
| POST /api/password | Current/next password; revoke all own sessions |
| GET /api/health | Database connectivity readiness |
| GET /api/catalog | Own organization and pump/fuel catalog |
| GET /api/transactions?offset=0 | Own authorized history, 100 rows/page |
| POST /api/transactions | Validated sale, UUID idempotency, authoritative effects |
| GET /api/dashboard | Manager/owner database metrics |
| GET /api/points?plate=... | Manager/owner balance and recent ledger |
| GET/POST /api/staff | Manager/owner staff operations |
| POST /api/staff/:id | Allowed target name/code/active update; revoke sessions |
| POST /api/staff/:id/credential | Scoped retrieve/change with reauthentication/audit |
| POST /api/fuels | Manager/owner price create/update |
| POST /api/pumps | Manager/owner compatible pump creation |
| POST /api/pumps/:id | Manager/owner activation |
| POST /api/settings | OWNER points policy |
| GET /api/audit | OWNER audit log |
| GET/POST /api/coupons | Manager/owner list/issue |
| POST /api/coupons/redeem | Authenticated atomic plate-bound redemption |

Errors: 400 validation, 401 authentication, 403 forbidden role/origin, 409 conflict/invalid redemption, 429 rate limit, 500 sanitized server error. Some credential reauthentication outcomes return an explicit error field after committing attempt/audit state; the UI checks this field. Never log request bodies or returned credentials.

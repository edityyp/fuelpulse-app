# Security review — current reconstruction

Fresh internal implementation review and automated tests completed; NOT a penetration-test certification or blanket claim of security.

## Implemented
- Async scrypt N=131072,r=8,p=1; random 16-byte salt; 64-byte derived key; timing-safe compare.
- Random 32-byte opaque session, only SHA-256 digest stored. HttpOnly, SameSite Strict, Secure in production; 8h employee / 2h owner-manager; explicit logout/expiry/activation and password-change revocation.
- Atomic PostgreSQL 15-minute account/IP login windows (5/account,50/IP); generic errors/dummy hash for absent account. Reauthentication attempts separately limited. Additional per-process HTTP rate limit 300/minute/IP.
- AES-256-GCM optional operational password copy with random 96-bit nonce and tenant:user additional authenticated data. Server-only 32-byte key, no-store responses, reauthentication, scoped retrieval, audit and 30-second UI clear. Login still uses hash. Prefer reset-only mode.
- Tenant RLS + strict server RBAC and composite FKs. Parameterized SQL, no client query fragments. Strict schemas prevent mass assignment. Immutable history grants. Expected-actor header protects queued entry/account mismatch.
- Exact-origin write validation, no cross-origin access permission, Helmet/CSP, React text escaping, 16KB request limit, redacted logs, generic internal errors. No server file upload or command/path execution from input.
- Browser OCR file size/type checks; images never uploaded to app API. QR is strict random FP1 code, never executed/navigated; server validates org/plate/expiry/unused state.
- Transaction locks/unique constraint/daily UPSERT and conditional coupon UPDATE tested under concurrency.

## Review scope and evidence
Authentication/authorization/RLS/IDOR/privilege escalation, session/cookie security, login limits, SQL injection/mass assignment, CSRF/XSS/CSP, secrets/logging, image/QR input, local queue, races and audit integrity. See tests/security.test.ts (24 current tests). Production dependency audit returned zero known vulnerabilities during this run. This does not prove absence of unknown vulnerabilities.

## Deployment gates
No trusted proxy is enabled by default. Configure explicit trusted proxy addresses and external WAF/global rate limits before scaling; per-process HTTP limits are not distributed, though login windows are shared PostgreSQL state. Validate TLS and DB certificate checking; never disable certificate verification. Default local PostgreSQL trust fixture is localhost-only and must never be used for production.

Use least-privileged runtime database login; never migration admin/postgres/service-role browser access. Do not expose app schema in Supabase Data API. Audit/credential access is a trusted server boundary. Database credentials can set server context and are inherently sensitive.

Key rotation/re-encryption, MFA/account recovery, independent pen-test, sustained load sizing, disaster restore, alerts and retention policy remain release gates. Do not replace CREDENTIAL_KEY without re-encrypting stored passwords under a reviewed procedure. Shared-device queue contains plates; browser/OS users with devtools can inspect them. Use OS profiles, device encryption and kiosk locking. Offline cache is not a business-data backup.

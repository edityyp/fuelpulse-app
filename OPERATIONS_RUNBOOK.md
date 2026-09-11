# FuelPulse Operations Runbook

## Routine checks

- Application: https://fuelpulse-app-production.up.railway.app
- Health: https://fuelpulse-app-production.up.railway.app/api/health
- Expected health response: HTTP 200, `{"status":"ok"}`
- Confirm Railway deployment status is `SUCCESS` and commit matches approved `main`.
- Review Railway deploy/error/network logs without printing environment-variable values.
- Review Supabase database health, backups, storage, connections, and security advisors.

## Incident response

### Health endpoint fails

1. Check Railway deployment and container logs.
2. Confirm all five required variable names exist; never expose their values.
3. Test Supabase session-pooler reachability and TLS certificate validity.
4. Confirm `fuelpulse_runtime` still has the restricted attributes and `fuelpulse_gateway` membership.
5. Roll back to the last known-good Railway deployment if a recent application change caused the failure.

### Authentication failures

1. Check persistent `login_limits` and `login_events` records.
2. Confirm the client IP is resolved through exactly one trusted Railway proxy hop.
3. Use OWNER controls to reset credentials; never edit credential hashes manually.
4. Revoke affected sessions and review audit logs.

### Transaction dispute

1. Preserve transaction, audit, points-ledger, coupon, and idempotency records.
2. Never edit or delete immutable transaction history.
3. Export relevant records for investigation while preserving tenant boundaries.
4. Record any correction as a new authorized compensating workflow, not a rewrite.

## Secret rotation

- Rotate `CREDENTIAL_KEY` only with a planned credential re-encryption/rehash strategy; changing it alone may invalidate retrievable credentials.
- Rotate the runtime database password by generating it securely, applying it to `fuelpulse_runtime`, updating Railway over a secret channel, redeploying, and verifying health before retiring temporary material.
- Revoke exposed sessions immediately.
- Never place passwords, database URLs, keys, or tokens in Git, logs, chat, or documentation.

## Backups and restore

Confirm Supabase backup/PITR availability in the current plan. Schedule and document a real restore drill. Database consistency tests do not replace a restore test.

## Certificate maintenance

Track the pinned Supabase root certificate expiry (2031-04-26) and Supabase CA-rotation announcements. Test the replacement with strict hostname verification before deployment.

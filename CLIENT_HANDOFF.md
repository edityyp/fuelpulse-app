# FuelPulse Client Handoff

## Production access

- Application: https://fuelpulse-app-production.up.railway.app
- Repository: https://github.com/edityyp/fuelpulse-app
- Branch: `main`
- Deployed application commit: `a14ead07bd15ec09fc13f367bc808cb0e29ee66c`
- Station ID: `fuelpulse-main`
- Time zone: `Asia/Kolkata`

Initial OWNER and QA staff credentials are delivered separately in the secure `FuelPulse-owner-credentials.txt` handoff file. No passwords, database URLs, private keys, or tokens are stored in GitHub.

## First client actions

1. Sign in as OWNER and change the temporary OWNER password immediately.
2. Store the replacement in a password manager and delete the handoff file.
3. Review the QA MANAGER and EMPLOYEE accounts; deactivate or replace them after acceptance.
4. Review the configured `Petrol` fuel and `Pump 01`, then edit/add the station's real catalog.
5. Keep the five immutable QA transactions as acceptance evidence; their plates begin with `QA` or `PW` and they must not be represented as real sales.

## Verified production state — 2026-09-09

- Railway deployment status: `SUCCESS`.
- `GET /api/health`: HTTP 200 with `{"status":"ok"}`.
- One organization, three users, one fuel, one pump.
- Five immutable QA transactions and five matching points-ledger rows.
- Two fraud transactions, exactly as expected from the same station + pump + plate + business-day rule.
- One redeemed single-use QA coupon.
- No ledger mismatch and no duplicate idempotency key.
- Live OWNER, MANAGER, EMPLOYEE, session, CSRF, transaction, fraud, idempotency, coupon, audit, PWA, offline queue, reconnect, OCR, and mobile checks passed.

## Manual acceptance items

The automated suite exercised a synthetic image through OCR and verified manual confirmation. A client should still test on the actual target phones:

- physical camera permission and real number plates;
- physical microphone permission and voice recognition quality;
- install prompt and home-screen launch on intended Android/iOS devices;
- printer/scanner integrations, if any are added later;
- a real restore drill and the Supabase dashboard's current backup/PITR entitlement.

## Support boundary

FuelPulse is deployed and usable. Any future custom domain, payment integration, SMS/email provider, hardware integration, or app-store packaging is a separate optional deployment step.

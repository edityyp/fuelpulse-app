# Operations

- Review fraud indicators and device-local pending queues. Fraud records still represent recorded fuel sales but earn zero points. Third and later same-day/pump/plate submissions are flagged.
- Pending entries are not confirmed records. Reconnect and sign in as the original staff user before retry. Do not clear browser data while pending entries exist. A failed request retains its UUID; investigate existing server record before creating a replacement key.
- Permanent queue validation failures remain visible/retryable; correction/discard UI is not yet implemented. Use controlled support review, not blind developer-tools edits or clearing storage.
- Catalog/policy changes apply at server acceptance, including offline fills. Communicate pricing implications to staff.
- Disable compromised staff to revoke sessions. Authorized password changes revoke sessions. Credential retrieval is optional and audited; prefer reset-only. Do not change encryption key without a reviewed re-encryption/key-retention procedure.
- Define retention for plate/personal data, login events and audits. Schedule maintenance-role cleanup of expired sessions/stale rate-limit windows. Do not grant history deletion to runtime.
- Enable protected managed backups/PITR, exercise restore to isolated database, and define RPO/RTO before production. Never commit sensitive dumps. Source GitHub commits and exported source ZIPs are not database backups.
- Protect shared devices with OS profile separation, encryption and kiosk locking. Browser local storage/IndexedDB is inspectable by someone with access to the same browser profile. Treat queued plates as personal operational data.
- Proxy configuration defaults to trustProxy=false. Before production, set an explicitly trusted proxy topology, global WAF/distributed API limits and alerts. Database login limits are shared; general HTTP limit is per process.
- Monitor health/5xx/lockouts/queue rejection and sustained resource usage. Load tests, backup restore and alert delivery are NOT VERIFIED in this run.

Troubleshooting: 401 reauthenticate; 403 role/origin; 409 duplicate-payload/coupon conflict; 400 invalid input; unavailable pump requires active compatible fuel; OCR manual fallback for missing model/camera; microphone varies by browser/provider. PWA requires HTTPS or localhost. Close old tabs to activate a new service worker; never clear a pending queue just to update assets.

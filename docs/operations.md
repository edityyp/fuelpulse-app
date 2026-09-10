# Operations

## Provision a new customer company/station

Each paying business customer must have a separate organization with a unique Station ID. Never add a different company as staff inside an existing customer station. Forced PostgreSQL row-level security scopes staff, transactions, vehicles, customer records, points, rewards, pumps, and reports to the signed-in organization.

1. Choose a unique lowercase Station ID such as `green-fuels-delhi`. It is permanent login information, not a secret.
2. Use an administrative database connection only for the one-off command. Never expose it to the browser or leave it configured in the runtime service.
3. Run the provisioning command from a trusted operator terminal:

```bash
PROVISION_STATION=green-fuels-delhi \
PROVISION_NAME="Green Fuels Delhi" \
PROVISION_OWNER_NAME="Green Fuels Owner" \
PROVISION_FUEL_PRICE_PAISE=10000 \
MIGRATION_DATABASE_URL="$PRIVATE_ADMIN_DATABASE_URL" \
npm run provision:station
```

4. The command atomically creates the organization, OWNER, password hash, default fuel, Pump 01, and pump/fuel link. It refuses a duplicate Station ID.
5. Copy the displayed Station ID, OWNER code, and generated initial password into a password manager. Give them privately to the customer. Do not send passwords in a public chat or shared document.
6. Ask the OWNER to sign in, verify the Station ID shown in the app header/Profile, change the initial password, set the real fuel price, and add only that station's managers/employees from **Staff**.
7. Remove the administrative database URL from the terminal/session after provisioning.

Repeat this command with a different Station ID for every new business customer. A customer station's OWNER can create MANAGER and EMPLOYEE accounts inside that station, but cannot view or create another organization.

## Plate recognition

- Uploaded plate photos are processed by the authenticated `POST /api/alpr` route using FastALPR 0.4.0, a Python/ONNX runtime licensed under MIT. The packaged detector is `yolo-v9-t-384-license-plate-end2end` and OCR model is `cct-xs-v2-global-model`; see `THIRD_PARTY_NOTICES.md`.
- The application streams the image to the worker for inference and does not persist it. The route accepts only JPEG, PNG, or WebP images up to 4 MB.
- Uploaded-photo recognition tries server-side FastALPR first. Browser OCR and manual plate entry remain fallbacks. Staff must verify the recognized number before submitting a transaction.
- The live camera guide remains device/browser dependent. Validate camera permission, focus, glare, framing, and real local number plates on representative Android and iOS phones before operational rollout.

## Customer records and loyalty rewards

- OWNER can set the reward name, required points, and exact free-fuel quantity under **Points**. MANAGER and EMPLOYEE cannot change the reward rule.
- OWNER, MANAGER, and EMPLOYEE can register a consenting customer's name, mobile number, and vehicle inside their current station. The employee navigation exposes registration but not the full customer directory; the server also guards the directory route for managers/owners.
- After a plate scan or manual lookup, staff receive only an operationally limited profile: name, masked phone, points balance, last visit, and available rewards.
- The public customer portal needs only Station ID and vehicle number. It deliberately omits the customer's name, phone, full profile, and cross-station data.
- When usable earned points reach each configured threshold, FuelPulse issues durable single-use reward entitlements. Issuance is bounded to 100 entitlements per lookup to limit abuse and pathological catch-up.
- The customer portal shows the unlocked reward and QR immediately. Browser notification is optional and occurs only when permission was already granted. FuelPulse does not send SMS or external push notifications in this release.
- At redemption, staff must verify the plate and reward quantity, select the actual pump and fuel, dispense the free fuel, scan or enter the single-use reward code, and confirm. The server records employee, pump, fuel, quantity, and timestamp atomically; a redeemed code cannot be reused.

## Production verification record

- Production migration `reward_entitlements` was applied only to the approved Supabase project. The table has ENABLE RLS and FORCE RLS, and the customer/vehicle write policies were split by operation.
- GitHub `main` release commit `af5d38cfd1423e6e0ad15795d7a9313c237db8c3` built and is served by Railway. The deployed client contains FastALPR, reward QR/redemption, employee registration, and owner loyalty controls.
- Public production checks passed for health, PWA manifest/service worker, customer portal rendering, privacy-limited empty-vehicle lookup, and the unauthenticated ALPR 401 boundary.
- Local FastALPR runtime validation passed on an upstream real plate image. Authenticated production ALPR inference, employee registration, entitlement issuance/redemption, and physical real-phone camera behavior still require a fresh authorized staff session and representative devices; do not describe those checks as completed until they are run.
- Railway dashboard/CLI logs were not inspected in this release pass because the stored Railway authorization had expired. Public health and the newly built asset verify the running release, but not internal build-log details.

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

Troubleshooting: 401 reauthenticate; 403 role/origin; 409 duplicate-payload/coupon/reward conflict; 400 invalid input; unavailable pump requires active compatible fuel; OCR/manual fallback for missing model/camera; microphone varies by browser/provider. PWA requires HTTPS or localhost. Close old tabs to activate a new service worker; never clear a pending queue just to update assets.

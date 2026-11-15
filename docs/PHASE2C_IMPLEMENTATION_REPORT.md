# Disaster Management — Phase 2C implementation and security decisions

**Scope:** P2‑06, P2‑07 and P2‑08 on a separate review branch. No deployed change or database migration. Review and test before merge.

## 1. Changes visible in the UI

| Area | Implementation | Explicit boundary |
| --- | --- | --- |
| Tour: Address | Optional **Test location once** on step 4; result describes success, denial or timeout; manual addresses remain usable. | Never saves or displays coordinates; no map, background geofence or automatic route selection. Browser permission grants can be revoked in browser site settings. |
| Tour: Consent | Step 7 offers **Check browser status** and **Review privacy settings**. | No Akatsuki, Bluetooth, calendar, notification or cloud permission is requested. |
| Settings: Privacy | Read-only browser geolocation and notification status; optional deliberate **Test location once** and **Request protected storage** actions. | `Permissions.query()` only observes status. `StorageManager.persist()` is best-effort, not a guaranteed backup. Notifications remain unimplemented. |
| Settings: Backups | Original **Export JSON backup** remains; new **Export encrypted backup** uses a user-chosen password; imports first show a **preview**. | Plain JSON contains readable personal data. Encrypted file creation/decryption needs secure-context Web Crypto; no account or data upload. |
| Import recovery | Cancel, compatibility check, separate Apply + confirmation, one-slot local pre-import recovery copy, Review/Download previous copy, exact-byte undo for previous snapshots. | Import replaces records, never merges automatically; storage failure refuses replacement. Local undo copy is unencrypted and erased with app data. |
| Settings: Sync | Explicit **design stage / Not connected** label. | No account, sync queue, server, Akatsuki contract or remote data transfer yet. |

## 2. Data compatibility and recovery contract

- Existing key remains **`disaster-management:v1`**, schema `version:1`; existing Phase 1 / Phase 2A / Phase 2B fields remain the same. This phase adds no persistent fields and does not automatically rewrite storage on startup.
- Existing bare JSON v1 export/import remains supported, including Phase 2B quantity, expiry, custom go-bag items, embassy self-report, contacts, incident progress and historical logs. `MIGRATIONS` remains an explicit version-step registry; no migration has been activated because the stored schema version did not change.
- The encrypted *file envelope* has an independent `formatVersion:1` and `schemaVersion:1` and contains no plaintext names, addresses, contacts or logs in its unencrypted header. It uses random 16-byte salt, PBKDF2-HMAC-SHA256 at 600,000 iterations, AES-256-GCM with random 12-byte IV and a 128-bit tag, implemented using browser Web Crypto. Passwords are never persisted. Future unsupported format/schema/algorithms are rejected.
- Imports use a **2 MB limit** and validate format/structure before preview. An import with known record-array counts beyond the current normalizer's limits is rejected to avoid silent truncation. The selected backup is staged in memory; **nothing is written** at file selection, decryption, cancellation or invalid-password failure.
- Applying import requires a separate confirmation. Before writing to the original key, its **exact existing bytes** are copied into `disaster-management:preimport:v1`. If this copy fails (for example quota), replacement is refused. If replacing the active key fails, the app retains the original bytes and tries to restore the former recovery slot.
- The local recovery slot is **not encrypted**, holds at most **one** previous copy and is overwritten on the next successful replacement. It can be downloaded as raw JSON or reviewed for restoration; compatible snapshots are restored as exact original bytes. Incompatible raw snapshots can be restored explicitly into the app's existing quarantine mode for later recovery with a compatible version. This is not automatic history, a cloud backup or a substitute for an external backup.
- Erasure clears only the two owned keys. The service worker uses the `disaster-management-app-v9` namespace and deletes only older caches in its own namespace; all other same-origin apps' caches and local storage are out of scope.
- Browser site-data clearing, quota eviction, device loss, a forgotten password or storage corruption can still make records unrecoverable. Keep an independently stored backup and **test restoring it**.

## 3. Consent and browser API reality

| Capability | This phase | Failure / fallback |
| --- | --- | --- |
| Browser geolocation query | Read status only, after tap | Query unsupported → unknown; no geolocation prompt. |
| Browser geolocation test | Calls `getCurrentPosition()` **only after tap** | Denied, timed out or unavailable → manual address and official shelter check. Coordinates never stored, logged or transmitted. |
| Notifications | Read `Notification.permission` if available | No request, alert scheduling or background notification. |
| Persistent storage | Calls `navigator.storage.persisted()` to check, `persist()` only on user tap | Denied/unsupported → best-effort browser storage and manual file backups. |
| Browser contacts / calendar / Bluetooth / Akatsuki | No permission, connector or synchronization | Honest **Not connected** status; use existing manual features. |

The app never requests geolocation or background permission at first load. The user may already have browser-level grants for this origin, so status is not evidence that this app collected data. A one-time location test might leave a *browser-level* grant; revoke it in site settings if desired. The app has no background location watcher.

## 4. Future opt-in synchronization — architecture proposal only

Do **not** implement cloud tables, credentials, Auth, RLS, cross-app grants or data upload as part of Phase 2C. The following are release gates for a separately approved future phase.

1. **Identity and separation:** Determine whether Disaster Management and Akatsuki share an authentication authority. Require verified ownership and per-user row-level access enforcement server-side. Never infer ownership of anonymous legacy records or attach them to another account.
2. **Explicit data scopes, default off:** Present independent permission switches for low-risk readiness/status summaries, general rules, contact details, addresses/shelters, incident logs and Night Out notes. Highly sensitive categories start excluded; an “all apps” blanket consent is prohibited. Consent must name destination app, purpose, data category, retention and revoke action.
3. **Local-first state:** Keep the device's v1 data usable offline. Introduce a versioned sync envelope *in addition* to the old storage key, not a destructive storage migration. Use durable per-device change IDs, version/updated timestamp, deletion tombstones and an offline outbox. Do not interpret “queued” as “delivered.”
4. **Contract boundary for Akatsuki:** Propose an event contract such as `{schemaVersion, sourceApp, eventId, category, state, occurredAt, payloadRef}`. Expose minimal *task/reminder metadata* by default, not raw contact numbers, home addresses, personal logs or document contents. Confirm/acknowledge/snooze statuses must be idempotent and attributable to the same owner.
5. **Conflicts and recovery:** Define multi-device merge rules per record type; never silently last-write-wins on critical incident records. Surface queued, failed, stale, conflict and revoked states, allow preview before applying a remote restore, and require explicit user choice for irreconcilable changes.
6. **Security and retention:** Define authentication, authorization/RLS, transport security, backups, encryption/key management, revocation and erasure semantics before connection. A backup-password-derived key is **not** a login credential or sync encryption protocol. Test hostile clients and account separation.
7. **Release tests:** Two-device offline edits, replay/deduplication, delayed access revocation, stolen/expired sessions, identity changes, corrupt remote record, concurrent conflict, network interruption, quota pressure and an actual cross-app integration with no contact leakage.

**Current release decision:** Sync stays *Not connected*. This phase only documents the gates and reserves no cloud tables or endpoints.

## 5. Verification and manual acceptance

Automated:

- `tests/phase2c.test.mjs`: no automatic permission request, explicit geolocation and storage flows, denial/unsupported fallback, old v1 data preservation, preview/cancel/confirm, failed snapshot, exact-byte recovery and future-version quarantine, encrypted AES-GCM roundtrip/wrong password/tampering, safe erase and v9 PWA scope.
- `tests/phase2c-browser.test.mjs` (Chromium CI required): real 320/375/412/768 responsive UI, permission stubs, plaintext preview/cancel/apply and previous snapshot undo, encrypted file export/invalid password/decrypt/apply, offline reload and same app-owned cache; screenshot artifacts for review.
- All existing Phase 1S–2B Node/browser regression suites remain in CI; earlier immediate-import test flows now explicitly apply the import preview.

Device acceptance after PR review/merge:

1. Export **unencrypted** and **encrypted** files and keep both outside the app/browser. Check the encrypted file does not contain a readable address or phone number.
2. Change a disposable contact, import the compatible file, inspect the preview, cancel, then apply. Confirm the original data is downloadable as the previous local copy and can be restored.
3. Test a wrong password, unsupported schema, denied location and unavailable storage; existing records must remain intact and manual features usable.
4. Force offline, relaunch the installed PWA on the real device and recheck the emergency guide, readiness and data. Browser cache status is not proof that maps or external documents are available.
5. Confirm no unexpected browser prompts at startup and that no Akatsuki/cloud sync is shown as active. Revoke any test location grant through browser site settings if desired.

**Rollback:** Revert the app files to the previous review-approved build only after exporting a full v1 backup. Do not clear site data. A previous app build may ignore some Phase 2B inventory fields on its next save, so avoid editing in a rollback build and restore through a compatible build. The Phase 2C encrypted envelope is not understood by older builds; keep a conventional JSON backup as well if rollback is anticipated.

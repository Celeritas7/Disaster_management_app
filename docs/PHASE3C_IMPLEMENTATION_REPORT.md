# Phase 3C — Local follow-up evidence and emergency-scenario validation

**Scope:** `P3-07`, `P3-08` in [PHASED_IMPLEMENTATION_CHECKLIST.md](PHASED_IMPLEMENTATION_CHECKLIST.md). Based on merged Phase 3B `main` (`e034acb`); one reviewable PR, not a deployment. **No cloud, OS background service, automatic call/SMS, geofence or Bluetooth connection is introduced.**

## What is visible

- Incident guide **step 7** shows **Private follow-up evidence** beneath the existing manual checklist and note. The same panel is available in **Activity Log** after the guide ends.
- User can type an optional note or choose existing image file(s), keep an **interrupted local draft**, remove draft photos, save a follow-up record, view prior observations/thumbnails and deliberately delete records after a confirmation.
- Dates label **when the user saved** a record, not when the incident happened. Stored content is labeled **self-reported, not verified / not submitted**. The UI warns against returning to an unsafe area to photograph damage and against recording identities, documents or sensitive details.
- No camera is opened automatically. No GPS, home address, severity, official status, EXIF, filename, message-delivery status or emergency action is inferred. Uploaded photos are **re-encoded in the browser as small JPEGs**, up to 960 px on the longest side, without source metadata; their *visible content* could still reveal identifying features.
- Limits: 12 saved evidence records; six total photos across draft and records, 120,000 characters per compressed photo, 650,000 characters total image data, initial image file at most 8 MB. Compression failure or exhausted browser quota refuses the new photo and leaves existing records intact. This protects the pre-existing 2 MB backup-import limit and practical offline storage.

## Compatibility and privacy

- The unchanged `disaster-management:v1` JSON now has **optional** `evidence: {draft,entries,nextId,nextPhotoId}`. Old v1 records with no `evidence` open with an empty panel. `incident.communication`, previous checklist marks, contacts, logs, rules, readiness, source metadata and `incident.note` remain intact.
- Evidence belongs to the app's top-level local record, rather than its active incident state: finishing a guide clears only that guide, **not** saved evidence or the separately persisted evidence draft.
- Normalization validates photo IDs, permitted JPEG data URLs, sizes, dimensions and record bounds; structurally damaged evidence causes the original version-1 bytes to be quarantined for manual recovery. It is **not** silently truncated on import or launch.
- Standard JSON export, optional AES-GCM password-encrypted export, import preview, import undo slot and application erasure cover evidence and its draft. The import comparison explicitly includes evidence-record and photo counts. Backups made **before deletion** can still contain deleted photos; the undo slot is also unencrypted. Photos are stored **unencrypted at rest** in browser localStorage and share the usual browser-storage retention risks. Data never automatically leaves the browser.
- Owned offline shell cache bumped from `disaster-management-app-v11` to `v12` to include `phase3c.css`. Worker cleanup remains narrowly scoped; existing same-origin apps' caches are untouched.

## Emergency scenario rehearsal matrix (`P3-08`)

| Scenario | Automated assertion | Real-device / owner acceptance still needed |
| --- | --- | --- |
| Earthquake while at home | Old saved home is displayed only as **not assumed current** in emergency phone context. It does not automatically appear in a step-3 SMS message. Guide step 1 retains `tel:119` and `tel:110`. | With real location awareness, confirm user can state their *actual* current address to a dispatcher; do **not** call emergency lines merely as a test. |
| Suspected damaged building | Step 4 retains leave-immediate-danger guidance, serious structural damage warning and **Tsunami status: UNKNOWN**. Evidence form explicitly says to prioritize safety and never re-enter for photos. | Review readability and emergency priorities outdoors in daylight/large font. Do not create hazards to test. |
| No internet | Cached app shell and local photo/draft still open on a cold reload after the browser goes offline. An unrelated PWA's CacheStorage entry remains. | Airplane-mode restart after a real install on Android and iOS/iPadOS. Cached shell is not guaranteed if site storage was cleared. |
| No contacts | Phase 3B empty-contact panel gives a copy/manual option; it does **not** invent recipients or show a sent status. Evidence panel is independent of contacts. | Check contact setup, manual dialing and local backup recovery without internet. |
| Interrupted incident or photo draft | Leave/return/reload retains the incomplete step and the evidence draft, and separate saved records persist after finishing the guide. | Check abrupt app termination, low storage, device reboot and interrupted image selection on physical phones. |
| Urgent 119 | Guide has explicit `tel:119` and `tel:110` links but the tests only **inspect their href**. Nothing calls emergency services. | Only inspect on-device dialer handoff without actually placing a test emergency call. Physical Android/iOS acceptance remains **pending `P3-05`**. |

The browser suite additionally checks 320/375/412/768 px horizontal overflow; generated-image selection and JPEG conversion; safe backup export/import/restore; refusal to delete without confirmation; and absence of outgoing network requests or JavaScript errors. Tests use a generated pixel image, never a personal photo. CI screenshots are attached as a `phase3c-mobile-reference` artifact on the PR run.

## Test and release gates

- Run `node --test tests/phase1s.test.mjs tests/phase1a.test.mjs tests/phase1b.test.mjs tests/phase1c.test.mjs tests/phase2a.test.mjs tests/phase2b.test.mjs tests/phase2c.test.mjs tests/phase3a.test.mjs tests/phase3b.test.mjs tests/phase3c.test.mjs` and `node --check app.js`.
- CI (required) runs the nine prior Playwright PWA suites plus the new Phase 3C Chromium simulation. Local execution may skip Chromium if the local host forbids browser process sockets; that is **not** considered passing device QA.
- Review phone screenshots, especially evidence note entry, photo preview and very narrow widths. Compare old `disaster-management:v1` JSON and encrypted backup restore. Test a disposable photo first; never use sensitive real photos for review/testing.
- User approval, PR merge, deployment and physical Android/iOS acceptance are **not** done by this implementation. Especially, **`P3-05` device dialer/SMS handoff remains open**; do not claim physical delivery or operator availability based on browser tests.
- `IN-24` remains partially complete overall: safe local photos and existing landlord/employer reminders are present, but no validated follow-up contact-action integration is included. Optional embassy check-in is not auto-inferred (`IN-25`).

## Next step after owner review

Review and merge the Phase 3C PR if CI passes and UI behavior is acceptable; separately perform safe physical Android/iOS read-only dialer/SMS/airplane-mode checks (never place an emergency test call), then plan Phase 4 departure and stranded assistance. Device integration feasibility must be investigated before promises of geofences, Bluetooth tags or automatic OS notifications.

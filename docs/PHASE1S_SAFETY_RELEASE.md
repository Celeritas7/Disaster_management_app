# Disaster Management — Phase 1S safety implementation and release gate

**Date:** 2026-11-15 (Japan). **Scope:** safety-only, no visual feature expansion or live emergency-feed integrations.

The `main`/GitHub Pages site must remain unchanged while this work is reviewed on a separate branch and PR. The PR must **not** be merged until the manual browser checklist below is verified on a device with access to the published test build or an equivalent local secure origin.

## Why this phase comes first

| Hazard / phase-0 source | Previous behavior | Phase 1S change | Evidence |
| --- | --- | --- | --- |
| `CF-02`, RISK-01: cross-app cache deletion | The old worker deleted **every** same-origin CacheStorage key other than its own, potentially removing another Celeritas7 PWA's offline files. | The `activate` handler now deletes only older caches matching `^disaster-management-app-v\d+$`, and retains unrelated cache names. | `tests/phase1s.test.mjs`: activation + second-app preservation |
| `CF-02`: cross-app cached responses | The old worker used global `caches.match()`, which could potentially resolve an entry from another app's cache. | Fetches only the exact shell file URLs, and reads only the named Disaster Management cache. | `tests/phase1s.test.mjs`: sibling-path bypass + foreign-cache poisoning |
| `CF-03`, RISK-02: stale shell after update | Shell files were previously cached under `disaster-management-app-v2`, and UI had no update notice. | Bump shell to `v3`, precache via reload requests, use `updateViaCache: 'none'`, and show a non-blocking **Reload to update / Later** notice after an existing worker is replaced. | Unit test: fresh requests and notice without rerender; **real browser still pending** |
| `CF-15`, RISK-04: unknown/corrupt stored records | Invalid records were silently replaced with default state when any normal action saved, which could destroy original data. | Keep stable storage key and schema `v1`; quarantine raw records that fail version/shape/JSON validation. Prevent normal writes; offer verbatim download, compatible JSON restore or explicit reset. | `tests/phase1s.test.mjs`: known, future, malformed, restore and reject tests |

## Data and rollback contract

1. Existing localStorage key remains **`disaster-management:v1`**; the new app does not automatically erase or rewrite valid v1 records on startup.
2. There is **no version-2 data migration yet**. The `MIGRATIONS` table is empty by design and future changes must supply a tested migration for each old schema version before increasing `VERSION`.
3. If stored data cannot be interpreted safely, the app exposes the unchanged raw JSON as an export and **blocks normal writes**. Settings, contacts and progress entered during this recovery state are temporary until the user restores a compatible backup or confirms reset.
4. Restoring a compatible file requires user confirmation and a successful storage write **before** clearing recovery mode. An invalid or future-version file leaves the old record untouched.
5. Rollback within compatible v1 releases can reload v1 records. A future release that changes schema must design/verify an explicit backward-compatible rollback path; this patch does not promise arbitrary future-schema downgrade.
6. The newer worker removes only older `disaster-management-app-vN` caches; it does not claim to repair other applications' caches already removed by the old worker. Other PWAs may need to re-download their offline data if they were affected previously.

## Automated verification

Run without installing any frontend framework or build tooling:

```bash
node --test tests/phase1s.test.mjs
```

Current result: **13 passed, 0 failed**. Checks cover shell installation, scoped deletion, path/cache isolation, preserved saved data, corruption quarantine, compatible import, rejected import and first-install/update notice behavior.

There is also a real-browser script:

```bash
node --test tests/browser-smoke.test.mjs
```

It uses optional `playwright` and Chromium; in an environment without a working Chromium installation it reports a **skip**, not a false pass. The implementation environment blocked its local browser process before any UI assertions could run. The proposed `.github/workflows/phase1s-safety.yml` checked the PR with GitHub-hosted Chromium and `REQUIRE_BROWSER=1`, where a skip was **not allowed**. **Result: passed** ([Actions run #43611865349](https://github.com/Celeritas7/Disaster_management_app/actions/runs/43611865349)). The manual mobile/device and first-production-upgrade checks below remain unverified.

## Required acceptance checks before merge

- [ ] Record the exact source commit and a snapshot of the working Pages build. On the current app, export a copy from Settings and keep that file before testing.
- [ ] On a real browser, open the app, save a contact, readiness check, home location and incident/log note; reload and confirm all persist.
- [ ] Put a second app's offline data in a different CacheStorage namespace on the **same origin**. Install the revised worker and verify that second app's cache remains intact.
- [ ] Update from worker `v2` to `v3`, verify the notice appears without clearing an unsubmitted form, choose **Later**, and then choose **Reload to update** at a safe time.
- [ ] Confirm the new `app.js` and `styles.css` actually load after updating, and that no old cached variant is indefinitely stuck. Confirm mobile responsive layout unchanged.
- [ ] Disconnect the network after one complete load, cold-reopen the installed app, navigate Watch, Readiness, Incident, Settings and verify saved data/export while offline.
- [ ] Import a valid v1 JSON backup and check values; attempt an invalid or version-999 backup and confirm the previous local records were not overwritten.
- [ ] In a separate disposable browser profile, simulate a malformed record and confirm the **Download original records** file is byte-identical before reset. Never corrupt real personal records for this test.
- [ ] Check rollback procedure on disposable test data. Verify previous v1 app still reads compatible v1 records and no unrelated cache is deleted.
- [ ] Review the PR diff: only `app.js`, `service-worker.js`, docs, tests, and safe validation configuration; no speculative live alerts or feature redesign.

## Operational notes

- The SW cache revision (`v3`) **must be bumped** whenever a future release changes precached app shell files; that is a release checklist item, not an automatic source hash.
- **One-time v2 to v3 upgrade:** the already-running v2 JavaScript cannot display the new update notice because it does not contain the listener yet. After the new service worker takes control, a manual page reload loads v3's new shell. Later v3+ worker upgrades can show the notice without forcibly reloading the current screen.
- Updating is a user-initiated page reload, never an automatic forced navigation during an incident or unsaved form entry.
- Existing app continues to label JMA/transport/Akatsuki feeds as **not connected**. The release is strictly an offline-cache and data-recovery safety change.
- After approval and successful Pages deployment, re-run acceptance on the actual published URL, then update this document with the tested commit, date, device and result.

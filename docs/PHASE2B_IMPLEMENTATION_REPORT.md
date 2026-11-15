# Phase 2B — Emergency Go-Bag and Readiness

**Scope:** P2-03, P2-04 and P2-05 in [the phased implementation checklist](PHASED_IMPLEMENTATION_CHECKLIST.md).  
**Starting point:** latest merged `main` after Phase 2A (merge `ed1819203e17392a70f395404a7e9e117ec8c9b8`, 2026-11-15).  
**Release policy:** Changes are proposed in a separate pull request. Do not deploy, merge or call the Phase 2B experience device-verified until the owner accepts the CI and device results.

## What this implements

1. **Fourteen core preparations.** Preserve all ten existing IDs and boolean checkmarks: water, food, light, power, bag, documents, cash, contacts, shelter, plan. Add first aid/medicines, sanitation, weather-protective clothing/shoes and whistle/protective supplies. Show survival, evacuation, family/location and health/comfort groups. Up to 30 optional custom items have their own quantities and dates and **do not change the core percentage**.
2. **User-managed amounts and dates.** Each item supports an optional amount, target, unit, expiry date, review-due date, personal check date and short private note. Water uses litres and cash uses Japanese yen by default; food uses days. The app **does not assign a target automatically**. After a checked item's details are edited, it requires a new explicit personal check before counting the item ready.
3. **Honest readiness display.** The existing weighted core score is normalized to a 0–100 percentage. Separately show the number **marked by you** and **counted ready**. A core item does not count when unchecked, when its user-entered expiry/review date has passed, when it falls below the user's target, or when its details need rechecking. Water and cash **also require both an amount and a positive personal target** to count. No item is independently or officially verified. Critical gaps are prioritized; “System verified: none” is visible.
4. **Optional embassy reminder.** Save whether the person reports being registered, unregistered, uncertain or not applicable; label this as self-reported, omit it from the core score and do not contact any embassy.
5. **Offline/PWA integration.** Add `phase2b.css` to the HTML and **app-owned** offline shell, advance the service-worker cache to `disaster-management-app-v8`, and leave unrelated origin caches alone.

## Data and compatibility contract

- Keep the `disaster-management:v1` localStorage key and `version: 1`; do not silently reassign historical flags or manufacture past review dates.
- The additive structure is `readiness.items` (metadata by existing item ID), `readiness.custom` (optional extra items), `readiness.nextCustomId`, and `readiness.embassy`. Absent fields are normalized to `null`/empty/unknown **in memory** and saved only through the app's existing save behavior.
- Old records retain their contacts and roles, profile and place checks, incident progress, departure flags, Night Out settings, logs and rules. Import/export uses the existing JSON backup mechanism and new metadata survives normalization.
- Invalid amounts, impossible dates, duplicate/malformed custom IDs and untrusted notes are validated or escaped. Future, incompatible storage versions remain protected by the existing raw-record recovery mechanism.
- All records, quantities and notes stay in this browser; there is no account sync, server verification, background reminder or medical document storage. Avoid entering detailed medical information in private notes on an unencrypted/shared device.

## Honest safety boundaries

- **Marked by you** is not an independent physical check. The display does not assert that a shelter is open or that belongings have been inspected.
- An unentered expiry date means **no expiry date recorded**, not proof that an item is fresh. A future user-entered date is not proof of product validity.
- Water guidance in the interface refers to **home stockpiling**, not a suggested go-bag carry weight: the Japanese Cabinet Office recommends approximately 3 L/person/day for at least three days for household preparedness. Users should choose a carryable evacuation bag separately: [Cabinet Office emergency supplies guidance](https://www.bousai.go.jp/kyoiku/hokenkyousai/check.html).
- Embedded Japanese emergency guidance and official links are reference information. Current local evacuation orders, hazard conditions and embassy registration have to be confirmed independently.

## Test matrix

| Verification | Coverage | Gate |
| --- | --- | --- |
| Existing Phase 1S/1A/1B/1C/2A Node suites | Earlier UI/storage/offline safety; old checkmarks, profile, contacts, logs | Must remain green |
| `tests/phase2b.test.mjs` | v1 legacy preservation, water/cash targets, expiry/review/recheck, invalid input, extras, embassy, hostile text, future-version quarantine, shell cache | Must pass |
| `tests/phase2b-browser.test.mjs` | Real Chromium, 320/375/412/768-px horizontal-overflow checks, old-data load, edit/recheck/expiry interactions, extras, embassy, JSON export/import, offline reload | CI required; no silent skip |
| Existing Chromium UI/PWA suites | Real-browser regressions and same-origin cache protection | Must remain green |
| Owner physical-device smoke test | Android/iOS layout, date inputs and keyboard, tap targets, backup and no-network start with actual old records | **Pending until tested** |

The GitHub Actions workflow installs Chromium and runs each browser test with `REQUIRE_BROWSER=1`; Phase 2B mobile screenshots are uploaded as the `phase2b-mobile-reference` artifact for review. The hosted execution environment can disallow Chromium's sandbox/socket, so **local browser launch failure is not a passing result**; the PR's CI run is the appropriate browser gate.

## Manual acceptance checklist for the owner

1. Export the existing app's JSON backup from **Settings → Data management** before updating. Keep a separate copy; the app has no cloud backup.
2. After merging and updating the app (only after PR acceptance), confirm the ten old checked items stay checked and old contacts/logs remain visible. Water/cash without an amount/target must show a missing-data gap, not be silently cleared.
3. On phone, open Readiness, expand water, enter an amount and personal target, save and **recheck today**. Verify insufficient/expired/overdue amounts do not score. Check the 14 core items and extra-item form.
4. Record a temporary optional extra and embassy status; export the backup, import it after changing a value, and confirm both survive. Remove the temporary extra using its confirmation prompt.
5. Reload with Wi-Fi/mobile data off and verify the inventory, saved dates, emergency guide and prior personal records remain accessible. Confirm other apps hosted on the same origin continue to work.
6. Review focus order, native date picker, 320–412-px layout, Japanese text wrapping and whether the amount/target wording matches how you actually pack.

## Rollback

Do **not** erase browser storage as a rollback step. A build rollback restores earlier `main` app files and its service worker, but **an older build can drop the new Phase 2B inventory metadata when it next saves** because its historical normalizer does not understand those fields. Export and retain a full Phase 2B JSON backup *before* any rollback, do not make new edits in the older build unless necessary, and restore the backup after returning to Phase 2B only after checking version compatibility. Retest existing records after rollback and restoration. The service worker deletes only caches starting with its own `disaster-management-app-` prefix, never those of other apps.

## Deferred / explicitly not in Phase 2B

- Automatic item reminders, push or email notifications and cross-app Akatsuki scheduling.
- GPS/shelter verification, official stockpile audits or an external embassy lookup.
- Encrypted document/photo vault or cloud synchronization.
- Phase 2C: real permission/consent UX, migration/backup improvements and secure-sync feasibility.

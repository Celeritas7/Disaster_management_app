# Disaster Management — Phased implementation checklist

**Phase 0 baseline:** [`main` @ `b7ae23c7375d2c3fa5a3a4ae060d302db3ff7aac`](https://github.com/Celeritas7/Disaster_management_app/commit/b7ae23c7375d2c3fa5a3a4ae060d302db3ff7aac) (2026-11-14 JST).  
**Requirement register:** [PHASE0_FEATURE_INVENTORY.md](PHASE0_FEATURE_INVENTORY.md) — each item has a stable `UX/OB/WA/DP/ST/IN/RD/NO/AA/LG/SE/CF` ID.  
**Deployment policy:** Work on one reviewable branch/PR per bounded phase; do **not** push incomplete work directly to `main`. Verify that the existing published app remains usable before merging. The prototype is a design reference, not proof of a real feed or permission.

Status notation: `[x]` completed in the named work branch; `[ ]` pending. A checked Phase 1S item is **not yet on the deployed site** until its PR is merged and Pages deployment is verified. An `I` status in the feature register means code exists, not that device QA has passed.

## Phase 0 — Audit, inventory, risk register, release baseline

- [x] **P0-01** Hash/inspect all three uploaded source files (`H`, `R`, `A`) and compare against GitHub.
- [x] **P0-02** Record remote `main` commit/tree and compare `app.js`, `index.html`, `service-worker.js` to the locally generated build.
- [x] **P0-03** Enumerate original onboarding, Watch variants, departure, stranded, seven-step incident, readiness, Night Out variants, after-action, log, settings and the 13 screenshot references.
- [x] **P0-04** Identify which UI concepts were examples, simulated integrations, inert controls or developer-only previews.
- [x] **P0-05** Record **190 independently checkable feature rows** in the linked register and assign initial delivery phases.
- [x] **P0-06** Record blockers and hazards: origin-wide SW cache deletion, stale cached assets, local PII, state migration, fabricated live status, background API feasibility and emergency copy.
- [x] **P0-07** Publish Phase 0 documentation on a separate branch/PR; change no runnable source and leave Pages deployment untouched.
- [x] **P0-08** Owner approved the next development phase (Phase 1S) on 2026-11-15 JST; UI-fidelity priorities remain for Phase 1A.

**Exit gate:** Source tree/feature register traceable, reported risks understood, no JS/CSS/HTML/manifest/service-worker changes, `main` remains exactly the baseline unless the owner independently changes it.

## Phase 1S — Protect deployed app and stored records (prerequisite)

- [x] **P1S-01** Fix `CF-02` / RISK-01: constrain SW cache deletion to *this app's cache names*, never touch caches belonging to any other app on `celeritas7.github.io` (unit-verified in Phase 1S branch).
- [ ] **P1S-02** Fix `CF-03` / RISK-02: revision `v3`, fresh shell precaching and in-place update prompt implemented; **real Chromium PR test passed**, but initial deployed v2→v3 and physical-device upgrade acceptance remain pending.
- [x] **P1S-03** Fix `CF-15` / RISK-04: retain v1 storage schema, validate version/shape, preserve incompatible raw bytes, supply original-data export/import/reset recovery and test harness.
- [x] **P1S-04** Add automated checks: service worker only removes owned caches, preserves a simulated second app's cache, and does not corrupt existing readiness/contact/log data (13 passing Node checks; separate CI Chromium test configured).
- [ ] **P1S-05** Chromium CI passed offline shell, data recovery, worker upgrade and foreign-cache checks; still confirm real user-data export before/after, rollback, and **mobile/device** cold launch with no network.

**Phase 1S implementation review:** [PHASE1S_SAFETY_RELEASE.md](PHASE1S_SAFETY_RELEASE.md) includes changed-file scope, tests, real-browser acceptance instructions and rollback. Work stays on a separate PR and is not deployed until accepted.

**Exit gate:** Separate safety-only PR; test with multiple same-origin app cache namespaces. Release this before changes that would depend on updated offline assets. Do not add unverified alerts here.

## Phase 1A — Restore Watch, onboarding and readiness UI

- [ ] **P1A-01** Screenshot comparison documented in [PHASE1A_IMPLEMENTATION_REPORT.md](PHASE1A_IMPLEMENTATION_REPORT.md) for `SS-01`, `SS-02`, `SS-08`; final comparison of **new** 412×892 screenshots awaits CI visual artifacts/owner acceptance (`UX-01,UX-02`).
- [x] **P1A-02** Implemented Watch **prediction-card** and **quiet-state** layouts as explicitly labeled **design/demo states** until Phase 7 provides real data (`WA-01,WA-07,WA-09`).
- [x] **P1A-03** Implemented radar/list/card visual variants, four unknown-status tiles and dismiss/restore state without suggesting decorative metrics are measurements (`WA-06,WA-08,WA-10`).
- [x] **P1A-04** Restored seven onboarding screens visually, preserved truthful labels for unsupported permissions, and implemented per-screen Back/Skip/Exit semantics (`OB-01–03,OB-10,OB-11`).
- [x] **P1A-05** Improved readiness ring/three gap cards/inventory overview, retaining *real checked items*, not a fixed fake score (`RD-01,RD-02,RD-11,RD-12`).
- [ ] **P1A-06** Responsive CSS, accessible controls and dedicated 320/375/412 px CI checks added; final physical-device safe-area/Japanese-wrap/contrast acceptance remains (`UX-01–03,UX-09–13`).

**Exit gate:** Accessible mobile screenshots at target widths match intended hierarchy; all risk/confidence/mapping examples visibly say **DEMO**; no “All clear” safety claim without a real verified source. No functional regression on stored records or offline opening.

## Phase 1B — Restore high-urgency/stranded layouts

- [x] **P1B-01** Implemented departure lock-screen-style **manual in-app preview**, four interactive item tiles, explicit All with me / Something's missing / Dismiss actions (`SS-03`, `DP-01–03,DP-07`). Real OS notifications remain Phase 4.
- [x] **P1B-02** Implemented one prominent NEXT ACTION card, ordered fallbacks, and honest unknown/unverified distance, walk, and cost fields (`SS-04`, `ST-01,ST-10`).
- [x] **P1B-03** Implemented black high-contrast incident shell, large emergency call controls, seven segmented navigable stages, bilingual headlines, and manual progress continuity (`SS-05–07`, `UX-10,UX-12,IN-01,IN-02,IN-06`).
- [x] **P1B-04** Implemented persistent optional one-at-a-time mode, Done / Can't / Skip outcomes, Back/review controls, and an unfinished-items summary without claiming skipped actions were done (`IN-09–11,IN-26`).
- [x] **P1B-05** Preserved direct `tel:119` / `tel:110` anchors and clear dialer/no automatic call warning (`IN-03–05`).

**Phase 1B implementation report:** [PHASE1B_IMPLEMENTATION_REPORT.md](PHASE1B_IMPLEMENTATION_REPORT.md). These checks indicate code implemented in the review branch; **CI/browser and physical-device acceptance are separate release gates**, not implied by the checkmarks.

**Exit gate:** Emergency screens remain usable offline and under large font/accessibility settings. No fictitious JMA “no warning”, cached map, geofence event, station distance, or completed SMS is shown as fact.

## Phase 1C — Restore Night Out, after-action, log and settings layout

- [ ] **P1C-01** Compare `SS-09–13` and implement all five Night Out UI states plus optional counter/timer presentation (`NO-01,NO-05–08,NO-13–14,NO-20–21`).
- [ ] **P1C-02** Restore low-friction after-action three-step hierarchy and selectable decision-point UI as editable **suggestions** (`AA-01–03,AA-08`).
- [ ] **P1C-03** Restore log status/trigger visual hierarchy without seeding invented personal events (`LG-01–08`).
- [ ] **P1C-04** Group Settings into sources, privacy, thresholds, offline cache, contacts/addresses and data management; label unavailable integrations accurately (`SE-01–20`).
- [ ] **P1C-05** Test all page transitions with actual saved local data and with no contacts, no checkmarks and no past events.

**Exit gate:** Original UI concepts are visually recognizable and functional manual flows continue working. Original developer-only previews (`UX-04,UX-06–08`) are not shipped as fake operating-system features.

## Phase 2 — Real setup, readiness and local data

- [ ] **P2-01** Collect user-edited home/office, safe check-in location, preferred station and **officially verified** shelter, with accuracy/provenance flags (`OB-04,OB-08,SE-14–15`).
- [ ] **P2-02** Add contact roles and explicit ordering, international phone number handling, missing-role prompts and confirmation before messaging (`OB-07,IN-12,RD-05`).
- [ ] **P2-03** Expand ten generic readiness checks into a configurable 14-item go-bag inventory while retaining existing completion data (`RD-03,RD-11,CF-15`).
- [ ] **P2-04** Track expiry/review dates, water quantity, cash target, embassy registration and critical preparation gaps (`RD-02,04–09`).
- [ ] **P2-05** Keep honest weighted readiness calculation and distinguish **checked by user**, **system verified**, **expired** and **unknown** (`RD-07,RD-12,RD-13`).
- [ ] **P2-06** Make the tour's permission/consent pages functional only for feasible integrations; show manual-only alternatives (`OB-04–10`).
- [ ] **P2-07** Improve privacy notes and JSON backup/import, with version migrations, restore tests, and no accidental data loss (`SE-16–18,CF-14–15,CF-19`).
- [ ] **P2-08** Investigate account/secure sync as a separately opt-in later enhancement; do not upload address/contact/document data automatically.

**Exit gate:** Existing users' v1 records survive; no automatic location/background permission at first load; readiness never claims documents or emergency kit are cached if not.

## Phase 3 — Reliable incident and communication flow

- [ ] **P3-01** Recheck quake/fire/gas/evacuation guidance with Japanese official sources and document content-review date (`IN-03–05,IN-09–10,IN-18,CF-20`).
- [ ] **P3-02** Support accessible one-step mode, context-sensitive Help/Can't/Skip and interruption/resume (`IN-10–11,IN-26`).
- [ ] **P3-03** Provide audited bilingual SMS templates that fill **only verified/user-provided** details; show unsent/draft/sent-confirmed distinctly (`IN-12–16`).
- [ ] **P3-04** Decide explicitly whether to support sequential multi-recipient SMS composition; never call a click “sent to all” without delivery confirmation (`IN-14–17`).
- [ ] **P3-05** Preserve `tel:119`, `tel:110`, `tel:171` links and test Android/iOS fallback; 171 availability/instructions verified (`IN-03–05,IN-17`).
- [ ] **P3-06** Improve offline/low-battery state without using battery percentages unless reliably available (`IN-06–08`).
- [ ] **P3-07** Capture optional user-supplied follow-up evidence/photos safely, without confusing an attached image with official damage assessment (`IN-22–27`).
- [ ] **P3-08** Rehearse simulated scenarios: quake at home, damaged building, no internet, no contacts, interrupted flow, urgent 119.

**Exit gate:** Offline response is fast and never blocks emergency access. Data-only proof of sending is not inferred from opening an SMS composer. Tsunami warning defaults to **unknown**, never “no warning.”

## Phase 4 — Departure and stranded assistance

- [ ] **P4-01** Investigate Android background geofence and notification feasibility versus PWA restrictions before offering “automatic departure checks” (`DP-06–07,CF-10`).
- [ ] **P4-02** Keep manual departure as a guaranteed fallback; add configurable items, dismissal and completion history (`DP-01–03,DP-08–11`).
- [ ] **P4-03** Evaluate Bluetooth tags by platform/model/permission. Do **not** promise all AirTag/Tile/SmartTag devices are accessible to this web app (`DP-05,CF-11`).
- [ ] **P4-04** Add verified battery/charging context only if the platform can supply it (`DP-04`).
- [ ] **P4-05** Enhance stranded options with validated operator/ATM/police/contact guidance and explicit service availability uncertainty (`ST-02–06,ST-08`).
- [ ] **P4-06** Rank options by verified travel time, cost, opening hours and personal constraints; provide navigation actions only when supported (`ST-07,ST-09,ST-12–13`).

**Exit gate:** No fake “tag last seen”, staff availability, cost, travel time, ATM compatibility or guaranteed fare loans. Explicit consent for location and clear user override.

## Phase 5 — Night Out completion

- [ ] **P5-01** Store distinct nightly records; display history and next event only from real user or consented calendar data (`NO-02–04,NO-25`).
- [ ] **P5-02** Make last-train/walk-buffer calculations conditional on verified station, date, operator and schedule; otherwise use manual leave time (`NO-08–11`).
- [ ] **P5-03** Add countdown/timer and separate stop-drinking/stay option; test midnight/day rollover and timezone (`NO-13–17`).
- [ ] **P5-04** Restore “Mine / Theirs” social-pressure decision, logging “One more”, limits, budget and undo consistently (`NO-15,NO-18–19,NO-26`).
- [ ] **P5-05** Recheck urgent intoxication symptoms, recovery and seek-help language with clinical/emergency references (`NO-20–22,CF-20`).
- [ ] **P5-06** Add post-night accountability checklist, true home-time capture (if user enters), and contextual after-action shortcut (`NO-23–24,AA-07`).
- [ ] **P5-07** Add optional calendar-initiated pre-commit after explicit permission and only where supported (`NO-27,CF-09`).

**Exit gate:** Users can complete manual loop with no network, optional alcohol-free nights, and no fake train time or misleading clinical instruction.

## Phase 6 — After-action learning and activity logs

- [ ] **P6-01** Add editable decision-point suggestions, rule suggestions, source-event association and provenance (`AA-02–05`).
- [ ] **P6-02** Convert stored text triggers into validated rule definitions with event conditions, preview and opt-in activation (`AA-04,AA-06,LG-05`).
- [ ] **P6-03** Add explainable rules, deactivation/editing and a record of if/when each actually fired (`AA-06,LG-04–05`).
- [ ] **P6-04** Support filtered 30-day timeline, outcome chips, Night Out history and incident/departure outcomes (`LG-01–08,NO-03`).
- [ ] **P6-05** Ensure rule/log data are backed up and migrated; no automatic outbound notifications until Phase 9 integration passes privacy gates.

**Exit gate:** A rule is described as “saved/dormant” until it can actually execute and has a testable event source. No seeded sample personal history.

## Phase 7 — Live Watch and official alerts

- [ ] **P7-01** Select primary, licensed/documented official feeds (JMA, appropriate local governments, railway operators); record update intervals, coverage and quotas (`WA-02–05,WA-10,IN-19,CF-06–08`).
- [ ] **P7-02** Build fetch/parse/cache with provenance, last-success time, data age, source errors and fallback to **unknown** (`WA-03–04,WA-15,CF-17`).
- [ ] **P7-03** Define risk/confidence methods and calibration before any numeric forecast; test prediction usefulness versus historical outcomes (`WA-02–04,WA-12`).
- [ ] **P7-04** Integrate only consented commute/meeting context, with explicit user-specified station/line and customizable thresholds (`OB-05,WA-05,SE-08–09`).
- [ ] **P7-05** Restore evidence card, recommendation/dismissal, quiet-state and next-check logic **after** source readiness; avoid declaring “All clear” solely because fetch failed (`WA-01–16`).
- [ ] **P7-06** Implement alerts/reminders only with testable browser/platform support; record if permission denied or app closed (`CF-13`).

**Exit gate:** Simulate stale feed, missing internet, severe alert, corrupt feed, contradictory sources, consent revoked, and timezone/schedule boundaries. No blank UI is interpreted as safety.

## Phase 8 — Offline shelter maps, location and resources

- [ ] **P8-01** Scope safe map layers/shelter data per municipality; choose verified downloadable tiles/routes, update dates and storage limits (`IN-20–21,RD-10,CF-18`).
- [ ] **P8-02** Allow selective offline packs with visible size, download progress, retry, verification and deletion (`SE-12,CF-04`).
- [ ] **P8-03** Route only over stored verified map data; distinguish general map directions from officially safe evacuation paths (`ST-12,IN-21`).
- [ ] **P8-04** Respect geolocation permission and accuracy; allow manual region/shelter selection without GPS (`OB-04,DP-06,CF-10`).
- [ ] **P8-05** Evaluate secure document storage and sensitive-file threat model; **do not** add raw passport/residence-card photos to unencrypted browser storage (`RD-08,SE-13,CF-14`).
- [ ] **P8-06** Test with network disabled from a cold launch and after download interruption; test cache eviction and service worker updates (`CF-01–04`).

**Exit gate:** No fake cached map, nonexistent shelter, unverified safe route or silently lost offline data. Emergency guide remains usable when map pack is absent.

## Phase 9 — Akatsuki / appverse coordination

- [ ] **P9-01** Define integration contract with Akatsuki: incoming weather/quake/train/places, outgoing task/reminder events, version and error schemas (`OB-09,ST-13,CF-12`).
- [ ] **P9-02** Add revocable per-category consent and privacy policy: share coarse region/train line only if needed; never contacts, calendar contents, tag IDs or drink logs by default (`SE-05–07,SE-19`).
- [ ] **P9-03** Make background scheduling conditional on available permission, verified device support and user choice; Akatsuki receives explicit pending/acknowledged/snoozed events (`CF-09–13`).
- [ ] **P9-04** Surface stale synchronization, authentication, offline queue, deduplication and recovery states; do not claim connected unless verified (`SE-01–03,SE-02`).
- [ ] **P9-05** Apply the user's existing Akatsuki default-snooze behavior to missed time windows, with user confirmation for irreversible actions.
- [ ] **P9-06** Threat-model credentials and RLS before choosing a cloud backend; keep offline guide functioning when Akatsuki is unavailable.

**Exit gate:** Explicit consent, revocation, error handling, test event logs, no silent contact/medical/drinking-data disclosure, and no cross-app cache interference.

## Phase 10 — Release-quality validation and long-term maintenance

- [ ] **P10-01** Visual regression at 320/375/412/768/desktop widths, small/large font settings, dark mode, Android Chrome/iOS Safari (`UX-*`, `SS-*`).
- [ ] **P10-02** Keyboard, screen-reader, color-contrast, focus, tap target and emergency fast-access audit (`UX-03,UX-10,IN-*`).
- [ ] **P10-03** Offline cold-start, interrupted-download, quota eviction, cache migration, two-app same-origin coexistence and stale-feed test (`CF-01–04`).
- [ ] **P10-04** Automated backups/migration/export/import/erase cases with sensitive data and corrupt JSON (`SE-16–18,CF-14–15`).
- [ ] **P10-05** Scenario test with “no verified shelter”, “no contacts”, “unavailable geolocation”, “no permissions”, “no JMA feed”, and “critical emergency now”.
- [ ] **P10-06** User acceptance against every feature-register ID, explicit disposition for `X` (preview-only) and deferred unsupported device capabilities.
- [ ] **P10-07** Document PWA-versus-native constraints, current data-source coverage, privacy limitations and incident safety disclaimers in-app and README.
- [ ] **P10-08** Cut tagged release only after reviewed PR, successful Pages deployment and rollback/previous-version data recovery verification.

**Final acceptance:** All supported original reference concepts are implemented or explicitly documented as unsafe/unsupported/deferred; no mock integration is presented as operational. The existing app, user records, and other Celeritas7 GitHub Pages PWAs are preserved through the upgrade.

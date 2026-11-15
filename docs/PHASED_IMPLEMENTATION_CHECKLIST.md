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

- [x] **P1C-01** Original `SS-09–13` reviewed; five Night Out states, optional counter/timer, manual drink-limit stepper, and bilingual 119 emergency handoff implemented. Timer uses a user-specified Japan time and does not pretend to know last trains (`NO-01,NO-05–08,NO-13–14,NO-20–21`).
- [x] **P1C-02** Three-step reflection hierarchy and three **generic, editable** decision-point examples implemented. Saved rule text does not auto-fire (`AA-01–03,AA-08`).
- [x] **P1C-03** Activity timeline, typed manual status badges, accurate unknown status for legacy entries, saved inactive rules and real empty states implemented; no fictitious personal history (`LG-01–08`).
- [x] **P1C-04** Settings divided into six navigable groups for source status, privacy, thresholds, offline, contacts/addresses and backup/erase with non-connected integrations labeled correctly (`SE-01–20`).
- [x] **P1C-05** Local old-v1/empty-record tests, manual time rollover, no contacts, transitions and browser test script implemented. **CI and physical-device acceptance remain separate release gates.**

**Phase 1C implementation report:** [PHASE1C_IMPLEMENTATION_REPORT.md](PHASE1C_IMPLEMENTATION_REPORT.md). Checkmarks indicate completed review-branch code, not deployment or device acceptance.

**Exit gate:** Original UI concepts are visually recognizable and functional manual flows continue working. Original developer-only previews (`UX-04,UX-06–08`) are not shipped as fake operating-system features.

## Phase 2 — Real setup, readiness and local data

- [x] **P2-01 · Phase 2A code** Collect user-edited home/office, safe check-in location, preferred station and a municipality-source *self-checked* shelter, with per-place check dates/provenance (`OB-04,OB-08,SE-14–15`). The app cannot independently certify a shelter; current official availability must still be checked.
- [x] **P2-02 · Phase 2A code** Add editable contact roles and explicit ordering, local/international phone-format checks, missing-role prompts and confirmation before opening SMS drafts (`OB-07,IN-12,RD-05`).
- [x] **P2-03 · Phase 2B code** Expand ten existing readiness checks into a 14-item go-bag inventory with optional custom extras, preserving the original ten checkmarks and storage key (`RD-03,RD-11,CF-15`).
- [x] **P2-04 · Phase 2B code** Record personal quantities/targets, expiry/review dates, a separately labeled optional embassy-registration status and prioritized critical gaps (`RD-02,04–09`).
- [x] **P2-05 · Phase 2B code** Maintain weighted core readiness without automatically counting missing water/cash quantities, expired or overdue records, or edited items awaiting recheck. Clearly separate **marked by user**, **counted ready**, **unknown**, **expired** and **system verified: none** (`RD-07,RD-12,RD-13`).
- [x] **P2-06** Added user-initiated, one-time location and browser storage controls to Settings and tour, with denied/unsupported/manual fallbacks. No automatic permission on first load; other integrations remain unconnected (`OB-04–10`).
- [x] **P2-07** Preserved v1 schema and legacy JSON import/export, added optional password-encrypted file exports, explicit import preview/apply, one-slot exact-byte recovery with quota checks, rejection of unsupported backups, and Node/Chromium restore tests. No stored-schema bump required; future migrations retain explicit gates (`SE-16–18,CF-14–15,CF-19`).
- [x] **P2-08** Completed an opt-in secure-sync feasibility and trust-boundary design with future release gates; no accounts, cloud writes or automatic address/contact/document uploads have been enabled.

**Exit gate:** Existing users' v1 records survive; no automatic location/background permission at first load; readiness never claims documents or emergency kit are cached if not.

**Phase 2A implementation report:** [PHASE2A_IMPLEMENTATION_REPORT.md](PHASE2A_IMPLEMENTATION_REPORT.md). **Phase 2B report:** [PHASE2B_IMPLEMENTATION_REPORT.md](PHASE2B_IMPLEMENTATION_REPORT.md). **Phase 2C report:** [PHASE2C_IMPLEMENTATION_REPORT.md](PHASE2C_IMPLEMENTATION_REPORT.md). Checkmarks mean implemented in a review branch, subject to CI and device acceptance; they do **not** mean deployed. Phase 2C retains all manual/offline functionality; cloud sync remains design-only.

**Phase 2B implementation report:** [PHASE2B_IMPLEMENTATION_REPORT.md](PHASE2B_IMPLEMENTATION_REPORT.md). Phase 2B checkmarks indicate the review-branch implementation only; GitHub Actions Chromium/mobile tests, owner review and real-device acceptance remain separate release gates. The deployed application is untouched by this PR.

## Phase 3 — Reliable incident and communication flow

- [x] **P3-01 · Phase 3A code** Reviewed offline quake/fire/gas/evacuation/tsunami help against FDMA/JMA official guidance on **2026-11-15**; stored source URLs and review date. Content is static; live alerts stay unknown (`IN-03–05,IN-09–10,IN-18,CF-20`).
- [x] **P3-02 · Phase 3A code** Existing one-item mode now has per-item fallback help, all seven steps have contextual bilingual Help, step-level Can't/Skip remain unconfirmed, and unfinished progress gets an explicit Watch resume card (`IN-10–11,IN-26`).
- [x] **P3-03 · Phase 3B code** Added reviewed bilingual check-in/safe/help SMS templates with English/Japanese/both preview, optional *current, explicitly typed* location (never inherited saved home or shelter), and distinct unsent, draft-requested, user-reported draft-opened, user-confirmed Send, and delivery-unknown labels (`IN-12–16`). Browser/device acceptance remains pending.
- [x] **P3-04 · Phase 3B code** Decided on **manual one-at-a-time composition** in saved recipient priority order, with a persisted interrupted-request reconciliation gate. Automatic or bulk sending and delivery confirmation are not supported by the PWA; no “sent to all” claim (`IN-14–17`).
- [ ] **P3-05 · Phase 3A partial** Preserved `tel:119`, `tel:110`, `tel:171`, added manual-dial fallback and accurately labeled NTT's conditional 171 availability. Automated Chromium checks are planned; **physical Android/iOS dialer testing remains pending** (`IN-03–05,IN-17`).
- [x] **P3-06 · Phase 3A code** Added manual simplified incident display, practical low-power suggestions, honest offline/online text; no battery estimates, automatic battery saver or unsupported notifications (`IN-06–08`).
- [x] **P3-07 · Phase 3C code** Added optional local notes and re-encoded photo attachments, persistent private drafts, saved evidence archive, deletion controls and backup import/export support. Content remains unverified, not submitted or officially assessed. Old `disaster-management:v1` records remain compatible. Physical-device acceptance remains pending (`IN-24`, part of `IN-27`).
- [x] **P3-08 · Phase 3C automated rehearsal** Added Node and Chromium scenarios for quake at home, unsafe building, offline startup, no contacts, interrupted incident/draft, and a non-dialing `119` link check. Actual emergency calls are **never placed by tests**; physical Android/iOS and owner rehearsal remain separate gates.

**Exit gate:** Offline response is fast and never blocks emergency access. Data-only proof of sending is not inferred from opening an SMS composer. Tsunami warning defaults to **unknown**, never “no warning.”

**Phase 3A implementation report:** [PHASE3A_IMPLEMENTATION_REPORT.md](PHASE3A_IMPLEMENTATION_REPORT.md). Phase 3A deferred SMS composition (`P3-03/04`) to Phase 3B and follow-up evidence (`P3-07`), scenario rehearsal (`P3-08`) and physical Android/iOS dialer checks to later gates. No cloud connection or deployment is part of this phase.

**Phase 3B implementation report:** [PHASE3B_IMPLEMENTATION_REPORT.md](PHASE3B_IMPLEMENTATION_REPORT.md). The Phase 3B code addresses `P3-03/04` on a separate review branch only; CI Chromium, owner review and physical Android/iOS handoff/delivery-unknown checks remain release gates. Phase 3C targets `P3-07/08` and the outstanding physical-device acceptance portion of `P3-05`.

**Phase 3C implementation report:** [PHASE3C_IMPLEMENTATION_REPORT.md](PHASE3C_IMPLEMENTATION_REPORT.md). `P3-07/08` are checked for implemented code/tests in a reviewable work branch; **this does not imply deployment or device acceptance**. The mobile/dialer/SMS portion of `P3-05` is still unchecked and must be validated separately without placing test emergency calls. Follow-up recipient action links, real-world official damage assessment and automatic sending remain out of scope.

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

# Phase 1A — Watch / onboarding / readiness UI restoration

**Work branch:** `phase1a-watch-onboarding-readiness` (review before merge)  
**Base:** Phase 1S merged on `main`, commit `5705e2cec4f650d59ec63f9e6e7bd18c5c7807f3`  
**Scope:** UI and presentation behavior only. Existing GitHub Pages deployment and stored version-1 records are unchanged until the owner reviews and merges the PR.

## Original-to-current comparison

| Source screenshot / prototype | Deployed Phase 1S baseline | Phase 1A change | Feature IDs | Acceptance |
|---|---|---|---|---|
| `uploads/01 1 Watch with a prediction.png`, prototype Watch example | General-purpose safety dashboard with separate sample alert under hero | Original-style “One thing to look at” hierarchy and evidence/CTA card **only when a user explicitly opens a DEMO**; no fabricated accuracy, confidence, train timing or weather observation | `SS-01`, `WA-01`, `WA-02`, `WA-06`, `WA-10` | Test checks DEMO/No forecast/no live evidence and dismiss |
| `uploads/02 1b Watch quiet state.png`, prototype quiet Watch | Decorative radar inside generic hero, no dedicated quiet composition | Centered radial motif, quiet summary, optional example reveal; **“Live status unknown”**, not “All clear” or a no-hazards result | `SS-02`, `WA-07–10`, `UX-09` | First-load test checks unknown status and never implies safety |
| Prototype Watch layout controls, `support.js` | No radar/list/cards selector | Accessible three-state presentation selector; four tiles show Unknown/Not connected for Weather, Quake activity, Commute, Upcoming trip | `WA-09`, `WA-10`, `UX-09` | Selector test switches all variants; presentation choice stays ephemeral |
| Seven prototype onboarding pages, `Disaster Management Prototype.dc.html` | Seven factual pages with a basic generic card; global skip exits | Segmented progress, distinct icon, list/metadata rows, Why note and responsive CTA. `Back`, `Skip this step`, `Exit tour` now have separate behavior | `OB-01–03`, `OB-10–11`, `UX-01–02` | Test traverses all seven without asserting permissions were granted |
| `uploads/08 5 Readiness.png`, prototype score/three gaps/inventory | Accurate 10-item weighted score, but only two quick items and no compact group inventory | Ring plus count, three next unverified item cards, grouped inventory counts and complete toggleable checklist | `SS-08`, `RD-01`, `RD-02`, `RD-11–12` | Test confirms user-checked score, gap rotation, undo and persisted v1 |

## Explicit safety boundaries

- **No live monitoring** added. Forecast text is a hypothetical example, displayed with persistent `DEMO`/`NOT LIVE`/`NO FORECAST` markings; the original prototype’s `72% confidence`, “All clear” and fictitious “Normal” statuses are deliberately omitted.
- The radar is decorative. It is never a location sensor or a JMA/railway measurement.
- Watch layout is local transient UI state; existing `scenario` boolean still controls whether to display the sample. No new storage keys, schema changes, contacts, address collection, background permissions, accounts or outbound messages.
- Readiness remains ten real user-checked items with existing weighting. The new three cards can be marked only by a deliberate tap; no automatic verification or prefilled inventory.
- Seven tour steps still describe **manual** capabilities; “Skip this step” advances, “Exit tour” ends tour, and finishing page seven sets `tourDone` as before. No OS permissions are claimed.
- Sidebar, mobile nav, emergency telephone links, seven-stage incident guide and backup/recovery functions are retained.
- Changed offline shell assets require only an owned cache revision `v3` → `v4`; Phase 1S's app-specific cache cleanup and non-destructive update prompt remain in place.

## QA and release gates

### Automated

- `node --test tests/phase1s.test.mjs tests/phase1a.test.mjs`: 18 tests passed locally with staging sources (`DMA_TEST_ROOT=dist`).
- Browser smoke test (offline update, other same-origin app caches, data recovery): source updated to test `v4` → `v5` on CI.
- New Chromium UI test checks 320/375/412 px overflow, demo labels, three layouts, onboarding Back/Skip and readiness persistence. CI stores full-page 412 px screenshots for **quiet Watch, demo Watch, onboarding, readiness** as PR artifacts.

### Still requiring acceptance

- [ ] GitHub Actions green on PR (local Chromium could not launch: sandbox prevents its singleton socket; do not interpret this as an app failure).
- [ ] Review CI visual artifacts against `SS-01`, `SS-02`, `SS-08` and verify mobile 412×892 hierarchy, Japanese wrapping and contrast.
- [ ] Test Android Chrome/iOS Safari at 320–412 px, especially safe-area/nav overlaps, text size and emergency access.
- [ ] Confirm Pages shows the new UI **after** owner-approved merge and `v4` service worker upgrade; export a backup of important local records first.

**Deferred to later phases:** verified live weather/quakes/rail feeds and risk scoring (Phase 7), native lock-screen notification (Phase 4), expanded kit/expiry inventory (Phase 2). Those prototype concepts are not claimed as working features in this PR.

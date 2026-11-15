# Phase 3A — Reliable incident help, interruption/resume and offline clarity

## Scope and baseline

- Starting point: **merged `main` `7a1185e3a0e0fb76cb7019ea3e6efd3ef8f02878`**, verified against local source hashes before edits.
- Scope: `P3-01`, `P3-02`, `P3-06`, and implementation-only portions of `P3-05` plus limited scenario regression. SMS templates, delivery claims, image evidence and live hazard feeds remain out of scope.
- Source review date: **2026-11-15 (JST)**. Offline help is static, not a substitute for official emergency services or fresh local instructions.
- App remains a local-first, manual PWA. No production changes, database write or automatic permission prompt in this review branch.

## User-visible changes

1. Every incident stage (1–7) offers a native, keyboard-friendly **Help with this step · 困ったときは** disclosure with context-specific English/Japanese guidance. Checklist one-item mode adds individual fallback hints before marking **Done / Can't / Skip**.
2. Each whole stage can be marked **Can't do** or **Skip for now**, stored separately from checked items and never called complete. For an urgent first step, skipping requires an additional explicit warning. A **Can't** action expands its fallback guidance; manual progress remains visible.
3. Exiting an active guide shows a clear **Resume earthquake guide** card on Watch, retaining the last step, one-item position, couldn't-do records and earlier contacts/logs after offline reload.
4. A user-operated **Use simpler display** option reduces visual effects and retains large emergency links. It never claims to know the battery level or to change system power settings.
5. Emergency copy now tells the user to speak their **actual location**, not to assume the separately saved **home** address is where they are. Dial buttons are honest `tel:` links: they might fail on a computer, browser or unsupported handset. If 119 fails to connect, a public phone or another person can help; do not place test calls.
6. **Disaster Message Dial 171** is explicitly conditional on NTT activation or practice windows. The app links to provider instructions and status but cannot check them when offline, record a voice message or confirm delivery.
7. The evacuation screen labels **tsunami status UNKNOWN**, warns coastal users about strong/long shaking even without a live feed, and keeps local shelter self-checks distinctly unverified by the app.

## Japanese primary-source content check

| Topic | Reviewed primary source | Scope of paraphrased app guidance |
| --- | --- | --- |
| Earthquake, personal protection | [Fire and Disaster Management Agency: earthquake FAQ](https://www.fdma.go.jp/about/question/cat3/) | Protect yourself and your head during shaking; do not prioritize objects over safety. |
| Gas and electricity | [FDMA: urban gas safety](https://www.fdma.go.jp/relocation/e-college/cat67/cat50/cat48/64.html) | After shaking, look for hazards if safe; avoid electrical switches, fans and flames if gas is suspected. |
| Fire and smoke | [FDMA: fire evacuation](https://www.fdma.go.jp/relocation/bousai_manual/lat/later32.html) | Keep low in smoke and leave danger; the app cannot assess a particular building. |
| Tsunami | [Japan Meteorological Agency: tsunami precautions](https://www.jma.go.jp/jma/kishou/know/jishin/tsunami_bosai/index.html) | Strong/long shaking near shore calls for urgent high-ground evacuation; never infer no tsunami warning from an unavailable feed. |
| 119 | [FDMA: calling 119, including when mobile calls fail](https://www.fdma.go.jp/mission/enrichment/kyukyumusen_kinkyutuhou/119.html) | 119 is for fire/ambulance; if calls cannot connect, try a public phone or ask for help. Give current address or landmarks. |
| 110 | [National Police Agency: emergency reporting](https://www.npa.go.jp/goiken_index.html) | 110 for urgent incidents requiring police. |
| 171 | [NTT East: 171 service overview](https://www.ntt-east.co.jp/saigai/voice171s/intro.html), [recording steps](https://www.ntt-east.co.jp/saigai/voice171s/rec.html), [availability bulletin](https://www.ntt-east.co.jp/saigai/news/) | Conditional availability; press 1/2 only after the 171 prompts; no call or recorded message can be verified inside this app. |

These links need a network connection. Links inside the app do not make alerts, municipal shelter status, ambulance availability or mobile signal verifiable.

## Storage, privacy and migration

- Persistent key **`disaster-management:v1`** and record version **1** remain unchanged; older records normalize with defaults for additive `incident.stepOutcomes`, `incident.paused`, `incident.lowPower`.
- Existing checklist outcomes, current step, contacts, notes, readiness metadata and logs remain. Backup/export/import still includes the current normalized record, including the additive incident properties once saved.
- Incident notes and contact information are still stored as browser plaintext. No geolocation, battery, camera, SMS or notification API is requested by opening the guide. No live data or Akatsuki access was added.
- Service worker uses **owned v10 cache** and precaches `phase3a.css`; cache cleaning remains scoped to this app's versioned cache names.

## Verification

- New `tests/phase3a.test.mjs` covers old v1 records, emergency phone script, real `tel:` links, help copy, first-step skip confirmation, Can't/Skip continuity, Watch resume, simplified mode, 171 uncertainty, logs and owned shell.
- New `tests/phase3a-browser.test.mjs` covers 320/375/412/768 px layouts, emergency call links without placing calls, one-item fallback, full-step omission and resume, reload/offline, current location wording and preservation of legacy data.
- Existing Node tests remain included; CI browser suites and screenshot artifact added to the workflow.
- **Acceptance still required:** physical Android Chrome and iOS Safari/PWA `tel:` handoff, accessibility/screen reader, large font, emergency navigation in an actual low-power/network outage, and individual professional review of localized safety text. An automated browser cannot prove a telephone call connected or that a message was delivered.

## Deferred Phase 3 work

- **Phase 3B:** audited bilingual SMS, verified/user-supplied fields, explicit draft/unsent/sent-by-user distinctions, sequential multi-recipient composition decision (`P3-03/04`).
- **Phase 3C:** optional safe evidence/photos and wider no-internet/no-contact/urgent-response scenario rehearsal (`P3-07/08`), plus physical device acceptance of `P3-05`.

The existing published app is not changed by opening this pull request. Only the owner can merge and perform deployment/device release acceptance.

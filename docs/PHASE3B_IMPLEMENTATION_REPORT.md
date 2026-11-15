# Phase 3B — Emergency SMS and Communication Management

**Scope:** `P3-03`, `P3-04` (`IN-12–16`, `CF-15–16`). Based on merged `main` at `3a5506bf2e6f5536b70d8b669028d7fbfe144d40` (Phase 3A / PR #9). This is a separate, unmerged review branch; no deployment, production-data change or cloud integration.

## What the user will see in Incident step 3

1. A message-type chooser with bilingual, deliberately short, **editable-by-selection** templates. The neutral **Request a check-in** is the default. **I am safe right now** and **I need help** must be explicitly selected; neither is deduced from app state.
2. An English, Japanese or bilingual preview. The optional current-location field is entered **in this incident screen by the user**, not populated from saved home, office, safe place, shelter or browser geolocation. If empty, no location assertion is included. The message preview can be copied manually.
3. Saved emergency contacts in their Settings priority order, with explicit selection, per-contact visual states and a one-at-a-time **Open next draft** action. A direct contact-specific draft remains possible after a confirmation prompt.
4. A persisted reconciliation panel when a draft was requested: **I saw the draft open**, **I tapped Send in SMS app**, or **Not sent / could not open**. A reloaded/offline app retains this unresolved request; it cannot silently move to the next recipient.
5. Clearly distinct **Unsent**, **Draft requested (opening unverified)**, **Draft opened (user-reported, sending not confirmed)**, and **User confirmed Send (delivery UNKNOWN)** labels. The existing `Reached (manual)` marker is separate; legacy reached records never imply SMS delivery.

No button sends a message. There is no delivery, carrier acceptance, receipt or SMS-app callback. The app logs only the user's *report* of tapping Send; the log contains contact name, not a phone number or message text. Finishing an incident records counts of these reports and opened drafts, then clears the active communication composition, including the optional location. Prior activity logs remain intact.

## Template copy and review decision

Editorial review completed **2026-11-15 JST** for concise, truthful emergency communication. These are **app-authored templates**, not text endorsed or certified by a government agency.

| User-selected type | English | Japanese |
| --- | --- | --- |
| Neutral request (default) | Please let me know if you are safe when you can. I will update you when possible. | 落ち着いたら、無事かどうか教えてください。こちらからも可能なときに連絡します。 |
| Safe, explicitly chosen | I am safe right now. I will contact you again when possible. | 今は無事です。また連絡できるときに連絡します。 |
| Need help, explicitly chosen | I need help. Please contact me if you can. | 助けが必要です。可能なら連絡してください。 |

If the user provides a *current* location, the preview adds **“Current location (entered by me): …”** / **「今いる場所（自分で入力）：…」**. No date, shelter safety, battery level, injury status, delivery time or inferred location is fabricated. The user must review the generated text and recipient each time. For immediate danger, use emergency calls/official guidance before SMS.

Reference checks (primary sources):

- [RFC 5724 — `sms:` URI scheme](https://www.rfc-editor.org/rfc/rfc5724.html): `body` text is optional and encoded; composing a message is not the same as sending one. Multi-recipient capability is an option for a user agent, not a guarantee of sending.
- [Apple's published SMS link scheme](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/SMSLinks/SMSLinks.html): the documented `sms:` link accepts a recipient but **not message text**. On iPhone/iPad the app requests the recipient-only composer and tells users to paste a copied preview.
- [NTT web171 safety-confirmation service](https://group.ntt/en/disaster/service/web171.html) and [171 dial](https://group.ntt/jp/disaster/service/171.html): availability and purpose of disaster safety messages; not evidence that SMS is delivered. The existing 171 warning and call links remain unchanged.

## Sequential multi-recipient decision

**Supported, conditionally:** user-initiated *sequential draft composition*, exactly one validated destination per tap. The ordered queue is local-only; it pauses until the user reports the outcome of a requested draft. They may leave a contact **unsent** and proceed to the next. If a draft opened but was never sent, that status remains honest. The selected order follows Settings contact priority even if the selection order differs.

**Not supported:** unattended sequential sending, a bulk **Send to all**, background dispatch, a reliable iOS prefilled body, delivery receipts, or a guarantee that any device provides an SMS app/SIM/service. Browser `sms:` links only *request* the OS composer. The copy/paste fallback works offline even when no SMS app can be opened. Offline app functionality does not imply cellular SMS connectivity.

### State and privacy contract

- Storage remains `disaster-management:v1`, schema version `1`. Added optional `contacts[].id`, top-level `nextContactId`, and `incident.communication` fields are normalized on load. Existing contacts, ordering, `incident.contacted`, checklist, places, logs, rules, night records, readiness, and backup workflow remain valid. Missing communication metadata defaults to **unsent**.
- Contact IDs survive reorder and edits. A changed phone number invalidates a prepared draft; the user must deliberately reset it to address the newly edited number. Unverified or malformed sent-state metadata is not promoted to a send report.
- Selected recipients, optional typed current location, and state transitions persist to the same local record. They are included in explicit plain/encrypted JSON exports and restore previews (while the incident is active). Browser localStorage itself remains plaintext; avoid shared devices and erase/finish outdated current-location details.
- Status has two separate dimensions: **manual UI progress** (`unsent` / `draft-opened` / `user-confirmed-sent`) and **delivery** (`unknown`). “Draft requested” is an unverified *handoff attempt*, not evidence of opening. Reopening the app resumes an unresolved attempt without automatic resending.
- No network request, background SMS, SMS-device permission, native contact permission, cloud endpoint or new production storage is introduced. Service-worker shell cache is bumped to owned namespace `disaster-management-app-v11` and includes `phase3b.css`; unrelated GitHub Pages caches are untouched.

## Validation and limitations

- Dependency-free Node regression suite includes Phase 1S–3B. New Phase 3B checks cover legacy v1 records, neutral/safe/help bilingual wording, omitted/explicit location, priority-order queue, cancelled prompts, interrupted composer, user-confirmed states, malformed metadata, missing/invalid/edited contacts, iPhone copy fallback, offline navigation and incident finish.
- New mandatory Chromium CI test covers 320/375/412/768 px overflow, previews, contacts, user prompt, draft interruption/reload, explicit Send report, service-worker cold offline load and preserved records. CI screenshots are uploaded for owner review.
- Local Chromium in the development container could not start (`socket() failed: Operation not permitted`), so **real-browser tests require GitHub Actions** and physical-device acceptance. No real SMS, iOS Messages, Android SMS app, carrier delivery or paid network service was exercised or claimed.
- Preserve the Phase 3A warning: live hazard feeds, tsunami status and NTT 171 availability remain unknown offline.

## Release and rollback

Review the separate PR and its CI artifacts before merging. Do not deploy from this branch. If a reviewed merge is later approved, verify original-data backup, Safari/Android composer behavior, no sending from cancelled requests, offline cold launch, Japanese wrapping, and correct status after force-quitting the app. Restoration uses the existing JSON import/previous-copy workflow; record version stays `1`.

## Next: Phase 3C

- `P3-07` — optional, user-provided follow-up notes/photos with local privacy limits and no false “official damage assessment” implication; avoid raw sensitive scans or automatic capture.
- `P3-08` — full simulated scenarios: earthquake at home, damaged building, no internet, no contacts, interrupted workflow, urgent 119. Recheck status, communication and history across app restarts.
- Finish outstanding `P3-05` physical Android/iOS dialer/171/SMS handoff testing and Phase 3A/3B device layout acceptance. Keep future cloud, live warning integration, background alerts and deployment outside Phase 3C unless independently authorized.

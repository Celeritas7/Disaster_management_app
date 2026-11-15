# Mobile UX follow-up — Settings access and less scrolling

**Context:** After Phase 3C was merged, the owner reported successful offline reopening, seven-step guide availability and Activity Log persistence on a physical device (**3/3 reported passes; Android vs. iPhone not yet specified**). During SMS handoff acceptance, Settings was difficult to find and required excessive scrolling. Physical SMS/dialer handoff remains pending; do not call 119/110 or assume a message was sent.

## Visible improvements

1. **Settings in the mobile bottom navigation.** All six destinations remain: Watch, Ready, Incident, Night, Log and Settings. The desktop sidebar is unchanged. 320/375/412 px layouts use flexible icon-and-label buttons, keeping all existing destinations.
2. **Sticky Settings shortcuts.** Immediately below the page heading, links for **Contacts, Backups, Places, Offline, Privacy, Sources, Limits** can be used without scrolling through unrelated forms. On mobile they occupy a single horizontally scrollable row and remain visible while the user scrolls. Target sections land beneath the header/shortcuts.
3. **Contacts first in the existing important-details group**, before the longer Places form. The stored fields, roles, priority controls, Save buttons and backup behavior are unchanged.
4. **Back to top.** On phone-size screens, a small control appears only after substantial scrolling and returns to the top of the current page. It doesn't replace emergency access or auto-save incomplete forms.

## Safety and compatibility

- No new permissions, cloud, Bluetooth, notifications, location tracking, SMS sending, dialing or service-worker scope changes.
- `disaster-management:v1` retains identical field names and version. No migration runs, no user data is deleted or sent. Phase 3C evidence, contacts, readiness, logs and backups remain intact.
- Offline shell revision changes from `disaster-management-app-v12` to `v13` to cache `mobile-ux.css` together with the updated app and HTML. Only app-owned older caches are cleaned up, never another same-origin app's caches.
- UI links are ordinary same-page anchors; a Settings shortcut does not create or edit a contact by itself.

## Review and tests

- Existing Node tests, legacy Chromium/PWA suites, plus new mobile UX contract tests and a physical-browser 320/375/412 px navigation, scroll, contact preservation and offline-reload test.
- Owner still needs to review the six-item bottom nav on a real small phone, Japanese text wrapping, top-button safe-area overlap and accessibility. Browser tests do **not** certify real SMS/dialer operation.
- After owner review, merge separately; let the existing deployment mechanism update the app if configured. The PR itself does not deploy.
- Complete Phase 3C `P3-05` physical SMS composer and dialer acceptance separately, avoiding test calls to emergency services.

# Disaster Management

An offline-capable, privacy-first web app based on the three supplied source files:

- **Disaster Management Prototype.dc.html** — feature map, content, screen concepts and dark visual direction.
- **support.js** — the original design-preview runtime (not needed in this production build).
- **android-frame.jsx** — Android frame and compact layout reference.

## Included in this initial build

- Mobile/desktop responsive Watch dashboard
- Checklist-based readiness score (not a forecast)
- Seven-step earthquake response guide (English and Japanese), with incident progress
- Japan emergency dial links (119, 110) and Disaster Message Dial 171 guidance
- Manually entered contacts, addresses and shelter name
- Manual departure checklist and stranded fallback scenarios
- Manual Night Out safety commitment, tracking and after-action notes
- Local activity log and personally created follow-up rules
- Optional local follow-up notes and compressed photo evidence in Incident step 7 / Activity Log
- Plain or password-encrypted JSON backups, preview-before-restore and app-only reset
- Installable PWA manifest, icons and service-worker cache for the app shell

## Deliberate limitations

This is a **functional local-first MVP**, not an emergency-alert service:

- No live JMA, weather, train, municipal shelter or tsunami feed is connected.
- No Akatsuki, Supabase, calendar, Bluetooth or geofence integration exists yet.
- No push notifications, automatic SMS delivery, phone contact access or cloud backup.
- Example scenarios are clearly labeled. No confidence numbers or risk scores are invented.
- Emergency calls are links to the device dialer; SMS actions open a draft only.
- Bilingual SMS drafts are one recipient at a time; only the user may report having tapped Send. Delivery is always unknown.
- Optional evidence photos are user-selected and re-encoded locally without the source filename/EXIF; photos are not official damage assessments. Never enter a dangerous place to collect evidence.
- Browser localStorage can store addresses/contacts, but **it is not encrypted**. Avoid shared devices or storing document scans.
- Saved or draft evidence photos are included in local JSON backups and erase; an exported unencrypted backup or local recovery copy can still contain sensitive images.
- The offline cache stores the app shell after a successful online visit; external official alert links still require connectivity.

## Development

No build step or external dependencies are required. Serve the repository root over HTTPS (or localhost for development).

The application is implemented with plain JavaScript, accessible HTML and CSS. Its state key is `disaster-management:v1`.

## Publishing on GitHub Pages

The repository includes a safety-check workflow, but not an automatic deployment workflow. A review branch/PR does not change a deployed site. Deployment depends on the GitHub Pages settings.

In the GitHub repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source. For a project repository, the published URL normally ends with the repository name. All asset URLs are relative to support that subpath.

Publishing source code does not upload your private records, addresses, contacts or photos, which stay in your own browser's localStorage. Keep exported backups private; another device starts empty unless you explicitly import one.

## Suggested follow-up phases

1. Confirm Japanese municipal and JMA data sources and implement freshness-aware, timestamped alerts.
2. Design explicit Akatsuki read-only connectors with user-controlled data-sharing rules.
3. Create reliable Android native integrations for background alerts, geofences and phone actions.
4. Add opt-in secure account backup, data encryption and multi-device synchronization.

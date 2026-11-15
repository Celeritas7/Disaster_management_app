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
- Optional private follow-up notes and locally compressed photos in Incident step 7 and Activity Log
- Plain or password-encrypted JSON backup exports, import preview, local previous-copy recovery and app-only reset
- Installable PWA manifest, icons and service-worker cache for the app shell

## Deliberate limitations

This is a **functional local-first MVP**, not an emergency-alert service:

- No live JMA, weather, train, municipal shelter or tsunami feed is connected.
- No Akatsuki, Supabase, calendar, Bluetooth or geofence integration exists yet.
- No push notifications, automatic SMS delivery, phone contact access or cloud backup.
- Example scenarios are clearly labeled. No confidence numbers or risk scores are invented.
- Emergency calls are links to the device dialer; SMS actions open a draft only.
- The incident SMS screen offers reviewed English/Japanese templates, a one-at-a-time contact queue and manually reported draft/Send states. **Neither opening a draft nor reporting Send proves delivery.** Current location is entered separately and is never taken automatically from a saved home/shelter.
- Evidence photos are optional and never official damage assessments. Do not enter unsafe areas to capture them. Photos are re-encoded without source EXIF/filename, but their visible contents can still reveal sensitive details.
- Browser localStorage can store addresses/contacts, but **it is not encrypted**. Avoid shared devices or storing document scans.
- Optional encrypted files protect **exported backups only**, not local browser storage. A local one-slot pre-import recovery copy remains unencrypted until the next restore/erase. Keep a separate backup; browser storage can be deleted.
- Location testing and browser storage protection are optional, initiated by you. There is no continuous location collection, and all browser permissions can be managed in site settings.
- The offline cache stores the app shell after a successful online visit; external official alert links still require connectivity.

## Development

No build step or external dependencies are required. The **app shell is in the repository root** (`index.html`, `app.js`, styles and service worker). Serve that root over HTTPS (or localhost for development).

The application is implemented with plain JavaScript, accessible HTML and CSS. Its state key is `disaster-management:v1`.

Phase 2C implementation/security details and future synchronization gates are documented at `docs/PHASE2C_IMPLEMENTATION_REPORT.md`. Phase 3A adds reviewed, offline incident help, paused-step resume, user-operated simplified layout and honest call/171 fallback wording; see `docs/PHASE3A_IMPLEMENTATION_REPORT.md`. Phase 3B adds local, bilingual, recipient-by-recipient SMS draft and outcome tracking; see `docs/PHASE3B_IMPLEMENTATION_REPORT.md`. Phase 3C adds optional offline evidence and a scenario rehearsal suite; see `docs/PHASE3C_IMPLEMENTATION_REPORT.md`. There is no live account synchronization or Akatsuki data-sharing contract yet.

## Publishing on GitHub Pages

The repository currently contains a safety-check GitHub Actions workflow, **not** an automatic deployment workflow. The root HTML/CSS/JS files are ready for project-site hosting, subject to the repository's GitHub Pages configuration. A review branch or pull request is not a deployment. All asset URLs are relative to support the project subpath.

Publishing source code does not upload your private records, addresses, contacts or evidence photos, which remain in your own browser's localStorage. Plain JSON exports and local undo copies may expose them if shared; use a private password-encrypted export when appropriate. Another device starts empty until a backup is explicitly imported.

## Suggested follow-up phases

1. Confirm Japanese municipal and JMA data sources and implement freshness-aware, timestamped alerts.
2. Design explicit Akatsuki read-only connectors with user-controlled data-sharing rules.
3. Create reliable Android native integrations for background alerts, geofences and phone actions.
4. Add opt-in secure account backup, data encryption and multi-device synchronization.

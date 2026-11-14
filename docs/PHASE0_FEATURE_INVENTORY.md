# Disaster Management — Phase 0 feature inventory

**Audit date:** 2026-11-14 (JST)  
**Repository:** [Celeritas7/Disaster_management_app](https://github.com/Celeritas7/Disaster_management_app)  
**Audited branch/commit:** `main` at `b7ae23c7375d2c3fa5a3a4ae060d302db3ff7aac`  
**Published site stated by owner:** `https://celeritas7.github.io/Disaster_management_app/`  
**Scope:** Static source-code comparison, not a certification of live network behavior, browser installation, mobile rendering, external data, or emergency safety. The live Pages instance was not instrumented during this audit.

## 1. Verified source provenance

| Alias | Uploaded/original input | SHA-1 Git blob | Interpretation |
| --- | --- | --- | --- |
| `H` | `Disaster Management Prototype.dc.html` (830 lines) | `64da473e14f493cd8a2193dfabcb6f9ba8898f1b` | Original interactive design, screen copy, mock state, and behavior sketches. |
| `R` | `support.js` (1,911 lines) | `cb009b69ec6b5e00f48c6287a587fe7e0c6c421b` | **Generated `dc-runtime` interpreter**, including React/Babel adapters. No independent disaster-domain features. Do not copy into production as application logic. |
| `A` | `android-frame.jsx` (229 lines) | `84c0ccee1ae944341f7359c9b1dee1f7fc27a217` | Visual Android Material 3 device frame, status bar, app bar, nav, list rows and illustrative keyboard. **Not** Android OS APIs. |
| `G` | GitHub `app.js` (526 lines) | `5223ff6bb15c3070c4a0cb83e03d055c3782feb4` | Deployed-app JavaScript; plain browser JS, not Vite/React. |
| `C` | GitHub `styles.css` | `7e555b965acde5f27a2e647f8469fa3ef67a8588` | Deployed-app styling; original visual system is not reproduced exactly. |
| `S` | GitHub `service-worker.js` | `447f9d493be52a120a5a5d35998d408aebd3f782` | Offline app-shell caching. **Critical cross-app cache issue described in §4.** |
| `P` | GitHub `index.html`, `manifest.webmanifest` | `9d8ca3dd16f0592a2ef5bc31d4ee99b66b1e16c7`, `49e2a20ce4f47c95c7e4c81d236d63f98e937285` | Static entry point and install metadata. |

The three local uploaded input hashes match the three files in GitHub `main`. The local generated `dist/` copies of `G`, `S`, and `index.html` also match the GitHub blobs byte-for-byte. The GitHub root is the deployed static app layout; there is no `package.json`, Vite build chain, or `.github/workflows` directory in this audited GitHub tree.

**Important distinction:** A UI label in the prototype does not prove a feature ever worked. Its JMA feed timestamps, commute confidence, wallet-tag detections, maps, historical metrics, train schedules, sample contacts, and Akatsuki status were static or in-memory demonstrations. The current app intentionally labels missing integrations instead of presenting fictional live data.

### Reading the matrix

- **I — implemented:** Equivalent behavior exists in current `G`/`S` code; *not yet hands-on acceptance-tested*.
- **P — partial:** Some UI or behavior exists, but reference detail, automation, or interaction is absent.
- **M — missing:** No substantial corresponding current behavior.
- **X — excluded by design:** Preview-only mock OS/developer controls; keep as reference/test fixture, not a production requirement.
- **Phase:** First proposed phase to address/accept the item. `1S` is the **safety gate** before feature work; `1A–1C` are UI parity; `2–10` are functional phases.

The inventory groups each observable screen, choice, variant, data capability, or critical interaction into an independently verifiable item. Cosmetic icons and repeated HTML elements are captured at component/style level, not one row per DOM node.

## 2. Traceable feature register

### Platform, navigation and visual system

| ID | Original capability / UI | Original reference | Current GitHub mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| UX-01 | Dark minimal app visual language; charcoal, violet, amber/red danger | `H:20–23`, `H:54–146` | Navy responsive cards in `C`; visual hierarchy and colors differ | P | 1A |
| UX-02 | Narrow 412×892 phone composition and safe edges | `A:154–180`, `H:20` | Responsive layout exists; phone-specific parity not verified | P | 1A |
| UX-03 | Five-tab bottom navigation | `H:603–611` | Five-tab mobile nav with reordered labels in `G:167–193` | I | 1A |
| UX-04 | Android status-bar/clock/signal/battery illustration | `A:35–74` | Not reproduced as a fake OS overlay | X | 10 |
| UX-05 | Android app bar and Material 3 list-item mock components | `A:75–138` | Browser-native app components instead | P | 1A |
| UX-06 | Android gesture nav/soft-keyboard illustration | `A:139–153,182–229` | Native browser/phone handles these; no fake keyboard | X | 10 |
| UX-07 | Developer-only screen jump menu and reset state | `H:617–632`, `H:737–758` | No dev jump menu; production navigation added | X | 10 |
| UX-08 | Prototype knobs: offline, battery, urgency | `H:633`, `H:680–688` | No developer scenario-knob page; only a sample alert toggle | X | 10 |
| UX-09 | Prototype layout knobs: Watch radar/list/card; incident checklist/step; Night counters/timer | `H:633`, `H:780–783` | Only one current UI per screen | P | 1A–1C |
| UX-10 | Incident screen black, oversized high-contrast text and controls | `H:222–359` | Styled incident cards; legibility/one-handed parity needs review | P | 1B |
| UX-11 | Japanese sublabels and safety phrases | `H:25–611` | Selective Japanese terms and scripts; incomplete coverage | P | 1A–1C |
| UX-12 | Navigation changes between normal and urgent flows | `H:603–611`, `H:222–359` | Navigation remains in app shell; incident has own controls | P | 1B |
| UX-13 | Larger desktop navigation was not in phone prototype | `A:154–180` | Desktop sidebar in `G:167–193`; useful addition to retain | I | 10 |

### Onboarding and permission/setup flow

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| OB-01 | Seven-page onboarding with title, bilingual kicker, CTA | `H:25–51`, `H:634–642` | Seven-page informational tour, `G:45–52,359–369` | P | 1A |
| OB-02 | Step-by-step progress segments | `H:25–51` | Progress segments exist, `G:359–369` | I | 1A |
| OB-03 | Intro: predict with evidence, offline response, learn rules | `H:634–635` | Welcome describes actual manual local-first features; predictions not claimed | P | 1A |
| OB-04 | Location/geofence permission and home/office triggers | `H:636` | Addresses editable; no geofence or permission flow | M | 2,4,8 |
| OB-05 | Calendar connection, excluded calendars and event detection | `H:637` | Tour says not connected; no calendar integration | M | 2,5,7 |
| OB-06 | Optional Bluetooth tag pairing (wallet/keys) | `H:638` | No pairing/detection | M | 2,4 |
| OB-07 | Ordered 5-person emergency contact setup, landlord gap | `H:639` | Manual name/phone contacts in Settings; no order/role/inline setup | P | 2 |
| OB-08 | Home/office form, nearest station/walk time/shelter selection | `H:640` | Manual home/office/shelter/safe-place, no station inference | P | 2,8 |
| OB-09 | Akatsuki data-sharing consent and explicit decline | `H:641` | Plain-language no-connection statement; no connection or consent | M | 9 |
| OB-10 | Per-page permission skip/fallback semantics | `H:47–48`, `H:634–642` | Skip exits whole tour; Back/Continue exist | P | 1A,2 |
| OB-11 | Tour completion and return to Watch | `H:47–51`, `H:785` | `tourDone` saved; return to Watch | I | 1A |
| OB-12 | Clear explanation of local privacy and no automated sending | `H:641` | Truthful disclosure in final tour, `G:45–52,359–369` | I | 2 |

### Watch: prediction, quiet state and risk overview

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| WA-01 | Watch home dashboard and one main recommended action | `H:54–67` | Watch dashboard, readiness and quick actions, `G:195–226` | P | 1A |
| WA-02 | Predictive commute/weather warning (72% example) | `H:68–108` | **Only** labeled demonstration card; no prediction | M | 7 |
| WA-03 | Evidence/confidence presentation and explanation | `H:89–108` | No confidence or evidence engine | M | 7 |
| WA-04 | Combine JMA rain, meeting time and prior train delays | `H:92–100` | No input connectors or correlation | M | 7 |
| WA-05 | Set 20-min-earlier alarm CTA | `H:80,102` | No alarm, including original prototype (visual CTA only) | M | 7 |
| WA-06 | Not relevant / dismiss prediction | `H:81,103`, `H:783` | Toggle dismisses the demo alert, not a real prediction | P | 1A,7 |
| WA-07 | Quiet “All clear” scene with centered radar | `H:123–145` | Decorative radar still shown with normal hero; distinct quiet scene absent | M | 1A |
| WA-08 | Restore the last dismissed prediction | `H:136`, `H:783` | Demo can be shown again; no prediction history | P | 1A,7 |
| WA-09 | Switchable radar/list/card Watch layouts | `H:68–120`, `H:633` | Single layout; radar is decorative, explicitly not monitoring | M | 1A |
| WA-10 | Weather, quake, commute and trip risk tiles | `H:107–116,137–145` | Official links and action tiles; not four source-backed risk statuses | P | 1A,7 |
| WA-11 | Current readiness score and navigation | `H:87,119` | Real checklist-based readiness card/link | I | 1A |
| WA-12 | Alarm accuracy, 30-day count “11/13” | `H:119` | Correctly omitted; no predictions to evaluate | M | 7 |
| WA-13 | Next watched event/departure at 18:30 | `H:133–136` | No scheduling or monitored next event | M | 7 |
| WA-14 | Show official safety sources | `H:92–108`, `H:760` | Direct JMA/Cabinet Office links, clearly distinguished from live data | I | 7 |
| WA-15 | Freshness / last-update information for each risk | `H:92–100,760` | No feed/last-verified timestamps | M | 7 |
| WA-16 | Clearly labeled sample alert for first-run exploration | `H:68–120` (example is unlabeled there) | Improved “DEMONSTRATION ONLY — NOT A FORECAST” behavior | I | 10 |

### Departure check / lock-screen concept

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| DP-01 | Very quick manual departure check | `H:150–181` | Full manual page, `G:272–286` | I | 1B |
| DP-02 | Wallet / transit pass / phone check cards | `H:161–168`, `H:691–693` | Individual wallet, pass, phone toggles | I | 1B |
| DP-03 | Keys check as optional Bluetooth-related item | `H:638` | Manual keys toggle added to current app | I | 1B |
| DP-04 | Show real phone battery level / low-battery caution | `H:156–170`, `H:633` | No battery sensor integration; manual phone item only | M | 4 |
| DP-05 | Detect wallet/keys via paired tags | `H:163–178`, `H:638` | No tag proximity integration | M | 4 |
| DP-06 | Trigger by leaving `[Home]`/`[Office]` geofence | `H:175`, `H:636` | Page manually opened; no background trigger | M | 4,8 |
| DP-07 | Actual Android lock-screen notification/action presentation | `H:150–181`, `A:35–74` | Normal browser route, not lock-screen/notification | M | 4 |
| DP-08 | “All with me” completion/log | `H:171`, `H:816` | Saves local completion log and resets toggles | I | 4 |
| DP-09 | “Something missing” action to open Stranded | `H:172`, `H:816` | Missing items route to Stranded | I | 4 |
| DP-10 | Explain why triggered and “not relevant” dismiss | `H:175` | Explains manual-only; no trigger reason to display | P | 4 |
| DP-11 | Manual fallback without permissions | `H:178` | Manual checks work without permissions | I | 4 |

### Stranded fallback planner

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| ST-01 | One next action plus ordered fallback list | `H:184–217` | Five-step guidance, `G:37–44,287–295` | I | 1B |
| ST-02 | Return to known office/wallet location | `H:652–653` | Generic “Retrace your steps”; no detected last-seen location | P | 4 |
| ST-03 | Set up/top-up Mobile IC as alternative | `H:654` | Check **already-set-up** mobile payment; safer, no unsupported promises | P | 4 |
| ST-04 | Smartphone-enabled ATM at a konbini | `H:655` | Replaced by “ask station staff”; no verified nearby ATM path | M | 4,9 |
| ST-05 | 交番 (police box) option | `H:656` | Generic help, explicitly no guaranteed fare loan | P | 4 |
| ST-06 | Call an available colleague | `H:657` | Contact someone trusted; no last-online status | P | 4 |
| ST-07 | Distance, walking time and cost per option | `H:194–205`, `H:652–657` | No metrics; prototype values were fabricated samples | M | 4,8 |
| ST-08 | Check venue opening hours/availability | `H:202`, `H:652–657` | No venue data source or opening-hours API | M | 4,9 |
| ST-09 | Order by cost/distance | `H:216` | Fixed, safety-first suggested order; no dynamic ranking | M | 4,9 |
| ST-10 | “Won’t work” → next alternative | `H:206`, `H:816` | Next button and step selector work | I | 4 |
| ST-11 | Resolve and log result | `H:205`, `H:816` | Explicit resolved log, `G:435–442` | I | 4 |
| ST-12 | Launch verified walking/calling/payment action | `H:205`, `H:816` | No real route, payment integration, or call from plan | M | 4,8 |
| ST-13 | Akatsuki nearby places without disclosing exact location | `H:216` | No Akatsuki integration/consent protocol | M | 9 |

### Incident: all seven steps and incident-wide controls

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| IN-01 | Seven consecutive earthquake response steps | `H:222–359`, `H:643–651` | Seven-step guide, `G:19–36,243–270` | I | 1B |
| IN-02 | Step number, progress bar and step jump | `H:230–235` | Functional segmented stepper | I | 1B |
| IN-03 | “Are you hurt?” and ambulance/fire 119 | `H:239–253` | Functional `tel:119` link | I | 3 |
| IN-04 | Police / danger 110 | `H:253–262` | Functional `tel:110` link (prototype button inert) | I | 3 |
| IN-05 | Japanese “my address is…” emergency phrase | `H:257–261` | Displays manually saved home address | I | 3 |
| IN-06 | Offline badge/status in urgent layout | `H:223–229` | Online/offline footer plus browser status, not same prominent badge | P | 1B |
| IN-07 | Current battery percentage/low-power message | `H:223–229`, `H:810–813` | Not reading battery; no percentage | M | 3 |
| IN-08 | Optional amber/red emergency color variant | `H:633`, `H:683–685` | Single visual treatment | M | 1B |
| IN-09 | Safety checklist: shoes, hazards, exit, elevators | `H:263–290`, `H:644` | Interactive checklist with safer gas-leak wording | I | 3 |
| IN-10 | One-at-a-time checklist variant with Done/Can’t | `H:273–287`, `H:633` | Checklists only; can advance without completion | P | 1B,3 |
| IN-11 | Retain completed items while stepping offline | `H:643–651`, `H:693–700` | Local incident progress/checks | I | 3 |
| IN-12 | Five **ordered roles**: partner, mum, colleague, landlord, embassy | `H:291–315`, `H:698–700` | Any user-entered contacts, no role/order or five-slot checklist | P | 2,3 |
| IN-13 | English/Japanese prewritten safe-check-in message | `H:294–304` | Templates shown; location is user-entered; no actual battery/next time | P | 3 |
| IN-14 | One-tap send to all 5 contacts | `H:301`, `H:800` | Not implemented; **prototype only flipped a boolean**, sent zero SMS | M | 3 |
| IN-15 | Per-contact SMS composition, user confirms send | `H:291–314` | `sms:` composer for saved contacts | I | 3 |
| IN-16 | Tap when contact actually reached | `H:306–314` | Reached/undo toggles | I | 3 |
| IN-17 | Disaster Message Dial 171 fallback | `H:313–319` | `tel:171` and NTT instructions | I | 3 |
| IN-18 | Stay/leave decision guidance | `H:321–345` | Safer general cues and official-warning direction | P | 3 |
| IN-19 | JMA tsunami/aftershock status and cached timestamp | `H:326–333`, `H:812` | Intentionally no fake “no warning” or “LIVE”; official links only | M | 7 |
| IN-20 | Cached shelter map/school/route distance | `H:335–344` | Manually saved shelter name, no cached map | M | 8 |
| IN-21 | “Evacuate — start route” walking navigation | `H:345` | No route; prototype merely advanced a step | M | 8 |
| IN-22 | Water/kit/charger/neighbors checklist | `H:645–648` | Four safety check items, adapted for safety | I | 3 |
| IN-23 | Official information and rumor/trains guidance | `H:648–649` | JMA/NHK links, municipality reminder; no train status | P | 3,7 |
| IN-24 | Damage photos and landlord/employer follow-up | `H:649–650` | Checklist guidance; no in-app photo or contact-action links | P | 3 |
| IN-25 | Embassy check-in/registration as explicit task | `H:649–650` | Not in current step 7 checklist; may be user-specific | M | 3 |
| IN-26 | “Help”, “Skip”, “Done” footer actions | `H:349–356` | Previous/Continue/Leave guide; no context-specific Help | P | 1B,3 |
| IN-27 | Finish incident and save local record | `H:649–651` | Saves event/note; resets incident flow | I | 3 |
| IN-28 | Never mistake mock statuses for real alerts | `H:329,812` (misleading mock labels) | Current app explicitly says no live feed, no verified evacuation route | I | 10 |

### Readiness score, gaps and inventory

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| RD-01 | Circular readiness score | `H:362–370` | Actual 0–100 weighted ring, `G:7–18,230–242` | I | 1A |
| RD-02 | Top three gap cards with actions | `H:370–380`, `H:707–716` | “Next small win” and first two pending checks; not exact 3 cards | P | 1A,2 |
| RD-03 | 14-item emergency go-bag inventory | `H:378–385`, `H:713–716` | Ten broad readiness items; not a 14-item inventory | P | 2 |
| RD-04 | Water expiry date + “replace” reminder | `H:708–710` | No quantity, expiry date, or replenishment cycle | M | 2 |
| RD-05 | Missing landlord contact as gap | `H:709–714` | Contacts stored, no required-role validation | P | 2 |
| RD-06 | Emergency cash held vs target | `H:710–711` | Cash yes/no check only | P | 2 |
| RD-07 | One-tap action to close gaps | `H:373–377` | Checkbox confirms user checked item, not actual purchase | P | 2 |
| RD-08 | Offline copies of residence card/passport/insurance | `H:713–716`, `H:763` | Checklist awareness, no documents vault | M | 8 |
| RD-09 | Embassy registration status | `H:713–716` | No registration tracking | M | 2 |
| RD-10 | Designated shelter and cached route readiness | `H:713–716` | Saved shelter name but no route verification/cache | P | 2,8 |
| RD-11 | Readiness inventory summary with visible statuses | `H:378–385` | Ten detailed toggles grouped by essentials/bag/contacts | P | 1A,2 |
| RD-12 | Score reacts to checks instead of fixed sample 68+23 | `H:711–714` | Improvement: actual tracked weighted 0–100 score | I | 2 |
| RD-13 | Honest “verify personally” disclaimer | `H:362–385` (sample is simulated) | Explicitly states user confirmation required | I | 2 |

### Night Out: idle, before, live, urgent and after

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| NO-01 | Idle state and start-night action | `H:420–436` | Working idle state, `G:296–321` | I | 1C |
| NO-02 | Next detected event/venue in idle state | `H:423–427` | No event detection | M | 5 |
| NO-03 | Last three nights with per-night metrics | `H:427–433`, `H:729–735` | No queryable night-history records; only general log | M | 5 |
| NO-04 | Learned personal patterns/risk triggers | `H:431–434` | No pattern analysis | M | 5,6 |
| NO-05 | Pre-commit/limits before first drink | `H:438–467` | Form + confirmation in local state | I | 5 |
| NO-06 | Adjustable drink count limit | `H:445–449` | Numeric field instead of +/- picker | I | 1C |
| NO-07 | Adjustable spend cap | `H:451` | Numeric yen field rather than three-value cycle | I | 1C |
| NO-08 | Leave-by time | `H:451–454` | Manually editable time, no external validation | P | 5 |
| NO-09 | Last-train calculation from timetable | `H:452–454` | No timetable or actual train fetch | M | 5,7 |
| NO-10 | Getting-home mode (train/taxi/walk) | `H:454–458` | Train/taxi/walk/other options | I | 5 |
| NO-11 | Walking time + travel buffer | `H:452–454`, `H:471–488` | No route-walk estimate or computed margin | M | 5,8 |
| NO-12 | “Why this matters” based on logged mistakes | `H:460–465` | Generic preparation explanation only | M | 6 |
| NO-13 | Three live counters: drinks, spend, train | `H:470–488` | Drinks/spend/leave-by, no last-train minutes | P | 1C,5 |
| NO-14 | Alternative large countdown/timer UI | `H:482–488`, `H:633` | Missing | M | 1C,5 |
| NO-15 | “Last sober decision” when limits reached | `H:488–494`, `H:807` | Limit-reached warning in live screen | I | 5 |
| NO-16 | Go home action | `H:490`, `H:817` | “I’m heading home” enters after screen | I | 5 |
| NO-17 | “Stop drinking, stay” choice | `H:491`, `H:817` | No distinct stopped-but-staying state | M | 5 |
| NO-18 | “One more” and +1 with honest record | `H:492,503` | +1 user-entered cost, plus undo | I | 5 |
| NO-19 | Social-pressure decision “Mine / Theirs — I'll pass” | `H:495–500`, `H:817` | Missing; prototype selection was transient UI state | M | 5 |
| NO-20 | Intoxicated-person red flags and 119 dial | `H:507–522` | Urgent screen with 119 and first aid basics | I | 5 |
| NO-21 | Japanese translations for each red flag | `H:509–517` | Japanese heading but fewer bilingual labels | P | 1C,5 |
| NO-22 | Recovery guidance after the night | `H:526–537` | Absent; safety review required before wording is restored | M | 5 |
| NO-23 | Accountability list: cleaning, costs, apology | `H:537–545`, `H:733–736` | Missing | M | 5 |
| NO-24 | Pre-filled post-night card (home time, spend, drinks) | `H:546–557` | Spend/drink summary, not home-arrival timestamp | P | 5 |
| NO-25 | Save a night event to activity log | `H:554`, `H:733–735` | Working local log, saved note, limit and spend | I | 5 |
| NO-26 | Real cost history, manual prices and undo | `H:728–735` (prototype uses fixed ¥1,300/drink) | Better current implementation with exact user-entered amounts | I | 5 |
| NO-27 | Calendar-started pre-commit push notification | `H:637,438–442` | No background calendar or push | M | 5,9 |

### After-action and activity log

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| AA-01 | Three-step reflection: what happened → last decision → rule | `H:390–414` | Dedicated manually editable form, `G:333–341` | I | 1C |
| AA-02 | Three illustrative “last decision point” selectable choices | `H:396–404`, `H:718–723` | Free-text field only | M | 1C,6 |
| AA-03 | Suggested rule derived from decision choice | `H:404–409`, `H:720–724` | User writes rule; no suggestions/derivation | P | 6 |
| AA-04 | Explain when saved rule will fire | `H:407–412` | Plain text “Trigger”; no execution | P | 6 |
| AA-05 | Save rule linked to a log entry | `H:412`, `H:723–724` | Rule and event log saved; link implicit in note | P | 6 |
| AA-06 | Auto-fire learned rules when future conditions recur | `H:407–412`, `H:720–724` | Not implemented; original prototype did not execute triggers | M | 6,9 |
| AA-07 | Prefill from the Night Out just recorded | `H:546–557` | After screen has numeric summary; separate reflection is blank | P | 6 |
| AA-08 | Minute-long, low-friction reflection flow | `H:390–392` | Functionality exists but lengthy blank form | P | 1C |
| AA-09 | Example “sharehouse party” with ¥10,000/blackout | `H:392–398` | Intentionally not seeded as the user's personal event | X | 10 |
| LG-01 | Time-ordered activity timeline | `H:562–574` | Real saved events, `G:322–332` | I | 1C |
| LG-02 | Event time, title and notes | `H:565–574` | Dynamically generated JST timestamp and user notes | I | 6 |
| LG-03 | Default sample history (rain, party, stranded, departure) | `H:659–664` | Correctly omitted from user's real activity | X | 10 |
| LG-04 | Event outcome/status badges (accurate/review/resolved) | `H:572–574` | Titles/notes only; no typed outcome | M | 6 |
| LG-05 | Saved rules with trigger and origin | `H:575–582` | Rule text, trigger string and saved date; no origin link | P | 6 |
| LG-06 | Open after-action from the log | `H:583` | “Create a safety rule” navigation | I | 6 |
| LG-07 | Add a new manual event | `H:562–584` | New capability implemented in current app | I | 6 |
| LG-08 | 30-day filter/lookback | `H:563` | Original label only; no current filter | M | 6 |

### Settings, storage and privacy

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| SE-01 | Data-source connection list | `H:589–599`, `H:759–765` | Honest inactive statuses, `G:342–357` | P | 2 |
| SE-02 | Last-successful-sync timestamps | `H:760` | None; original values were hardcoded | M | 7,9 |
| SE-03 | Calendar account/allowed calendar exclusions | `H:637,760` | Not connected | M | 2,9 |
| SE-04 | Bluetooth paired tag list | `H:638,760` | Not connected | M | 2,4 |
| SE-05 | Akatsuki area-cell approximate 1 km privacy option | `H:641,761,599` | No Akatsuki or sharing/consent controls | M | 9 |
| SE-06 | Train-line/station sharing toggle | `H:641,761` | No train-line data or sharing | M | 9 |
| SE-07 | Calendar, contacts, tags, drinks remain private | `H:641,761` | No external sends; plaintext browser storage | P | 2,9 |
| SE-08 | Commute alert confidence threshold ≥60% | `H:762` | No predictive alert/threshold editor | M | 7 |
| SE-09 | Quake threshold 震度5弱 | `H:762` | No automatic quake trigger | M | 7 |
| SE-10 | Night Out limit alert threshold | `H:762` | Displayed limit reached when manual count hits user limit | I | 5 |
| SE-11 | Seven steps cached for offline opening | `H:763` | App shell and embedded steps cached by service worker | I | 1S,8 |
| SE-12 | Download/cache 2-km shelter map with status/size | `H:763` | No offline map | M | 8 |
| SE-13 | Offline residence/passport/insurance documents | `H:763` | No document store; **security review required** | M | 8 |
| SE-14 | Emergency contacts and addresses | `H:764` | Manual contact add/remove; home/office/shelter/safe-place | I | 2 |
| SE-15 | 150-m home/office geofence radius | `H:764` | Address strings only | M | 4,8 |
| SE-16 | Local data backup and restore | `H:589–602` (not interactive in original) | JSON export/import with replacement confirmation | I | 2 |
| SE-17 | Clear all local data | `H:625` (prototype reset) | Explicit browser confirmation then local reset | I | 2 |
| SE-18 | Persistent privacy-aware preferences | `H:760–765` | localStorage settings persist; **not encrypted** | P | 2 |
| SE-19 | Revoke Akatsuki consent | `H:641,599` | No integration and no revoke flow | M | 9 |
| SE-20 | Contacts/addresses as editable forms, not read-only mock labels | `H:764` | Working local inputs; improvement to preserve | I | 2 |

### Offline operation, integrations and reliability

| ID | Original capability / UI | Original reference | Current mapping / difference | Status | Phase |
| --- | --- | --- | --- | :---: | :---: |
| CF-01 | App opens with offline safety guide | `H:223–229,643–651` | Static PWA shell service worker caches app assets | I | 1S,8 |
| CF-02 | Only this app's caches removed on SW update | `H:223–229` (implicit offline requirement) | **DEFECT:** `S:6–8` deletes **all other caches on same origin** | M | **1S** |
| CF-03 | Cache version/freshness/upgrade strategy | `H:760–764` | Cache-first strategy, version constant `v2`; stale asset risk | P | **1S**,8 |
| CF-04 | Verify offline startup after install/restart | `H:223–229` | Source suggests capability; no device-level evidence in audit | P | 8,10 |
| CF-05 | Installable PWA metadata/icons | `A:154–180` (phone reference) | Manifest, icons, registration in `P`,`G:520–525` | I | 10 |
| CF-06 | JMA weather/quakes/tsunami feed | `H:92,329,641,760` | Not connected; current links to real official sites | M | 7 |
| CF-07 | Local government evacuation/shelter updates | `H:326–345,648` | Not connected | M | 7,8 |
| CF-08 | Railway delay and last-train data | `H:92,454,641` | Not connected | M | 7 |
| CF-09 | Calendar reading/event triggers | `H:637,641` | Not connected | M | 5,9 |
| CF-10 | Background geofences and user location | `H:636,175` | Not connected; PWA cannot be assumed to offer native background geofences | M | 4,8 |
| CF-11 | Bluetooth/AirTag/Tile/SmartTag proximity | `H:638` | Not connected; device/platform feasibility unknown | M | 4 |
| CF-12 | Akatsuki read-only data and privacy-limited outbound signals | `H:641,216,760–761` | Not connected | M | 9 |
| CF-13 | Scheduled/background alerts and notifications | `H:637,641,762` | Not implemented | M | 7,9 |
| CF-14 | Private on-device contacts and records | `H:639,641` | `localStorage` stores contact names/numbers/addresses in plaintext | P | 2 |
| CF-15 | Versioned state with migration safety | `H:669–676` (prototype memory only) | `G:86–150` has v1 schema; mismatched version silently defaults (data-loss risk) | P | **1S**,2 |
| CF-16 | User-initiated emergency communication (no silent send) | `H:242–262,301` | Phone/SMS composer only, user retains control | I | 3 |
| CF-17 | Official-source timestamps, confidence, stale/error states | `H:92–100,326–333` | Missing until real data integration | M | 7 |
| CF-18 | Safe offline maps/routes with provenance and update dates | `H:334–345,763` | Missing, and original visual route was not real | M | 8 |
| CF-19 | User-data backup portability | `H:669–676` (in-memory only) | Current JSON export/import, 1-MB import cap | I | 2 |
| CF-20 | Safety review of quake, tsunami, first aid and alcohol guidance | `H:222–359,507–537` | Adapted copy exists; requires authoritative review and scenario tests | P | 3,5,10 |

## 3. Original screenshot and PDF crosswalk

These assets are already in the GitHub `uploads/` folder; their filenames are reproduced exactly to make individual visual reviews traceable. There are 13 PNG references plus the combined `Disaster-Management-screens.pdf`. Screens 4c and 4e, onboarding, idle Night Out, Log and Settings are present in `H` but have no separate named PNG in this set.

| Screenshot ID | Repo asset | Feature IDs / implementation window |
| --- | --- | --- |
| SS-01 | `uploads/01 1 Watch with a prediction.png` | WA-01–06, WA-09–12 · 1A,7 |
| SS-02 | `uploads/02 1b Watch quiet state.png` | WA-07–10, WA-13 · 1A |
| SS-03 | `uploads/03 2 Departure Check lock screen.png` | DP-01–11 · 1B,4 |
| SS-04 | `uploads/04 3 Stranded.png` | ST-01–13 · 1B,4 |
| SS-05 | `uploads/05 4a Incident Are you hurt.png` | IN-01–08 · 1B,3 |
| SS-06 | `uploads/06 4b Incident offline, make it safe.png` | IN-06–11 · 1B,3 |
| SS-07 | `uploads/07 4d Incident offline, stay or evacuate.png` | IN-18–21 · 1B,7–8 |
| SS-08 | `uploads/08 5 Readiness.png` | RD-01–13 · 1A,2 |
| SS-09 | `uploads/09 6 After-Action.png` | AA-01–09 · 1C,6 |
| SS-10 | `uploads/10 7a Night Out pre-commit.png` | NO-05–12 · 1C,5 |
| SS-11 | `uploads/11 7b Night Out last sober decision.png` | NO-13–19 · 1C,5 |
| SS-12 | `uploads/12 7c Night Out someone is very drunk.png` | NO-20–21 · 1C,5 |
| SS-13 | `uploads/13 7d Night Out after.png` | NO-22–25 · 1C,5 |
| SS-PDF | `uploads/Disaster-Management-screens.pdf` | Combined image collection · QA reference |

## 4. High-priority audit findings — **not fixed in Phase 0**

1. **RISK-01 — Cross-app CacheStorage deletion (critical; Phase 1S).** `service-worker.js:6–8` uses `keys.filter(key => key !== CACHE)` and deletes *every* other cache key on the same **origin** when the worker activates. All `https://celeritas7.github.io/<repo>/` apps share the origin-wide CacheStorage namespace even though their service-worker scopes differ. An activation in this app may delete other Celeritas7 PWA caches. Correct behavior: delete only cache keys owned by Disaster Management (namespaced prefix), preserve unrelated caches, test with another installed app, and avoid deleting live needed files mid-session. **Do not change `main` during Phase 0.**
2. **RISK-02 — Stale offline assets (high; Phase 1S/8).** `S:1–16` is cache-first and uses fixed `v2`; deployment of a new `app.js` or `styles.css` without a cache version/update policy may keep serving old files. Verify update and rollback behavior; namespace revisions.
3. **RISK-03 — Local sensitive information (high; Phase 2).** `G:86–150,342–357` stores name/phone/address and event notes in plaintext `localStorage`; JSON exports also contain them. This is local-only, **not encrypted**; user should be informed clearly, especially on shared devices. Do not build a “document vault” without threat modeling and opt-in safeguards.
4. **RISK-04 — Schema migration/data recovery (high; Phase 1S/2).** `G:93–96` resets state to defaults on unexpected schema version. A future release could hide or lose existing records. Introduce tested, backward-compatible migrations and import/export tests before changing structure; preserve v1 data.
5. **RISK-05 — Live-status misinformation (critical safety constraint; Phase 7).** Original `H:92–100,326–333,760` shows invented confidence, current JMA status and sync timestamps. Those **must never** be copied verbatim into live UI. All actual notices need authoritative source, fetch time, coverage, expiry/uncertainty and fail-closed “unknown/offline” states. The current app's truthful warnings are correct.
6. **RISK-06 — Background device limitations (high feasibility; Phase 4/8/9).** A GitHub Pages PWA alone cannot be assumed to deliver reliable closed-app geofences, broad third-party Bluetooth tag access, or background reminders. Investigate Android native companion/platform limitations before making promises in onboarding.
7. **RISK-07 — Emergency workflow and medical copy (high; Phase 3/5/10).** User-visible quake/tsunami/evacuation, drinking emergency and recovery guidance needs current official review and offline scenario testing. The original mock's “Tsunami: no warning,” an implied guaranteed police fare loan, and “all SMS sent” click must never be made operational without verification.
8. **RISK-08 — Real behavior versus matching pixels (release gate).** Passing a screenshot comparison does **not** prove the app can send an alert, verify shelter status, reserve a fare loan, find a route, or place a call. Treat UI parity and functional acceptance as separate tests.

## 5. Implementation trace policy

Each future phase PR must: (1) name the relevant IDs above in its description; (2) mark `I/P/M` only after tested behavior; (3) add tests or a manual acceptance transcript with evidence; (4) distinguish demo content from live data; (5) document changed storage schema and migrations; (6) leave working `main` deployed until review and a successful Pages check. The accompanying [phased checklist](PHASED_IMPLEMENTATION_CHECKLIST.md) is the delivery tracker; **the Phase 0 audit changes documentation only**.

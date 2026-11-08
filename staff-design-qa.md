# Staff design verification — 2026-11-08

final result: passed

## Reference and evidence

Compared the supplied ZIP's staff screens `_6` (ward monitoring), `_2` (care recording), `_3` (family communication), and `_1` (reports). The original PNGs were inspected; `_2/screen.png` contains an image-fetch error, so its original HTML was rendered locally. ZIP content was treated as design material.

Both reference HTML and implementation were captured at **1440 × 1000 CSS pixels**. Original and revised captures were placed together in `outputs/staff-qa/comparison-{6,2,3,1}-1440.png` and inspected. Focused content comparisons exclude the reference's 288 px sidebar and implementation's existing 248 px sidebar plus signed-in strip/header; they retain the actual content scale. Detail captures cover medication/meal inputs and the lower three report panels. Evidence is retained locally in ignored `outputs/staff-qa/`.

## Findings resolved

- **P1 — Missing composition.** Restored the ward KPIs, patient observation feed and handoff notes; sectioned care form and visible save bar; communication roster/composer/approval columns and recipient preview; report period/scope controls, vital/nutrition/activity charts, clinical notes and family read receipts.
- **P2 — Narrow columns and broken wrapping.** Patient names, identifiers, metrics and actions use explicit minmax tracks, bounded images and minimum button sizes. Communication changes from three columns to two columns at 1350 px, then a single column on small screens. Ward actions remain inline where they fit.
- **P2 — Excessive first-screen height.** Matched the source's compact patient header and KPI/form density. The accessible page heading is retained without duplicating the sidebar/header visually. The patient picker is inside the care header and report toolbar.
- **P2 — Header gap on scroll.** Made the signed-in strip sticky. On a scrolled desktop page it occupies y=0–44 and the fixed header begins at y=44; content no longer appears through an empty strip.
- **P2 — Oversized or unstable saving actions.** The save bar stays within the content width, reflows on small screens and submits the actual care form. It displays explicit unsaved/draft/shared status rather than a fictitious autosave time.
- **P2 — Chart reliability.** Added recorded-value charts and accessible value tables. Missing dates remain gaps. Blood pressure, glucose and temperature have separate unit-correct views. Bar spacing avoids axis-label collisions.
- **P2 — Cross-page section links.** Care-note/reply anchors scroll after the asynchronous UI is rendered and clear the fixed header. Rehabilitation and meals have separate anchor targets.

## Fidelity surfaces

- **Typography:** retained Plus Jakarta Sans/Korean fallback and Material Symbols; checked names, headings, numeric input/units, action labels and table text. Controls no longer force letter-by-letter wrapping.
- **Spacing/layout:** restored four-KPI rhythm, compact patient context, main/side panel hierarchy, three-column composition, section tabs and sticky save actions. Inspected five responsive widths and focused lower-page states.
- **Colors/tokens:** retained blue primary actions, mint family/read-state panels, soft gray inputs and red observation emphasis. No replacement brand or unrelated palette was introduced.
- **Images:** retained the generated patient portraits and six synthetic activity scenes, served by the authenticated photo API. Restored photo strips, enlargement and the family-card preview. Captures confirm proper crops and bounded image sizes.
- **Copy/data:** all counts, charts, notes and read statuses come from authorized synthetic records. Mock prescriptions, fall-risk scores, calories, sensor events, AI conclusions, family members and read timestamps were not copied as real facts. Metric labels describe the data actually available.

## Working behavior and data boundaries

- Ward filters support all patients, observation values, missing records and unsent news; search includes patient name, room and guardian.
- The care form supports temperature presets, linked glucose slider, medication/care confirmations, meal percentage, pulse/water/swallow observations, notes, draft saving and publishing. New confirmation/pulse/water/swallow observations are preserved as labeled text in the existing care note; no unbacked prescription order or new clinical table is implied.
- Activity strips display the existing authenticated photo collection. Ordinary staff photo-upload permissions were not expanded; this change does not claim a new image-attachment workflow.
- News templates update the recipient preview, roster search/status filters work, all pending bookings remain accessible, and direct conversations exclude broadcast-news entries.
- Report range supports 7/14/30 days, individual/ward scope, blood pressure/glucose/temperature views, value tables and browser print/PDF. Ward mode disables the individual patient picker.
- The existing server, D1 schema, approval rules and family access checks were unchanged.

## Verification

1. **20 staff layout combinations passed:** 4 screens × 390/768/1024/1280/1440 px. Document width equals viewport width; no unintended content overflow. Deliberate section-tab/table scrollers remain inside their containers.
2. **Browser interactions passed:** ward/guardian search, observation filter, roster search and unsent filter, news templates, typed preview preservation over polling, report range/scope/metric controls, and care-note/reply anchor placement.
3. **Local real-server persistence passed:** entered draft and published care records through the UI; read them back using fresh staff/family sessions with `tests/staff-ui-records.mjs`. Temperature 36.7, meal 50%, checklist, pulse 78, water 250 and swallow observation persisted. The draft was absent from family state; the published record was present. Test records exist only in the local synthetic DB.
4. **Family regression passed:** existing five family screens at 390 px still render without overflow and show only Kim Soon-ja for the linked family account.
5. `node --check public/app.js`, `node --check public/staff-charts.js`, `node scripts/build-pages.mjs`, and `node tests/pages-build.mjs` passed. The build check verifies all staff routes include the stylesheet and chart runtime before the app.

No open P0/P1/P2 finding remains in the inspected scope. P3 follow-up: physical-device, keyboard and screen-reader verification; browser print dialogs were not executed during layout checks.

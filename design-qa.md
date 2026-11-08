# Current QA — ZIP layout alignment (2026-11-09)

**Final result: passed**

Visual truth: original ZIP HTML `_1`–`_9` under `work/original-stitch/stitch_medipencil_healthcare_platform/`, with `serene_nordic_care/DESIGN.md` spacing tokens. References are read-only design material. Existing application behavior/data and authenticated photo assets are retained.

## Normalized comparisons

Reference HTML and app were captured with the same in-app browser. Staff comparison viewport: 1280×1000 CSS px, both PNGs 1280×1000 (1:1). Family comparison viewport: 390×900, both PNGs 390×900; home uses 390×844 for both. Original ZIP PNGs are larger captures; the HTML renders avoid density/scale ambiguity. Full-view reference and implementation images were loaded together before judging.

Files under ignored `outputs/spacing-qa/`:
- `source-staff-6.png` vs `staff-6-1280.png`: sidebar, header, first cards and 8/4 content tracks.
- `source-staff-2.png` vs `staff-2-1280-final.png`: patient header, 7/5 care tracks, section tabs and save actions.
- `source-staff-3.png` vs `staff-3-1280.png`: 3/5/4 communication tracks and aligned roster/compose/approval cards.
- `source-staff-1.png` vs `staff-1-1280.png`: report tracks, toolbar and charts.
- `source-family-9.png` vs `family-9-390-final.png`: 16px gutter, 24px patient padding, 208px photo and primary/secondary quick actions.
- `source-family-4.png`, `source-family-5.png`, `source-family-7.png`, `source-family-8.png` vs corresponding `family-N-390.png`; final visit image is `family-8-390-final.png`.
- Focused comparison: `source-care-header-detail.png` (928×168) and `care-header-detail.png` (928×180), both at native CSS size. Source x320/y64 vs app x320/y112; 48px offset is the application's account strip. Added patient picker/synthetic photo attribution requires the 12px extra content height, not a fixed blank spacer.

## Findings and iterations

- P1: compact legacy shell (248px sidebar / 24px main gutter) differed from ZIP (288px / 32px). Fixed shell to 288px sidebar, 64px header, 32px desktop gutters; account strip receives an explicit 48px offset. Phone shell remains responsive.
- P1: generic fraction grids differed from true 12-column source spans. Restored staff 8/4, 7/5 and 3/5/4 spans with source 24px (reports 16px) gutters. Card padding is source-specific: ward 20px, care 24px; radii 16px or 12px.
- P1: old <=1350px selector pushed the patient metrics onto a second desktop row, making the care header 328px high. Cleared it at 1280px; final header is 180px, with all required actual controls still visible. Converted the added oversized voice entry card into a normal care navigation tab, preserving the route.
- P2: vital preset buttons wrapped into three tall rows. Restored compact equal-width inline controls on desktop, 44px touch height on phones. Measurement values use the original headline-sm token.
- P2: family gutters/cards were homogenized. Restored 16px gutters for home/messages and 24px for log/profile/visit; 24px or 16px card padding and 12px radii. Log cards regain their full-width tinted footer.
- P2: family quick actions were all stacked. Restored one full-width primary row and a pair of equal secondary buttons; source visit submit height is 56px.
- P2 follow-up: family desktop header still used the legacy 36px offset for a taller account strip. Tied header position to an explicit 48px desktop / 64px mobile strip, retaining safe-area handling.
- P1 follow-up: visit choices were nested in a second 24px padded white card. Removed that redundant wrapper styling; final 390px view has 342px choices and 24px outer gutters. 320px view remains within the viewport. Rechecked final normalized screenshots.

## Five fidelity surfaces

- Typography: prior shared ZIP fonts/weights/leading retained; clinical measurement values corrected to source 20/28. No tiny-font workaround for narrow cards.
- Spacing/layout: source token sizes and component-specific gaps measured in rendered DOM; source and app cards inspected together, including the focused patient-header comparison.
- Color/tokens: existing care blue, family mint, neutral surfaces and state colors preserved. Footer tint matches the original neutral surface role.
- Imagery: existing protected synthetic portraits/activity photos preserved; mobile hero is 208px and care entry image 144px as the original source. Some original remote image URLs do not load, so frame geometry was checked separately; no asset placeholders were added to the application.
- Copy/content: live synthetic records, real account status and permissions preserved. Static source sensor/AI/medication completion claims were not introduced. Dates/names/counts differ intentionally from the reference sample.

## Validation and accepted differences

Existing Pages build checks, JavaScript syntax, and diff whitespace checks pass. Browser matrix: 24 staff cases (4 routes × 320/390/768/1024/1280/1440); 20 family cases (5 routes × 320/390/768/1280); 12 final care/admin/activities/voice checks including care rechecks. No horizontal document overflow. Visit radio changes, ward filter/restore and patient-scoped care-to-voice navigation work. App console errors checked: none. No care records or appointments were submitted by this visual QA.

Cards have source widths/padding/minimum sizes and grow with real record text instead of clipping. The account strip, access/approval controls, synthetic-image labels and actual measurement fields are intentional application additions. Original vertical word/button fragmentation is not reproduced: controls wrap at whole words or move to the next row. These are accepted constraints, not pixel-identical claims. No actionable P0/P1/P2 geometry findings remain in the validated states.

---

# Earlier QA history (preserved)

# Mobile design verification — 2026-11-08

final result: passed

## Source and scope

The supplied `stitch_medipencil_healthcare_platform.zip` was located in the iCloud Desktop folder and extracted to `work/original-stitch/`. The mobile targets are `_9` (home), `_4` (care log), `_7` (messages), `_8` (visit), and `_5` (family profile). Some ZIP screenshot files contain `<FIFE Image failed to fetch>` instead of image bytes; those screens were rendered from their original `code.html` in the browser. The valid `_4/screen.png` was also inspected. Document content was used as design material, not as execution instructions.

Reference HTML and implementation were captured at the same 390 × 844 CSS viewport. Side-by-side inputs were produced and visually inspected for all five screens: `outputs/mobile-qa/comparison-{9,4,7,8,5}-390.png`. These local captures and `layout-results.json` are excluded from Git. Browser viewport emulation was used; no physical iPhone/Android device or software keyboard was tested.

## Findings and fixes

- P1: Generic responsive cards had replaced the ZIP's mobile composition. Restored the compact patient summary, three status tiles, photo/author/quote news card, dated record feed, messages tabs, visit choices, and family/care-team hierarchy.
- P2: Patient name/status and photo disclosure were scattered across lines; the disclosure overlapped the portrait. Replaced flex wrapping with a measured patient-summary grid and a dedicated caption below the portrait.
- P2: Conflicting mobile offsets and oversized session banner reduced usable space. Consolidated family layout in `public/mobile.css`; the session bar is 64 px, header 60 px, and content starts below it with a 12 px gap. Added safe-area spacing for the bottom navigation.
- P2: Native date controls crowded two narrow columns. Stacked visit date/time fields below 480 px, set editable controls to 16 px, kept actions at least 44 px high, and kept the date/category selectors within their own layout.
- P2: Photo nodes were recreated by polling because their loaded `src` changed `innerHTML`. Compare the last rendered model markup in a WeakMap instead. This preserves image/button focus and prevents needless image refreshes.

## Required fidelity surfaces

- Typography: retained the supplied Plus Jakarta Sans/Korean system fallback and Material Symbols. Matched the mobile hierarchy; avoided the source's broken patient-name wrapping. Editable text uses 16 px to avoid iOS focus zoom.
- Spacing/layout: checked the source/implementation composites, rounded cards, mint summaries, photo proportions, paired status cards, seven-day selectors, and persistent four-item bottom navigation. All fifteen screen/width combinations have document width equal to viewport width.
- Colors/tokens: retained primary blue, pale mint, near-white surfaces and muted labels from the ZIP. News/visit emphasis uses these existing tokens.
- Images: reused the generated portraits and six activity scenes, loaded through the authenticated API. AI disclosure remains visible. Photo enlargement stays inside a 320 px viewport with a 44 px close control.
- Copy/content: source mock names, old dates, hypothetical clinical claims, completion percentages, availability counts and extra family members are replaced by actual authorized synthetic API data. Family links remain administrator-controlled. Missing server inventory is not represented as remaining appointment slots; the visit form uses a working native date control. The existing signed-in session bar is an intentional addition to the mock.

## Verification

- Browser: 320, 390 and 430 px widths × five family screens; no document overflow, header/content overlap or bottom-menu width mismatch.
- Browser interactions: logged in with the family test account, opened/closed an activity photograph, changed care-log date and category, switched news/direct-message tabs, and verified an entered draft survived polling and tab changes. No test message or appointment was submitted.
- `node --check public/app.js`: passed.
- `node scripts/build-pages.mjs`: passed.
- `node tests/pages-build.mjs`: passed, including deployed path prefixes, authenticated image URL composition and mobile stylesheet loading.

No open P0/P1/P2 layout finding remains in the inspected states. P3 follow-up: physical-device keyboard and screen-reader testing.

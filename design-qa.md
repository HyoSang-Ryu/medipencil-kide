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

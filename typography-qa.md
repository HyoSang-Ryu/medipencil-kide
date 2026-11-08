# ZIP typography alignment — 2026-11-08

Canonical source: `work/original-stitch/stitch_medipencil_healthcare_platform/serene_nordic_care/DESIGN.md`; semantic assignments checked against original `_1` through `_9` HTML. The reference ZIP is not distributed in the app.

One final stylesheet (`public/typography.css`) supplies the shared original font, size, weight and leading. `voice.css` now contains layout only. No bespoke mobile font shrinking.

- Staff page/patient heading: headline-md 24/32, 700. Section headings and clinical measurement inputs: headline-sm 20/28, 600.
- Ward/report KPIs: headline-lg 36/44, 700; communication KPIs retain the source's headline-md 24/32.
- Family page/patient headings: headline-sm 20/28, 600. Visit selection headings and choices: label-lg 16/24, 600, as in `_8`.
- Main body: body-md 16/24, 400. Record prose, messages, metadata descriptions: body-sm 14/20, 400.
- Standard buttons, navigation, labels: label-md 14/20, 600. Original small template/filter actions remain label-sm 12/16, 500; source-specific primary family/communication actions use label-lg.
- Small metadata, chips and family bottom-navigation captions: label-sm 12/16, 500. Icons keep the Material Symbols font.
- Desktop textareas follow the source's body-sm; editable mobile fields use body-md 16px to prevent iOS focus zoom. Voice transcript fields retain their existing body-md assignment.
- Canvas chart axes now use 12px labels and reduce date density on narrow canvases. Missing data behavior is unchanged.

QA: existing Pages artifact checks passed. Live local browser checked staff routes 6/2/3/1 at 1440 and 390px; family 9/4/7/8/5 at 1280 and 390px; all nine plus admin accounts, activities and voice at 320px. No horizontal document overflow in the 30 measured combinations. Runtime computed sizes, screenshots and metrics are saved under ignored `outputs/typography-qa/`. No new clinical data was written for typography QA.

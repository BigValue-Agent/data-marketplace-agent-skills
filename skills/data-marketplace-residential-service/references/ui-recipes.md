# UI Recipes

Use these recipes to compose product calls into residential service screens.

**Defaults, not mandates.** These recipes encode the common Korean residential-map service grammar. The caller's explicit requirements always win: do not copy a specific competitor service structure as a fixed requirement, and do not force every generated app to use every product.

## Contents

- Map-First Layout Grammar
- Search Box
- Map Viewport
- Interaction State Rules
- Price Bubble Map
- Boundary Layer
- Detail Panel
- Detail Drawer Order
- Detail Drawer Tabs
- Full-Service Minimum
- Price Chart Pattern
- Transaction Area Filtering
- Price Scope And Reference Time
- Unit Price Detail
- Building Unit Drilldown
- Route Blueprint
- Unsupported UI Sections

## Map-First Layout Grammar

1. Use a map-first workspace, not a marketing landing page.
2. Desktop layout should be: top search/filter bar, a results list (the bundled template's floating search-result card satisfies this), full-height map, right detail drawer.
3. Mobile layout should keep search first, then map, then bottom-sheet or drawer detail.
4. Show markers when the initial bbox is eligible; otherwise show a clear zoom-in guide instead of forcing a marker call.
5. Keep browser code behind the generated app backend; do not call Data Marketplace directly from the browser.

## Search Box

1. Debounce text input.
2. Call name search with `query_text` and optional `result_scope`; do not send offset.
3. Group rows by `result_type` and render `title` plus `subtitle`; do not auto-select the first row.
4. On region selection, fit its bbox and show the center pin without complex markers; when `polygon_available=true`, reuse the legal-dong detail response for both the boundary and one clearly labeled type-count line on the pin instead of adding another call, then reveal viewport markers after the user zooms in.
5. On complex selection, store `result_key` as the string `complex_key`.
6. Load complex detail drawer data only for a complex result.

## Map Viewport

1. Read viewport bbox.
2. Validate all four bbox values.
3. Load type markers with a documented limit; markers do not support offset paging. The residential type marker product is the default bbox marker source.
4. Render one marker row per `complex_key`; show `residential_type` as its representative type.
5. On click, load parent detail and keep the selected `residential_type` for profile, realdeal, and unit scopes.
6. Do not call the complex profile product for every marker in the viewport.
7. If the viewport span exceeds 0.1 degrees per axis, render a zoom-in guide state instead of loading markers.
8. When a marker response returns `has_next=true`, only complexes near the viewport center are shown and outer edges are truncated; tell the user to zoom in for full coverage, do not offset-page, and do not present the visible markers as complete coverage.
9. Keep region overview and complex viewport as separate states; use actual bbox span, not SDK zoom numbers, to switch between them.

## Interaction State Rules

1. Keep explicit state for `activeComplexKey`, `selectedResidentialType`, `mapViewMode`, `selectedRegionBaseline`, `detailRequestSeq`, `markerRequestSeq`, and `programmaticMapMovePending` (example names — adapt them to the app's conventions, keep the roles).
2. On marker, candidate, or list selection, apply the selected class immediately, open the detail drawer immediately, and render a skeleton profile shell before network calls finish.
3. When selection pans the map, the next programmatic idle reload must not clear the selected marker, selected list row, or open detail drawer. When the user changes a filter, re-evaluate the selection against that filter; clear an excluded selection or distinguish it from current results. Absence from a viewport or truncated response alone does not establish a filter mismatch.
4. Repainted marker layers must restore selected state by `complex_key`, not by DOM node identity.
5. Detail, shape, realdeal, building, and unit responses must check the current selection and request sequence before writing to the DOM.
6. Empty or failed sections should render local empty/error states while keeping the detail drawer open.
7. Expose stable DOM hooks for smoke testing; the canonical hook list lives in `references/verification-checklist.md`.

## Price Bubble Map

1. Use this only when the map needs a complex name plus recent price-like label.
2. Load residential type markers with bbox and a narrow field set.
3. Prefer `complex_key`, `residential_type`, `latitude`, `longitude`, `display_name`, `complex_household_count`, and `recent_month6_average_realdeal_price`.
4. Treat recent price fields as optional; show a fallback label when they are null.
5. A price bubble should identify the complex and label the price as the complex profile's recent-six-month summary; do not imply it is a residential-type price.
6. For long names, use visual truncation/ellipsis; do not drop the name entirely.
7. Marker rows carry nullable `display_name`, not `complex_name`. Fall back to household count or representative type when it is null; load the complex profile after selection when the source name is required.
8. Load complex profile only after marker selection when the UI needs full detail data.

## Boundary Layer

1. Use legal-dong detail for a selected region boundary and complex area for a selected complex boundary; keep the two layers independent.
2. The complex area product does not support viewport bbox loading.
3. Shape loading should be lazy and should not block the detail drawer.
4. Validate `Polygon`/`MultiPolygon`, closed rings, and finite in-range coordinates before drawing.
5. If `polygon_geojson` is missing or unsupported (including `GeometryCollection`), omit the boundary only; keep the detail panel usable and center the map on marker/profile coordinates.

## Detail Panel

1. Use residential complex profile as the main profile source for the detail panel.
2. Use it for address, coordinates, scale, approval/parking/heating, nearby facilities, school context, constructor/developer, representative land info, and title-part summary.
3. Treat the profile as one row per `complex_key`, with representative `residential_type`. Use `recent_month6_*` only as a whole-complex summary and hide it when the selected type differs from that representative type.
4. Load the complex-scope realdeal page independently of buildings; automatically select an observed private area before showing its trend. Load notice and estimated prices only after unit selection.
5. Add shape layer only if map boundary is visible.
6. In 완성형, load buildings independently for dong/ho navigation and load units only after a building is selected.
   Fetch one building page initially; expand already-loaded cards first, then fetch subsequent pages only on explicit “동 더 보기” clicks. Preserve the selected residential type and existing cards on retry, reset paging when the complex changes, and disclose a partial list when the API offset limit is reached. Do not fetch all buildings automatically to obtain a total count.
7. If shape is missing, keep the panel usable with representative coordinates.
8. Treat nearby `*_distance` fields as distance only; do not turn them into walking/driving time without route or travel-time data.

## Detail Drawer Order

1. Hero: complex name, address, type, household count, map focus.
2. Whole-complex summary: profile `recent_month6_*`, shown in a type-filtered view only when the selected type matches representative `residential_type`.
3. Realdeal list, observed transaction-area selector, and selected-area chart.
4. Building/dong section: building summaries.
5. Unit/ho section: selected-unit notice and estimated prices after `ppk + jpk` is known.
6. Land/title summary: complex profile land fields and the single aggregate-title source values when present. Do not label legacy `sum_title_*` fields as sums across buildings; the structure field is currently unavailable.

## Detail Drawer Tabs

Use this neutral tab architecture for full residential map service generation. The table below is the 완성형 composition tier. 기본형 keeps the profile-summary 가격 and 단지정보 only. 표준형 adds realdeal and shape, and omits buildings, unit prices, and the 동/호 tab.

| Tab | Products | Required components |
|---|---|---|
| 가격 | complex profile, realdeal history | whole-complex profile summary, transaction list, observed-area selector, selected-area price-trend-chart and volume-bars |
| 동/호 | building summaries, unit details, notice prices, estimated prices | building-card, unit-drilldown-panel |
| 단지정보 | complex profile | complex-detail-drawer, profile-stat-strip |

입지 is recommended when the complex profile has useful location facts. If location data is limited, merge 입지 into 단지정보 instead of blocking the drawer.

When nearby comparison is requested, load one marker query lazily and label prices as whole-complex profile summaries. Do not present them as same-area comparisons.

## Full-Service Minimum

For a full residential map service (the 완성형 composition tier, or when no tier was asked), the generated app must show evidence for both building and lazy unit drilldown: a buildings route/section and a lazy units route/panel that carries `complex_key + ppk` (strings). Recommended route names are `/api/buildings` and `/api/units`. Before unit rows load, show `data-testid="unit-panel-placeholder"`; after a unit request, render `data-testid="unit-row"` rows or `data-testid="unit-empty-state"`. A bundled starting point lives in `assets/map-service/`; adapt it to the target stack instead of rebuilding these surfaces. 기본형 omits both routes. 표준형 also omits both routes and unit-price surfaces; realdeal has no buildings dependency.

The detailed completeness criteria and DOM evidence list live in `references/verification-checklist.md` (Full-Service Incomplete Checks).

## Price Chart Pattern

1. Use realdeal history for transaction charts at one actual private area; never mix areas in one price trend.
2. Initialize the selected area from the first page as described in Transaction Area Filtering below; reuse those rows for the chart.
3. Trend chart fields are `contract_date`, `deal_division_name`, `private_area`, `price`, `deposit_price`, and `cancel_date`.
4. Use a single-axis chart for one price semantic at a time: sale uses `price`, lease uses `deposit_price`.
5. Do not mix monthly-rent `deposit_price` and monthly-rent `price` on the same y-axis; show monthly-rent rows as a table or dual-value labels instead.
6. Expose the amount-axis trend as `data-testid="price-trend-chart"`.
7. Monthly volume bars can group loaded `contract_date` rows by year-month and should expose `data-testid="volume-bars"`.
8. Monthly volume bars are secondary evidence; they do not replace the price trend chart when selected-area sale rows exist.
9. Use the same scope and dates as the list, following Price Scope And Reference Time below.
10. Fix the chart's right edge to `date_to`. When results are partial (`has_next` or the offset cap), start the left edge at the earliest loaded row instead of `date_from`; pad minimum width only toward the past and never beyond the product standard month.
11. When more rows exist, label the first-page view as partial and fetch more only after explicit user intent.
12. Cancelled rows should be visually marked or excluded with a clear note.

## Transaction Area Filtering

1. Start with one complex-scope realdeal page using `sort.field=contract_date`, `sort.order=desc`, and `limit=100`; do not wait for buildings. Select its most frequent valid, non-cancelled observed area for the initial list and chart, reusing those rows without another request. Disclose a partial first-page scope.
2. Offer valid `private_area` values from loaded transactions as observed transaction-area options, not the complete housing stock or unit counts. Do not scan all units to recreate composition.
3. A displayed two-decimal area represents its 0.01㎡ bin. On area selection, send `private_area_min = value - 0.005` and `private_area_max = value + 0.005`, then update the table, price chart, and volume bars together.
4. Show the same-area price trend and optional sale/lease overlay only for a selected private area. Do not chart mixed-area prices as one area’s trend.
5. Keep the selected area across period/deal-type changes. An empty scoped result does not widen to another area automatically.
6. Never convert supply `pyeong_number` to `private_area`. Apply the shared display policy to area options and preserve raw rows for inspection.

## Price Scope And Reference Time

1. The default whole-complex summary is the profile `recent_month6_*` snapshot. It is not type-specific: in a type-filtered view, show it only when the selected type matches representative `residential_type`, and do not rebuild it from paged rows.
2. Treat `complex_key + residential_type + selected actual private-area bin + deal type + requested period` as one realdeal scope.
3. Anchor preset periods to profile `standard_ym`; label the screen with that product reference month and actual contract dates.
4. A selected-area empty result stays `해당 전용면적 자료 없음`; do not reuse a whole-complex value under the selected-area label.
5. Keep sale/lease overlay optional and cache it independently by scope, deal type, and period.

## Unit Price Detail

1. Load notice and estimated prices only after a selected unit provides `ppk + jpk`.
2. Request the latest row from both products in parallel and render their failures independently.
3. Show `notice_year` and `estimated_standard_ym` from the returned rows; do not substitute the current calendar year or month.
4. Show the estimate grade only as that unit's grade. Do not promote it to a complex or pyeong grade.
5. Treat the current unit-price products as single snapshots: display the returned notice year or estimated-price year-month, and do not generate history or trend UI from one snapshot. Do not calculate complex/pyeong averages or a three-source gauge from paged unit rows.
6. Tax, brokerage-fee, or acquisition-cost calculators are optional and must be labeled `단순 추정`.

## Building Unit Drilldown

1. Load building summaries for the complex.
2. Carry `ppk` as a string when the user selects a building.
3. Load unit detail when the user drills into dong/ho or area.
4. Use `jpk` for unit-level follow-up when available.
5. For unit detail lists, page by `limit` and `offset`; do not load every unit when the drawer first opens.
6. Use `data-testid="unit-drilldown-panel"` for the selected building's lazy unit area.

## Route Blueprint

1. Browser routes may use query parameters for convenience.
2. Server routes must convert those parameters into Data Marketplace JSON Body.
3. Keep product-specific validation close to the route or product adapter.
4. Do not share one broad validation rule across realdeal, notice, estimated-price, building, and unit products.

## Unsupported UI Sections

Do not invent unavailable external data or attribute user-provided data to Data Marketplace. Requested app features built from supported data or user input do not require another property-data source; local favorites and sharing a selection are examples. Implement their actual dependencies, and disclose any local-only persistence or sharing limits. Omit unavailable features or mark them as unavailable instead of presenting mock behavior as working.

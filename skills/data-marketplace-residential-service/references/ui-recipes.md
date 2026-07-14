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
- Area Summary And Filtering
- Price Scope And Reference Time
- Unit Price Detail
- Building Unit Drilldown
- Route Blueprint
- Unsupported UI Sections

## Map-First Layout Grammar

1. Use a map-first workspace, not a marketing landing page.
2. Desktop layout should be: top search/filter bar, a results list (the bundled template's floating search-result card satisfies this), full-height map, right detail drawer.
3. Mobile layout should keep search first, then map, then bottom-sheet or drawer detail.
4. The first visible screen should show map markers and a selected-detail affordance, not only empty cards.
5. Keep browser code behind the generated app backend; do not call Data Marketplace directly from the browser.

## Search Box

1. Debounce text input.
2. Call name search.
3. Preserve returned order because name-search candidates are relevance-first by internal `match_score DESC`, then `complex_name` and `complex_key`; `match_score` is not exposed.
4. Show candidate name, address/region, and type labels.
5. On selection, store `complex_key` as a string.
6. Load detail drawer data.

## Map Viewport

1. Read viewport bbox.
2. Validate all four bbox values.
3. Load type markers with a documented limit; markers do not support offset paging. The residential type marker product is the default bbox marker source.
4. Render one marker row per `complex_key + residential_type`.
5. On click, load parent detail and keep the selected `residential_type` for profile, realdeal, and unit scopes.
6. Do not call the complex profile product for every marker in the viewport.
7. If the viewport span exceeds 0.1 degrees per axis, render a zoom-in guide state instead of loading markers.
8. When a marker response returns `has_next=true`, only complexes near the viewport center are shown and outer edges are truncated; tell the user to zoom in for full coverage, do not offset-page, and do not present the visible markers as complete coverage.

## Interaction State Rules

1. Keep explicit state for `activeComplexKey`, `selectedResidentialType`, `selectedMarkerId`, `detailRequestSeq`, `markerRequestSeq`, and `programmaticMapMovePending` (example names — adapt them to the app's conventions, keep the roles).
2. On marker, candidate, or list selection, apply the selected class immediately, open the detail drawer immediately, and render a skeleton profile shell before network calls finish.
3. When selection pans the map, the next programmatic idle reload must not clear the selected marker, selected list row, or open detail drawer.
4. Repainted marker layers must restore selected state by `complex_key + residential_type`, not by DOM node identity.
5. Detail, shape, realdeal, building, and unit responses must check the current selection and request sequence before writing to the DOM.
6. Empty or failed sections should render local empty/error states while keeping the detail drawer open.
7. Expose stable DOM hooks for smoke testing; the canonical hook list lives in `references/verification-checklist.md`.

## Price Bubble Map

1. Use this only when the map needs a complex name plus recent price-like label.
2. Load residential type markers with bbox and a narrow field set.
3. Prefer `complex_key`, `residential_type`, `latitude`, `longitude`, `complex_name`, `complex_household_count`, and `recent_month6_average_realdeal_price`.
4. Treat recent price fields as optional; show a fallback label when they are null.
5. A price bubble should identify the complex and label the price as the complex profile's recent-six-month summary; do not imply it is a residential-type price.
6. For long names, use visual truncation/ellipsis; do not drop the name entirely.
7. Load complex profile only after marker selection when the UI needs full detail data.

## Boundary Layer

1. Use the complex area product only for the selected complex boundary after a `complex_key` is known.
2. The complex area product does not support viewport bbox loading.
3. Shape loading should be lazy and should not block the detail drawer.
4. Validate `Polygon`/`MultiPolygon`, closed rings, and finite in-range coordinates before drawing.
5. If `polygon_geojson` is missing or unsupported (including `GeometryCollection`), omit the boundary only; keep the detail panel usable and center the map on marker/profile coordinates.

## Detail Panel

1. Use residential complex profile as the main profile source for the detail panel.
2. Use it for address, coordinates, scale, approval/parking/heating, nearby facilities, school context, constructor/developer, representative land info, and title-part summary.
3. Use matching-type `recent_month6_*` fields for the default whole-complex price summary; hide that price when the selected type differs from the profile type.
4. Load realdeal only after the selected private-area scope is known. Load notice and estimated prices only after unit selection.
5. Add shape layer only if map boundary is visible.
6. Load building/unit products only when the user opens that drill-down.
7. If shape is missing, keep the panel usable with representative coordinates.
8. Treat nearby `*_distance` fields as distance only; do not turn them into walking/driving time without route or travel-time data.

## Detail Drawer Order

1. Hero: complex name, address, type, household count, map focus.
2. Whole-complex summary: matching-type profile `recent_month6_*` fields.
3. Pyeong controls and scoped realdeal chart/list.
4. Building/dong section: building summaries.
5. Unit/ho section: selected-unit notice and estimated prices after `ppk + jpk` is known.
6. Land/title summary: complex profile land and title-part fields.

## Detail Drawer Tabs

Use this neutral tab architecture for full residential map service generation.

| Tab | Products | Required components |
|---|---|---|
| 가격 | complex profile, realdeal history | whole-complex profile summary, price-trend-chart, volume-bars |
| 평형 | building summaries, realdeal history | area-summary-card, area_axis_filter |
| 동/호 | building summaries, unit details, notice prices, estimated prices | building-card, unit-drilldown-panel |
| 단지정보 | complex profile | complex-detail-drawer, profile-stat-strip |

입지 is recommended when the complex profile has useful location facts. If location data is limited, merge 입지 into 단지정보 instead of blocking the drawer.

When nearby comparison is requested, load one marker query lazily and label prices as whole-complex profile summaries. Do not present them as same-area comparisons.

## Full-Service Minimum

For a full residential map service, the generated app must show evidence for both building and lazy unit drilldown: a buildings route/section and a lazy units route/panel that carries `complex_key + ppk` (strings). Recommended route names are `/api/buildings` and `/api/units`. Before unit rows load, show `data-testid="unit-panel-placeholder"`; after a unit request, render `data-testid="unit-row"` rows or `data-testid="unit-empty-state"`. A bundled starting point lives in `assets/map-service/`; adapt it to the target stack instead of rebuilding these surfaces.

The detailed completeness criteria and DOM evidence list live in `references/verification-checklist.md` (Full-Service Incomplete Checks).

## Price Chart Pattern

1. Use realdeal history for transaction charts.
2. Fetch the first page once with `sort.field=contract_date`, `sort.order=desc`, and `limit=100`; share those rows between the chart and list.
3. Trend chart fields are `contract_date`, `deal_division_name`, `private_area`, `price`, `deposit_price`, and `cancel_date`.
4. Use a single-axis chart for one price semantic at a time: sale uses `price`, lease uses `deposit_price`.
5. Do not mix monthly-rent `deposit_price` and monthly-rent `price` on the same y-axis; show monthly-rent rows as a table or dual-value labels instead.
6. Expose the amount-axis trend as `data-testid="price-trend-chart"`.
7. Monthly volume bars can group loaded `contract_date` rows by year-month and should expose `data-testid="volume-bars"`.
8. Monthly volume bars are secondary evidence; they do not replace the price trend chart when sale rows exist.
9. Derive preset periods from profile `standard_ym`, not the browser date, and apply the same `date_from`/`date_to` to the chart.
10. Fix the chart's right edge to `date_to`. When results are partial (`has_next` or the offset cap), start the left edge at the earliest loaded row instead of `date_from`; pad minimum width only toward the past and never beyond the product standard month.
11. When more rows exist, label the first-page view as partial and fetch more only after explicit user intent.
12. Cancelled rows should be visually marked or excluded with a clear note.

## Area Summary And Filtering

1. Derive pyeong cards from `buildings.units_summary`, not a limited realdeal or unit-detail page.
2. A card click should set a visible selected state and filter the realdeal chart and transaction table by that area.
3. Default to the valid-observed-area pyeong with the largest `ho_count` total.
4. Merge pyeongs whose observed private-area bands overlap into one realdeal scope, while keeping supply-pyeong labels visible.
5. Treat `area_axis_filter` as a cross-panel axis: the price-trend-chart, volume-bars, and transaction table should update together.
6. When refetching, use documented `private_area_min`/`private_area_max` for realdeal rows and `pyeong_number` or `pyeong_type_name` for unit rows.
7. Do not derive `private_area` from `pyeong_number`. When pyeong data exists but lacks an observed private area, keep scoped realdeal unavailable; only a truly pyeong-less complex may use whole-complex realdeal.
8. Use only values accepted by the shared display policy in selectors, labels, filters, and calculations; preserve rejected raw rows for inspection.

## Price Scope And Reference Time

1. The default whole-complex summary is the matching-type profile `recent_month6_*` snapshot. Do not rebuild it from paged rows.
2. Treat `complex_key + residential_type + observed private-area band + deal type + requested period` as one realdeal scope.
3. Anchor preset periods to profile `standard_ym`; label the screen with that product reference month and actual contract dates.
4. A selected-area empty result stays `해당 평형 자료 없음`; do not reuse a whole-complex value under the selected-area label.
5. Keep sale/lease overlay optional and cache it independently by scope, deal type, and period.

## Unit Price Detail

1. Load notice and estimated prices only after a selected unit provides `ppk + jpk`.
2. Request the latest row from both products in parallel and render their failures independently.
3. Show `notice_standard_ym` and `sise_production_standard_ym` from the returned rows; do not substitute the current calendar month.
4. Show the estimate grade only as that unit's grade. Do not promote it to a complex or pyeong grade.
5. Treat the current unit-price products as single snapshots: show the latest row and do not generate history or trend UI unless multiple standard months are actually returned. Do not calculate complex/pyeong averages or a three-source gauge from paged unit rows.
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

Do not generate live sections for listings, brokers, news, favorites, alerts, loan calculators, school/academy rankings, or recommendation scores unless the user explicitly provides another API/source. If needed, render them as disabled placeholders or omit them. Do not imply the Data Marketplace API provides these sections.

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
- Derived Metrics And Estimates
- Price Tabs
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
5. On click, load parent detail and keep the selected `residential_type` for price or unit tabs.
6. Do not call the complex profile product for every marker in the viewport.
7. If the viewport span exceeds 0.1 degrees per axis, render a zoom-in guide state instead of loading markers.
8. When a marker response returns `has_next=true`, only complexes near the viewport center are shown and outer edges are truncated; tell the user to zoom in for full coverage, do not offset-page, and do not present the visible markers as complete coverage.

## Interaction State Rules

1. Keep explicit state for `activeComplexKey`, `selectedResidentialType`, `selectedMarkerId`, `detailRequestSeq`, `markerRequestSeq`, and `programmaticMapMovePending` (example names — adapt them to the app's conventions, keep the roles).
2. On marker, candidate, or list selection, apply the selected class immediately, open the detail drawer immediately, and render a skeleton profile shell before network calls finish.
3. When selection pans the map, the next programmatic idle reload must not clear the selected marker, selected list row, or open detail drawer.
4. Repainted marker layers must restore selected state by `complex_key + residential_type`, not by DOM node identity.
5. Detail, shape, price, building, and unit responses must check the current `activeComplexKey` and request sequence before writing to the DOM.
6. Empty or failed tab responses should render tab-local empty/error states while keeping the detail drawer open.
7. Expose stable DOM hooks for smoke testing; the canonical hook list lives in `references/verification-checklist.md`.

## Price Bubble Map

1. Use this only when the map needs a complex name plus recent price-like label.
2. Load residential type markers with bbox and a narrow field set.
3. Prefer `complex_key`, `residential_type`, `latitude`, `longitude`, `complex_name`, `complex_household_count`, `recent_month6_average_realdeal_price`, and `representative_pyeong_number`.
4. Treat recent price fields as optional; show a fallback label when they are null.
5. A price bubble should identify the complex: show `complex_name` with the recent price label and `representative_pyeong_number` when available.
6. For long names, use visual truncation/ellipsis; do not drop the name entirely.
7. Load complex profile only after marker selection when the UI needs full detail data.

## Boundary Layer

1. Use the complex area product only for the selected complex boundary after a `complex_key` is known.
2. The complex area product does not support viewport bbox loading.
3. Shape loading should be lazy and should not block the detail drawer.
4. If `polygon_geojson` is missing, keep the detail panel usable and center the map on marker/profile coordinates.

## Detail Panel

1. Use residential complex profile as the main profile source for the detail panel.
2. Use it for address, coordinates, scale, approval/parking/heating, nearby facilities, school context, constructor/developer, representative land info, and title-part summary.
3. Load price detail products only when a price tab is opened.
4. Add shape layer only if map boundary is visible.
5. Load building/unit products only when the user opens that drill-down.
6. If shape is missing, keep the panel usable with representative coordinates.

## Detail Drawer Order

1. Hero: complex name, address, type, household count, map focus.
2. Price chart: latest realdeal rows first, then loaded-row trend or volume summary.
3. Price tabs: realdeal, notice prices, estimated prices.
4. Area or pyeong controls: derive only from loaded price/unit rows unless a dedicated API provides more.
5. Building/dong section: building summaries.
6. Unit/ho section: unit details after `ppk` or `jpk` is known.
7. Land/title summary: complex profile land and title-part fields.

## Detail Drawer Tabs

Use this neutral tab architecture for full residential map service generation.

| Tab | Products | Required components |
|---|---|---|
| 가격 | realdeal history, notice prices, estimated prices | price_evidence_panel, price-trend-chart, volume-bars |
| 평형 | realdeal history, unit details | area-summary-card, area_axis_filter |
| 동/호 | building summaries, unit details | building-card, unit-drilldown-panel |
| 단지정보 | complex profile | complex-detail-drawer, profile-stat-strip |

입지 is recommended when the complex profile has useful location facts. If location data is limited, merge 입지 into 단지정보 instead of blocking the drawer.

Signature components for full-service prompts:

- `price-level-gauge`: a price surface that compares realdeal, estimated, and notice prices together for the selected complex/area; separate price tabs alone do not satisfy it.
- `nearby-comparison-panel`: a drawer panel comparing the selected complex against nearby marker rows plus same-area realdeal evidence; do not omit it as an optional enhancement in full-service builds.

## Full-Service Minimum

For a full residential map service, the generated app must show evidence for both building and lazy unit drilldown: a buildings route/section and a lazy units route/panel that carries `complex_key + ppk` (strings). Recommended route names are `/api/buildings` and `/api/units`. Before unit rows load, show `data-testid="unit-panel-placeholder"`; after a unit request, render `data-testid="unit-row"` rows or `data-testid="unit-empty-state"`. A bundled starting point lives in `assets/map-service/`; adapt it to the target stack instead of rebuilding these surfaces.

The detailed completeness criteria and DOM evidence list live in `references/verification-checklist.md` (Full-Service Incomplete Checks).

## Price Chart Pattern

1. Use realdeal history for transaction charts.
2. Before drawing the chart, fetch enough rows once for shape inspection: `sort.field=contract_date`, `sort.order=desc`, `limit 50~100` (`contract_date desc`).
3. Trend chart fields are `contract_date`, `deal_division_name`, `private_area`, `price`, `deposit_price`, and `cancel_date`.
4. Use a single-axis chart for one price semantic at a time: sale uses `price`, lease uses `deposit_price`.
5. Do not mix monthly-rent `deposit_price` and monthly-rent `price` on the same y-axis; show monthly-rent rows as a table or dual-value labels instead.
6. Expose the amount-axis trend as `data-testid="price-trend-chart"`.
7. Monthly volume bars can group loaded `contract_date` rows by year-month and should expose `data-testid="volume-bars"`.
8. Monthly volume bars are secondary evidence; they do not replace the price trend chart when sale rows exist.
9. Chart captions must state: `불러온 rows 기준`.
10. Cancelled rows should be visually marked or excluded with a clear note.

## Area Summary And Filtering

1. Derive area or pyeong cards from loaded realdeal `private_area` rows and, when opened, unit-detail area fields.
2. A card click should set a visible selected state and filter the realdeal chart and transaction table by that area.
3. Treat `area_axis_filter` as a cross-panel axis, not a local card filter: the representative price, price-trend-chart, volume-bars, and transaction table should update together.
4. When refetching, use documented `private_area_min`/`private_area_max` for realdeal rows and `pyeong_number` or `pyeong_type_name` for unit rows.
5. If only one page of rows is loaded, label area summaries as loaded-row summaries.
6. Do not infer a complete complex-wide area universe from one limited price or unit page.
7. If area fields are sparse, keep the transaction table usable and show an all-area fallback.

## Derived Metrics And Estimates

1. Derived metrics are app-side calculations from loaded rows, not new API summary fields.
2. `평당가` can be calculated from sale `price` and `private_area`; label it as `불러온 rows 기준`.
3. `전세가율` is valid only when sale rows with `price` and lease rows with `deposit_price` exist for the same area bucket. Apply a minimum-sample guard per side, show the sample counts, and omit the segment honestly when the guard fails; expose the segment as `data-testid="jeonse-ratio-chip"`.
4. Notice-price change should compare the same `jpk` when available; otherwise label the comparison as loaded-row based.
5. Estimated-price range width can use `upperlimit_sise_price - lowerlimit_sise_price` when both fields exist.
6. Tax, brokerage-fee, or acquisition-cost calculators are optional UI estimates and must be labeled `단순 추정`.

## Price Tabs

1. Call realdeal, notice-price, or estimated-price detail only after the user opens that tab.
2. Include `residential_type` when the user selected a type marker.
3. Show an empty state if the selected price detail product returns no rows.
4. Render sale, lease, and monthly-rent values with transaction-type-aware labels.
5. For realdeal or notice-price lists, load the first page when the tab opens and request more pages only on scroll, "more", or explicit pagination.

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

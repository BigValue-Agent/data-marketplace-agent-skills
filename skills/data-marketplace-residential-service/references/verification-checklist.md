# Verification Checklist

Use this checklist when verifying a generated residential map, detail, price, or building/unit service. `SKILL.md` routes completion checks here; apply the checks relevant to the selected tier and changed functionality.

## Contents

- Source Review Order
- App Backend Pattern
- Route Blueprint
- Verification Flow
- UI/UX Verification Flow
- Full-Service Incomplete Checks
- DOM Smoke Test Requirements
- Static Source Checks
- Unsupported Section Checks
- Stale Flow Checks
- Do Not Overfit

## Source Review Order

1. Read `references/ui-recipes.md` for the service flow.
2. Read `https://datamarket.bigvalue.ai/llms.txt`, then open the linked live documents for the core products you are wiring; read realdeal, building/unit, and unit-price contracts only when implementing those screens.
3. Adapt `assets/map-service/` instead of writing screens from scratch; if the assets are unavailable, follow `references/ui-recipes.md`.
4. Read `references/code-patterns.md` and `references/pitfalls.md` as needed for the specific code pattern or pitfall in question.
5. Sample verification calls go directly to the Data Marketplace API from server-side code when credentials are available.

## App Backend Pattern

- Browser code calls only the generated app backend.
- The app backend calls `POST /api/v1/data-products/{domain}/{product_slug}/query`.
- The app backend sends `X-API-KEY` from server-side environment variables.
- Browser query parameters must be translated into JSON Body `filters`, `bbox`, `fields`, `sort`, `limit`, and `offset`.

## Route Blueprint

Route names are recommended examples; keep the role-to-route mapping even if names differ.

| App route | Product role (`api_slug`) | Main purpose |
|---|---|---|
| `/api/location-search` | Region + complex search (`location-search`) | Search by region or complex name; region/address tokens can narrow only with a complex-name token |
| `/api/markers` | Residential type marker (`complex-type-markers`) | Current viewport markers or a selected complex marker |
| `/api/complex-detail` | Residential complex profile (`complexes`) | Main complex profile |
| `/api/complex-shape` | Residential complex area (`complex-shapes`) | Selected complex boundary |
| `/api/prices?tab=realdeal` | Residential realdeal history (`realdeal`) | Selected-area transaction rows |
| `/api/prices?tab=notice` | Residential notice price (`notice-prices`) | Selected-unit latest notice price |
| `/api/prices?tab=estimated` | Residential estimated price detail (`estimated-prices`) | Selected-unit latest BigValue estimate |
| `/api/buildings` | Residential building/dong summary (`buildings`) | Building or dong summary rows |
| `/api/units` | Residential unit detail (`units`) | Unit, ho, floor, and area rows |

## Verification Flow

One representative complex is sufficient live verification; do not repeat the live chain across multiple complexes. Run only the steps for the selected composition tier. All tiers: search, markers, complex detail, and profile recent-six-month summary. 표준형·완성형: shape and realdeal. 완성형 only: buildings, units, notice prices, and estimated prices.

1. All tiers: search by region and complex name and select each candidate type once.
2. All tiers: confirm `complex_key` remains a string.
3. All tiers: load bbox markers with top-level `bbox`.
4. All tiers: load one complex-profile row by `complex_key`, verify that `residential_type` is representative, and use its recent-six-month values only as a whole-complex summary with `standard_ym`.
5. 표준형·완성형: load shape and handle empty shape fallback.
6. 표준형·완성형: load one complex-scope realdeal page without waiting for buildings; verify that the most frequent valid observed area becomes the initial list/chart selection without another request.
7. 표준형·완성형: change the observed-area selection and verify its ±0.005㎡ bin, sale/lease/monthly-rent labels, list, and chart together.
8. 완성형: load buildings, then selected-building unit rows with `limit` and `offset`.
9. 완성형: select a unit and load latest notice and estimated prices with `ppk + jpk`.

## UI/UX Verification Flow

Run only the checks for surfaces included in the selected tier.

1. The first screen is a map-based working surface, not a landing page.
2. The desktop layout has top search/filter, a results list (floating search card acceptable), full map, and right detail drawer.
3. The map renders markers within the bbox limit; a selected region first shows its pin and optional boundary, then reveals complex markers after zoom-in.
4. Price bubbles use loaded marker/profile fields and handle null price labels.
5. Selecting a marker or candidate opens a detail drawer by `complex_key`.
6. 표준형·완성형 detail drawers include a realdeal chart or volume chart when selected-area transaction rows are available; 기본형 stops at the profile `recent_month6_*` summary.
7. The whole-complex price summary comes from profile `recent_month6_*`, not paged detail rows, and a type-filtered view hides it when the selected type differs from the representative `residential_type`.
8. In 표준형·완성형, realdeal does not wait for buildings. The selected-area list and chart share a first page and a period derived from profile `standard_ym`.
9. In 완성형, building/unit sections are lazy and carry `ppk` and `jpk` as strings; notice and estimated prices load only for a selected unit.
10. In 표준형·완성형, the shape layer uses the complex area product only for selected complex boundaries.
11. In 표준형·완성형, the initial list and chart contain only the automatically selected observed area; changing it updates both surfaces and no empty all-area option is exposed.
12. In 완성형, notice prices display `notice_year` (YYYY) and estimates display `estimated_standard_ym` (YYYYMM), and one unit's grade is not promoted to a complex grade.
13. Profile distance fields render as distance only, without walking/driving time or an N-minute catchment.
14. In 표준형·완성형, empty or unsupported GeoJSON omits the boundary only and keeps the tier's remaining UI usable.
15. Out-of-policy pyeong, area, and floor fixtures render as `확인 필요` only on tiers that include those surfaces; they do not enter normal selectors or derived metrics, while raw rows and stable keys remain available.

## Full-Service Incomplete Checks

These two checks apply when the 완성형 composition tier was chosen, or when no tier was asked. 기본형 omits buildings and unit surfaces. 표준형 also omits buildings and unit surfaces.

- For 완성형 (or tier-unasked) residential map prompts, a generated app is incomplete when it lacks building route/UI evidence.
- For 완성형 (or tier-unasked) residential map prompts, a generated app is incomplete when it lacks a clear lazy unit drilldown route/panel.
- Whatever the tier: Data Marketplace product routes and dependent data screens must match the chosen tier. 기본형 uses location-search/region-detail/markers/complex-detail. 표준형 adds complex-shape/realdeal. 완성형 adds buildings/units/notice/estimated. Additional requested app routes or screens are allowed when implemented with available data and user input.
- Building route/UI evidence means `/api/buildings` (or equivalent), the building summary product, and `data-testid="building-card"` appear in the generated backend/frontend.
- Lazy unit drilldown route/panel means `/api/units` (or equivalent), the unit detail product, `complex_key + ppk`, and `data-testid="unit-drilldown-panel"` appear in the generated backend/frontend.
- Unit rows are required after user intent or an intentional first-building preview; before that, use `data-testid="unit-panel-placeholder"`.

## DOM Smoke Test Requirements

Run only the checks for surfaces included in the selected tier.

- All tiers: a marker click immediately opens the detail drawer before detail API responses finish; the selected marker and matching list item expose a selected class or equivalent selected state; a programmatic map pan followed by idle keeps the same drawer open.
- All tiers: stale detail or marker responses do not overwrite the selected complex, and profile distance fields do not produce `도보`, `차량 N분`, or `N분 생활권` text.
- All tiers: stale search/marker responses cannot reopen cleared results or overwrite region overview; zooming back to the selected-region baseline restores its pin without removing its boundary.
- 표준형·완성형: the realdeal section renders `data-testid="price-trend-chart"` or a realdeal-specific empty/error state; rapid private-area, deal-type, or period changes reject stale price responses.
- 표준형·완성형: selecting an observed transaction area filters the chart/table; a buildings failure does not prevent realdeal loading.
- 완성형: stale building responses do not overwrite the selected complex.
- 표준형·완성형: empty, unsupported `GeometryCollection`, or invalid-coordinate shape data keeps the detail drawer usable without a console error.
- 완성형: stale unit responses do not overwrite the selected complex; selected-unit notice and estimated-price requests can fail independently and do not reuse realdeal rows.
- 완성형: a building card click carries `ppk` as a string and renders unit rows or a unit-specific empty state; a single-unit snapshot shows its returned notice year or estimated-price year-month without a complex/pyeong aggregate or representative grade.
- For every tier, extreme pyeong, area, or floor values are tested only on surfaces that tier includes and never enter normal marker, selector, floor, or unit-price inputs.

## Static Source Checks

When local browser execution or port binding is blocked, these grep-level checks still apply. Check the selected tier's Data Marketplace product routes and data screens; verify included hooks as `data-testid` attribute literals or runtime `dataset.testid` assignments, and treat a higher-tier product route or data surface left in a lower tier as a failure.

- 표준형·완성형 source checks: require `/api/prices?tab=realdeal`, its product usage, and `transaction-chart` or `price-trend-chart`; 기본형 must omit them.
- 완성형-only source checks: require `/api/buildings`, `/api/units`, notice/estimated routes, unit product usages, `building-card`, `unit-drilldown-panel`, `unit-panel-placeholder`, `unit-empty-state`, and `unit-row`; 기본형·표준형 must omit them.
- Marker bubble rendering labels `recent_month6_average_realdeal_price` as a whole-complex summary and does not pair it with a type-specific pyeong claim.
- The marker API wrapper must be limit-only: send top-level `bbox`, optional `filters.residential_type`, `fields`, and `limit`; do not send `offset` in marker request bodies because marker responses are center-distance truncated with `has_next`, not offset-paged. For the all-types view, one unfiltered request (all types share one limit, so a dense type can crowd out others) and the bundled template's per-type parallel requests (balanced coverage with more requests, cushioned by the marker TTL cache) are both acceptable — pick one deliberately.
- If a bundled reference template was used, preserve module boundaries when the stack allows it (`data-policy`, `api`, `map`, `panel`, `chart`, `format`, and `proxy` layers). If a framework requires a different file shape, preserve the selected tier's behavior; DOM hooks alone do not prove equivalence.
- If `assets/map-service/` is used, keep the selected tier's product routes and data surfaces with the dependencies required for their behavior; 표준형 omits buildings and unit drilldown, and realdeal remains independent of buildings. App features follow the supported-data rule below.
- Verify changed functionality in proportion to its importance and impact, not the amount of code rewritten. Check observable outcomes; code or DOM element presence alone does not prove correct behavior. If runtime checks are prohibited, review the relevant source paths and explicitly leave runtime behavior unverified.
- A blocked local server, sandboxed network, or port binding failure is not a reason to skip static source checks.

## Unsupported Section Checks

- External data has an actual source and is not invented or incorrectly attributed to Data Marketplace.
- Requested features built from supported data or user input are allowed; verify their required storage, delivery, or integration and disclose any limits.
- Unavailable features are omitted or clearly unavailable, not presented as working through mock behavior.

## Stale Flow Checks

- Do not use removed legacy product names or paths from older API versions (including the retired `dp_apt_*` 31-product generation described in old documents).
- Do not use the old product-id based call route; public calls use `/api/v1/data-products/{domain}/{product_slug}/query`.
- Do not use the complex area product (`complex_area`) as a viewport bbox shape product.
- Do not use the complex profile product (`complex_profile`) as the base bbox marker product.
- Use the estimated-prices product for current 산출시세 flows; do not describe it with removed product names.
- Do not calculate a complex/pyeong notice or estimated price from a limited page of unit rows.
- Do not derive realdeal periods from the browser's current date; use profile `standard_ym`.
- Do not require a three-source price gauge, representative unit grade, or whole-complex housing-composition reconstruction.

## Do Not Overfit

- Do not copy a specific competitor service structure as a fixed requirement.
- Do not force every generated app to use every product.
- Do not treat one limited page of rows as a whole-complex aggregate.

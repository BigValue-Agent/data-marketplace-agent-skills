# Verification Checklist

Use this checklist when verifying a generated residential map, detail, price, or building/unit service. `SKILL.md`'s Final Self-Check is the 5-line summary of this file; this file is the full completion audit.

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
2. Read the API Reference for the core products you are wiring first; read the lazy price-tab, building, and unit contracts when implementing those screens.
3. Adapt `assets/map-service/` instead of writing screens from scratch; if the assets are unavailable, follow `references/ui-recipes.md`.
4. Read `references/code-patterns.md` and `references/pitfalls.md` as needed for the specific code pattern or pitfall in question; re-check pitfalls before finalizing.
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
| `/api/complex-search` | Complex name search (`complex-search`) | Search candidate complexes by name |
| `/api/markers` | Residential type marker (`complex-type-markers`) | Current viewport markers or selected-complex type breakdown |
| `/api/complex-detail` | Residential complex profile (`complexes`) | Main complex profile |
| `/api/complex-shape` | Residential complex area (`complex-shapes`) | Selected complex boundary |
| `/api/prices?tab=realdeal` | Residential realdeal history (`realdeal`) | Transaction rows |
| `/api/prices?tab=notice` | Residential notice price (`notice-prices`) | Notice price rows |
| `/api/prices?tab=estimated` | Residential estimated price detail (`estimated-prices`) | BigValue estimated price rows |
| `/api/buildings` | Residential building/dong summary (`buildings`) | Building or dong summary rows |
| `/api/units` | Residential unit detail (`units`) | Unit, ho, floor, and area rows |

## Verification Flow

One representative complex through this chain is sufficient live verification; do not repeat the live chain across multiple complexes.

1. Search by complex name and select a candidate.
2. Confirm `complex_key` remains a string.
3. Load bbox markers with top-level `bbox`.
4. Load complex detail by `complex_key`.
5. Load shape and handle empty shape fallback.
6. Open realdeal, notice, and estimated-price tabs separately.
7. Verify sale, lease, and monthly-rent price labels separately.
8. Load building summaries.
9. Load unit rows with `limit` and `offset`.

## UI/UX Verification Flow

1. The first screen is a map-based working surface, not a landing page.
2. The desktop layout has top search/filter, a results list (floating search card acceptable), full map, and right detail drawer.
3. The map renders residential type marker rows as markers or price bubbles.
4. Price bubbles use loaded marker/profile fields and handle null price labels.
5. Selecting a marker or candidate opens a detail drawer by `complex_key`.
6. The detail drawer includes a realdeal chart or volume chart when transaction rows are available.
7. Every chart or computed summary from fetched rows says it is based on loaded rows.
8. Price tabs are lazy and separate: realdeal, notice prices, estimated prices.
9. Building/unit sections are lazy and carry `ppk` and `jpk` as strings.
10. Shape layer uses the complex area product only for selected complex boundaries.

## Full-Service Incomplete Checks

- For full-service residential map prompts, a generated app is incomplete when it lacks building route/UI evidence.
- For full-service residential map prompts, a generated app is incomplete when it lacks a clear lazy unit drilldown route/panel.
- Building route/UI evidence means `/api/buildings` (or equivalent), the building summary product, and `data-testid="building-card"` appear in the generated backend/frontend.
- Lazy unit drilldown route/panel means `/api/units` (or equivalent), the unit detail product, `complex_key + ppk`, and `data-testid="unit-drilldown-panel"` appear in the generated backend/frontend.
- Unit rows are required after user intent or an intentional first-building preview; before that, use `data-testid="unit-panel-placeholder"`.

## DOM Smoke Test Requirements

- A marker click immediately opens the detail drawer before detail API responses finish.
- The selected marker and matching list item expose a selected class or equivalent selected state.
- A programmatic map pan followed by map idle keeps the same detail drawer open.
- A stale detail, marker, price, building, or unit response does not overwrite the currently selected complex.
- The realdeal tab renders either `data-testid="transaction-chart"` or a realdeal-specific empty state.
- Notice and estimated-price tabs switch independently and do not reuse realdeal rows.
- An area or pyeong card click updates the selected state and filters the chart/table when area data is available.
- A building card click carries `ppk` as a string and renders unit rows or a unit-specific empty state.
- Empty shape data keeps the detail drawer usable and does not throw a browser console error.

## Static Source Checks

When local browser execution or port binding is blocked, these checks still apply.

- Run a grep-level source check for `/api/buildings`, `/api/units` (or their equivalents), and the building/unit product usages.
- Run a grep-level source check for the hook names `price-level-gauge`, `nearby-comparison-panel`, `jeonse-ratio-chip`, `building-card`, `unit-drilldown-panel`, and `price-trend-chart` — as `data-testid` attribute literals or runtime `dataset.testid` assignments; the bundled chart module uses the latter for canvas hooks (definitions: `references/ui-recipes.md` Detail Drawer Tabs / Price Chart Pattern / Derived Metrics).
- Run a grep-level source check for `unit-panel-placeholder`, `unit-empty-state`, and `unit-row`.
- Marker bubble rendering uses `complex_name`, `recent_month6_average_realdeal_price`, and `representative_pyeong_number` together, or documents fallback behavior when price/pyeong is null.
- The marker API wrapper must be limit-only: send top-level `bbox`, optional `filters.residential_type`, `fields`, and `limit`; do not send `offset` in marker request bodies because marker responses are center-distance truncated with `has_next`, not offset-paged. For the all-types view, one unfiltered call (1x credit; a dense type can crowd out others within the shared limit) and the bundled template's per-type parallel calls (balanced coverage at Nx credit behind the marker TTL cache) are both acceptable — pick one deliberately.
- If a bundled reference template was used, preserve module boundaries when the stack allows it (`api`, `map`, `panel`, `chart`, `format`, and `proxy` layers). If a framework requires a different file shape, prove equivalent structure with the DOM hooks above.
- If `assets/map-service/` is used, preserve its proxy boundary, module boundaries, price-level-gauge, nearby-comparison-panel, building route, and lazy unit drilldown behavior unless the target framework requires an equivalent structure.
- Only when the template's interaction logic was reimplemented or heavily modified (not a verbatim template adaptation), use jsdom or pure DOM event tests for marker click → drawer open, tab switching, and area filter behavior.
- A blocked local server, sandboxed network, or port binding failure is not a reason to skip static source checks.

## Unsupported Section Checks

- Do not create live listings, active sale inventory, broker profiles, news feeds, favorites, alerts, loan calculators, school/academy rankings, or recommendation scores unless another API/source is explicitly supplied.
- If the UI needs those areas for visual completeness, render them as disabled placeholders or omit them.
- Do not imply the Data Marketplace API provides these sections.

## Stale Flow Checks

- Do not use removed legacy product names or paths from older API versions (including the retired `dp_apt_*` 31-product generation described in old documents).
- Do not use the old product-id based call route; public calls use `/api/v1/data-products/{domain}/{product_slug}/query`.
- Do not use the complex area product (`complex_area`) as a viewport bbox shape product.
- Do not use the complex profile product (`complex_profile`) as the base bbox marker product.
- Use the estimated-prices product for current 산출시세 flows; do not describe it with removed product names.

## Do Not Overfit

- Do not copy a specific competitor service structure as a fixed requirement.
- Do not force every generated app to use every product.
- Do not treat one limited page of rows as a whole-complex aggregate.

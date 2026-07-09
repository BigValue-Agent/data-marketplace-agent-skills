---
name: data-marketplace-residential-service
description: "Use when an AI code generator needs to generate Data Marketplace residential real-estate API code or build property service flows: complex search, map markers, detail panels, price tabs, realdeal/notice-price/estimated-price lists, unit drill-down, and safe server-side Data Product API integration."
---

# Data Marketplace Residential Service

## Core Rule

Use this skill as a routing and guardrail map, not as an API manual. The exact product contract lives in the bundled per-product API docs under `references/api/`; a newer caller-provided API Reference takes precedence. Use this skill to decide which product to call first, which key to carry forward, and which code patterns to avoid.

## Runtime Inputs

For live API calls or runnable integration, read the Data Marketplace base URL from the `DATA_MARKETPLACE_BASE_URL` environment variable — the value is provided with Data Marketplace onboarding; never guess or invent a host — and first confirm the caller has provided a server-side API key.

If the server-side API key is absent from the conversation and workspace, ask once whether to configure runtime keys now or proceed with a server-side environment variable placeholder — do not solicit the key value as a form, but if the caller pastes a key in chat, write it into the server-side `.env` immediately, never repeat its value in any later output, and recommend rotating production keys because chat history retains them. When proceeding with placeholders, state clearly that live API calls and live tests will not work until `DATA_MARKETPLACE_API_KEY` is configured. If `DATA_MARKETPLACE_BASE_URL` is also absent, cover it inside that same single question instead of asking separately, and let placeholder builds fail clearly at run time until it is set.

Before building a map UI, check the conversation and workspace for map SDK and other runtime keys (for example the Kakao JavaScript key used by `assets/map-service/`). If none are present, ask once whether to provide runtime keys now or proceed with placeholders, offering exactly three map choices — Kakao Maps (template default), Naver Maps, or OpenStreetMap as a keyless alternative (present it to end users as 오픈소스 맵); do not offer other map SDKs unless the caller asks. When Kakao or Naver is chosen, guide key issuance with both paths — paste the key in chat for the agent to wire into its proper place (`.env` for the data key, map config for the map key), or edit those files directly. Do not re-ask when the answer already exists in project files. When proceeding with placeholders, finish the build and explain how to inject real keys at run time as environment variables.

Never invent real keys. `DATA_MARKETPLACE_API_KEY` is a server-side secret — never expose it to browser code. Kakao/Naver JavaScript map keys are domain-restricted public runtime keys that belong in browser map config and are protected by domain registration, not secrecy. Inject real values at run time instead of committing them.

## Choose the Entry Point

| User request | Start with | Then read |
|---|---|---|
| Search by complex name | Name search entry | `references/entrypoints.md#name-search-entry` |
| Show markers for current map | Map bbox entry | `references/entrypoints.md#map-bbox-entry` |
| Open selected complex detail | Detail panel recipe | `references/ui-recipes.md#detail-panel` |
| Build price tab | Price tab recipe | `references/ui-recipes.md#price-tabs` |
| Show building/unit drill-down | Building/unit recipe | `references/ui-recipes.md#building-unit-drilldown` |
| Validate exact product/filter/field use | API Reference plus minimal schema contract | `references/schema-contract.md` |
| Verify a generated service before completion | Verification checklist | `references/verification-checklist.md` |

## Default Flows

Name search:

1. Search candidates by complex name.
2. Let the caller select a candidate.
3. Carry `complex_key` forward as a string.
4. Load residential complex profile/detail.
5. Load price details only when the user opens a price tab.

Map:

1. Receive `min_lat`, `max_lat`, `min_lng`, `max_lng`.
2. Load residential type markers.
3. Treat marker grain as `complex_key + residential_type`.
4. On marker click, load parent detail by `complex_key`.
5. For type-specific price or unit data, pass `residential_type` too.

## Critical Rules

- Call Data Products with `POST /api/v1/data-products/{domain}/{product_slug}/query`.
- Read exact public API path, `domain`, `product_slug`, required filters, allowed fields, and response fields from the API Reference.
- Put the API key in the server-side `X-API-KEY` header.
- Do not create `Authorization: Bearer` for this API.
- Do not expose API keys to browser code.
- Generated services call the Data Marketplace API directly from their own server-side code; do not route production data flows through agent-side tools or intermediaries.
- Send filters in the JSON Body `filters` object.
- Send `fields` as a JSON string array.
- Do not use internal UUID `product_id` values in public request URLs.
- Keep `complex_key`, `pnu`, `ppk`, and `jpk` as strings.
- Do not call `Number()`, `parseInt()`, or `int()` on ID keys.
- Use `fields` only after checking the target product supports those fields.
- Use `sort` only after checking the target product supports sorting.
- Use product-specific `limit` and `offset` constraints from the API Reference.
- Send bbox as a top-level JSON Body `bbox` object with `min_lat`, `max_lat`, `min_lng`, and `max_lng`.
- Do not send bbox to products that do not support bbox.
- Keep each bbox latitude/longitude span at or below 0.1 degrees; for wider viewports, render a zoom-in guide instead of calling.
- For offset-unsupported products, `has_next=true` is not a next-page signal. For bbox marker queries it means rows were truncated around the bbox center; zoom in or shrink the bbox and re-call.
- For sort-supported products, send `sort.field` and `sort.order` together explicitly; do not rely on server default ordering, and never send an order without a field.
- Label any client-side aggregate (average, per-pyeong price, jeonse ratio, min/max summary) as computed from loaded rows only; paged product rows are not a whole-complex summary.
- Do not generate live UI sections for listings, brokers, auctions, news, favorites, alerts, loan calculators, school/academy rankings, or recommendation scores unless the caller explicitly provides another data source; render disabled placeholders or omit them.
- Read returned rows from `result.data`, not from the response object itself.
- Do not use row `id` as a stable external URL key.
- For realdeal rows, treat sale `price`, monthly rent `price`, and lease `deposit_price` carefully.
- If shape data is empty, do not invent `polygon_geojson`; fall back to representative coordinates.
- If `pyeong_type_name` (units) or `area_type` (notice-prices) is missing, show area values instead of inventing a type label.

## Reference Routing

These are on-demand lookups, not a mandatory pre-read list; open each file only when its condition applies.

- Read `references/entrypoints.md` before implementing search or map entry code.
- Read `references/product-routing.md` when selecting products for a feature; then open the matching `references/api/<product>.md` for that product's exact filters, allowed fields, and limits.
- Read `references/schema-contract.md` when checking public API paths, required filters, bbox support, or risky fields.
- Read `references/code-patterns.md` when writing API client/helper code.
- Read `references/pitfalls.md` before finalizing generated code.
- Read `references/ui-recipes.md` when composing several products into a service screen.
- Read `references/verification-checklist.md` before declaring a generated service complete.
- For a full residential map service, adapt `assets/map-service/` instead of writing the service from scratch, then verify it with `references/verification-checklist.md`.

## Final Self-Check

This is the quick summary; the full completion audit lives in `references/verification-checklist.md`. Before finalizing generated code, verify:

- Exact public API paths, filters, fields, and response fields came from the API Reference.
- Base URL comes from `DATA_MARKETPLACE_BASE_URL` (onboarding-provided) or an explicit placeholder that fails clearly at run time; API key is handled as a server-side environment variable or explicit placeholder.
- API keys stay server-side in the `X-API-KEY` header.
- Filters, fields, bbox, limit, and offset are sent in the JSON Body.
- UI rows are read from `result.data`.
- `complex_key`, `pnu`, `ppk`, and `jpk` stay strings.
- Large list calls use documented pagination when supported and do not fetch all pages on initial render.
- Map marker calls send `bbox` + `limit` only (no offset); wide-viewport and `has_next=true` paths render a zoom-in guide.
- Sort-supported list routes send explicit `sort.field` + `sort.order`.
- Charts and computed summaries from fetched rows carry a loaded-rows caption.
- Price tabs (realdeal / notice / estimated) load lazily and validate independently per product.
- No live listings/brokers/news/calculator sections are generated without an explicitly provided extra source.

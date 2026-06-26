---
name: data-marketplace-agent-skills
description: "Use when an AI code generator needs to generate Data Marketplace residential real-estate API code or build property service flows: complex search, map markers, detail panels, price tabs, realdeal/notice-price lists, unit drill-down, and safe server-side Data Product API integration."
---

# Data Marketplace Residential Service

## Core Rule

Use this skill as a routing and guardrail map, not as an API manual. The exact product contract is provided separately as the API Reference in context. Use this skill to decide which product to call first, which key to carry forward, and which code patterns to avoid.

## Runtime Inputs

For live API calls or runnable integration, first confirm the caller has provided the Data Marketplace host/base URL and a server-side API key.

If either value is missing, ask once for `DATA_MARKETPLACE_BASE_URL` and `DATA_MARKETPLACE_API_KEY`. If the caller cannot provide them, continue with server-side environment variable placeholders, but state clearly that live API calls and live tests will not work until those values are configured.

Never hardcode the API key or expose it to browser code.

## Choose the Entry Point

| User request | Start with | Then read |
|---|---|---|
| Search by complex name | Name search entry | `references/entrypoints.md#name-search-entry` |
| Show markers for current map | Map bbox entry | `references/entrypoints.md#map-bbox-entry` |
| Open selected complex detail | Detail panel recipe | `references/ui-recipes.md#detail-panel` |
| Build price tab | Price tab recipe | `references/ui-recipes.md#price-tabs` |
| Show building/unit drill-down | Building/unit recipe | `references/ui-recipes.md#building-unit-drilldown` |
| Validate exact product/filter/field use | API Reference plus minimal schema contract | `references/schema-contract.md` |

## Default Flows

Name search:

1. Search candidates by complex name.
2. Let the caller select a candidate.
3. Carry `complex_key` forward as a string.
4. Load basic or integrated detail.
5. Load price details only when the user opens a price tab.

Map:

1. Receive `min_lat`, `max_lat`, `min_lng`, `max_lng`.
2. Load residential type markers.
3. Treat marker grain as `complex_key + residential_type`.
4. On marker click, load parent detail by `complex_key`.
5. For type-specific price or unit data, pass `residential_type` too.

## Critical Rules

- Call Data Products with `POST /api/v1/data-products/{product_id}/call`.
- Read exact `product_id`, required filters, allowed fields, and response fields from the API Reference.
- Put the API key in the server-side `X-API-KEY` header.
- Do not create `Authorization: Bearer` for this API.
- Do not expose API keys to browser code.
- Send filters in the JSON Body `filters` object.
- Send `fields` as a JSON string array.
- Do not confuse `product_id` with a real-estate object ID.
- Keep `complex_key`, `pnu`, `ppk`, and `jpk` as strings.
- Do not call `Number()`, `parseInt()`, or `int()` on ID keys.
- Use `fields` only after checking the target product supports those fields.
- Use `sort` only after checking the target product supports sorting.
- Keep `limit` in the `1..100` range.
- Send bbox as a top-level JSON Body `bbox` object with `min_lat`, `max_lat`, `min_lng`, and `max_lng`.
- Do not send bbox to products that do not support bbox.
- Read returned rows from `result.data`, not from the response object itself.
- Do not use row `id` as a stable external URL key.
- For realdeal rows, treat sale `price`, monthly rent `price`, and lease `deposit_price` carefully.
- If shape data is empty, do not invent `polygon_geojson`; fall back to representative coordinates.
- If `area_type` is missing, show area values instead of inventing a type label.

## Reference Routing

- Read `references/entrypoints.md` before implementing search or map entry code.
- Read `references/product-routing.md` when selecting products for a feature or opening product-specific AI API docs.
- Read `references/schema-contract.md` when checking product IDs, required filters, bbox support, or risky fields.
- Read `references/code-patterns.md` when writing API client/helper code.
- Read `references/pitfalls.md` before finalizing generated code.
- Read `references/ui-recipes.md` when composing several products into a service screen.

## Final Self-Check

Before finalizing generated code, verify:

- Exact product IDs, filters, fields, and response fields came from the API Reference.
- Host/base URL and API key are handled as server-side environment variables or explicit placeholders.
- API keys stay server-side in the `X-API-KEY` header.
- Filters, fields, bbox, limit, and offset are sent in the JSON Body.
- UI rows are read from `result.data`.
- `complex_key`, `pnu`, `ppk`, and `jpk` stay strings.
- Large list calls use `limit`/`offset` and do not fetch all pages on initial render.

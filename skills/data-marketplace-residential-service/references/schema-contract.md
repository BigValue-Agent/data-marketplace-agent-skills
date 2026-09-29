# Schema Contract

This is a minimal code-generation contract, not the API spec. Use the live product Markdown selected from `https://datamarket.bigvalue.ai/llms.txt` for exact public API paths, `domain`, `product_slug`, required filters, allowed fields, response fields, and sample requests.

## Product Fact Boundary

Keep these details out of the skill and read them from the API Reference:

- Exact public API path, `domain`, and `product_slug` values.
- Complete required-filter groups for each product.
- Complete `allowed_fields` and response schemas.
- Product-specific sample requests and sample responses.

The skill should say which role to use and which key to carry forward. The API Reference should say the exact public URL path and accepted JSON Body.

## Common Parameter Rules

- `limit` must follow the target product's documented range.
- `offset` must follow the target product's documented support. Name search, map markers, and complex boundaries have no `offset` at all — do not send it, and do not read one back. For those products `has_next=true` means the result was truncated, so narrow the search text or the bbox instead of paging.
- `fields` must be a string array and each value must exist in the product's allowed fields.
- Search filters belong in the JSON Body `filters` object.
- bbox belongs in the top-level JSON Body `bbox` object.
- Marker bbox latitude/longitude spans are capped at 0.1 degrees per axis; wider spans are a request error, not an empty result. Legal-dong bbox queries have no such span cap; follow each product's contract.
- bbox marker responses return rows nearest the bbox center first and truncate outward when the limit is hit.
- All Data Product responses are wrapped; returned rows are in `data`.
- The wrapper carries `success`, `data`, `row_count`, `limit`, `has_next`, and — only on offset-capable products — `offset`. There is no total-count field. On offset-capable products, page by resending with `offset + row_count` while `has_next` is `true`.
- Never render a total like "N건" from a single response. Only `row_count` is known; when `has_next` is `true` label it as "N건 이상" or hide the count.

## Stable Key Rules

- Carry `complex_key`, `pnu`, `ppk`, and `jpk` as strings.
- Do not call `Number()`, `parseInt()`, or `int()` on ID keys.
- Do not use row `id` as a stable external URL key.
- Map marker grain is one row per `complex_key`; `residential_type` is representative and is not a complete included-type list.
- `ppk` is building-level; `jpk` is unit-level.

## Known Data Shape Rules

- Notice prices use `notice_year` (YYYY), while estimates use `estimated_standard_ym` (YYYYMM). Display the returned period without inventing a month; a single snapshot is not a trend or change rate.
- Validate `polygon_geojson` as `Polygon` or `MultiPolygon`, including closed rings, finite `[lng, lat]` numbers, and coordinate ranges. If it is absent, a `GeometryCollection`, or otherwise unsupported, omit the boundary only and keep the raw row, marker, and detail panel usable.
- Preserve raw pyeong, unit-area, and floor values, but use them in selectors, labels, filters, or derived metrics only when they pass the shared template display policy. Show `확인 필요` instead of presenting an ineligible value as normal.
- `pyeong_number` and `pyeong_type_name` belong to unit rows. Notice-price rows do not carry area fields, and estimated-price rows expose raw `private_area` plus `private_pyeong_area`; use `jpk` to join a selected price row to its unit when a supply pyeong label is needed.
- Marker `display_name` can be null after the complex-name, road-address, and land-number-address fallbacks are exhausted.
- Complex aggregate-title purpose and area fields are populated only when exactly one aggregate-title source row is linked. `representative_title_structure_name` is currently unavailable, and the legacy `sum_title_*` field names do not mean a sum across buildings.
- Building `residential_type` can be null when the source type cannot be determined.
- For realdeal rows, sale `price`, monthly rent `price`, and lease `deposit_price` have different meanings.

## Do Not Include Here

- Full response schemas.
- Full sample requests/responses.
- Long `allowed_fields` lists.
- Internal DB connection or source configuration.

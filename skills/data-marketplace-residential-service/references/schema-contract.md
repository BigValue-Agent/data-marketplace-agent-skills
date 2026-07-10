# Schema Contract

This is a minimal code-generation contract, not the API spec. Use the provided API Reference for exact public API paths, `domain`, `product_slug`, required filters, allowed fields, response fields, and sample requests.

## Product Fact Boundary

Keep these details out of the skill and read them from the API Reference:

- Exact public API path, `domain`, and `product_slug` values.
- Complete required-filter groups for each product.
- Complete `allowed_fields` and response schemas.
- Product-specific sample requests and sample responses.

The skill should say which role to use and which key to carry forward. The API Reference should say the exact public URL path and accepted JSON Body.

## Common Parameter Rules

- `limit` must follow the target product's documented range.
- `offset` must follow the target product's documented support. Some products only allow `0`; for those, `has_next=true` is not a next-page signal.
- `fields` must be a string array and each value must exist in the product's allowed fields.
- Search filters belong in the JSON Body `filters` object.
- bbox belongs in the top-level JSON Body `bbox` object.
- bbox latitude/longitude spans are capped at 0.1 degrees per axis on bbox-supported products; wider spans are a request error, not an empty result.
- bbox marker responses return rows nearest the bbox center first and truncate outward when the limit is hit.
- All Data Product responses are wrapped; returned rows are in `data`.
- The wrapper also carries `row_count`, `total_available` (may be null), `limit`, `offset`, and `has_next`. Use `total_available` for "N건" headers and page math; when it is null, fall back to `has_next`-only pagination.

## Stable Key Rules

- Carry `complex_key`, `pnu`, `ppk`, and `jpk` as strings.
- Do not call `Number()`, `parseInt()`, or `int()` on ID keys.
- Do not use row `id` as a stable external URL key.
- Map marker grain is `complex_key + residential_type`, not only `complex_key`.
- `ppk` is building-level; `jpk` is unit-level.

## Known Data Shape Rules

- `polygon_geojson` may be absent; use representative coordinates as fallback.
- `pyeong_type_name` (units) or `area_type` (notice-prices) may be missing; show available area values instead of inventing a type label.
- For realdeal rows, sale `price`, monthly rent `price`, and lease `deposit_price` have different meanings.

## Do Not Include Here

- Full response schemas.
- Full sample requests/responses.
- Long `allowed_fields` lists.
- Internal DB connection or source configuration.

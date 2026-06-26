# Schema Contract

This is a minimal code-generation contract, not the API spec. Use the provided API Reference for exact product IDs, required filters, allowed fields, response fields, and sample requests.

## Product Fact Boundary

Keep these details out of the skill and read them from the API Reference:

- Exact `product_id` values.
- Complete required-filter groups for each product.
- Complete `allowed_fields` and response schemas.
- Product-specific sample requests and sample responses.

The skill should say which role to use and which key to carry forward. The API Reference should say the exact URL path variable and accepted JSON Body.

## Common Parameter Rules

- `limit` must be in the `1..100` range.
- `offset` must be in the `0..2000` range.
- `fields` must be a string array and each value must exist in the product's allowed fields.
- Search filters belong in the JSON Body `filters` object.
- bbox belongs in the top-level JSON Body `bbox` object.
- All Data Product responses are wrapped; returned rows are in `data`.

## Stable Key Rules

- Carry `complex_key`, `pnu`, `ppk`, and `jpk` as strings.
- Do not call `Number()`, `parseInt()`, or `int()` on ID keys.
- Do not use row `id` as a stable external URL key.
- Map marker grain is `complex_key + residential_type`, not only `complex_key`.
- `ppk` is building-level; `jpk` is unit-level.

## Known Data Shape Rules

- `polygon_geojson` may be absent; use representative coordinates as fallback.
- `area_type` may be missing; show available area values instead of inventing a type label.
- For realdeal rows, sale `price`, monthly rent `price`, and lease `deposit_price` have different meanings.

## Do Not Include Here

- Full response schemas.
- Full sample requests/responses.
- Long `allowed_fields` lists.
- Internal DB connection or source configuration.

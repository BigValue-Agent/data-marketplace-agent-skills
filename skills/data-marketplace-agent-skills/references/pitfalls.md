# Pitfalls

| Mistake | Why it fails | Preferred behavior |
|---|---|---|
| Calling price detail directly from a name | Name is not the stable join key | Search first, then carry `complex_key` |
| Treating `product_id` as complex ID | Product ID selects the API product | Keep object keys separate from product IDs |
| `Number(complex_key)` or `parseInt(pnu)` | IDs may contain leading zeros or string semantics | Preserve IDs as strings |
| `Authorization: Bearer` | Data Marketplace uses `X-API-KEY` | Use server-side `X-API-KEY` |
| Sending filters as URL query params | Current call structure expects JSON Body | Put filters under `body.filters` |
| Flattening bbox into URL params | Bbox is a top-level JSON Body object | Send `body.bbox` with all four bbox values |
| Using bbox on every product | Only some products support bbox | Check schema contract or API Reference |
| Treating `response.json()` as rows | Responses are wrapped | Read rows from `result.data` |
| Using realdeal as base map coverage | Realdeal is transaction data, not complete marker coverage | Use residential type markers |
| Assuming `polygon_geojson` always exists | Some complexes have no shape row | Use representative coordinate fallback |
| Assuming `area_type` always exists | Some residential types lack it | Display numeric area fields safely |
| Treating row `id` as stable URL key | It may be a surrogate row number | Use `complex_key`, `pnu`, `ppk`, or `jpk` as appropriate |
| Reading lease value from `price` | Lease rows may use `deposit_price` | Branch by transaction type |
| Requesting `limit=101` or higher | Product call limit is capped | Keep `limit` in the `1..100` range |
| Fetching all list rows on initial render | Large residential lists can be slow and credit-heavy | Load the first page with `limit`/`offset`, then continue with `has_next` |

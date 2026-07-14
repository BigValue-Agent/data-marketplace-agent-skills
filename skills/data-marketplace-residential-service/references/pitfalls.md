# Pitfalls

Rows are grouped by theme: paths/keys → bbox/markers → sort/pagination → price semantics/data shape → validation.

| Mistake | Why it fails | Preferred behavior |
|---|---|---|
| Calling price detail directly from a name | Name is not the stable join key | Search first, then carry `complex_key` |
| Calling the old UUID `product_id` URL | Public calls use `domain` and `product_slug`, not internal UUID IDs | Use `/api/v1/data-products/{domain}/{product_slug}/query` from the API Reference |
| Treating `api_slug` as a complex ID | API slug selects the API product path | Keep object keys (`complex_key`, `pnu`, `ppk`, `jpk`) separate from API path metadata |
| `Number(complex_key)` or `parseInt(pnu)` | IDs may contain leading zeros or string semantics | Preserve IDs as strings |
| Treating row `id` as stable URL key | It may be a surrogate row number | Use `complex_key`, `pnu`, `ppk`, or `jpk` as appropriate |
| `Authorization: Bearer` | Data Marketplace uses `X-API-KEY` | Use server-side `X-API-KEY` |
| Sending filters as URL query params | Current query structure expects JSON Body | Put filters under `body.filters` |
| Treating `response.json()` as rows | Responses are wrapped | Read rows from `result.data` |
| Flattening bbox into URL params | Bbox is a top-level JSON Body object | Send `body.bbox` with all four bbox values |
| Using bbox on every product | Only some products support bbox | Check schema contract or API Reference |
| Sending a bbox wider than 0.1 degrees per axis | The API caps bbox spans at 0.1 degrees per axis | Validate the span first and render a zoom-in guide for wide viewports |
| Using realdeal as base map coverage | Realdeal is transaction data, not complete marker coverage | Use residential type markers |
| Paging markers with offset when `has_next` is true | `complex-type-markers` does not support offset; dense viewports truncate outward from the bbox center | Zoom in or shrink the map area, then re-call markers |
| Treating marker price bubble labels as guaranteed | `recent_month6_average_realdeal_price` and similar fields can be sparse | Provide fallback label text (name, household count) when price fields are null |
| Sending only `sort.order` | Sort needs both field and order to be deterministic | Send `sort.field` and `sort.order` together (flattened route/tool inputs use `sort_field`/`sort_order`) |
| Relying on server default ordering for list tabs | Generated routes should be explicit and stable | Send the documented sort explicitly (e.g., `contract_date desc` for realdeal) |
| Assuming every product uses the same `limit`/`offset` range | Pagination support and caps differ by product | Read the product-specific pagination rule from the API Reference |
| Fetching all list rows on initial render | Large residential lists can be slow and request-heavy | Load the first page with documented pagination, then continue only when the UI asks for more |
| Building area options from one `unit_details` page | Large complexes return only the first page, often sorted by area | Paginate, or derive area options from the product that matches the UI purpose |
| Reading lease value from `price` | Lease rows may use `deposit_price` | Branch by transaction type |
| Converting `price_min`/`price_max` or `deposit_min`/`deposit_max` to 만원 | Filters compare directly against KRW price columns | Send filter values in KRW, the same unit as response price fields |
| Inventing `date_from`/`date_to` when the user did not specify a period | Fabricated date windows silently exclude real transactions | Omit date filters unless the user provides a period; use the documented sort for "latest rows" requests |
| Treating loaded rows as a whole-complex summary | `realdeal`, `notice-prices`, and `estimated-prices` return paged rows | Label aggregates as loaded-row summaries; no summary product exists |
| Treating `estimated-prices` as a complex-level summary | It returns unit-level detail rows | Aggregate explicitly client-side or show row-level values |
| Widening a selected pyeong silently | The value and label describe different populations | Keep `해당 평형 자료 없음`, or relabel an explicitly widened scope as `단지 전체 기준` |
| Treating one snapshot as a trend | No time comparison exists | Display the returned standard year-month as current evidence |
| Turning raw distance into walking time | No route, entrance, or crossing data exists | Display distance only |
| Trusting every numeric/GeoJSON value | Extreme values distort UI and unsupported shapes can throw | Apply the shared display policy, show `확인 필요`, and keep non-boundary UI usable |
| Assuming `polygon_geojson` always exists | Some complexes have no shape row | Use representative coordinate fallback |
| Assuming `pyeong_type_name` (units) / `area_type` (notice-prices) always exists | Some rows lack the type label | Display numeric area fields safely |
| Reusing one validation rule across price tabs | Realdeal, notice, and estimated-price products accept different required keys and filters | Split validation per product/tab |

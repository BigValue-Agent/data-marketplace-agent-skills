# Entrypoints

This file describes call order. It does not replace the provided API Reference.

## Name Search Entry

Use this when the user has a region name, complex name, partial name, or search box input.

Flow:

1. Call the name search product with `query_text` and optional `result_scope`.
2. Return candidates grouped by `result_type`, using `title` and `subtitle` for display.
3. Do not offset-page: `all` returns at most five regions followed by at most fifteen complexes.
4. For a region, fit its bbox and show its center pin without complex markers; load the legal-dong boundary only when `polygon_available=true`, then load viewport markers after the user zooms in.
5. For a complex, carry `result_key` forward as the string `complex_key` and load the residential complex profile.
6. Treat the profile as one row per `complex_key`; `residential_type` is representative. The current public products do not expose a complete included-type list.
7. Use profile `recent_month6_*` only as a whole-complex summary; in a type-filtered view, show it only when the selected type matches representative `residential_type`.
8. Load the complex-scope realdeal list independently of buildings; select an actual private area from loaded transactions before drawing a price trend.
9. Load notice and estimated prices only after a unit supplies `ppk + jpk`.

Decision notes:

- Region or land-lot address tokens may narrow same-name complexes only when the query also contains an actual complex-name token; address-only search is unsupported.
- Do not jump directly from a name string to realdeal or unit-price detail.
- If multiple candidates share a similar name, preserve `subtitle` so the UI can disambiguate.
- Do not treat a region `result_key` as `complex_key`, or invent a boundary when `polygon_available=false`.
- Do not silently pick the first candidate when the name is ambiguous; show region/address labels and let the user confirm.
- Do not invent bridge keys; carry only identifiers returned by the current API docs.

## Map Bbox Entry

Use this when the user asks for a map, viewport markers, or current-screen residential marker loading.

Flow:

1. Validate all four bbox values.
2. If the viewport span exceeds 0.1 degrees on either axis, render a zoom-in guide state instead of calling.
3. Call the residential type marker product.
4. Request only marker/list fields needed for display.
5. Send `bbox` + `limit` only; do not expose offset for markers. When `has_next` is true, rows were truncated around the bbox center — zoom in or shrink the bbox and re-call.
6. Treat each marker row as one `complex_key`; `residential_type` is the representative type.
7. On marker click, load parent detail by `complex_key`.
8. For type-specific tabs, pass the clicked `residential_type`.

Decision notes:

- Do not use a realdeal product as the default map marker source.
- Send bbox as a top-level JSON Body object only to products that support bbox.
- Dense bbox responses should be clustered or answered with a zoom-in guide; offset paging is not available for markers.

## Fallbacks

- If polygon/shape rows are empty, use representative coordinates.
- Keep an empty selected-private-area result empty; do not replace it with another area or mixed-area rows.
- If a price call returns no rows, distinguish a valid empty result from a request failure.
- If a mixed complex has multiple residential types, keep type tabs explicit.

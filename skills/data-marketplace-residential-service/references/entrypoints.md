# Entrypoints

This file describes call order. It does not replace the provided API Reference.

## Name Search Entry

Use this when the user has a complex name, partial complex name, or search box input.

Flow:

1. Call the name search product with the user's text.
2. Return candidates, not just the first row.
3. Preserve returned order: candidates are relevance-first by internal `match_score DESC`, then `complex_name` and `complex_key`; `match_score` is not exposed.
4. After selection, carry `complex_key` forward as a string.
5. Load the residential complex profile by `complex_key`.
6. Use matching-type profile `recent_month6_*` fields for the default whole-complex summary.
7. Load buildings to establish the pyeong/private-area scope, then load realdeal for the selected scope.
8. Load notice and estimated prices only after a unit supplies `ppk + jpk`.

Decision notes:

- Do not jump directly from a name string to realdeal or unit-price detail.
- If multiple candidates share a similar name, preserve region/address labels so the UI can disambiguate.
- Do not client-sort candidates by name, distance, or residential type before user selection; the server order is the relevance ranking.
- Do not silently pick the first candidate when the name is ambiguous; show region/address labels and let the user confirm.
- Do not invent bridge keys; carry only identifiers returned by the current API docs.

## Map Bbox Entry

Use this when the user asks for a map, viewport markers, or Zigbang-like current-screen loading.

Flow:

1. Validate all four bbox values.
2. If the viewport span exceeds 0.1 degrees on either axis, render a zoom-in guide state instead of calling.
3. Call the residential type marker product.
4. Request only marker/list fields needed for display.
5. Send `bbox` + `limit` only; do not expose offset for markers. When `has_next` is true, rows were truncated around the bbox center — zoom in or shrink the bbox and re-call.
6. Treat each marker row as `complex_key + residential_type`.
7. On marker click, load parent detail by `complex_key`.
8. For type-specific tabs, pass the clicked `residential_type`.

Decision notes:

- Do not use a realdeal product as the default map marker source.
- Send bbox as a top-level JSON Body object only to products that support bbox.
- Dense bbox responses should be clustered or answered with a zoom-in guide; offset paging is not available for markers.

## Fallbacks

- If polygon/shape rows are empty, use representative coordinates.
- If pyeong rows exist but the selected pyeong has no observed private area, show the realdeal scope as unavailable; do not widen it automatically.
- Only when a complex has no pyeong information may realdeal use a whole-complex scope.
- If a price call returns no rows, distinguish a valid empty result from a request failure.
- If a mixed complex has multiple residential types, keep type tabs explicit.

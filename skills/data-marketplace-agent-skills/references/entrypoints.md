# Entrypoints

This file describes call order. It does not replace the provided API Reference.

## Name Search Entry

Use this when the user has a complex name, partial complex name, or search box input.

Flow:

1. Call the name search product with the user's text.
2. Return candidates, not just the first row.
3. After selection, carry `complex_key` forward as a string.
4. Load basic or integrated detail by `complex_key`.
5. Load realdeal, notice-price, or sise detail only when the user opens that price tab.

Decision notes:

- Do not jump directly from a name string to realdeal or notice-price detail.
- If multiple candidates share a similar name, preserve region/address labels so the UI can disambiguate.
- Keep `representative_pnu` and `representative_ppk` as optional bridge keys, not as replacements for `complex_key`.

## Map Bbox Entry

Use this when the user asks for a map, viewport markers, or Zigbang-like current-screen loading.

Flow:

1. Validate all four bbox values.
2. Call the residential type marker product.
3. Request only marker/list fields needed for display.
4. Preserve `limit` and `offset`.
5. Treat each marker row as `complex_key + residential_type`.
6. On marker click, load parent detail by `complex_key`.
7. For type-specific tabs, pass the clicked `residential_type`.

Decision notes:

- Do not use a realdeal product as the default map marker source.
- Send bbox as a top-level JSON Body object only to products that support bbox.
- Dense bbox responses should be paginated or clustered by the service layer.

## Fallbacks

- If polygon/shape rows are empty, use representative coordinates.
- If a price detail call returns no rows, show an empty or disabled tab state.
- If a mixed complex has multiple residential types, keep type tabs explicit.

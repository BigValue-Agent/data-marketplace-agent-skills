# UI Recipes

Use these recipes to compose product calls into residential service screens.

## Search Box

1. Debounce text input.
2. Call name search.
3. Show candidate name, address/region, and type labels.
4. On selection, store `complex_key` as a string.
5. Load detail drawer data.

## Map Viewport

1. Read viewport bbox.
2. Validate all four bbox values.
3. Load type markers with pagination.
4. Render one marker row per `complex_key + residential_type`.
5. On click, load parent detail and keep the selected `residential_type` for price or unit tabs.

## Detail Panel

1. Use integrated complex info as the quick bundle for opening the drawer and connecting tabs.
2. For a user-facing rich profile, load basic info too; use it for construction/developer, approval date, scale, parking, heating, and nearby school/subway/park/hospital context.
3. Load price detail products only when a price tab is opened.
4. Add shape layer only if map boundary is visible.
5. If shape is missing, keep the panel usable with representative coordinates.

## Price Tabs

1. Call realdeal, notice-price, or sise detail only after the user opens that tab.
2. Include `residential_type` when the user selected a type marker.
3. Show an empty state if the selected price detail product returns no rows.
4. Render sale, lease, and monthly-rent values with transaction-type-aware labels.
5. For realdeal or notice-price lists, load the first page when the tab opens and request more pages only on scroll, "more", or explicit pagination.

## Building Unit Drilldown

1. Load building markers for the complex.
2. Carry `ppk` as a string when the user selects a building.
3. Load integrated dong info for building detail.
4. Load unit detail when the user drills into dong/ho or area.
5. Use `jpk` for unit-level follow-up when available.
6. For unit detail lists, page by `limit` and `offset`; do not load every unit when the drawer first opens.

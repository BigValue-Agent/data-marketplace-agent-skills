# Product Routing

Use this as a decision table for product selection and combination. Exact filters, allowed fields, and limits live in the bundled per-product docs under `references/api/`; if the caller provides a newer API Reference, it takes precedence over the bundled snapshot. Never invent fields beyond each doc's Allowed Fields. Actual API calls use the runtime base URL (`DATA_MARKETPLACE_BASE_URL`).

| Service feature | Product role | Use when | Carry forward | Contract reference |
|---|---|---|---|---|
| Name search | Complex name search | User starts from a name or search box | `complex_key` | references/api/complex-search.md |
| Complex profile/detail | Residential complex profile | Need address, coordinates, scale, profile fields, land summary, or title-part summary | `complex_key`, `pnu` | references/api/residential-complexes.md |
| Map markers | Residential type marker | Need current viewport markers | `complex_key`, `residential_type` | references/api/residential-complex-type-markers.md |
| Shape layer | Residential complex area | Need polygon or boundary display | representative coordinates fallback | references/api/residential-complex-shapes.md |
| Building/dong summary | Residential building/dong summary | Need internal building/dong markers or building-level summaries | `ppk`, `complex_key` | references/api/residential-buildings.md |
| Unit detail | Residential unit detail | Need dong/ho/area drill-down | `jpk`, `ppk`, `residential_type` | references/api/residential-units.md |
| Notice price | Residential notice price | Price tab or unit-level notice price | `complex_key` for complex-level tabs; `ppk`/`jpk` after building or unit selection; optional year/month filters | references/api/residential-notice-prices.md |
| Realdeal | Residential realdeal history | Price tab confirms transaction data | transaction filters | references/api/residential-realdeal.md |
| Estimated price | Residential estimated price detail | Price tab or unit-level estimated price detail | `complex_key` for complex-level lists; `ppk`/`jpk` after building or unit selection; optional ym/price filters | references/api/residential-estimated-prices.md |

## Selection Rules

- Use residential complex profile as the main source for detail header/profile sections.
- Use separate marker, shape, building/unit, and price products only when those screen areas are needed.
- Prefer type markers for map viewport loading; do not use realdeal as complete marker coverage.
- Prefer explicit user selection when name search returns multiple candidates.
- For name search, preserve returned order because candidates are relevance-first by internal `match_score DESC`, then `complex_name` and `complex_key`; `match_score` is not exposed.
- Read exact `api_domain` and `api_slug` from the bundled API docs (or a newer caller-provided API Reference); never bind product role names, API path metadata, or internal product IDs to a complex URL param.

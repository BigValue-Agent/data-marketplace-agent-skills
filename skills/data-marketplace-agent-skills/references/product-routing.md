# Product Routing

Use this as a decision table. Open the linked AI API doc for exact product IDs, parameters, response fields, and examples.

| Service feature | Product role | Use when | Carry forward | AI API doc |
|---|---|---|---|---|
| Name search | Complex name search | User starts from a name or search box | `complex_key` | http://bv.bigvalue.co.kr:3308/reference/ai/complex-search.md |
| Detail header | Residential complex basic info | Need address, coordinates, scale, or rich profile fields | `complex_key`, representative keys | http://bv.bigvalue.co.kr:3308/reference/ai/residential-complex-basic.md |
| Map markers | Residential type marker | Need current viewport markers | `complex_key`, `residential_type` | http://bv.bigvalue.co.kr:3308/reference/ai/residential-type-marker.md |
| Shape layer | Residential complex area | Need polygon or boundary display | representative coordinates fallback | http://bv.bigvalue.co.kr:3308/reference/ai/residential-complex-shape.md |
| Building markers | Residential building marker | Need internal building/dong markers | `ppk`, `complex_key` | http://bv.bigvalue.co.kr:3308/reference/ai/residential-building-marker.md |
| Unit detail | Residential unit detail | Need dong/ho/area drill-down | `jpk`, `ppk`, `residential_type` | http://bv.bigvalue.co.kr:3308/reference/ai/residential-unit-detail.md |
| Fast detail | Residential integrated complex info | Need quick detail drawer bundle | tab-specific follow-up keys | http://bv.bigvalue.co.kr:3308/reference/ai/residential-complex-integrated.md |
| Building detail | Residential integrated dong info | Need building-level detail | `ppk` | http://bv.bigvalue.co.kr:3308/reference/ai/residential-building-integrated.md |
| Notice price | Notice price integrated | Price tab or unit-level notice price | `complex_key` for complex-level tabs; `ppk`/`jpk` after building or unit selection; optional year/month filters | http://bv.bigvalue.co.kr:3308/reference/ai/residential-notice-price.md |
| Realdeal | Realdeal integrated | Price tab confirms transaction data | transaction filters | http://bv.bigvalue.co.kr:3308/reference/ai/residential-realdeal.md |
| Sise detail | Residential sise detail | Price tab or unit-level market price detail | `complex_key` for complex-level lists; `ppk`/`jpk` after building or unit selection; optional ym/price filters | http://bv.bigvalue.co.kr:3308/reference/ai/residential-sise-detail.md |

## Selection Rules

- For a user-facing detail panel, pair integrated complex info with basic info when profile fields are needed.
- Use integrated complex info alone only for a quick preview or minimal drawer.
- Prefer type markers for map viewport loading; do not use realdeal as complete marker coverage.
- Prefer explicit user selection when name search returns multiple candidates.
- Read exact product IDs from the linked AI API docs; never bind product role names or product IDs to a complex URL param.

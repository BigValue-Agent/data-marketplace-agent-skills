# Product Routing

Use this as a decision table for product selection and combination. Start with `https://datamarket.bigvalue.ai/llms.txt`, then open the linked live document for each selected product to confirm exact filters, allowed fields, and limits. Never invent fields beyond those documents. Actual API calls use `https://datamarket-api.bigvalue.ai` by default.

| Service feature | Product role | Use when | Carry forward | Contract reference |
|---|---|---|---|---|
| Name search | Complex name search | User starts from a name or search box | `complex_key` | [complex-search.md](https://datamarket.bigvalue.ai/reference/ai/complex-search.md) |
| Complex profile/detail | Residential complex profile | Need address, coordinates, scale, profile fields, land summary, or title-part summary | `complex_key`, `pnu` | [residential-complexes.md](https://datamarket.bigvalue.ai/reference/ai/residential-complexes.md) |
| Map markers | Residential type marker | Need current viewport markers | `complex_key`, `residential_type` | [residential-complex-type-markers.md](https://datamarket.bigvalue.ai/reference/ai/residential-complex-type-markers.md) |
| Shape layer | Residential complex area | Need polygon or boundary display | representative coordinates fallback | [residential-complex-shapes.md](https://datamarket.bigvalue.ai/reference/ai/residential-complex-shapes.md) |
| Building/dong summary | Residential building/dong summary | Need internal building/dong markers or building-level summaries | `ppk`, `complex_key` | [residential-buildings.md](https://datamarket.bigvalue.ai/reference/ai/residential-buildings.md) |
| Unit detail | Residential unit detail | Need dong/ho/area drill-down | `jpk`, `ppk`, `residential_type` | [residential-units.md](https://datamarket.bigvalue.ai/reference/ai/residential-units.md) |
| Notice price | Residential notice price | Need the selected unit's official price | `ppk`, `jpk`; latest row first | [residential-notice-prices.md](https://datamarket.bigvalue.ai/reference/ai/residential-notice-prices.md) |
| Realdeal | Residential realdeal history | Need transactions for the selected private-area/deal/period scope | `complex_key`, `residential_type`, private-area range, deal type, period | [residential-realdeal.md](https://datamarket.bigvalue.ai/reference/ai/residential-realdeal.md) |
| Estimated price | Residential estimated price detail | Need the selected unit's BigValue estimate | `ppk`, `jpk`; latest row first | [residential-estimated-prices.md](https://datamarket.bigvalue.ai/reference/ai/residential-estimated-prices.md) |

## Selection Rules

- Use residential complex profile as the main source for detail header/profile sections.
- Use matching-type profile `recent_month6_*` fields for the default whole-complex price summary; do not recreate it from paged rows.
- Use separate marker, shape, building/unit, and price products only when those screen areas are needed.
- For generated services, keep notice and estimated prices at unit scope. Their broader API filters remain contract capabilities, not the default screen aggregation strategy.
- Prefer type markers for map viewport loading; do not use realdeal as complete marker coverage.
- Prefer explicit user selection when name search returns multiple candidates.
- For name search, preserve returned order because candidates come back name-relevance first, then alphabetical by name. Never auto-select the first row as the answer.
- Read exact `api_domain` and `api_slug` from the live product document linked by `llms.txt`; never bind product role names, API path metadata, or internal product IDs to a complex URL param.

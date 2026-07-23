# Query Recipes — Region Apartment Ranking

This is an **analysis skill**: it fetches data by calling the plugin's **MCP live tools** (the plugin
authenticates them). You never read a key/host and never build REST requests. Each tool takes **flat
arguments** (no `filters` wrapper, no `sort` object), returns `{product, response}`, and the **rows are
in `response.data`** (`response.has_next` signals more rows). Keep every id a string.

Common flat args: the filter keys per call, plus `fields` (array), `limit`, `offset`, `sort_field`,
`sort_order` (`asc`/`desc`). Tools: `region_summaries`, `complexes_by_region`.

## Call 1 — region_summaries (resolve the region, get counts)

Pick the filter by what the user named:

- A 시/구 (e.g. "강남구", "성남시 분당구") → `sigungu_name`.
- A 동 (e.g. "역삼동") → `eupmyeondong_name`. A full 법정동명 (e.g. "서울특별시 강남구 역삼동") → `full_name`.

`region_summaries({ sigungu_name: "<구/시>", fields: ["legaldong_code","full_name","sido_name","sigungu_name","eupmyeondong_name","apartment_complex_count","officetel_complex_count","row_house_complex_count"], limit: 100 })`

- Returns one row per 법정동 in that area, each with `legaldong_code` and the per-type counts.
- **Zero rows** → the name did not match; stop and ask for a different place name.
- **Rows spanning more than one `sigungu_name`** (a 동 name shared across 구) → ask the user once which one,
  listing `full_name`.

## Fix the scope (between Call 1 and Call 2)

- **시군구 request** (whole 구): take any returned `legaldong_code`, keep its **first 5 digits** as
  `legaldong_code_prefix` (5-digit = 시군구). `region.scopeLabel` = the 구 name; `region.name` =
  `sido_name + " " + sigungu_name`. `region.counts.apartment` = **sum** of `apartment_complex_count`
  across all returned 동 rows (same for officetel/rowhouse).
- **single-동 request**: use that row's 10-digit `legaldong_code` directly. `region.name`/`scopeLabel` =
  its `full_name`; `region.counts.*` = that single row's counts.

Keep the leading zeros — `legaldong_code` is a string; never `Number()` it.

## Pick the metric (map user intent → sort)

| User asks for | `metric.key` | `metric.label` | `sort_field` | `sort_order` | `metric.unit` |
|---|---|---|---|---|---|
| 제일 비싼 / 대장 아파트 / 시세 높은 (default) | `price` | 최근 실거래가 | `recent_month6_average_realdeal_price` | `desc` | KRW |
| 세대수 많은 / 대단지 | `household` | 세대수 | `complex_household_count` | `desc` | 세대 |
| 신축 / 새 아파트 | `age_new` | 신축(연식) | `complex_age_number` | `asc` | 년 |
| 오래된 / 구축 | `age_old` | 연식(오래된) | `complex_age_number` | `desc` | 년 |
| 역세권 / 지하철 가까운 | `subway` | 역세권 거리 | `nearby_subway_station_distance` | `asc` | m |

Default when the user just says "순위/랭킹/top": `price` (최근 실거래가, 비싼 순).

## Call 2 — complexes_by_region (the ranked list)

`complexes_by_region({ <legaldong_code_prefix|legaldong_code>: "<code>", residential_type: "아파트", sort_field: "<from the map>", sort_order: "<from the map>", fields: ["complex_key","complex_name","residential_type","legaldong_code","road_name_address","complex_household_count","complex_age_number","use_approval_date","nearby_subway_station_name","nearby_subway_station_distance","recent_month6_realdeal_count","recent_month6_average_realdeal_price"], limit: 20, offset: 0 })`

- Use `legaldong_code_prefix` for a 구, `legaldong_code` for a single 동 (one of the two, not both).
- The API returns rows **already sorted** by your `sort_field`/`sort_order` (NULLS LAST). Do not re-sort;
  assign `rank` = 1..N in returned order.
- `response.has_next === true` → set `hasMore: true` (more complexes exist beyond the shown page).
- `shown` = number of ranking rows you include; `total` = `region.counts.apartment`.
- A row whose metric value is null (e.g. `recent_month6_average_realdeal_price` null) stays in the list at
  its NULLS-LAST position; keep the null in `dm-data` (the template labels it), never coerce it to 0.

## dm-data mapping

Fill exactly this shape (raw values; no formatting; keys are strings):

```json
{
  "sample": false,
  "queriedAt": "YYYY-MM-DD",
  "region": {
    "name": "서울특별시 강남구",
    "scopeLabel": "강남구 전체",
    "type": "아파트",
    "counts": { "apartment": 0, "officetel": 0, "rowhouse": 0 }
  },
  "metric": { "key": "price", "label": "최근 실거래가", "order": "desc", "unit": "KRW" },
  "total": 0,
  "shown": 0,
  "hasMore": false,
  "ranking": [
    {
      "rank": 1,
      "name": "",
      "type": "아파트",
      "address": "",
      "household": 0,
      "age": 0,
      "useApprovalYm": "YYYYMM",
      "subwayName": "",
      "subwayDistance": 0,
      "recentAvgPrice": 0,
      "recentCount": 0
    }
  ]
}
```

- `ranking` is in the API's returned order (already sorted); `rank` counts from 1.
- Every nullable metric field (`recentAvgPrice`, `age`, `subwayDistance`, `subwayName`, `useApprovalYm`) uses
  `null` when the row has no value — never 0 or "".
- `metric.key` must be one of `price | household | age_new | age_old | subway`; the template highlights the
  matching field as the headline metric per row.
- Do not compute the headline sentence or the "N개 중 상위 K" text — the template derives them from
  `region`, `metric`, `total`, `shown`, `hasMore`.
- Do not add fields; do not omit `sample`/`queriedAt`.

## Sanity checks before saving the HTML

- `ranking` order matches `metric.order` for the non-null rows (ascending metrics increase down the list,
  descending metrics decrease); null-metric rows are last.
- `shown` === `ranking.length` and `shown` ≤ `total`.
- `household` is an integer count; `subwayDistance` is meters (hundreds–thousands, not km); `recentAvgPrice`
  is a whole-complex KRW average (억 range for cities), not a per-pyeong number.
- `region.counts.apartment` ≥ `shown`.

# Query Recipes — Apartment Price Check

This is an **analysis skill**: it fetches data by calling the plugin's **MCP live tools**, and the
plugin supplies authentication. You never read an API key or host, and you never build REST requests —
the MCP tools are the interface, and they already enforce the route/filter contract (§0 of the
API-grounding guide). Your job is to pass the right arguments and treat the responses per the honesty rules.

Each tool takes **flat arguments** (no `filters` wrapper, no `sort` object), returns `{product, response}`,
and the **rows are in `response.data`** (`response.has_next` signals truncation). Keep every id
(`complex_key`, `pnu`, `ppk`, `jpk`) a string.

Common flat args on the row tools: the filter keys listed per call, plus `fields` (array of field names),
`limit`, `offset`, `sort_field`, `sort_order` (`asc`/`desc`). The six tools, in call order:
`search_complex`, `complex_profile`, `building_summaries`, `realdeal_history`, `estimated_prices`, `notice_prices`.

## Call 1 — search_complex

`search_complex({ complex_name: "<user input>", limit: 10 })`

- `response.data` is relevance-ordered. One clear candidate → proceed. Multiple plausible candidates →
  ask the user once, listing `complex_name · display_address · residential_type`.
- Keep the selected `complex_key` (string).

## Call 2 — complex_profile

`complex_profile({ complex_key: "<key>", fields: ["complex_key","complex_name","residential_type","complex_household_count","standard_ym","use_approval_date","road_name_address","recent_month6_realdeal_count","recent_month6_average_realdeal_price"], limit: 1 })`

- `standard_ym` (e.g. `"202606"`) from `response.data[0]` anchors every window below. Never use the current date.
- `recent_month6_*` is whole-complex context only — it never enters the triangulation axes.

## Call 3 — building_summaries (pyeong band)

`building_summaries({ complex_key: "<key>", fields: ["ppk","dong_name","units_summary"], limit: 300 })`

Band algorithm (unchanged by transport — run it on `response.data`):

1. Flatten every `units_summary` entry across dongs: `{pyeong_number, pyeong_type_name, private_area, ho_count}`.
2. Drop entries with no positive `private_area`.
3. Group by identical `private_area` (2-decimal). Sum `ho_count` per group.
4. **Merge overlapping bands**: sort group areas ascending; while the gap to the next area is `< 1.0㎡`, merge into one band (this is what joins 32/33평 supply types sharing ~84.9㎡).
5. Default target = merged band with the largest summed `ho_count`. If the user named a pyeong (e.g. "33평", "84타입"), pick the merged band containing a matching `pyeong_number` / `pyeong_type_name` / area mention — **never** compute ㎡ from 평 arithmetically.
6. Band filter bounds: `area_min = min(band areas) − 0.05`, `area_max = max(band areas) + 0.05`, but never wide enough to reach the nearest area outside the band (cap each side at half the gap to the neighbor band).
7. Band label for screen: `전용 {representative area}㎡` plus supply names when known, e.g. `전용 84㎡ (33·34평형 병합)`.

No usable pyeong info at all (typical for 연립다세대) → whole-complex fallback: omit `private_area_min/max` everywhere below and set `band.fallback = true` so the card labels the scope honestly.

## Call 4 — realdeal_history (deal axis)

Window (derive from `standard_ym`, never today): `date_to` = last day of `standard_ym`;
`date_from` = first day of `standard_ym − 11 months`. **Send both dates as 8-digit `YYYYMMDD` strings**
— `contract_date` is compared as an 8-digit string, so a dashed `YYYY-MM-DD` sorts below `YYYYMMDD`
and silently drops the boundary (window-end) day. Format the same window twice: `YYYYMMDD` for the tool
args, `YYYY-MM-DD` for the `dm-data` display fields (`deal.from`/`deal.to`).

`realdeal_history({ complex_key: "<key>", residential_type: "<profile type>", deal_division_name: "매매", private_area_min: <area_min>, private_area_max: <area_max>, date_from: "<YYYYMMDD>", date_to: "<YYYYMMDD>", fields: ["contract_date","floor_name","private_area","price","cancel_date"], sort_field: "contract_date", sort_order: "desc", limit: 100, offset: 0 })`

- Page `offset += 100` while `response.has_next` is true, max 3 pages. Still truncated after that → `deal.partial = true`.
- Drop rows with non-null `cancel_date`; count them into `deal.excludedCancelled`.
- Fewer than 4 rows remain → re-run once with a 36-month window (`standard_ym − 35 months`) and set `deal.monthsLabel` to `"최근 36개월(표본 확보 확장)"`.
- Compute locally: `n`, `median`, `min`, `max` over `price`. Median of an even count = mean of the two middle values, rounded to 만원.
- `deal.deals` = up to 8 most recent kept rows (`date`, `floor`, `area`, `price`); `deal.moreDeals` = remainder count.
- Zero rows even after extension → `deal = null` (template renders the empty state).

## Call 5 — estimated_prices (estimate axis)

`estimated_prices({ complex_key: "<key>", residential_type: "<profile type>", private_area_min: <area_min>, private_area_max: <area_max>, fields: ["jpk","dong_name","ho_name","private_area","sise_price","lowerlimit_sise_price","upperlimit_sise_price","sise_grade","sise_production_standard_ym"], sort_field: "sise_price", sort_order: "asc", limit: 100, offset: 0 })`

- `response.has_next` **false** → complete: `bandMin = first.sise_price`, `bandMax = last.sise_price`, representative unit = row at index `⌊n/2⌋`, `sise.complete = true`, scope label `"이 평형 호 전체 {n}호"`.
- `response.has_next` **true** → the asc page is truncated at the low end, so **do not pick the representative from it** (its rows cluster at the cheapest units and would understate the unit badly on large complexes). Instead:
  1. `bandMin` = the first row of the asc page (global minimum, since sorted asc).
  2. One `estimated_prices({ ..., sort_field: "sise_price", sort_order: "desc", limit: 1 })` call → `bandMax` (global maximum).
  3. One `estimated_prices({ ..., sise_price_min: round((bandMin+bandMax)/2), sort_field: "sise_price", sort_order: "asc", limit: 1 })` call → the cheapest unit at or above the midpoint = a **mid-range example unit**. This is the representative.
  Set `sise.complete = false`, scope label `"이 평형 대역 기준"`. The band (`bandMin`~`bandMax`) is the real signal; the representative is one example unit near the middle, not a census median.
- `sise.ym` = representative row's `sise_production_standard_ym`. Grade/lower/upper belong to the representative unit only.
- Zero rows → `sise = null`; notice axis is then also skipped (no `jpk` to look up).

## Call 6 — notice_prices (notice axis, same unit)

`notice_prices({ jpk: "<representative jpk>", fields: ["jpk","dong_name","ho_name","notice_price","notice_standard_ym","notice_year"], sort_field: "notice_standard_ym", sort_order: "desc", limit: 1 })`

- This tool has no area filter — that is why the notice axis is a single-unit lookup, and why it must reuse the estimate axis's representative `jpk`.
- Zero rows → `notice = null` (card shows 자료 없음; keep the other axes).

## dm-data mapping

Fill exactly this shape (raw KRW integers, no formatting):

```json
{
  "sample": false,
  "queriedAt": "YYYY-MM-DD",
  "complex": { "name": "", "type": "", "householdCount": 0,
               "standardYm": "YYYYMM", "address": "" },
  "band": { "label": "", "areaMin": 0, "areaMax": 0,
            "pyeongLabel": "", "fallback": false },
  "deal": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "monthsLabel": "최근 12개월",
            "n": 0, "median": 0, "min": 0, "max": 0,
            "partial": false, "excludedCancelled": 0 },
  "sise": { "ym": "YYYYMM", "bandMin": 0, "bandMax": 0,
            "complete": true, "scopeLabel": "",
            "rep": { "dongName": "", "hoName": "", "price": 0,
                     "lower": 0, "upper": 0, "grade": "" } },
  "notice": { "ym": "YYYYMM", "year": 0,
              "rep": { "dongName": "", "hoName": "", "price": 0 } },
  "deals": [ { "date": "YYYY-MM-DD", "floor": "", "area": 0, "price": 0 } ],
  "moreDeals": 0
}
```

- `deal`, `sise`, `notice` are each nullable — set the whole object to `null` when that axis has no data; the template renders the correct empty state and adjusts the verdict.
- `deals` holds at most 8 rows, newest first, cancelled rows already removed.
- `deal.from`/`deal.to` here are **display** strings in `YYYY-MM-DD` (the template formats them for the screen) — keep the dashes. This is deliberately different from the `YYYYMMDD` used in the Call 4 tool args; do not "align" them.
- Do not add fields; do not omit `sample`/`queriedAt`.

## Sanity checks before saving the HTML

- Median lies inside `[min, max]`; `bandMin ≤ rep.price ≤ bandMax`; every price `> 1_000_000` (KRW, not 만원).
- `notice.rep` and `sise.rep` show the same `dongName`/`hoName`.
- `standardYm`, `sise.ym`, `notice.ym` are the tool-returned values — they are expected to differ from each other.

---
name: region-apartment-ranking
description: "Use when a user asks which apartment complexes rank highest in a Korean region — a ranked list for one 시군구/동 by a chosen metric (세대수, 신축/연식, 역세권 거리, or 최근 실거래가): '강남구 아파트 순위', '우리 동네 대장 아파트', '세대수 제일 많은 아파트', '분당 신축 아파트 순위', '역세권 아파트 어디', '이 동네에서 제일 비싼 아파트', 'top apartments in this area', 'rank the complexes in 송파구'. For one specific complex's three-price verdict use apartment-price-check instead."
---

# Region Apartment Ranking (지역 아파트 순위)

Produce one self-contained Korean HTML card that **ranks the apartment complexes in one region**
(a 시군구 or a 법정동) by a single metric the user cares about — 세대수, 신축(연식), 역세권 거리, or
최근 6개월 평균 실거래가. You resolve the region, fetch the ranked complexes, and fill one JSON block;
the fixed template draws the ranked list and writes the headline. You do not write the ranking prose yourself.

## Runtime Inputs

This is a live **analysis skill**: it fetches data by calling the plugin's **MCP live tools**, and the
plugin (BigValue Real Estate) supplies authentication. Do **not** read an API key or host, and do **not**
build REST requests. Tools used: `region_summaries` (region name → legaldong code + counts) and
`complexes_by_region` (the ranked complexes).

If those MCP tools are not connected, stop and tell the user to install/enable the BigValue Real Estate
plugin (it provides the tools and their credentials). Never put a key, host, or internal identifier into the HTML.

## Workflow

Each tool takes **flat arguments**, returns `{product, response}`, and the rows are in **`response.data`**.
Exact tool arguments, the region-scope rule, the metric map, and the `dm-data` mapping live in
`references/query-recipes.md` — read it before the first call.

1. **Resolve the region** — `region_summaries` by the user's place name (`sigungu_name` for a 구/시,
   `eupmyeondong_name` or `full_name` for a 동). This returns 법정동 rows with `legaldong_code` and the
   per-type complex counts. Multiple 시군구 share a 동 name → ask once. Carry the region label and counts.
2. **Fix the scope** — a 시군구 request ranks the whole 구: take the 5-digit `legaldong_code` prefix and
   sum the counts across the returned 동 rows. A single-동 request uses that 동's 10-digit `legaldong_code`.
3. **Pick the metric** — from the user's words (default: 최근 실거래가, 비싼 순). Map it to a `sort_field`
   and `sort_order` per the recipe (household desc / age asc for 신축 / subway distance asc / recent price desc).
4. **Rank** — `complexes_by_region` with the scope filter, `residential_type: "아파트"`, the chosen sort,
   and `limit` (default 20). One page is a ranking; if `response.has_next` is true, note that more exist.
5. **Render** — copy `assets/result.html`, replace only the `<script type="application/json" id="dm-data">`
   block, set `sample: false`, and save as `<지역명>_아파트순위_<metric>.html`. Do not edit markup, CSS, or the render script.

Typical cost: 2–3 MCP tool calls per card.

## Honesty Rules (non-negotiable)

- **The ranking is scoped to region + 아파트 + one metric.** Always name the metric; a different metric
  gives a different order. Never call the top row "the best apartment" without the metric qualifier.
- **`legaldong_code_prefix` is a 시군구 administrative boundary (rough), not a curated 동네.** Label the scope
  by its `full_name`/구 name, and say it covers that whole 구.
- **`recent_month6_average_realdeal_price` can be null** (no recent transactions). The API sorts NULLS LAST,
  so those complexes sink to the end — show them as `최근 실거래 없음`, never as 0, and never silently drop them.
- **`complex_age_number` = years since 준공** (신축 = ascending). Do not invent a 준공년도; if you show one,
  use `use_approval_date`. Null age → `연식 정보 없음`.
- **역세권 = `nearby_subway_station_distance` in meters** to the nearest station. Null means no subway data
  for that complex, not that there is no subway nearby.
- **The list is the top N of the region total.** Show `N개 중 상위 K` from the region counts; if `has_next`
  is true, say more complexes exist beyond the shown page.
- **One residential type per ranking.** An 아파트 ranking keeps `residential_type: "아파트"`; never blend
  오피스텔/연립다세대 into the same list.
- **`recent_month6_average_realdeal_price` is a whole-complex 6-month average, not a 평당가.** Do not divide
  it by area or present it as a per-pyeong price.
- **Keys stay strings.** Each tool returns `{product, response}`; read rows from `response.data`. Respect
  limits (`limit` ≤ 100, `offset` ≤ 2000).

## Screen Language

- All visible text is consumer Korean. No product slugs, field names, or API vocabulary on screen.
- Title is `동네 아파트 순위`; the metric name is spelled out (세대수 · 신축 · 역세권 · 최근 실거래가).
- Pass raw values in `dm-data` (세대수는 정수, 거리는 m 정수, 가격은 KRW 정수); the template formats them.

## Failure Handling

| Situation | Action |
|---|---|
| MCP tools not connected | Stop; tell the user to enable the BigValue Real Estate plugin. Do not render |
| Region name not found | Stop; ask for a different place name (구/동) |
| Several 시군구 share the 동 name | Ask once which one, listing `full_name` |
| Region has 0 아파트 complexes | Render the card with a `이 지역에 아파트 단지가 없습니다` state; do not fabricate rows |
| Chosen metric is null for most rows (e.g. 실거래가 in a quiet 동) | Rank by what exists, label the null rows, and note the metric is sparse here |
| Tool error / auth failure | Stop and report the failing tool call; do not render a partial card |

## Final Self-Check

- `dm-data` is the only thing changed in the template copy; `sample` is `false`.
- Every value in `ranking` came from `response.data` rows — nothing estimated by you; keys are strings.
- `metric` names the actual sort field used; the list order matches that sort (the API sorted it, not you).
- Null metric values are labeled (최근 실거래 없음 / 연식 정보 없음 / 역세권 정보 없음), not shown as 0.
- `total`/`shown`/`hasMore` are honest: `shown` ≤ `total`, and `hasMore` reflects `response.has_next`.
- One residential type only; the scope label matches the region actually queried.
- No API key, host, internal identifier, or English field name appears in the HTML.

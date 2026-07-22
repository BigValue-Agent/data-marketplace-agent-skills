---
name: apartment-price-check
description: "Use when a user asks what a specific Korean apartment or unit is actually worth and wants evidence, not a guess — a diagnostic card (아파트 가격 진단) comparing real transaction prices, BigValue AI estimated prices, and official notice prices for one pyeong band: '이 아파트 가격 진단해줘', '이 집 얼마야', '실거래랑 시세 비교해줘', '공시가격도 같이 보여줘', '지금 가격 적정해?', '얼마에 팔리고 얼마로 평가돼?', 'how much is this apartment really worth'."
---

# Apartment Price Check (아파트 가격 진단)

Produce one self-contained Korean HTML card that puts three independent price evidences for **one complex + one pyeong band** on a single money axis:

1. **실거래가** — reported real transactions (past facts, 12-month window)
2. **AI 산출시세** — BigValue AI estimated price (current estimate with lower/upper band and grade)
3. **공시가격** — official notice price (tax base, yearly snapshot)

The three sources have different natures and different reference months. This skill never blends them into one number; it shows each with its own scope and lets the fixed template compute the verdict sentence. You collect data and fill one JSON block — you do not write the analysis prose yourself.

## Runtime Inputs

Read the API host from the `DATA_MARKETPLACE_BASE_URL` environment variable and the server-side key from `DATA_MARKETPLACE_API_KEY`. Both are provided with Data Marketplace onboarding — never guess or invent a host.

If the key is absent from the conversation and workspace, ask once whether to configure it now or stop; this skill performs live queries, so placeholder builds are not possible. Do not solicit the key value as a form, but if the caller pastes a key in chat, use it via the environment immediately, never repeat its value in any later output, and recommend rotating production keys because chat history retains them. The API key is a server-side secret — it goes into the `X-API-KEY` request header and never into the produced HTML.

## Workflow

All calls are `POST {BASE_URL}/api/v1/data-products/residential/{slug}/query` with a JSON body. Exact request bodies, selection algorithms, and the `dm-data` field mapping live in `references/query-recipes.md` — read it before the first call.

1. **Resolve the complex** — `complex-search` by name. If two or more plausible candidates return, ask the user to pick once (show name + address + type). Carry `complex_key` forward as a string.
2. **Load the profile** — `complexes`. Keep `complex_name`, `residential_type`, `complex_household_count`, and `standard_ym`. Every period in this skill derives from `standard_ym`, never from today's date.
3. **Choose the pyeong band** — `buildings` → aggregate `units_summary`. Default: the valid-area pyeong group with the most units; merge supply pyeongs whose private areas overlap into one band. If the user named a pyeong, match it against `units_summary`; never convert 평 to ㎡ arithmetically. If the chosen pyeong has no observed private area, area-scoped queries are unavailable — fall back to whole-complex scope only when the complex has no pyeong information at all, and label the card accordingly.
4. **Deal axis** — `realdeal` (route `realdeal`, not "transactions") with the band, `deal_division_name: "매매"`, and a 12-month window ending at `standard_ym`. Send the window dates as `YYYYMMDD` (dashed dates drop the boundary day). Page until `has_next` is false (max 3 pages). Drop rows with a non-null `cancel_date` and count them. If fewer than 4 deals remain, extend once to a 36-month window and label the extension. Compute median/min/max locally from the complete set; if truncation remained, mark `partial: true`.
5. **Estimate axis** — `estimated-prices` with the band, sorted by `sise_price asc`, limit 100. If `has_next` is false the set is complete: band range is first/last row and the **representative unit is the median row**. If incomplete, take `bandMin` from the asc page and `bandMax` from one `desc, limit 1` call, then fetch the representative **directly** with `sise_price_min ≈ (bandMin+bandMax)/2` (`asc, limit 1`) — a mid-range example unit, not the low-clustered asc sample. The band is the signal; the representative is one example unit.
6. **Notice axis** — `notice-prices` by the representative unit's `jpk`, sorted `notice_standard_ym desc`, limit 1. Using the same unit as the estimate axis is deliberate: 시세 and 공시 must describe the same physical unit.
7. **Render** — copy `assets/result.html`, replace only the `<script type="application/json" id="dm-data">` block, set `sample: false`, and save as `<단지명>_가격진단_<standard_ym>.html`. Do not edit markup, CSS, or the render script. Do not name the user copy `result.html` or `index.html`.

Typical cost: 6–10 API calls per card.

## Honesty Rules (non-negotiable)

- **Never average across the three axes** or present any single number as "the price". The verdict sentence is computed by the template, not written by you.
- **One scope per axis, stated on screen**: deals = band × window; estimate = band range + one representative unit; notice = that same one unit. The template prints each axis's reference month — the three months differ by design (transactions window vs. estimate snapshot vs. yearly notice snapshot).
- **매매 only** on the deal axis. Never mix 매매/전세/월세 rows in one statistic; lease and monthly-rent views are out of scope for this card.
- **Cancelled deals are excluded** from statistics; report the excluded count in `deal.excludedCancelled`.
- **No sample promotion**: statistics come only from a complete fetch (`has_next` false). If completeness was not reached, set `partial: true` so the card labels itself.
- **Grade is a unit attribute** (`sise_grade`) — it belongs to the representative unit only and the card labels it that way. Never present it as the complex's or the pyeong's grade.
- **Single snapshots are not trends.** Notice and estimated prices expose one reference month per unit; never fabricate history, change rates, or forecasts from them.
- **Keys stay strings** — `complex_key`, `pnu`, `ppk`, `jpk` are never cast to numbers.
- Read rows from `result.data`. Respect each product's documented limits (`limit` ≤ 100, `offset` ≤ 2000).

## Screen Language

- All visible text is consumer Korean. No product slugs, field names, or API vocabulary on screen.
- Source labels are fixed in the template markup (실거래 신고 기반 / 빅밸류 AI 산출시세 / 주택 공시가격) — never move them into data.
- Prices render in 억/만 form; the render script owns formatting. Pass raw KRW integers in `dm-data`.

## Failure Handling

| Situation | Action |
|---|---|
| Complex not found | Stop; ask for a different name. Never fabricate a card |
| No deals in window (after 36-month extension) | Keep the card; deal axis renders "기간 내 매매 없음", verdict degrades to estimate-vs-notice |
| Estimate rows absent for the band (e.g., 연립다세대) | Estimate card renders "자료 없음"; skip representative unit; notice axis then also unavailable — say so plainly |
| Notice row absent for the representative unit | Notice card renders "자료 없음"; keep the other two axes |
| `has_next` still true after paging caps | Compute from fetched rows, set `partial: true`, never claim completeness |
| API error / auth failure | Stop and report the failing call; do not render a partial card silently |

## Final Self-Check

- `dm-data` is the only thing you changed in the template copy; `sample` is `false`.
- Every price in `dm-data` is a raw KRW integer taken from API responses — nothing estimated by you.
- Deal stats come from a cancel-filtered, complete (or explicitly `partial`) fetch; window derived from `standard_ym`.
- Representative unit is identical for the estimate and notice axes, with its 동/호 shown.
- Each axis shows its own reference month; no invented trends; no cross-axis averages.
- No API key, host, internal identifiers, or English field names appear in the HTML.

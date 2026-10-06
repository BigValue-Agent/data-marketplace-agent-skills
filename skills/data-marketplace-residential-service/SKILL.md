---
name: data-marketplace-residential-service
description: "Use when the task is to create, extend, modify, debug, or review software for a Korean residential real-estate product, whether described as an app, website, map, dashboard, UI, backend, API integration, or service flow. Do not use when the goal is only to retrieve or summarize live property data."
---

# Data Marketplace Residential Service

## Core Rule

Use this skill as a routing and guardrail map, not as an API manual. Before writing or validating Data Marketplace API code, read `https://datamarket.bigvalue.ai/llms.txt` as the current product index, select only the products required for the requested feature, and open each matching product Markdown linked from that index. In this skill, "API Reference" means those live product documents. Use this skill to decide which product to call first, which key to carry forward, and which code patterns to avoid.

If the index or a required linked product document is unavailable, stop contract-dependent implementation and name the unavailable URL. Do not infer paths, filters, fields, or limits from memory.

Use the live API Reference as the authority for the generated app's HTTP requests. Reuse documents already read for the current task; retrieve additional contract metadata only when required information is missing, rather than routinely retrieving a second contract source for every product.

## Runtime Inputs

For live API calls or runnable integration, use `https://datamarket-api.bigvalue.ai` as the default Data Marketplace base URL. Do not ask for a base URL unless the caller needs a non-default environment.

**HITL gate:** A generic request to build a residential map service is not a composition or map SDK choice. If either answer is unresolved, ask the unresolved question(s) once and wait for the reply before creating or modifying files or adapting the template. An empty project, missing runtime keys, or OpenStreetMap being keyless does not count as a choice. Skip a question only when its answer already exists in the conversation or project files. If confirmation is unavailable or the caller explicitly delegates both defaults, use 완성형 and Kakao Maps (template default).

For composition, offer exactly three tiers, recommended first, using this Korean copy verbatim:

```
아파트·오피스텔·빌라 지도 서비스를 어느 구성으로 만들까요?

· 완성형 (권장) — 지도에서 검색과 가격 마커로 단지를 찾고, 단지를 누르면 경계가
  표시된 지도와 상세 패널에서 실거래 목록·차트를 확인하고, 동·호를 골라 호실 단위
  AI 산출시세·공시가격 비교까지 이어지는 전체 흐름
· 표준형 — 지도에서 검색과 가격 마커로 단지를 찾고, 단지를 누르면 경계 표시와
  함께 상세 패널에서 실거래 목록·차트까지 확인하는 구성
· 기본형 — 지도에서 검색과 가격 마커로 단지를 찾고, 상세 패널에서 최근 실거래
  요약까지 확인하는 최소 구성

(다른 조합이 필요하면 직접 입력)
```

Tier to products: 기본형 = integrated location search + legal-dong detail + type markers + complex profile (4 products); legal-dong detail is called only for a selected region that advertises a polygon. Its recent realdeal summary comes from profile `recent_month6_*`, with no realdeal-history route or chart. 표준형 = 기본형 + complex shapes + realdeal history (6 products). 완성형 = all ten, adding buildings, units, notice prices, and estimated prices. A free-form custom mix must keep the 기본형 core and include the 동·호 surface for unit-scope notice/estimated prices. Realdeal does not depend on buildings.

For the map, offer exactly three choices — Kakao Maps (template default), Naver Maps, or OpenStreetMap as a keyless alternative (present it to end users as 오픈소스 맵). Do not offer other map SDKs unless the caller asks. All three map adapters ship with `assets/map-service/`, so switching maps means loading exactly one of `js/map-adapter-kakao.js`, `js/map-adapter-naver.js`, or `js/map-adapter-osm.js` in `index.html` — do not rewrite the controller or the panels for it. Never read or compare a zoom number outside an adapter, and never gate marker calls on zoom: marker eligibility stays on the `BBOX_MAX_DEG` viewport span in every adapter. OpenStreetMap has no satellite layer, so that tool hides itself there.

After the composition and map SDK are resolved, runtime keys do not change the selected code shape and must not block implementation. Never switch to OpenStreetMap because a map key is missing. Finish the selected service, then close with a run checklist that names each value the caller still has to set, where it goes, and how to obtain it. Name the exact destination per key: `DATA_MARKETPLACE_API_KEY` goes in the server `.env`, and the map key goes in the browser map config (`js/config.js` in the bundled template). Name the exact key too — `KAKAO_MAP_KEY` for Kakao, `NAVER_MAP_CLIENT_ID` for Naver, none at all for OpenStreetMap. Ask for key values only in that closing message.

Never invent real keys, and inject real values at run time instead of committing them. Which keys you may invite into chat differs by key:

- `DATA_MARKETPLACE_API_KEY` is a server-side secret that belongs in `.env` and must never reach browser code. Show the caller how to set it themselves; do not ask them to paste the value.
- Kakao JavaScript keys and the Naver Dynamic Map Client ID are domain-restricted public runtime map keys that belong in browser map config, protected by domain registration rather than secrecy. Inviting the caller to paste these is fine.
- For Naver Maps, NCP issues both a Client ID (`X-NCP-APIGW-API-KEY-ID`) and a Client Secret (`X-NCP-APIGW-API-KEY`). Browser Dynamic Map JS uses only the Client ID as `ncpKeyId`; the Client Secret is server-side REST-only and must never be placed in browser config.

If the caller pastes any key anyway, write it to its proper home immediately, never repeat its value in any later output, and recommend rotating production keys because chat history retains them.

## Choose the Entry Point

| User request | Start with | Then read |
|---|---|---|
| Search by region or complex name | Name search entry | `references/entrypoints.md#name-search-entry` |
| Show markers for current map | Map bbox entry | `references/entrypoints.md#map-bbox-entry` |
| Open selected complex detail | Detail panel recipe | `references/ui-recipes.md#detail-panel` |
| Build a price flow | Price scope recipe | `references/ui-recipes.md#price-scope-and-reference-time` |
| Show building/unit drill-down | Building/unit recipe | `references/ui-recipes.md#building-unit-drilldown` |
| Validate exact product/filter/field use | Live product API Reference plus minimal schema contract | `references/schema-contract.md` |
| Verify a generated service before completion | Verification checklist | `references/verification-checklist.md` |

## Critical Rules

- Browser code calls the generated app's server; that server calls Data Marketplace directly with its environment key in `X-API-KEY`. Never expose that secret to the browser or route the app's data through agent tools.
- Before writing requests, use the live API Reference with `references/schema-contract.md` and `references/code-patterns.md` for body fields, response wrapping, product-specific pagination, bbox and sort support. Never invent fields, paths, or bridge keys.
- Keep identifiers as strings, branch search selection on `result_type`, and follow `references/entrypoints.md` for search and map loading. A truncated search or marker result is not an offset page or complete coverage.
- Profile and markers represent one complex with a representative residential type. Only profile `recent_month6_*` supplies its whole-complex price summary; never promote paged detail rows into that summary or label it as a type-specific price.
- For realdeal and unit-price screens, follow `references/ui-recipes.md` (Transaction Area Filtering, Price Scope And Reference Time, Unit Price Detail). Keep actual transaction-area scope separate from housing composition, and unit snapshots separate from transaction trends.
- Treat profile `use_approval_date` as a valid `YYYYMMDD` or null; do not invent missing month or day components.
- Treat nearby `*_distance` values as distance only. Do not derive walking/driving time or an N-minute catchment without route or travel-time data.
- Validate display/derived-metric inputs and GeoJSON before use. Preserve raw API rows, but do not treat unsupported shapes or out-of-policy pyeong/area/floor values as normal display or aggregate inputs.
- Do not invent external data or imply that Data Marketplace supplies unavailable listings, broker information, or other feeds. Requested app features may use supported data and user input, including local favorites or sharing a selection, without another property-data source. Implement the storage, delivery, or external integration those features actually need; do not present an unconnected feature as working.

## Reference Routing

These are on-demand lookups, not a mandatory pre-read list; open each file only when its condition applies.

- Read `references/entrypoints.md` before implementing search or map entry code.
- Read `references/product-routing.md` when selecting products for a feature; first read `https://datamarket.bigvalue.ai/llms.txt`, then open only the matching linked product documents for exact filters, allowed fields, and limits.
- Read `references/schema-contract.md` when checking public API paths, required filters, bbox support, or risky fields.
- Read `references/code-patterns.md` when writing API client/helper code.
- Read the relevant entries in `references/pitfalls.md` when resolving a contract or integration mistake.
- Read `references/ui-recipes.md` when composing several products into a service screen.
- Read `references/verification-checklist.md` before declaring a generated service complete.
- For a full residential map service, adapt the bundled `assets/map-service/` files to the selected tier and current service contract instead of writing the service from scratch. Reuse files already acquired, then verify with `references/verification-checklist.md`.

## Final Self-Check

Use `references/verification-checklist.md` for the chosen tier and changed functionality. Confirm the requested features and their dependencies are complete, report which checks actually ran, and leave untested runtime behavior explicit. Finish with any remaining runtime configuration from Runtime Inputs.

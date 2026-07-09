<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 산출시세 상세

단지, 필지, 동, 호 기준 빅밸류 산출시세 상세를 조회합니다.

## Base URL

Provided with Data Marketplace onboarding — inject the host via the `DATA_MARKETPLACE_BASE_URL` environment variable; do not hardcode it.

## Endpoint

```http
POST /api/v1/data-products/residential/estimated-prices/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`, `filters.pnu`, `filters.ppk`, `filters.jpk` 중 하나를 전달합니다.

Supported filters:

- `filters.complex_key`
- `filters.residential_type`
- `filters.pnu`
- `filters.ppk`
- `filters.jpk`
- `filters.sise_production_standard_ym`
- `filters.sise_price_min`
- `filters.sise_price_max`
- `filters.private_area_min`
- `filters.private_area_max`

Optional:

- `fields`: string array of response field names.
- `sort`: object with `field` and `order`. Supported fields: `sise_production_standard_ym`, `sise_price`, `private_area`.
- `limit`: maximum row count. Keep `limit` in the `1..100` range. Default is `30`.
- `offset`: pagination offset. Keep `offset` in the `0..2000` range.

## Bbox

Not supported.

## Sort

Default sort: `sise_production_standard_ym desc`.

Allowed sort fields:

- `sise_production_standard_ym`
- `sise_price`
- `private_area`

Allowed sort orders:

- `asc`
- `desc`

## Allowed Fields

- `complex_key`
- `residential_type`
- `pnu`
- `ppk`
- `jpk`
- `sise_production_standard_ym`
- `complex_name`
- `dong_name`
- `ho_name`
- `private_area`
- `private_pyeong_area`
- `sise_price`
- `lowerlimit_sise_price`
- `upperlimit_sise_price`
- `unit_sise_price`
- `unit_pyeong_sise_price`
- `sise_grade`

## Example

```http
POST /api/v1/data-products/residential/estimated-prices/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551"
  },
  "sort": {
    "field": "sise_production_standard_ym",
    "order": "desc"
  },
  "limit": 30
}
```

## Response Use

산출시세, 하한/상한 시세, 단위면적 시세, 시세 등급을 반환합니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

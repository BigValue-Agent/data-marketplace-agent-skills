<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 산출시세 상세

단지, 필지, 동, 호 기준 빅밸류 산출시세 상세를 조회합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

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
- `filters.estimated_standard_ym`
- `filters.estimated_price_min`
- `filters.estimated_price_max`
- `filters.pyeong_number`
- `filters.pyeong_type_name`
- `filters.private_area_min`
- `filters.private_area_max`

Optional:

- `fields`: string array of response field names.
- `sort`: object with `field` and `order`. Supported fields: `estimated_standard_ym`, `estimated_price`, `private_area`.
- `limit`: maximum row count. Keep `limit` in the `1..100` range. Default is `30`.
- `offset`: pagination offset. Keep `offset` in the `0..2000` range.

## Bbox

Not supported.

## Sort

Default sort: `estimated_standard_ym desc`.

Allowed sort fields:

- `estimated_standard_ym`
- `estimated_price`
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
- `estimated_standard_ym`
- `complex_name`
- `dong_name`
- `ho_name`
- `private_area`
- `private_pyeong_area`
- `pyeong_number`
- `pyeong_type_name`
- `estimated_price`
- `lowerlimit_estimated_price`
- `upperlimit_estimated_price`
- `unit_estimated_price`
- `unit_pyeong_estimated_price`
- `estimated_grade`

## Example

```http
POST /api/v1/data-products/residential/estimated-prices/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551",
    "pyeong_number": 33
  },
  "sort": {
    "field": "estimated_standard_ym",
    "order": "desc"
  },
  "limit": 30
}
```

## Response Use

산출시세, 하한/상한 시세, 단위면적 시세, 시세 등급, 평형을 반환합니다.

`pyeong_number`와 `pyeong_type_name`으로 "33평 A타입 시세"를 이 상품 하나로 만들 수 있습니다. 연립다세대는 원천에 평형 구분이 없어 두 필드가 비어 있습니다.

`private_pyeong_area`(전용면적의 평 환산)와 `pyeong_number`(공급 기준 평수)는 기준이 다릅니다. 전용 84.99㎡가 25.76평이면서 동시에 33평입니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

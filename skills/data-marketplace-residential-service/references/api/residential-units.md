<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 호실 상세

선택 단지/동의 호실, 층, 평형, 면적 상세를 조회합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

## Endpoint

```http
POST /api/v1/data-products/residential/units/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key` + `filters.ppk`, `filters.complex_key` + `filters.jpk` 중 하나를 전달합니다.

Supported filters:

- `filters.complex_key`
- `filters.residential_type`
- `filters.ppk`
- `filters.jpk`
- `filters.pyeong_number`
- `filters.pyeong_type_name`
- `filters.private_area_min`
- `filters.private_area_max`

Optional:

- `fields`: string array of response field names.
- `sort`: object with `field` and `order`. Supported fields: `private_area`, `floor_number`.
- `limit`: maximum row count. Keep `limit` in the `1..100` range. Default is `50`.
- `offset`: pagination offset. Keep `offset` in the `0..2000` range.

## Bbox

Not supported.

## Sort

Default sort: `private_area asc`.

Allowed sort fields:

- `private_area`
- `floor_number`

Allowed sort orders:

- `asc`
- `desc`

## Allowed Fields

- `complex_key`
- `residential_type`
- `ppk`
- `jpk`
- `dong_name`
- `ho_name`
- `floor_number`
- `pyeong_number`
- `pyeong_type_name`
- `private_area`
- `public_area`
- `supply_area`

## Example

```http
POST /api/v1/data-products/residential/units/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551",
    "ppk": "11710-1000000000000000000"
  },
  "sort": {
    "field": "private_area",
    "order": "asc"
  },
  "limit": 30
}
```

## Response Use

호실 단위 원천 상세 대신 공개 화면에 필요한 동/호, 층, 평형, 면적 필드만 반환합니다.

`floor_number`는 층을 모르는 호실이 0으로 옵니다. 실제 지상 1층과 구분되지 않으니 0을 유효한 층으로 쓰지 마세요. 이 상품에는 지하층 음수 표기가 없습니다 — 실거래 상품의 `floor_name`은 문자열이고 지하를 음수로 쓰므로 두 값을 같은 축에 놓지 마세요.

`dong_name`과 `ho_name`은 '107', '102'처럼 접미사 없이 숫자만 오기도 하므로 문자열로 다룹니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

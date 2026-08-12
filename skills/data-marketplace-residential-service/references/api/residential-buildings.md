<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 동별 상세

단지 안 동마다 층수·호실 수·평형 구성을 조회합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

## Endpoint

```http
POST /api/v1/data-products/residential/buildings/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`, `filters.ppk`, `bbox` 중 하나를 전달합니다.

Supported filters:

- `filters.complex_key`
- `filters.ppk`
- `filters.residential_type`

Optional:

- `fields`: string array of response field names.
- `limit`: maximum row count. Keep `limit` in the `1..300` range. Default is `100`.
- `offset`: pagination offset. Keep `offset` in the `0..2000` range.

## Bbox

Supported. The bbox filter uses `latitude` and `longitude`. The latitude and longitude span can each be at most `0.1` degrees.

```json
{
  "bbox": {
    "min_lat": 37.45,
    "max_lat": 37.55,
    "min_lng": 127.05,
    "max_lng": 127.15
  }
}
```

## Sort

Client-selected sort is not supported for this product.

## Allowed Fields

- `complex_key`
- `ppk`
- `dong_name`
- `latitude`
- `longitude`
- `residential_type`
- `total_ho_count`
- `ground_floor_count`
- `units_summary`

## Example

```http
POST /api/v1/data-products/residential/buildings/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551"
  },
  "limit": 30
}
```

## Response Use

`units_summary` 항목은 `pyeong_number`, `pyeong_type_name`, `private_area`, `ho_count` 네 키입니다. 평형 라벨이 필요하면 앞의 두 값을 붙여 만듭니다 — 합본 표기 키는 제공하지 않습니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

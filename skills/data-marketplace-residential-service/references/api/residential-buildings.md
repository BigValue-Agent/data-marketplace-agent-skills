<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 동/건물 요약

단지 내부 동/건물 목록, 동 마커, 평형 요약을 조회합니다.

## Base URL

Provided with Data Marketplace onboarding — inject the host via the `DATA_MARKETPLACE_BASE_URL` environment variable; do not hardcode it.

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

동/건물 단위 좌표, 주거유형, 호수, 지상층수, 평형 요약을 반환합니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

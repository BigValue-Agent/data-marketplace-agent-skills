<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거유형별 단지 마커

지도 영역에서 주거유형별 단지 마커를 조회합니다.

## Base URL

Provided with Data Marketplace onboarding — inject the host via the `DATA_MARKETPLACE_BASE_URL` environment variable; do not hardcode it.

## Endpoint

```http
POST /api/v1/data-products/residential/complex-type-markers/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`, `bbox` 중 하나를 전달합니다.

Supported filters:

- `filters.complex_key`
- `filters.residential_type`

Optional:

- `fields`: string array of response field names.
- `limit`: maximum row count. Keep `limit` in the `1..500` range. Default is `300`.
- `offset`: not supported. Omit it or use `0`.

## Bbox

Supported. The bbox filter uses `latitude` and `longitude`. The latitude and longitude span can each be at most `0.1` degrees.

When `bbox` is used, rows are returned from the closest complex to the bbox center. This product does not support offset pagination. If `has_next=true`, do not increase `offset`; zoom in or request a smaller bbox.

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

For bbox requests, the API internally sorts by distance from the bbox center. For non-bbox requests, `default_sort_column=latitude` is only a fallback order.

## Allowed Fields

- `complex_key`
- `residential_type`
- `latitude`
- `longitude`
- `complex_name`
- `road_name_address`
- `complex_household_count`
- `recent_month6_average_realdeal_price`
- `representative_pyeong_number`

## Example

```http
POST /api/v1/data-products/residential/complex-type-markers/query
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

마커 좌표, 단지명, 도로명주소, 세대수, 최근 6개월 평균 실거래가, 대표 평수를 반환합니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.
- Do not treat `has_next=true` as a next-page signal for map markers. Use a smaller bbox instead.

<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 지도 영역

선택 단지의 지도 표시용 경계 GeoJSON을 조회합니다.

## Base URL

Provided with Data Marketplace onboarding — inject the host via the `DATA_MARKETPLACE_BASE_URL` environment variable; do not hardcode it.

## Endpoint

```http
POST /api/v1/data-products/residential/complex-shapes/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`을 전달합니다.

Supported filters:

- `filters.complex_key`

Optional:

- `fields`: string array of response field names.
- `limit`: maximum row count. Keep `limit` in the `1..20` range. Default is `5`.
- `offset`: not supported. Omit it or use `0`.

## Bbox

Not supported.

## Sort

Client-selected sort is not supported for this product.

## Allowed Fields

- `complex_key`
- `center_lat`
- `center_lng`
- `polygon_geojson`

## Example

```http
POST /api/v1/data-products/residential/complex-shapes/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551"
  },
  "limit": 5
}
```

## Response Use

지도 표시용 중심 좌표와 polygon_geojson만 공개 응답 필드로 제공합니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

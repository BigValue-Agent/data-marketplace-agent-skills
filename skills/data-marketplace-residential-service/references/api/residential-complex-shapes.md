<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 경계

선택 단지의 지도 표시용 경계 GeoJSON을 조회합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

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
- `offset`: not supported. Do not send it. The response has no `offset` field either, so do not compute a next page from it.

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

`polygon_geojson`은 지도 라이브러리(Leaflet, Mapbox 등)의 GeoJSON 레이어에 그대로 넣으면 그려집니다. 좌표계는 지도에서 그대로 쓰는 WGS84(위도·경도)입니다. `center_lat`·`center_lng`는 지도 카메라를 단지로 옮길 때 씁니다.

경계 도형이 준비되지 않은 단지도 있습니다. 이때는 오류가 아니라 0행으로 돌아오므로, 경계가 없으면 마커만 표시하도록 대비하세요.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

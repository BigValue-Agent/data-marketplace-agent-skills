<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 지도 마커

지도 화면에 찍을 단지 핀을 조회합니다. 한 단지가 두 유형 이상이면 유형마다 한 행씩 돌아옵니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

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
- `offset`: not supported. Do not send it. The response has no `offset` field either, so do not compute a next page from it.

## Bbox

Supported. The bbox filter uses `latitude` and `longitude`. The latitude and longitude span can each be at most `0.1` degrees.

`has_next=true`는 다음 페이지가 있다는 뜻이 아니라 이 영역의 결과가 잘렸다는 뜻입니다. 지도를 확대해 bbox를 줄인 뒤 다시 호출하세요.

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

`bbox`로 조회하면 영역 중심에 가까운 단지부터 돌아옵니다. `filters.complex_key`로 조회할 때는 이 정렬이 걸리지 않으므로 순서에 의미를 두지 마세요.

## Allowed Fields

- `complex_key`
- `residential_type`
- `latitude`
- `longitude`
- `display_name`
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

아파트와 오피스텔이 함께 있는 단지는 2행으로 옵니다. 지도에 핀을 하나만 찍으려면 `complex_key`로 묶어서 처리하세요.

핀 라벨은 `display_name`을 씁니다. 원천에 이름이 없는 단지는 도로명주소 → 지번주소 → 단지 키 순으로 대체해 채우므로 빈 라벨이 없습니다. 이 상품은 원천 단지명(`complex_name`)을 싣지 않으니, 그 값이 필요하면 단지 상세 API에서 가져옵니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.
- Do not treat `has_next=true` as a next-page signal for map markers. Use a smaller bbox instead.

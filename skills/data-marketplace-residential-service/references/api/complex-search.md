<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 검색

단지명을 입력해 후보 단지를 찾고 다음 호출에 사용할 complex_key를 확보합니다.

## Base URL

Provided with Data Marketplace onboarding — inject the host via the `DATA_MARKETPLACE_BASE_URL` environment variable; do not hardcode it.

## Endpoint

```http
POST /api/v1/data-products/residential/complex-search/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_name`을 전달합니다.

Supported filters:

- `filters.complex_name`

Optional:

- `fields`: string array of response field names.
- `limit`: maximum row count. Keep `limit` in the `1..20` range. Default is `10`.
- `offset`: not supported. Omit it or use `0`.

## Bbox

Not supported.

## Sort

Client-selected sort is not supported for this product.

## Allowed Fields

- `complex_key`
- `complex_name`
- `residential_type`
- `display_address`
- `latitude`
- `longitude`

## Example

```http
POST /api/v1/data-products/residential/complex-search/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_name": "헬리오시티"
  },
  "limit": 10
}
```

## Response Use

검색 응답은 함수 내부의 match_score 기준으로 정렬되지만 match_score 자체는 기본 응답 필드에 포함하지 않습니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

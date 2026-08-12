<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 검색

단지명을 입력해 후보 단지를 찾고 다음 호출에 사용할 complex_key를 확보합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

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
- `offset`: not supported. Do not send it. The response has no `offset` field either, so do not compute a next page from it.

## Bbox

Not supported.

## Sort

Client-selected sort is not supported for this product. 이름 일치도가 높은 순으로, 일치도가 같으면 이름 가나다순으로 돌아옵니다.

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

이름이 비슷한 단지가 많으면 첫 행이 정답이 아닙니다. `헬리오`로 검색하면 헬리오스 세 곳이 헬리오시티보다 먼저 나옵니다. 첫 행을 자동 선택하지 말고, 화면에 `display_address`를 함께 보여주고 사용자가 고르게 하세요.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

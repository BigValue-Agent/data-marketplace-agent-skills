<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 공시가격 상세

단지, 필지, 동, 호 기준 공시가격 상세를 조회합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

## Endpoint

```http
POST /api/v1/data-products/residential/notice-prices/query
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
- `filters.notice_year`

Optional:

- `fields`: string array of response field names.
- `sort`: object with `field` and `order`. Supported fields: `notice_year`, `notice_price`.
- `limit`: maximum row count. Keep `limit` in the `1..100` range. Default is `30`.
- `offset`: pagination offset. Keep `offset` in the `0..2000` range.

## Bbox

Not supported.

## Sort

Default sort: `notice_year desc`.

Allowed sort fields:

- `notice_year`
- `notice_price`

Allowed sort orders:

- `asc`
- `desc`

## Allowed Fields

- `complex_key`
- `residential_type`
- `pnu`
- `ppk`
- `jpk`
- `notice_year`
- `notice_price`
- `dong_name`
- `ho_name`
- `private_area`
- `pyeong_number`
- `pyeong_type_name`

## Example

```http
POST /api/v1/data-products/residential/notice-prices/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551"
  },
  "sort": {
    "field": "notice_year",
    "order": "desc"
  },
  "limit": 30
}
```

## Response Use

공시가격은 정부가 매년 1월 1일 기준으로 발표하는 공식 평가 가격입니다. 실거래가나 산출시세와는 다른 값이므로 같은 축에 놓고 비교하지 마세요.

이 상품은 당해 연도분만 보관합니다. 과거 연도 이력이 없으므로 `notice_year`로 연도별 추이 차트를 만들 수 없습니다. 추이가 필요하면 매년 받은 값을 직접 보관해야 합니다.

평형 라벨이 필요하면 `pyeong_number`와 `pyeong_type_name`을 붙여 만듭니다 — 합본 표기 필드는 제공하지 않습니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

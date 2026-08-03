<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 실거래 내역

단지 또는 필지 기준 매매/전세/월세 실거래 내역을 조회합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

## Endpoint

```http
POST /api/v1/data-products/residential/realdeal/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`, `filters.pnu` 중 하나를 전달합니다.

Supported filters:

- `filters.complex_key`
- `filters.residential_type`
- `filters.pnu`
- `filters.deal_division_name`
- `filters.deal_type_name`
- `filters.date_from`
- `filters.date_to`
- `filters.price_min`
- `filters.price_max`
- `filters.deposit_min`
- `filters.deposit_max`
- `filters.private_area_min`
- `filters.private_area_max`

Optional:

- `fields`: string array of response field names.
- `sort`: object with `field` and `order`. Supported fields: `contract_date`, `price`, `deposit_price`, `private_area`.
- `limit`: maximum row count. Keep `limit` in the `1..100` range. Default is `30`.
- `offset`: pagination offset. Keep `offset` in the `0..2000` range.

## Bbox

Not supported.

## Sort

Default sort: `contract_date desc`.

Allowed sort fields:

- `contract_date`
- `price`
- `deposit_price`
- `private_area`

Allowed sort orders:

- `asc`
- `desc`

## Allowed Fields

- `complex_key`
- `residential_type`
- `deal_division_name`
- `deal_type_name`
- `pnu`
- `complex_name`
- `dong_name`
- `floor_name`
- `private_area`
- `contract_date`
- `registry_date`
- `deposit_price`
- `price`
- `cancel_date`

## Example

```http
POST /api/v1/data-products/residential/realdeal/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551"
  },
  "sort": {
    "field": "contract_date",
    "order": "desc"
  },
  "limit": 30
}
```

## Response Use

거래 구분, 거래 방식, 계약일, 등기일, 가격, 보증금, 면적을 반환합니다.

이 상품은 최근 36개월 계약분을 보관하며 매달 창이 한 달씩 이동합니다. `date_from`·`date_to`를 그 밖으로 잡으면 빈 결과가 나옵니다.

`dong_name`과 `registry_date`는 매매 거래에만 들어옵니다. 전세·월세에는 값이 없으니 전월세 목록에 동 이름 칼럼을 만들지 마세요. `deal_type_name`도 매매에만 채워집니다.

`cancel_date`가 채워진 행은 취소된 거래입니다. 통계에는 이 값이 null인 행만 쓰고, 취소는 매매 거래에만 나타납니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

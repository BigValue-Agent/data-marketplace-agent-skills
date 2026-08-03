<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 프로필

검색 또는 마커에서 얻은 complex_key로 단지 프로필과 요약 정보를 조회합니다. 법정동 코드로 지역 안의 단지 목록과 랭킹을 조회할 때도 사용합니다.

## Base URL

API server:

```text
https://datamarket-api.bigvalue.ai
```

## Endpoint

```http
POST /api/v1/data-products/residential/complexes/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`, `filters.legaldong_code`, `filters.legaldong_code_prefix` 중 하나를 전달합니다.

Supported filters:

- `filters.complex_key` — exact match on a single complex.
- `filters.legaldong_code` — exact match on the 10-digit legal dong code. Returns every complex in that legal dong.
- `filters.legaldong_code_prefix` — prefix match. Use 5 digits for a sigungu, 2 digits for a sido.
- `filters.residential_type` — one of `아파트`, `오피스텔`, `연립다세대`. Narrows a region query.

Optional:

- `fields`: string array of response field names.
- `limit`: maximum row count. Keep `limit` in the `1..100` range. Default is `20`.
- `offset`: supported. Keep it in the `0..2000` range.

## Bbox

Not supported. Use `filters.legaldong_code_prefix` for area queries.

## Sort

Supported. Allowed sort fields:

- `complex_household_count`
- `complex_age_number`
- `nearby_subway_station_distance`
- `recent_month6_average_realdeal_price`

```json
{
  "sort": {
    "field": "complex_household_count",
    "order": "desc"
  }
}
```

Descending sort places NULL values last. `recent_month6_average_realdeal_price` is NULL for complexes with no recent trade, so a price ranking returns traded complexes first.

## Allowed Fields

- `complex_key`
- `standard_ym`
- `complex_name`
- `residential_type`
- `pnu`
- `land_area`
- `land_purpose_name`
- `purpose_region_division_1_name`
- `land_use_situation_detail_name`
- `land_recent_notice_year`
- `land_recent_notice_price`
- `representative_title_structure_name`
- `representative_title_purpose_name`
- `representative_title_etc_purpose_name`
- `sum_title_building_area`
- `sum_title_total_floor_area`
- `legaldong_code`
- `land_number_address`
- `road_name_address`
- `latitude`
- `longitude`
- `complex_household_count`
- `complex_ho_count`
- `complex_dong_count`
- `use_approval_date`
- `complex_age_number`
- `max_ground_floor_count`
- `max_underground_floor_count`
- `complex_parking_count`
- `floorarea_rate`
- `buildingcoverage_rate`
- `heating_division_name`
- `nearby_subway_station_name`
- `nearby_subway_station_distance`
- `assignment_elementary_school_name`
- `assignment_middle_school_name`
- `assignment_high_school_name`
- `recent_month6_realdeal_count`
- `recent_month6_min_realdeal_price`
- `recent_month6_average_realdeal_price`
- `recent_month6_max_realdeal_price`
- `constructor_name`
- `developer_name`
- `nearby_hospital_distance`
- `nearby_park_distance`
- `nearby_large_store_count`

## Example

```http
POST /api/v1/data-products/residential/complexes/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "complex_key": "00533551"
  },
  "limit": 1
}
```

Region ranking:

```http
POST /api/v1/data-products/residential/complexes/query
X-API-KEY: {API_KEY}
Content-Type: application/json

{
  "filters": {
    "legaldong_code_prefix": "11680",
    "residential_type": "아파트"
  },
  "sort": {
    "field": "complex_household_count",
    "order": "desc"
  },
  "limit": 20
}
```

## Response Use

단지 기본정보, 대표 토지, 표제부 요약, 입지 요약, 최근 6개월 실거래 요약 필드를 반환합니다.

토지·표제부 보강분의 기준월은 상품 전체 기준월(`standard_ym`)과 같습니다. 별도 기준월 필드는 제공하지 않습니다.

`assignment_middle_school_name`과 `assignment_high_school_name`은 배정 학교가 여럿이면 쉼표로 이어 한 문자열로 옵니다. 한 곳이라고 가정하지 마세요.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

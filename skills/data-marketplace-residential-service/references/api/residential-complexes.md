<!-- Bundled snapshot generated from frontend/apps/app/public/reference/ai — edit the origin, not this copy. -->

# 주거형 단지 프로필

검색 또는 마커에서 얻은 complex_key로 단지 프로필과 요약 정보를 조회합니다.

## Base URL

Provided with Data Marketplace onboarding — inject the host via the `DATA_MARKETPLACE_BASE_URL` environment variable; do not hardcode it.

## Endpoint

```http
POST /api/v1/data-products/residential/complexes/query
X-API-KEY: {API_KEY}
```

Send the request as a JSON Body. Do not send filters as URL query parameters.

## JSON Body

Required search condition: `filters.complex_key`을 전달합니다.

Supported filters:

- `filters.complex_key`

Optional:

- `fields`: string array of response field names.
- `limit`: maximum row count. Keep `limit` in the `1..10` range. Default is `1`.
- `offset`: not supported. Omit it or use `0`.

## Bbox

Not supported.

## Sort

Client-selected sort is not supported for this product.

## Allowed Fields

- `complex_key`
- `standard_ym`
- `complex_name`
- `residential_type`
- `pnu`
- `land_standard_ym`
- `land_area`
- `land_purpose_name`
- `purpose_region_division_1_name`
- `land_use_situation_detail_name`
- `land_recent_notice_year`
- `land_recent_notice_price`
- `title_part_standard_ym`
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

## Response Use

단지 기본정보, 대표 토지, 표제부 요약, 입지 요약, 최근 6개월 실거래 요약 필드를 반환합니다.

Carry forward string identifiers as strings. Do not cast `complex_key`, `pnu`, `ppk`, or `jpk` to numbers when they appear.

## Common Mistakes

- Do not send filters as URL query parameters.
- Do not request fields outside the Allowed Fields list.
- Do not use deprecated product paths from older documents.

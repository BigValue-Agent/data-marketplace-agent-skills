# 주거 지도 — 참조 템플릿 (map-service)

빅밸류 데이터 마켓플레이스 **주거형 데이터 상품 9종**만으로 만든 단지 중심 시세 지도 서비스의
참조 구현. 시그니처인 **가격 수준계**(실거래·산출시세·공시가격 3층 비교 게이지)와
**주변 단지 시세 비교**(동일 전용면적대 정밀 비교)를 포함한다.

> 이 코드는 그대로 배포하는 완성품이 아니라 **각색용 참조 구현**이다.
> 아래 "각색 규칙"을 지키는 범위에서 요청받은 스택/브랜드에 맞게 바꿔 쓴다.

## 실행

```bash
DATA_MARKETPLACE_API_KEY=발급받은키 DATA_MARKETPLACE_BASE_URL=발급받은주소 node server/proxy.mjs
# 브라우저에서 http://localhost:3000 접속
# DATA_MARKETPLACE_BASE_URL은 온보딩 시 안내받은 업스트림 주소를 지정한다 (미설정 시 기동 실패).
```

격리망이나 샌드박스에서 `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`가 설정돼 있으면
`server/proxy.mjs`가 이를 존중해 업스트림을 호출한다. Node 전역 `fetch`가 proxy env를
자동으로 따르지 않는 환경에서도 live smoke가 가능하도록 의존성 없이 처리한다.

`js/config.js`의 `KAKAO_MAP_KEY`를 발급 키로 교체해야 지도가 뜬다
(https://developers.kakao.com — 사용할 도메인 등록 필요).

## 각색 규칙 (must-adapt)

1. **템플릿 기반 시작, 차이만 각색** — 스택이 같으면(바닐라 JS + Node 프록시) 파일을
   거의 그대로 쓰고 키/브랜딩/중심좌표만 교체한다. 재구현하지 않는다.
   요청 스택(React/Next 등)이 다를 때만 구조를 옮기되 화면 문법
   (마커 3-info, 가격 수준계, 평형→동→호 드릴다운, span 가드)은 유지한다.
   스택상 불가피하지 않다면 `data-policy/async-policy/api/map/panel-price/panel-units/panel/chart/format/proxy` 모듈 경계를 유지하고,
   한 개의 거대 스크립트로 합치지 않는다.
   `price-level-gauge`와 `nearby-comparison-panel`은 시그니처 컴포넌트라 탭/표만으로 대체하지 않는다.
   다른 프레임워크로 옮겨도 `data-policy`의 가격 범위·응답 기준월·표시값·경계 판정 결과를 보존한다.
   API 원본 행을 삭제·변형하는 일과 화면 표시·파생계산 적격값을 고르는 일을 구분한다.
2. **보안 경계 유지** — 브라우저가 Data Marketplace를 직접 호출하는 코드를 만들지 않는다.
   `X-API-KEY`는 프록시(서버) 환경변수로만 다룬다.
3. **placeholder 키 교체** — `YOUR_KAKAO_MAP_KEY`를 실키로 하드코딩해 커밋하지 말고
   환경변수/설정 주입으로 처리한다.
4. **프록시 allowlist 유지** — `server/proxy.mjs`는 계약 route ↔ 상품 slug 1:1 매핑만
   전달한다. `/api/:slug` 직통 전달로 바꾸면 오픈 프록시가 된다.
5. **데모 값 교체** — 초기 좌표(서울 송파)·브랜드(`APP_NAME`)는 데모용 기본값이다.
6. **캐시 정책** — 원본은 검색은 no-cache, 뷰포트 마커는 60초 TTL
   (`MARKER_CACHE_TTL_MS` — 유형 필터 왕복 등 동일 뷰 중복 조회 방지,
   0이면 캐시 없음), 단지 단위 데이터는 세션 캐시로 분화돼 있다. 가격 신선도가
   중요한 서비스는 TTL 또는 수동 갱신으로 조정한다.
7. **호출량** — 주변 단지 비교는 패널을 열 때 1+6콜을 자동 실행한다. 요청량을 줄여야
   하는 서비스는 섹션 진입 시 로드(lazy)로 전환할 수 있다.
8. **OSM 전환(키리스)** — 카카오 키가 없거나 OSM을 선택한 경우 `js/map.js`의 카카오
   어댑터만 Leaflet+OSM 타일로 교체하고 컨트롤러 인터페이스(도 단위 span 가드·중심
   클램프·마커 풀·밀도 티어)는 유지한다. 공용 OSM 타일은 데모 전용 — 실서비스는
   상용/자체 타일 서버를 쓴다.
9. **Naver 전환** — 네이버를 선택한 경우 `js/map.js`의 카카오 어댑터만 Naver Maps
   JS v3로 교체하고 같은 컨트롤러 인터페이스와 `getBounds()` span 가드를 유지한다.
   NCP는 Client ID(`X-NCP-APIGW-API-KEY-ID`)와 Client Secret(`X-NCP-APIGW-API-KEY`)을
   함께 발급하지만 브라우저 Dynamic Map JS에는 Client ID만 `ncpKeyId`로 넣는다.
   Client Secret은 서버 REST API 전용이며 브라우저 config에 넣지 않는다.
   `ncpClientId`는 구형 예제 호환 확인용 후보로만 둔다. 카카오는 level이 작을수록
   확대되고 네이버는 zoom이 클수록 확대되므로 이 차이는 `INITIAL_ZOOM`과 밀도 티어
   임계값에만 반영하고, 마커 호출 여부는 계속 bbox span으로 판단한다. 인증 실패는
   `navermap_authFailure`, Dynamic Map 활성화, Web 서비스 URL 등록을 확인한다.

## 기능 ↔ route ↔ 데이터 상품 매핑

| 화면 기능 | 프록시 route | 상품 slug |
|---|---|---|
| 검색 자동완성 | `/api/complex-search` | `complex-search` |
| 지도 가격 마커 (bbox) | `/api/markers` | `complex-type-markers` |
| 단지 프로필·배지·입지·개요 | `/api/complex-detail` | `complexes` |
| 단지 경계 폴리곤 | `/api/complex-shape` | `complex-shapes` |
| 평형 카드·동 그리드·동 라벨 | `/api/buildings` | `buildings` (units_summary 집계) |
| 호실 목록 | `/api/units` | `units` |
| 실거래 차트·테이블·게이지 레인 | `/api/prices?tab=realdeal` | `realdeal` |
| 공시가격 레인·호별 이력 | `/api/prices?tab=notice` | `notice-prices` |
| 산출시세 레인·호별 이력 | `/api/prices?tab=estimated` | `estimated-prices` |

## 줌 전략 (마커 상품 bbox 0.1° 제한 대응)

- **호출 가드는 span 전용**: `getBounds()` 위도/경도 span이 어느 축이든 0.1°를 넘으면
  마커를 호출하지 않고 "확대하면 표시" 안내를 띄운다. 줌 레벨로 호출 여부를 판단하지 않는다
  (SDK마다 레벨 체계가 달라 이식 시 깨진다).
- **줌 레벨은 표시 밀도 전용**: ≤4 풀 핀(단지명+가격+평형) / 5–6 컴팩트 핀 / 그 외 도트,
  과밀 시 가격 보유→세대수 순 상한 컷. 선택 단지 동 라벨은 레벨 ≤3.
- `has_next=true`(중심거리순 상위로 잘림) 응답 시 다음 페이지를 요청하지 않고
  "지도 중심 주변 단지만 표시 중 — 확대하면 전체가 보여요" pill로 확대를 유도한다.
- 마커 요청 body에는 `offset`을 넣지 않는다. 마커 상품은 중심거리순 상위 결과와
  `has_next` 신호를 반환하며 offset pagination 대상이 아니다.
- 서버 프록시도 `/api/markers` body에 top-level `offset`이 들어오면 `400`으로 거부해
  클라이언트 우회 호출이 상품 계약을 깨지 못하게 한다.

## 구조

```
index.html        골격, 검색 카드, 패널/시트 마운트, testid 훅
css/app.css       디자인 토큰(딥그린·시스템 폰트), 마커·게이지·패널 스타일
js/config.js      APP_NAME, placeholder 키, 초기 좌표, span/밀도 상수
js/data-policy.js 가격 범위·최신 스냅샷·표시 수치·GeoJSON 경계를 판정하는 순수 정책
js/async-policy.js 역순으로 완료된 목록·차트 요청에서 최신 응답만 적용하는 순수 정책
js/format.js      억/만 가격, 날짜, 평/㎡ 포맷
js/api.js         계약 route 래퍼(프록시 경유), 세션 캐시, 페이지 수집기, 시세 밴드 집계
js/chart.js       캔버스 실거래 차트 (금액축 산점+월평균 라인 · 거래량 바 분리)
js/map.js         SDK 로드, 마커 풀 diff 렌더, span 가드, 폴리곤, 동 라벨
js/panel-price.js 가격 수준계·실거래·차트·주변 비교
js/panel-units.js 평형 선택·동 목록·호실 시트·호별 가격
js/panel.js       패널 상태·셸·모듈 연결·입지·단지 개요
js/app.js         브랜드 주입, 검색 자동완성, 필터, 도구, 부트스트랩
server/proxy.mjs  키 보관 + 계약 route allowlist 프록시 + proxy env 대응 + 정적 서빙 (의존성 없음)
```

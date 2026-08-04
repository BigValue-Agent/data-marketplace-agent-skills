// 앱 환경 설정 — 실키를 절대 넣지 않는다. Data Marketplace 키는 server/proxy.mjs가
// 환경변수(DATA_MARKETPLACE_API_KEY)로만 다루고, 브라우저는 프록시 route만 호출한다.
window.APP_CONFIG = {
  // 서비스 이름 — 각색 시 브랜드로 교체
  APP_NAME: "주거 지도",
  APP_TAGLINE: "단지 정보와 가격 흐름을 한눈에",

  // 지도 키 — 지금 로드한 어댑터(index.html)가 쓰는 것만 채우면 된다.
  // 카카오맵 JavaScript 키 (https://developers.kakao.com 에서 발급, 도메인 등록 필요)
  KAKAO_MAP_KEY: "YOUR_KAKAO_MAP_KEY",
  // 네이버 지도 Client ID (NCP에서 발급). NCP는 Client Secret도 함께 주지만 브라우저에는
  // Client ID만 넣는다 — Secret은 서버 REST 전용이라 이 파일에 두지 않는다.
  NAVER_MAP_CLIENT_ID: "YOUR_NCP_CLIENT_ID",
  // 오픈소스 맵(OSM)은 키가 없다.

  // 프록시 origin. 프록시(server/proxy.mjs)가 정적 파일도 함께 서빙하므로
  // 기본은 같은 origin("") — 프록시를 분리 배포하면 "http://localhost:3000" 형태로 교체.
  PROXY_BASE: "",

  // 지도 초기 위치: 서울 송파 (데모용 — 서비스 지역에 맞게 교체)
  // 초기 확대 정도는 지도마다 체계가 달라 아래 줌 블록에 둔다.
  INITIAL_CENTER: { lat: 37.4976, lng: 127.1072 },

  // 마커 상품 bbox 제한: 위도/경도 각각 최대 0.1도.
  // ⚠ 마커 "호출 여부" 가드는 반드시 이 span 기준 — 줌 레벨로 판단하지 않는다 (map.js 참고).
  BBOX_MAX_DEG: 0.1,
  MARKER_LIMIT: 500,
  // 같은 뷰(동일 bbox+유형) 마커 재조회 억제 시간 — 유형 필터 왕복 등으로 같은 요청이
  // 반복되지 않게 한다. 0이면 캐시 없음.
  MARKER_CACHE_TTL_MS: 60_000,

  // ── 줌 값은 지도마다 체계가 달라 어댑터별로 따로 둔다 ──────────────────
  // 읽는 것도 비교하는 것도 어댑터뿐이다. 컨트롤러와 화면 코드는 "full/compact/dot"
  // 같은 티어 이름만 받으므로, 아래 숫자가 화면 코드로 새어 나가면 그것이 버그다.
  // 표시 밀도 튜닝 전용이며 마커 호출 가드는 어느 지도에서도 BBOX_MAX_DEG로 판단한다.

  // 카카오: level이 작을수록 확대 (어댑터가 `<=`로 비교)
  INITIAL_LEVEL: 5,
  FULL_PIN_LEVEL: 4,
  COMPACT_PIN_LEVEL: 6,
  DONG_LABEL_LEVEL: 3,

  // 네이버: zoom이 클수록 확대 (어댑터가 `>=`로 비교) — 카카오와 부등호가 반대다
  NAVER_ZOOM: { INITIAL: 15, FULL_PIN: 16, COMPACT_PIN: 14, DONG_LABEL: 17 },

  // 오픈소스 맵(Leaflet): 네이버와 같은 방향
  OSM_ZOOM: { INITIAL: 15, FULL_PIN: 16, COMPACT_PIN: 14, DONG_LABEL: 17 },
};

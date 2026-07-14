// 앱 환경 설정 — 실키를 절대 넣지 않는다. Data Marketplace 키는 server/proxy.mjs가
// 환경변수(DATA_MARKETPLACE_API_KEY)로만 다루고, 브라우저는 프록시 route만 호출한다.
window.APP_CONFIG = {
  // 서비스 이름 — 각색 시 브랜드로 교체
  APP_NAME: "주거 지도",
  APP_TAGLINE: "단지 정보와 가격 흐름을 한눈에",

  // 카카오맵 JavaScript 키 (https://developers.kakao.com 에서 발급, 도메인 등록 필요)
  KAKAO_MAP_KEY: "YOUR_KAKAO_MAP_KEY",

  // 프록시 origin. 프록시(server/proxy.mjs)가 정적 파일도 함께 서빙하므로
  // 기본은 같은 origin("") — 프록시를 분리 배포하면 "http://localhost:3000" 형태로 교체.
  PROXY_BASE: "",

  // 지도 초기 위치: 서울 송파 (데모용 — 서비스 지역에 맞게 교체)
  INITIAL_CENTER: { lat: 37.4976, lng: 127.1072 },
  INITIAL_LEVEL: 5,

  // 마커 상품 bbox 제한: 위도/경도 각각 최대 0.1도.
  // ⚠ 마커 "호출 여부" 가드는 반드시 이 span 기준 — 줌 레벨로 판단하지 않는다 (map.js 참고).
  BBOX_MAX_DEG: 0.1,
  MARKER_LIMIT: 500,
  // 같은 뷰(동일 bbox+유형) 마커 재조회 억제 시간 — 유형 필터 왕복 등으로 같은 요청이
  // 반복되지 않게 한다. 0이면 캐시 없음.
  MARKER_CACHE_TTL_MS: 60_000,

  // 아래 레벨 값들은 "표시 밀도" 튜닝 전용 (호출 가드 아님):
  // 이 레벨 이하(확대)면 풀 핀(단지명+단지 평균), 그 위는 컴팩트 핀, 그 위는 도트
  FULL_PIN_LEVEL: 4,
  COMPACT_PIN_LEVEL: 6,
  // 이 레벨 이하(확대)면 선택 단지의 동 라벨 표시
  DONG_LABEL_LEVEL: 3,
};

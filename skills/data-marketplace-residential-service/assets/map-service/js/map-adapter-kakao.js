// 카카오맵 어댑터 — 지도 SDK를 아는 유일한 파일이다.
//
// map.js(컨트롤러)는 이 계약만 부르고 SDK 이름·좌표 객체·줌 숫자를 전혀 모른다.
// 지도를 바꾸려면 이 파일 대신 map-adapter-naver.js 또는 map-adapter-osm.js를
// index.html에서 로드한다 — 컨트롤러와 나머지 화면 코드는 손대지 않는다.
//
// ⚠ 줌 방향은 SDK마다 반대다(카카오 level은 작을수록 확대, 네이버·OSM zoom은 클수록
// 확대). 그 차이를 이 파일 안에서 끝내는 것이 이 계약의 존재 이유다. 바깥에는 방향이
// 없는 이름(zoomIn/zoomOut/focusOn)과 의미 티어("full"/"compact"/"dot")만 나간다.
window.mapAdapter = (() => {
  const C = window.APP_CONFIG;

  let map = null;
  let skyview = false;

  function load() {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${C.KAKAO_MAP_KEY}&autoload=false`;
      s.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"));
      s.onload = () => {
        if (!window.kakao || !window.kakao.maps) return reject(new Error("kakao 객체 없음"));
        window.kakao.maps.load(() => resolve());
      };
      document.head.appendChild(s);
    });
  }

  function create(el) {
    const { kakao } = window;
    map = new kakao.maps.Map(el, {
      center: new kakao.maps.LatLng(C.INITIAL_CENTER.lat, C.INITIAL_CENTER.lng),
      level: C.INITIAL_LEVEL,
    });
  }

  function onIdle(cb) {
    window.kakao.maps.event.addListener(map, "idle", cb);
  }

  // 뷰포트 경계 — 컨트롤러의 span 가드와 bbox 클램프가 쓴다. 도 단위 숫자만 넘긴다.
  function getBoundsRect() {
    const b = map.getBounds();
    const sw = b.getSouthWest(), ne = b.getNorthEast();
    return { minLat: sw.getLat(), maxLat: ne.getLat(), minLng: sw.getLng(), maxLng: ne.getLng() };
  }

  function getCenter() {
    const c = map.getCenter();
    return { lat: c.getLat(), lng: c.getLng() };
  }

  // 표시 밀도 — 카카오 level은 작을수록 확대라 `<=`로 비교한다.
  function getDensityTier() {
    const lv = map.getLevel();
    if (lv <= C.FULL_PIN_LEVEL) return "full";
    if (lv <= C.COMPACT_PIN_LEVEL) return "compact";
    return "dot";
  }

  function isDongLabelVisible() {
    return map.getLevel() <= C.DONG_LABEL_LEVEL;
  }

  // 방향 있는 연산 — 여기서만 부호를 안다.
  function zoomIn() { map.setLevel(map.getLevel() - 1); }
  function zoomOut() { map.setLevel(map.getLevel() + 1); }

  // 티어별 최소 확대 보장. 카카오는 값이 작을수록 확대이므로 Math.min을 쓴다.
  const TIER_LEVEL = { complex: () => C.FULL_PIN_LEVEL, dong: () => C.DONG_LABEL_LEVEL };
  function focusOn(lat, lng, tier = null) {
    const { kakao } = window;
    if (tier && TIER_LEVEL[tier]) {
      const target = Math.min(map.getLevel(), TIER_LEVEL[tier]());
      if (map.getLevel() !== target) map.setLevel(target);
    }
    map.panTo(new kakao.maps.LatLng(lat, lng));
  }

  // HTML 마커. 반환 핸들은 컨트롤러가 마커 풀을 관리할 때 쓴다.
  function addOverlay({ lat, lng, el, yAnchor = 1, zIndex = 0, clickable = false }) {
    const { kakao } = window;
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(lat, lng),
      content: el, yAnchor, zIndex, clickable,
    });
    overlay.setMap(map);
    return {
      remove: () => overlay.setMap(null),
      setZIndex: (z) => overlay.setZIndex(z),
    };
  }

  // rings: GeoJSON 외곽선 배열([[lng, lat], ...][]) — 좌표 순서는 컨트롤러가 유지한다.
  function addPolygon(rings, style) {
    const { kakao } = window;
    const paths = rings.map((ring) => ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng)));
    const polygon = new kakao.maps.Polygon({ path: paths, ...style });
    polygon.setMap(map);
    return { remove: () => polygon.setMap(null) };
  }

  function setSatellite(on) {
    const { kakao } = window;
    skyview = on;
    map.setMapTypeId(skyview ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP);
    return skyview;
  }

  return {
    id: "kakao",
    supportsSatellite: true,
    load, create, onIdle,
    getBoundsRect, getCenter, getDensityTier, isDongLabelVisible,
    zoomIn, zoomOut, focusOn,
    addOverlay, addPolygon, setSatellite,
  };
})();

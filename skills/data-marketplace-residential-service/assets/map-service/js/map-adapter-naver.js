// 네이버 지도 어댑터 — map-adapter-kakao.js와 같은 계약을 구현한다.
// index.html에서 이 파일 하나만 로드하면 지도가 네이버로 바뀐다. 컨트롤러(map.js)와
// 화면 코드는 손대지 않는다.
//
// ⚠ 줌 방향이 카카오와 반대다. 네이버 zoom은 클수록 확대라, 티어 비교가 `>=`이고
// 최소 확대 보장이 Math.max다. 이 파일 밖으로 그 사실이 나가지 않게 한다.
//
// 키: NCP는 Client ID와 Client Secret을 함께 발급하지만 브라우저에는 Client ID만
// `ncpKeyId`로 넣는다. Client Secret은 서버 REST 전용이라 config에 두지 않는다.
window.mapAdapter = (() => {
  const C = window.APP_CONFIG;
  const Z = C.NAVER_ZOOM;

  let map = null;
  let skyview = false;

  function load() {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${C.NAVER_MAP_CLIENT_ID}`;
      s.onerror = () => reject(new Error("네이버 지도 SDK 로드 실패"));
      s.onload = () => {
        if (!window.naver || !window.naver.maps) return reject(new Error("naver 객체 없음"));
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  function create(el) {
    const { naver } = window;
    map = new naver.maps.Map(el, {
      center: new naver.maps.LatLng(C.INITIAL_CENTER.lat, C.INITIAL_CENTER.lng),
      zoom: Z.INITIAL,
    });
  }

  function onIdle(cb) {
    window.naver.maps.Event.addListener(map, "idle", cb);
  }

  function getBoundsRect() {
    const b = map.getBounds();
    const sw = b.getSW(), ne = b.getNE();
    return { minLat: sw.lat(), maxLat: ne.lat(), minLng: sw.lng(), maxLng: ne.lng() };
  }

  function getCenter() {
    const c = map.getCenter();
    return { lat: c.lat(), lng: c.lng() };
  }

  // 네이버 zoom은 클수록 확대 — 카카오와 부등호 방향이 반대다.
  function getDensityTier() {
    const z = map.getZoom();
    if (z >= Z.FULL_PIN) return "full";
    if (z >= Z.COMPACT_PIN) return "compact";
    return "dot";
  }

  function isDongLabelVisible() {
    return map.getZoom() >= Z.DONG_LABEL;
  }

  function zoomIn() { map.setZoom(map.getZoom() + 1); }
  function zoomOut() { map.setZoom(map.getZoom() - 1); }

  // 최소 확대 보장 — 값이 클수록 확대이므로 Math.max를 쓴다(카카오는 Math.min).
  const TIER_ZOOM = { complex: () => Z.FULL_PIN, dong: () => Z.DONG_LABEL };
  function focusOn(lat, lng, tier = null) {
    const { naver } = window;
    if (tier && TIER_ZOOM[tier]) {
      const target = Math.max(map.getZoom(), TIER_ZOOM[tier]());
      if (map.getZoom() !== target) map.setZoom(target);
    }
    map.panTo(new naver.maps.LatLng(lat, lng));
  }

  // HTML 마커 — 네이버는 Marker의 icon.content로 임의 HTML을 붙인다.
  // yAnchor(0~1, 아래가 1)를 네이버 anchor 픽셀로 옮기려면 요소 크기가 필요하므로
  // 렌더 후 measure한다. 크기를 못 재면 하단 중앙(카카오 기본)으로 둔다.
  function addOverlay({ lat, lng, el, yAnchor = 1, zIndex = 0, clickable = false }) {
    const { naver } = window;
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(lat, lng),
      map,
      zIndex,
      clickable,
      icon: { content: el, anchor: new naver.maps.Point(0, 0) },
    });
    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    if (w || h) marker.setIcon({ content: el, anchor: new naver.maps.Point(w / 2, h * yAnchor) });
    return {
      remove: () => marker.setMap(null),
      setZIndex: (z) => marker.setZIndex(z),
    };
  }

  function addPolygon(rings, style) {
    const { naver } = window;
    const paths = rings.map((ring) => ring.map(([lng, lat]) => new naver.maps.LatLng(lat, lng)));
    const polygon = new naver.maps.Polygon({
      map,
      paths,
      strokeWeight: style.strokeWeight,
      strokeColor: style.strokeColor,
      strokeOpacity: style.strokeOpacity,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      zIndex: style.zIndex,
    });
    return { remove: () => polygon.setMap(null) };
  }

  function setSatellite(on) {
    const { naver } = window;
    skyview = on;
    map.setMapTypeId(skyview ? naver.maps.MapTypeId.HYBRID : naver.maps.MapTypeId.NORMAL);
    return skyview;
  }

  return {
    id: "naver",
    supportsSatellite: true,
    load, create, onIdle,
    getBoundsRect, getCenter, getDensityTier, isDongLabelVisible,
    zoomIn, zoomOut, focusOn,
    addOverlay, addPolygon, setSatellite,
  };
})();

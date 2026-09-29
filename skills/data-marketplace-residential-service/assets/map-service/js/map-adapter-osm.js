// 오픈소스 맵(Leaflet + OSM 타일) 어댑터 — 같은 계약을 구현한다.
// 지도 키가 없어 발급 절차 없이 바로 뜬다. index.html에서 이 파일만 로드하면 된다.
//
// ⚠ 줌 방향은 네이버와 같다 — zoom이 클수록 확대라 티어 비교가 `>=`, 최소 확대 보장이 Math.max다.
//
// 한계 둘을 분명히 밝힌다.
//  1. 위성 지도가 없다. 공용 OSM 타일은 일반 지도만 제공하므로 supportsSatellite가 false이고
//     컨트롤러가 위성 버튼을 감춘다. 위성이 필요하면 별도 타일 공급자를 붙여야 한다.
//  2. 공용 타일 서버(tile.openstreetmap.org)는 데모 전용이다. 실서비스는 사용 정책상
//     상용 타일이나 자체 타일 서버로 바꿔야 한다.
window.mapAdapter = (() => {
  const C = window.APP_CONFIG;
  const Z = C.OSM_ZOOM;

  let map = null;

  function load() {
    return new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);

      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onerror = () => reject(new Error("Leaflet 로드 실패"));
      s.onload = () => {
        if (!window.L) return reject(new Error("L 객체 없음"));
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  function create(el) {
    const { L } = window;
    map = L.map(el, { zoomControl: false, attributionControl: true })
      .setView([C.INITIAL_CENTER.lat, C.INITIAL_CENTER.lng], Z.INITIAL);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
  }

  // Leaflet은 이동·줌이 끝나면 moveend를 낸다 — 카카오·네이버의 idle과 같은 자리다.
  function onIdle(cb) {
    map.on("moveend", cb);
  }

  function getBoundsRect() {
    const b = map.getBounds();
    return {
      minLat: b.getSouth(), maxLat: b.getNorth(),
      minLng: b.getWest(), maxLng: b.getEast(),
    };
  }

  function getCenter() {
    const c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }

  function getDensityTier() {
    const z = map.getZoom();
    if (z >= Z.FULL_PIN) return "full";
    if (z >= Z.COMPACT_PIN) return "compact";
    return "dot";
  }

  function zoomIn() { map.setZoom(map.getZoom() + 1); }
  function zoomOut() { map.setZoom(map.getZoom() - 1); }

  const TIER_ZOOM = { complex: () => Z.FULL_PIN };
  function focusOn(lat, lng, tier = null) {
    if (tier && TIER_ZOOM[tier]) {
      const target = Math.max(map.getZoom(), TIER_ZOOM[tier]());
      map.setView([lat, lng], target);
      return;
    }
    map.panTo([lat, lng]);
  }

  function fitBounds({ minLat, maxLat, minLng, maxLng }) {
    map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [24, 24] });
  }

  // HTML 마커 — Leaflet은 divIcon으로 임의 HTML을 넣는다. 크기를 지정하지 않으면
  // 내용에 맞춰 잡히고, iconAnchor로 yAnchor(아래가 1)를 픽셀로 옮긴다.
  function addOverlay({ lat, lng, el, yAnchor = 1, zIndex = 0, clickable = false }) {
    const { L } = window;
    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    const icon = L.divIcon({
      html: el,
      className: "",
      iconSize: w && h ? [w, h] : null,
      iconAnchor: w && h ? [w / 2, h * yAnchor] : null,
    });
    const marker = L.marker([lat, lng], {
      icon,
      zIndexOffset: zIndex,
      interactive: clickable,
      keyboard: false,
    }).addTo(map);
    return {
      remove: () => marker.remove(),
      setZIndex: (z) => marker.setZIndexOffset(z),
    };
  }

  function addPolygon(rings, style) {
    const { L } = window;
    const paths = rings.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
    const polygon = L.polygon(paths, {
      weight: style.strokeWeight,
      color: style.strokeColor,
      opacity: style.strokeOpacity,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
    }).addTo(map);
    return { remove: () => polygon.remove() };
  }

  // 공용 OSM 타일에는 위성 레이어가 없다. 요청을 삼키지 않고 "적용 안 됨"을 돌려준다.
  function setSatellite() {
    return false;
  }

  return {
    id: "osm",
    supportsSatellite: false,
    load, create, onIdle,
    getBoundsRect, getCenter, getDensityTier,
    zoomIn, zoomOut, focusOn, fitBounds,
    addOverlay, addPolygon, setSatellite,
  };
})();

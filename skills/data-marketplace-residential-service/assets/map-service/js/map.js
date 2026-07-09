// 지도 컨트롤러 — 카카오맵 로드, 마커 풀, span 기반 줌 전략, 폴리곤/동 라벨
window.mapCtl = (() => {
  const C = window.APP_CONFIG;
  const F = window.fmt;

  let map = null;
  let handlers = { onMarkerClick: null, onViewChange: null };
  let typeFilter = "아파트"; // '아파트' | '연립다세대' | '전체'
  let selectedKey = null;

  const overlays = new Map(); // complex_key → {overlay, el, row, mode}
  let dongOverlays = [];
  let polygon = null;
  let fetchAbort = null;
  let idleTimer = null;
  let noticeTimer = null;

  // ── SDK 로드 ──────────────────────────────────
  function loadSdk() {
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

  async function init(h) {
    handlers = { ...handlers, ...h };
    await loadSdk();
    const { kakao } = window;
    map = new kakao.maps.Map(document.getElementById("map"), {
      center: new kakao.maps.LatLng(C.INITIAL_CENTER.lat, C.INITIAL_CENTER.lng),
      level: C.INITIAL_LEVEL,
    });
    kakao.maps.event.addListener(map, "idle", () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        refreshMarkers();
        syncDongLabels();
        handlers.onViewChange && handlers.onViewChange();
      }, 220);
    });
    refreshMarkers();
  }

  // ── 줌 전략 ──────────────────────────────────
  // 호출 가드: 뷰포트 span(getBounds) 전용 — 어느 축이든 0.1°(BBOX_MAX_DEG)를 넘으면
  // 마커를 호출하지 않고 줌인 안내를 띄운다 (마커 상품 계약 규칙 · SDK 중립 판정).
  // 줌 레벨은 표시 밀도(풀/컴팩트/도트)와 동 라벨 티어 튜닝에만 쓴다 — 호출 여부 판단 금지.
  function viewportSpan() {
    const b = map.getBounds();
    const sw = b.getSouthWest(), ne = b.getNorthEast();
    return { lat: ne.getLat() - sw.getLat(), lng: ne.getLng() - sw.getLng() };
  }

  function shouldFetchMarkers() {
    const s = viewportSpan();
    return s.lat <= C.BBOX_MAX_DEG && s.lng <= C.BBOX_MAX_DEG;
  }

  // 표시 밀도 (호출 가드 아님): ≤FULL_PIN_LEVEL 풀 핀 / ≤COMPACT_PIN_LEVEL 컴팩트 / 그 외 도트
  function markerDensity() {
    const lv = map.getLevel();
    if (lv <= C.FULL_PIN_LEVEL) return "full";
    if (lv <= C.COMPACT_PIN_LEVEL) return "compact";
    return "dot";
  }

  // bbox 안전 클램프 — span 가드를 통과했어도 부동소수 오차 등으로 0.1°를 넘지 않도록
  // 중심 기준으로 자른다 (마커 상품 계약: 위도/경도 각각 최대 0.1°).
  function currentBbox() {
    const b = map.getBounds();
    const sw = b.getSouthWest(), ne = b.getNorthEast();
    let minLat = sw.getLat(), maxLat = ne.getLat();
    let minLng = sw.getLng(), maxLng = ne.getLng();
    const c = map.getCenter();
    let clamped = false;
    if (maxLat - minLat > C.BBOX_MAX_DEG) {
      minLat = c.getLat() - C.BBOX_MAX_DEG / 2;
      maxLat = c.getLat() + C.BBOX_MAX_DEG / 2;
      clamped = true;
    }
    if (maxLng - minLng > C.BBOX_MAX_DEG) {
      minLng = c.getLng() - C.BBOX_MAX_DEG / 2;
      maxLng = c.getLng() + C.BBOX_MAX_DEG / 2;
      clamped = true;
    }
    return { bbox: { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng }, clamped };
  }

  async function refreshMarkers() {
    if (!map) return;
    if (!shouldFetchMarkers()) {
      clearOverlays();
      notice("지도를 확대하면 단지 시세가 표시됩니다", { sticky: true });
      return;
    }
    const mode = markerDensity();
    const { bbox, clamped } = currentBbox();

    if (fetchAbort) fetchAbort.abort();
    fetchAbort = new AbortController();
    const signal = fetchAbort.signal;

    try {
      let rows = [];
      let truncated = false;
      if (typeFilter === "전체") {
        // 혼합 쿼리는 수가 많은 유형이 limit을 독식해 잘리므로 유형별로 나눠 호출 후 병합
        const results = await Promise.all(
          ["아파트", "오피스텔", "연립다세대"].map((t) => window.api.markers(bbox, t, { signal })));
        rows = dedupeByComplex(results.flatMap((r) => r.rows));
        truncated = results.some((r) => r.truncated);
      } else {
        const r = await window.api.markers(bbox, typeFilter, { signal });
        rows = r.rows; truncated = r.truncated;
      }
      renderMarkers(rows, mode);
      if (truncated) {
        // has_next=true: 응답이 지도 중심거리순 상위로 잘렸다는 뜻 — 다음 페이지는 없다(offset 미지원), 확대 유도
        notice("지도 중심 주변 단지만 표시 중 — 확대하면 전체가 보여요");
      } else if (clamped) {
        notice("넓은 영역은 중심부 단지만 표시해요");
      } else {
        hideNotice();
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error(e);
      notice("단지 정보를 불러오지 못했어요 — 지도를 움직이면 다시 시도해요");
    }
  }

  const TYPE_CLASS = { "연립다세대": "villa", "오피스텔": "officetel" };
  function markerContent(row, mode) {
    const el = document.createElement("div");
    const typeCls = TYPE_CLASS[row.residential_type] || "";
    const name = row.complex_name || row.residential_type || "";
    if (mode === "dot") {
      el.className = `mk-dot${typeCls ? ` ${typeCls}` : ""}`;
      el.title = name;
    } else {
      el.className = `mk${mode === "compact" ? " compact" : ""}${typeCls ? ` ${typeCls}` : ""}`;
      el.dataset.testid = "price-bubble-marker";
      const price = row.recent_month6_average_realdeal_price;
      const priceTxt = price
        ? F.price(price, { compact: true })
        : `${F.count(row.complex_household_count)}세대`;
      const py = row.representative_pyeong_number;
      if (mode === "full") {
        el.innerHTML =
          `<span class="mk-name">${F.esc(name)}</span>` +
          `<span class="mk-price">${priceTxt}${py ? `<small>${py}평</small>` : ""}</span>`;
      } else {
        el.innerHTML = `<span class="mk-price">${priceTxt}${py ? `<small>${py}평</small>` : ""}</span>`;
        el.title = name;
      }
    }
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onMarkerClick && handlers.onMarkerClick(row);
    });
    return el;
  }

  // 줌 모드별 표시 상한 — 과밀하면 지도가 죽는다. 가격 보유 → 세대수 순으로 추린다.
  const MODE_CAP = { full: 260, compact: 130, dot: 500 };
  function prioritize(rows, mode) {
    const cap = MODE_CAP[mode] ?? 500;
    if (mode === "compact") {
      // 넓은 줌에서는 시세 없는 소규모 단지를 걸러 밀도를 낮춘다
      const filtered = rows.filter((r) =>
        r.recent_month6_average_realdeal_price || (r.complex_household_count || 0) >= 300);
      if (filtered.length >= 20) rows = filtered;
    }
    if (rows.length <= cap) return rows;
    return [...rows]
      .sort((a, b) =>
        ((b.recent_month6_average_realdeal_price ? 1 : 0) - (a.recent_month6_average_realdeal_price ? 1 : 0)) ||
        ((b.complex_household_count || 0) - (a.complex_household_count || 0)))
      .slice(0, cap);
  }

  // 오버레이 키는 마커 상품 row grain(complex_key + residential_type)을 따른다 —
  // 유형 필터 전환 시 같은 단지의 다른 유형 row가 stale하게 남지 않도록 한다.
  // 선택 상태 비교는 여전히 row.complex_key 기준.
  function markerKey(row) {
    return `${row.complex_key}::${row.residential_type ?? ""}`;
  }

  // '전체' 병합에서 주상복합(같은 complex_key가 유형별 row로 중복)은 대표 row 1개만 남긴다
  // — 같은 좌표에 동일 내용 버블이 겹쳐 그려지는 것을 방지. 가격 보유 row 우선.
  function dedupeByComplex(rows) {
    const byKey = new Map();
    for (const row of rows) {
      const kept = byKey.get(row.complex_key);
      if (!kept || (!kept.recent_month6_average_realdeal_price && row.recent_month6_average_realdeal_price)) {
        byKey.set(row.complex_key, row);
      }
    }
    return [...byKey.values()];
  }

  function renderMarkers(allRows, mode) {
    const { kakao } = window;
    const rows = prioritize(allRows, mode);
    const seen = new Set();
    for (const row of rows) {
      if (row.latitude == null || row.longitude == null) continue;
      const key = markerKey(row);
      seen.add(key);
      const existing = overlays.get(key);
      if (existing && existing.mode === mode) continue; // 그대로 유지
      if (existing) { existing.overlay.setMap(null); overlays.delete(key); }
      const el = markerContent(row, mode);
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(row.latitude, row.longitude),
        content: el,
        yAnchor: mode === "dot" ? 0.5 : 1,
        zIndex: row.complex_key === selectedKey ? 100 : (row.recent_month6_average_realdeal_price ? 5 : 2),
        clickable: true,
      });
      overlay.setMap(map);
      overlays.set(key, { overlay, el, row, mode });
    }
    // 화면에서 사라진 마커 제거 (선택 단지는 유지)
    for (const [key, o] of overlays) {
      if (!seen.has(key) && o.row.complex_key !== selectedKey) {
        o.overlay.setMap(null);
        overlays.delete(key);
      }
    }
    applySelectionStyle();
  }

  function clearOverlays() {
    for (const [key, o] of overlays) {
      if (o.row.complex_key === selectedKey) continue;
      o.overlay.setMap(null);
      overlays.delete(key);
    }
  }

  function applySelectionStyle() {
    for (const [, o] of overlays) {
      if (!o.el.classList) continue;
      const isSelected = o.row.complex_key === selectedKey;
      o.el.classList.toggle("is-selected", isSelected);
      o.overlay.setZIndex(isSelected ? 100 : (o.row.recent_month6_average_realdeal_price ? 5 : 2));
    }
  }

  // ── 선택/폴리곤/동 라벨 ──────────────────────
  function select(complexKey) {
    selectedKey = complexKey;
    applySelectionStyle();
  }

  function clearSelection() {
    selectedKey = null;
    applySelectionStyle();
    hidePolygon();
    setDongLabels(null);
  }

  function showPolygon(geojson) {
    hidePolygon();
    if (!geojson) return;
    const { kakao } = window;
    const polys = geojson.type === "MultiPolygon" ? geojson.coordinates : [geojson.coordinates];
    const paths = polys.map((rings) => rings[0].map(([lng, lat]) => new kakao.maps.LatLng(lat, lng)));
    polygon = new kakao.maps.Polygon({
      path: paths,
      strokeWeight: 2.5,
      strokeColor: "#0e6b4f",
      strokeOpacity: 0.9,
      fillColor: "#0e6b4f",
      fillOpacity: 0.1,
      zIndex: 1,
    });
    polygon.setMap(map);
  }

  function hidePolygon() {
    if (polygon) { polygon.setMap(null); polygon = null; }
  }

  let dongRows = null;
  function setDongLabels(rows) {
    dongRows = rows;
    syncDongLabels();
  }

  function syncDongLabels() {
    for (const o of dongOverlays) o.setMap(null);
    dongOverlays = [];
    if (!map || !dongRows || map.getLevel() > C.DONG_LABEL_LEVEL) return;
    const { kakao } = window;
    for (const b of dongRows) {
      if (b.latitude == null || b.longitude == null) continue;
      const el = document.createElement("div");
      el.className = "dong-label";
      el.innerHTML = `${F.esc(b.dong_name)}동${b.ground_floor_count ? ` <small>${b.ground_floor_count}층</small>` : ""}`;
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(b.latitude, b.longitude),
        content: el, yAnchor: 0.5, zIndex: 50, clickable: false,
      });
      ov.setMap(map);
      dongOverlays.push(ov);
    }
  }

  // ── 뷰 이동/도구 ─────────────────────────────
  function panTo(lat, lng, level = null) {
    const { kakao } = window;
    if (level != null && map.getLevel() !== level) map.setLevel(level);
    map.panTo(new kakao.maps.LatLng(lat, lng));
  }

  function zoom(delta) { map.setLevel(map.getLevel() + delta); }

  let skyview = false;
  function toggleMapType() {
    const { kakao } = window;
    skyview = !skyview;
    map.setMapTypeId(skyview ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP);
    return skyview;
  }

  // ── 안내 pill ────────────────────────────────
  const noticeEl = document.getElementById("map-notice");
  function notice(msg, { sticky = false } = {}) {
    clearTimeout(noticeTimer);
    noticeEl.textContent = msg;
    noticeEl.hidden = false;
    if (!sticky) noticeTimer = setTimeout(hideNotice, 3500);
  }
  function hideNotice() {
    clearTimeout(noticeTimer);
    noticeEl.hidden = true;
  }

  function setTypeFilter(t) {
    typeFilter = t;
    refreshMarkers();
  }

  return {
    init, refreshMarkers, setTypeFilter,
    select, clearSelection, showPolygon, setDongLabels,
    panTo, zoom, toggleMapType, notice, hideNotice,
    getLevel: () => (map ? map.getLevel() : null),
  };
})();

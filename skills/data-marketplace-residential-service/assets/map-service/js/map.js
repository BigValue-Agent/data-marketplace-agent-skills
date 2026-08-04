// 지도 컨트롤러 — 지도 SDK를 모른다.
// SDK를 아는 것은 window.mapAdapter 하나뿐이고(index.html에서 어댑터 파일 하나를 고른다),
// 이 파일은 그 계약만 부른다. 줌 숫자·좌표 객체·SDK 이름이 여기 등장하면 그것이 버그다.
window.mapCtl = (() => {
  const C = window.APP_CONFIG;
  const F = window.fmt;
  const D = window.dataPolicy;
  const A = window.mapAdapter;

  let ready = false;
  let handlers = { onMarkerClick: null, onViewChange: null };
  let typeFilter = "아파트"; // '아파트' | '연립다세대' | '전체'
  let selectedKey = null;

  const overlays = new Map(); // complex_key → {overlay, el, row, mode}
  let dongOverlays = [];
  let polygon = null;
  let fetchAbort = null;
  let idleTimer = null;
  let noticeTimer = null;

  async function init(h) {
    handlers = { ...handlers, ...h };
    await A.load();
    A.create(document.getElementById("map"));
    ready = true;
    A.onIdle(() => {
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
    const r = A.getBoundsRect();
    return { lat: r.maxLat - r.minLat, lng: r.maxLng - r.minLng };
  }

  function shouldFetchMarkers() {
    const s = viewportSpan();
    return s.lat <= C.BBOX_MAX_DEG && s.lng <= C.BBOX_MAX_DEG;
  }

  // 표시 밀도 (호출 가드 아님): 어댑터가 자기 줌 체계로 판정해 티어 이름만 돌려준다.
  function markerDensity() {
    return A.getDensityTier();
  }

  // bbox 안전 클램프 — span 가드를 통과했어도 부동소수 오차 등으로 0.1°를 넘지 않도록
  // 중심 기준으로 자른다 (마커 상품 계약: 위도/경도 각각 최대 0.1°).
  function currentBbox() {
    const r = A.getBoundsRect();
    let { minLat, maxLat, minLng, maxLng } = r;
    const c = A.getCenter();
    let clamped = false;
    if (maxLat - minLat > C.BBOX_MAX_DEG) {
      minLat = c.lat - C.BBOX_MAX_DEG / 2;
      maxLat = c.lat + C.BBOX_MAX_DEG / 2;
      clamped = true;
    }
    if (maxLng - minLng > C.BBOX_MAX_DEG) {
      minLng = c.lng - C.BBOX_MAX_DEG / 2;
      maxLng = c.lng + C.BBOX_MAX_DEG / 2;
      clamped = true;
    }
    return { bbox: { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng }, clamped };
  }

  async function refreshMarkers() {
    if (!ready) return;
    if (!shouldFetchMarkers()) {
      clearOverlays();
      notice("지도를 확대하면 단지 가격 정보가 보여요.", { sticky: true });
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
        notice("지도 중심 주변 단지만 표시 중 — 확대하면 더 자세히 볼 수 있어요.");
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
    const name = row.display_name || row.residential_type || "";
    if (mode === "dot") {
      el.className = `mk-dot${typeCls ? ` ${typeCls}` : ""}`;
      el.title = name;
    } else {
      el.className = `mk${mode === "compact" ? " compact" : ""}${typeCls ? ` ${typeCls}` : ""}`;
      el.dataset.testid = "price-bubble-marker";
      // 금액과 세대수는 있을 때만 표기한다 — 없는 값은 빈칸이 아니라 단계적으로 대체:
      // 금액+세대 → 금액만 → 세대만 → 단지명만. 가격 스코프 설명은 호버 툴팁에 남긴다.
      const price = row.recent_month6_average_realdeal_price;
      const household = row.complex_household_count;
      const hasPrice = D.validPrice(price);
      const hasHousehold = Number.isFinite(household) && household > 0;
      const mainTxt = hasPrice
        ? F.price(price, { compact: true })
        : hasHousehold ? `${F.count(household)}세대` : F.esc(name);
      const subTxt = hasPrice && hasHousehold ? `<small>${F.count(household)}세대</small>` : "";
      const valueLine = (hasPrice || hasHousehold)
        ? `<span class="mk-price">${mainTxt}${subTxt}</span>`
        : "";
      if (mode === "full") {
        el.innerHTML = `<span class="mk-name">${F.esc(name)}</span>${valueLine}`;
      } else {
        el.innerHTML = valueLine || `<span class="mk-price">${F.esc(name)}</span>`;
        el.title = hasPrice
          ? `${name} · 단지 전체 최근 6개월 실거래 평균 ${F.price(price, { compact: true })}`
          : name;
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
        D.validPrice(r.recent_month6_average_realdeal_price) || (r.complex_household_count || 0) >= 300);
      if (filtered.length >= 20) rows = filtered;
    }
    if (rows.length <= cap) return rows;
    return [...rows]
      .sort((a, b) =>
         ((D.validPrice(b.recent_month6_average_realdeal_price) ? 1 : 0) -
          (D.validPrice(a.recent_month6_average_realdeal_price) ? 1 : 0)) ||
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
      if (!kept || (!D.validPrice(kept.recent_month6_average_realdeal_price) &&
          D.validPrice(row.recent_month6_average_realdeal_price))) {
        byKey.set(row.complex_key, row);
      }
    }
    return [...byKey.values()];
  }

  function renderMarkers(allRows, mode) {
    const rows = prioritize(allRows, mode);
    const seen = new Set();
    for (const row of rows) {
      if (!D.validCoordinate(row.longitude, row.latitude)) continue;
      const key = markerKey(row);
      seen.add(key);
      const existing = overlays.get(key);
      if (existing && existing.mode === mode) continue; // 그대로 유지
      if (existing) { existing.overlay.remove(); overlays.delete(key); }
      const el = markerContent(row, mode);
      const overlay = A.addOverlay({
        lat: row.latitude,
        lng: row.longitude,
        el,
        yAnchor: mode === "dot" ? 0.5 : 1,
        zIndex: row.complex_key === selectedKey
          ? 100
          : (D.validPrice(row.recent_month6_average_realdeal_price) ? 5 : 2),
        clickable: true,
      });
      overlays.set(key, { overlay, el, row, mode });
    }
    // 화면에서 사라진 마커 제거 (선택 단지는 유지)
    for (const [key, o] of overlays) {
      if (!seen.has(key) && o.row.complex_key !== selectedKey) {
        o.overlay.remove();
        overlays.delete(key);
      }
    }
    applySelectionStyle();
  }

  function clearOverlays() {
    for (const [key, o] of overlays) {
      if (o.row.complex_key === selectedKey) continue;
      o.overlay.remove();
      overlays.delete(key);
    }
  }

  function applySelectionStyle() {
    for (const [, o] of overlays) {
      if (!o.el.classList) continue;
      const isSelected = o.row.complex_key === selectedKey;
      o.el.classList.toggle("is-selected", isSelected);
      o.overlay.setZIndex(isSelected
        ? 100
        : (D.validPrice(o.row.recent_month6_average_realdeal_price) ? 5 : 2));
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
    const rings = D.geoJsonOuterRings(geojson);
    if (!rings) return false;
    polygon = A.addPolygon(rings, {
      strokeWeight: 2.5,
      strokeColor: "#0e6b4f",
      strokeOpacity: 0.9,
      fillColor: "#0e6b4f",
      fillOpacity: 0.1,
      zIndex: 1,
    });
    return true;
  }

  function hidePolygon() {
    if (polygon) { polygon.remove(); polygon = null; }
  }

  let dongRows = null;
  function setDongLabels(rows) {
    dongRows = rows;
    syncDongLabels();
  }

  function syncDongLabels() {
    for (const o of dongOverlays) o.remove();
    dongOverlays = [];
    if (!ready || !dongRows || !A.isDongLabelVisible()) return;
    for (const b of dongRows) {
      if (!D.validCoordinate(b.longitude, b.latitude)) continue;
      const el = document.createElement("div");
      el.className = "dong-label";
      const floor = D.validFloor(b.ground_floor_count) ? ` <small>${b.ground_floor_count}층</small>` : "";
      el.innerHTML = `${F.esc(b.dong_name)}동${floor}`;
      dongOverlays.push(A.addOverlay({
        lat: b.latitude, lng: b.longitude, el,
        yAnchor: 0.5, zIndex: 50, clickable: false,
      }));
    }
  }

  // ── 뷰 이동/도구 ─────────────────────────────
  // tier는 "최소 이 정도까지는 확대" 요청이다. 어느 SDK에서 무슨 숫자인지는 어댑터가 안다.
  //   null       — 이동만
  //   "complex"  — 단지가 보이는 수준
  //   "dong"     — 동 라벨이 보이는 수준
  function focusOn(lat, lng, tier = null) {
    if (!ready || !D.validCoordinate(lng, lat)) return false;
    A.focusOn(lat, lng, tier);
    return true;
  }

  function zoomIn() { if (ready) A.zoomIn(); }
  function zoomOut() { if (ready) A.zoomOut(); }

  let skyview = false;
  function toggleMapType() {
    if (!A.supportsSatellite) return false;
    skyview = A.setSatellite(!skyview);
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

  // 공개 면에 줌 숫자를 내보내지 않는다 — 내보내면 호출부가 SDK 방향을 알게 되고,
  // 어댑터만 바꿔도 화면이 반대로 도는 버그가 다시 생긴다.
  return {
    init, refreshMarkers, setTypeFilter,
    select, clearSelection, showPolygon, setDongLabels,
    focusOn, zoomIn, zoomOut, toggleMapType, notice, hideNotice,
    supportsSatellite: () => A.supportsSatellite,
  };
})();

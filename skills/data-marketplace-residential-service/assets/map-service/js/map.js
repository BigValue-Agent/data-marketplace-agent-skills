// 지도 컨트롤러 — 지도 SDK를 모른다.
// SDK를 아는 것은 window.mapAdapter 하나뿐이고(index.html에서 어댑터 파일 하나를 고른다),
// 이 파일은 그 계약만 부른다. 줌 숫자·좌표 객체·SDK 이름이 여기 등장하면 그것이 버그다.
window.mapCtl = (() => {
  const C = window.APP_CONFIG;
  const F = window.fmt;
  const D = window.dataPolicy;
  const A = window.mapAdapter;
  const Async = window.asyncPolicy;

  const VIEW_MODE = {
    COMPLEX: "complex_viewport",
    REGION: "region_overview",
  };
  // 지도 SDK의 fitBounds 여백·화면 비율 차이는 실제 getBounds 결과로 흡수한다.
  // 2%는 확대 단계가 아니라 부동소수점·리사이즈 흔들림을 무시하기 위한 허용치다.
  const REGION_SPAN_EPSILON = 0.02;
  const REGION_BASELINE_FALLBACK_MS = 400;

  let ready = false;
  let handlers = { onMarkerClick: null, onViewChange: null, onRegionOverview: null, onSelectionCleared: null };
  let typeFilter = "아파트"; // '아파트' | '연립다세대' | '전체'
  let selectedKey = null;
  let selectedType = null;
  let activeMarkerKey = null;
  let viewMode = VIEW_MODE.COMPLEX;
  let regionContext = null;

  const overlays = new Map(); // complex_key → {overlay, el, row, mode}
  let regionPolygon = null;
  let complexPolygon = null;
  let regionPin = null;
  let fetchAbort = null;
  const markerRequest = Async.latestRequest();
  let idleTimer = null;
  let regionBaselineTimer = null;
  let noticeTimer = null;

  async function init(h) {
    handlers = { ...handlers, ...h };
    await A.load();
    A.create(document.getElementById("map"));
    ready = true;
    A.onIdle(() => {
      captureRegionBaseline(regionContext);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        refreshMarkers();
        handlers.onViewChange && handlers.onViewChange();
      }, 220);
    });
    refreshMarkers();
  }

  // ── 줌 전략 ──────────────────────────────────
  // 호출 가드: 뷰포트 span(getBounds) 전용 — 어느 축이든 0.1°(BBOX_MAX_DEG)를 넘으면
  // 마커를 호출하지 않고 줌인 안내를 띄운다 (마커 상품 계약 규칙 · SDK 중립 판정).
  // 줌 레벨은 표시 밀도(풀/컴팩트/도트) 튜닝에만 쓴다 — 호출 여부 판단 금지.
  function viewportSpan() {
    const r = A.getBoundsRect();
    return { lat: r.maxLat - r.minLat, lng: r.maxLng - r.minLng };
  }

  function shouldFetchMarkers() {
    return isMarkerViewport(viewportSpan());
  }

  function isMarkerViewport(s) {
    return s.lat <= C.BBOX_MAX_DEG && s.lng <= C.BBOX_MAX_DEG;
  }

  function invalidateMarkerRequest() {
    fetchAbort?.abort();
    fetchAbort = null;
    markerRequest.next();
  }

  function regionSpanRatio(span) {
    const baseline = regionContext?.baselineSpan;
    if (!baseline || baseline.lat <= 0 || baseline.lng <= 0) return 1;
    return Math.max(span.lat / baseline.lat, span.lng / baseline.lng);
  }

  function validSpan(span) {
    return Number.isFinite(span?.lat) && Number.isFinite(span?.lng) &&
      span.lat > 0 && span.lng > 0;
  }

  function bboxSpan(bbox) {
    const { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng } = bbox || {};
    if (!D.validCoordinate(minLng, minLat) || !D.validCoordinate(maxLng, maxLat) ||
        minLat >= maxLat || minLng >= maxLng) return null;
    return { lat: maxLat - minLat, lng: maxLng - minLng };
  }

  function ensureRegionPin() {
    if (!regionPin && regionContext) {
      showRegionPin(
        regionContext.lat,
        regionContext.lng,
        regionContext.title,
        regionContext.apartmentComplexCount,
      );
    }
  }

  function showMarkerZoomGuide() {
    notice("지도를 확대하면 단지 가격 정보가 보여요.", { sticky: true });
  }

  function captureRegionBaseline(context) {
    if (!context?.awaitingFit || regionContext !== context) return false;
    const actualSpan = viewportSpan();
    const baselineSpan = validSpan(actualSpan) ? actualSpan : context.fallbackSpan;
    if (!validSpan(baselineSpan)) return false;
    context.baselineSpan = baselineSpan;
    context.awaitingFit = false;
    clearTimeout(regionBaselineTimer);
    regionBaselineTimer = null;
    return true;
  }

  function scheduleRegionBaselineFallback(context) {
    clearTimeout(regionBaselineTimer);
    regionBaselineTimer = setTimeout(() => {
      captureRegionBaseline(context);
    }, REGION_BASELINE_FALLBACK_MS);
  }

  // true면 현재 뷰에서 단지 마커를 조회한다. 지역 선택 직후의 자동 맞춤 화면은
  // 실제 getBounds로 기준선만 확정하고, 이후 사용자 확대부터 기존 0.1도 가드를 적용한다.
  function resolveMarkerView() {
    if (!regionContext) return true;

    const span = viewportSpan();
    if (regionContext.awaitingFit || !validSpan(regionContext.baselineSpan)) {
      invalidateMarkerRequest();
      clearAllComplexOverlays();
      ensureRegionPin();
      showMarkerZoomGuide();
      return false;
    }

    const ratio = regionSpanRatio(span);
    const markerViewport = isMarkerViewport(span);
    const zoomedInFromRegion = ratio <= 1 - REGION_SPAN_EPSILON;
    if (viewMode === VIEW_MODE.REGION) {
      if (markerViewport && zoomedInFromRegion) {
        viewMode = VIEW_MODE.COMPLEX;
        hideRegionPin();
        hideNotice();
        return true;
      }
      invalidateMarkerRequest();
      clearAllComplexOverlays();
      ensureRegionPin();
      showMarkerZoomGuide();
      return false;
    }

    const returnedToRegion = ratio >= 1 - REGION_SPAN_EPSILON / 2;
    if (!markerViewport || returnedToRegion) {
      viewMode = VIEW_MODE.REGION;
      invalidateMarkerRequest();
      clearSelection();
      clearAllComplexOverlays();
      ensureRegionPin();
      showMarkerZoomGuide();
      handlers.onRegionOverview?.();
      return false;
    }
    return true;
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
    if (!resolveMarkerView()) return;
    if (!shouldFetchMarkers()) {
      invalidateMarkerRequest();
      clearOverlays();
      showMarkerZoomGuide();
      return;
    }
    const mode = markerDensity();
    const { bbox, clamped } = currentBbox();

    fetchAbort?.abort();
    const controller = new AbortController();
    fetchAbort = controller;
    const signal = controller.signal;
    const sequence = markerRequest.next();

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
      if (!markerRequest.isCurrent(sequence) || viewMode !== VIEW_MODE.COMPLEX) return;
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
      if (e.name === "AbortError" || !markerRequest.isCurrent(sequence)) return;
      console.error(e);
      notice("단지 정보를 불러오지 못했어요 — 지도를 움직이면 다시 시도해요");
    } finally {
      if (fetchAbort === controller) fetchAbort = null;
    }
  }

  const TYPE_CLASS = { "연립다세대": "villa", "오피스텔": "officetel" };
  function markerContent(row, mode, key) {
    const el = document.createElement("div");
    const typeCls = TYPE_CLASS[row.residential_type] || "";
    const name = row.display_name || row.residential_type || "";
    let accessibleLabel = `${name || "주거 단지"} 상세 보기`;
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
      accessibleLabel = hasPrice
        ? `${name || "주거 단지"}, 최근 6개월 평균 ${F.price(price, { compact: true })}, 상세 보기`
        : hasHousehold
          ? `${name || "주거 단지"}, ${F.count(household)}세대, 상세 보기`
          : accessibleLabel;
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
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", accessibleLabel);
    el.tabIndex = -1;
    const activate = (e) => {
      e.stopPropagation();
      handlers.onMarkerClick && handlers.onMarkerClick(row);
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate(e);
        return;
      }
      const direction = e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!direction && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      e.stopPropagation();
      moveMarkerFocus(key, direction, e.key);
    });
    return el;
  }

  // 지도에는 최대 수백 개 마커가 있으므로 모두를 Tab 순서에 넣지 않는다.
  // 한 마커만 Tab 정지점으로 두고 화살표/Home/End로 화면의 마커를 순회한다.
  function syncMarkerTabStops() {
    const entries = [...overlays.entries()];
    if (!entries.length) { activeMarkerKey = null; return; }
    if (!activeMarkerKey || !overlays.has(activeMarkerKey)) {
      activeMarkerKey = entries.find(([, item]) => isSelected(item.row))?.[0] || entries[0][0];
    }
    entries.forEach(([key, item]) => { item.el.tabIndex = key === activeMarkerKey ? 0 : -1; });
  }

  function moveMarkerFocus(currentKey, direction, keyName) {
    const entries = [...overlays.entries()];
    if (!entries.length) return;
    const currentIndex = Math.max(0, entries.findIndex(([key]) => key === currentKey));
    const nextIndex = keyName === "Home"
      ? 0
      : keyName === "End"
        ? entries.length - 1
        : (currentIndex + direction + entries.length) % entries.length;
    activeMarkerKey = entries[nextIndex][0];
    syncMarkerTabStops();
    entries[nextIndex][1].el.focus();
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

  // 마커 상품은 complex_key당 한 행이며 residential_type은 대표 유형이다.
  function markerKey(row) {
    return row.complex_key;
  }

  function isSelected(row) {
    return row.complex_key === selectedKey;
  }

  // 유형별 병렬 응답을 합칠 때 방어적으로 complex_key 중복을 제거한다.
  function dedupeByComplex(rows) {
    const byKey = new Map();
    for (const row of rows) {
      const kept = byKey.get(row.complex_key);
      if (!kept || isSelected(row) || (!isSelected(kept) && !D.validPrice(kept.recent_month6_average_realdeal_price) &&
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
      const el = markerContent(row, mode, key);
      const overlay = A.addOverlay({
        lat: row.latitude,
        lng: row.longitude,
        el,
        yAnchor: mode === "dot" ? 0.5 : 1,
        zIndex: isSelected(row)
          ? 100
          : (D.validPrice(row.recent_month6_average_realdeal_price) ? 5 : 2),
        clickable: true,
      });
      overlays.set(key, { overlay, el, row, mode });
    }
    // 화면에서 사라진 마커 제거 (선택 단지는 유지)
    for (const [key, o] of overlays) {
      if (!seen.has(key) && !isSelected(o.row)) {
        o.overlay.remove();
        overlays.delete(key);
        if (activeMarkerKey === key) activeMarkerKey = null;
      }
    }
    applySelectionStyle();
  }

  function clearOverlays() {
    for (const [key, o] of overlays) {
      if (isSelected(o.row)) continue;
      o.overlay.remove();
      overlays.delete(key);
      if (activeMarkerKey === key) activeMarkerKey = null;
    }
    syncMarkerTabStops();
  }

  function clearAllComplexOverlays() {
    for (const [, overlay] of overlays) overlay.overlay.remove();
    overlays.clear();
    activeMarkerKey = null;
  }

  function applySelectionStyle() {
    let selectedMarkerKey = null;
    for (const [key, o] of overlays) {
      if (!o.el.classList) continue;
      const selected = isSelected(o.row);
      o.el.classList.toggle("is-selected", selected);
      if (selected) {
        o.el.setAttribute("aria-current", "true");
        selectedMarkerKey ||= key;
      } else {
        o.el.removeAttribute("aria-current");
      }
      o.overlay.setZIndex(selected
        ? 100
        : (D.validPrice(o.row.recent_month6_average_realdeal_price) ? 5 : 2));
    }
    if (selectedMarkerKey) activeMarkerKey = selectedMarkerKey;
    syncMarkerTabStops();
  }

  // ── 선택/폴리곤 ─────────────────────────────
  function select(complexKey, residentialType = null) {
    selectedKey = complexKey;
    selectedType = residentialType;
    applySelectionStyle();
  }

  function clearSelection() {
    selectedKey = null;
    selectedType = null;
    applySelectionStyle();
    hideComplexPolygon();
  }

  function drawPolygon(geojson, zIndex) {
    const rings = D.geoJsonOuterRings(geojson);
    if (!rings) return null;
    const rootStyle = typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;
    const boundaryColor = rootStyle?.getPropertyValue("--map-boundary").trim() || "#0e6b4f";
    return A.addPolygon(rings, {
      strokeWeight: 2.5,
      strokeColor: boundaryColor,
      strokeOpacity: 0.9,
      fillColor: boundaryColor,
      fillOpacity: 0.1,
      zIndex,
    });
  }

  function showRegionPolygon(geojson) {
    hideRegionPolygon();
    regionPolygon = drawPolygon(geojson, 1);
    return !!regionPolygon;
  }

  function hideRegionPolygon() {
    if (regionPolygon) { regionPolygon.remove(); regionPolygon = null; }
  }

  function showComplexPolygon(geojson) {
    hideComplexPolygon();
    complexPolygon = drawPolygon(geojson, 2);
    return !!complexPolygon;
  }

  function hideComplexPolygon() {
    if (complexPolygon) { complexPolygon.remove(); complexPolygon = null; }
  }

  function showRegionPin(lat, lng, title, apartmentComplexCount = null) {
    hideRegionPin();
    if (!ready || !D.validCoordinate(lng, lat)) return false;
    if (regionContext && Number.isInteger(apartmentComplexCount) && apartmentComplexCount >= 0) {
      regionContext.apartmentComplexCount = apartmentComplexCount;
    }
    const el = document.createElement("div");
    el.className = "region-pin";
    const nameEl = document.createElement("span");
    nameEl.className = "region-pin-name";
    nameEl.textContent = title || "선택 지역";
    el.appendChild(nameEl);
    if (Number.isInteger(apartmentComplexCount) && apartmentComplexCount >= 0) {
      const metaEl = document.createElement("span");
      metaEl.className = "region-pin-meta";
      metaEl.textContent = `${F.count(apartmentComplexCount)}개 단지`;
      el.appendChild(metaEl);
    }
    regionPin = A.addOverlay({ lat, lng, el, yAnchor: 1, zIndex: 90 });
    return true;
  }

  function hideRegionPin() {
    if (regionPin) { regionPin.remove(); regionPin = null; }
  }

  function enterRegionOverview({ lat, lng, title, bbox }) {
    if (!ready || !D.validCoordinate(lng, lat)) return false;
    clearTimeout(idleTimer);
    clearTimeout(regionBaselineTimer);
    invalidateMarkerRequest();
    clearSelection();
    clearAllComplexOverlays();
    hideRegionPolygon();
    // 검색 bbox는 이동 입력일 뿐이다. 화면 비율과 SDK 여백이 반영된 실제 표시 범위를
    // idle에서 기준선으로 저장하고, idle이 없는 어댑터만 짧은 fallback으로 보완한다.
    const context = {
      lat, lng, title,
      apartmentComplexCount: null,
      baselineSpan: null,
      fallbackSpan: bboxSpan(bbox),
      awaitingFit: true,
    };
    regionContext = context;
    viewMode = VIEW_MODE.REGION;
    showRegionPin(lat, lng, title);
    showMarkerZoomGuide();
    const moved = fitBounds(bbox) || focusOn(lat, lng);
    scheduleRegionBaselineFallback(context);
    return moved;
  }

  function enterComplexViewport() {
    clearTimeout(regionBaselineTimer);
    regionBaselineTimer = null;
    invalidateMarkerRequest();
    regionContext = null;
    viewMode = VIEW_MODE.COMPLEX;
    hideRegionPin();
    hideRegionPolygon();
  }

  // ── 뷰 이동/도구 ─────────────────────────────
  // tier는 "최소 이 정도까지는 확대" 요청이다. 어느 SDK에서 무슨 숫자인지는 어댑터가 안다.
  //   null       — 이동만
  //   "complex"  — 단지가 보이는 수준
  function focusOn(lat, lng, tier = null) {
    if (!ready || !D.validCoordinate(lng, lat)) return false;
    A.focusOn(lat, lng, tier);
    return true;
  }

  function fitBounds(bbox) {
    const { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng } = bbox || {};
    if (!ready || !D.validCoordinate(minLng, minLat) || !D.validCoordinate(maxLng, maxLat) ||
        minLat > maxLat || minLng > maxLng) return false;
    A.fitBounds({ minLat, maxLat, minLng, maxLng });
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
    if (t === typeFilter) return;
    typeFilter = t;
    // 응답에서 빠진 것은 범위 이동·잘림일 수 있다. 실제 조건으로 선택을 판단한다.
    if (selectedKey && t !== "전체" && selectedType !== t) {
      clearSelection();
      handlers.onSelectionCleared?.();
    }
    // 새 조회가 느리거나 실패해도 이전 유형의 마커를 새 조건의 결과로 남기지 않는다.
    for (const [key, item] of overlays) {
      if (t !== "전체" && item.row.residential_type !== t) {
        item.overlay.remove();
        overlays.delete(key);
        if (activeMarkerKey === key) activeMarkerKey = null;
      }
    }
    syncMarkerTabStops();
    if (viewMode === VIEW_MODE.COMPLEX) refreshMarkers();
  }

  // 공개 면에 줌 숫자를 내보내지 않는다 — 내보내면 호출부가 SDK 방향을 알게 되고,
  // 어댑터만 바꿔도 화면이 반대로 도는 버그가 다시 생긴다.
  return {
    init, refreshMarkers, setTypeFilter,
    select, clearSelection,
    enterRegionOverview, enterComplexViewport,
    showRegionPolygon, showComplexPolygon,
    showRegionPin, hideRegionPin,
    focusOn, fitBounds, zoomIn, zoomOut, toggleMapType, notice, hideNotice,
    supportsSatellite: () => A.supportsSatellite,
  };
})();

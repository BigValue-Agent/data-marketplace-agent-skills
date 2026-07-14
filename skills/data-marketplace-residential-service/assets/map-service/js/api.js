window.api = (() => {
  const C = window.APP_CONFIG;
  const cache = new Map(); // key: route+body → response (단지 단위 데이터는 세션 내 불변으로 취급)

  // 계약 route — minimum_service_contract의 core/lazy route 문자열과 1:1
  const ROUTES = {
    search: "/api/complex-search",
    markers: "/api/markers",
    detail: "/api/complex-detail",
    shape: "/api/complex-shape",
    buildings: "/api/buildings",
    units: "/api/units",
    realdeal: "/api/prices?tab=realdeal",
    notice: "/api/prices?tab=notice",
    estimated: "/api/prices?tab=estimated",
  };

  // ttlMs: 캐시 유효시간. 없으면 세션 내 영구(단지 단위 데이터), 있으면 만료 후 재호출.
  async function query(route, body, { signal = null, useCache = true, ttlMs = null } = {}) {
    const url = `${C.PROXY_BASE}${route}`;
    const key = url + JSON.stringify(body);
    if (useCache && cache.has(key)) {
      const hit = cache.get(key);
      if (!hit.expiresAt || hit.expiresAt > Date.now()) return hit.json;
      cache.delete(key);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail || ""; } catch (_) { /* ignore */ }
      throw new Error(`API ${res.status}: ${detail || route}`);
    }
    const json = await res.json();
    if (!json.success) throw new Error(`API 실패: ${route}`);
    if (useCache) cache.set(key, { json, expiresAt: ttlMs ? Date.now() + ttlMs : null });
    return json;
  }

  // ── 상품별 래퍼 ──────────────────────────────────────────

  // 1. 단지 검색 (자동완성)
  async function searchComplex(name, { signal } = {}) {
    const r = await query(ROUTES.search, {
      filters: { complex_name: name },
      limit: 10,
    }, { signal, useCache: false });
    return r.data;
  }

  // 2. 단지 프로필
  async function complexProfile(complexKey) {
    const r = await query(ROUTES.detail, {
      filters: { complex_key: complexKey },
      limit: 1,
    });
    return r.data[0] || null;
  }

  // 3. 지도 마커 (bbox는 0.1도 이내로 호출자에서 클램프 — offset 페이지네이션 금지 상품)
  // 같은 뷰(동일 bbox+유형)의 재조회(유형 필터 왕복, 직후 재렌더)가 idle마다
  // 반복되지 않도록 짧은 TTL 캐시를 둔다.
  async function markers(bbox, residentialType, { signal } = {}) {
    const body = { bbox, limit: C.MARKER_LIMIT };
    if (residentialType) body.filters = { residential_type: residentialType };
    const r = await query(ROUTES.markers, body, { signal, ttlMs: C.MARKER_CACHE_TTL_MS });
    return { rows: r.data, truncated: !!r.has_next };
  }

  // 3b. 단지 중심 반경 조회 (주변 단지 비교용) — bbox 중심=단지 좌표라 거리순으로 반환된다.
  // 뷰포트 마커와 달리 단지별로 캐시한다.
  async function nearbyMarkers(lat, lng, residentialType, { radiusKm = 1.2 } = {}) {
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const body = {
      bbox: {
        min_lat: lat - dLat, max_lat: lat + dLat,
        min_lng: lng - dLng, max_lng: lng + dLng,
      },
      limit: 100,
    };
    if (residentialType) body.filters = { residential_type: residentialType };
    const r = await query(ROUTES.markers, body);
    return { rows: r.data, truncated: !!r.has_next };
  }

  // 4. 단지 경계 GeoJSON
  async function complexShape(complexKey) {
    const r = await query(ROUTES.shape, {
      filters: { complex_key: complexKey },
      limit: 5,
    });
    return r.data[0] || null;
  }

  // 5. 동/건물 목록 — 첫 페이지(최대 300동)만. hasNext=true면 건물이 더 있다는 뜻인데,
  // 헤더 숫자 하나를 정확히 세려고 추가 페이지를 자동 조회하지 않는다("N+"로 표기).
  // 주상복합 대응: residentialType을 주면 해당 유형의 동만 — 진입 유형과 평형/동 정보가 어긋나지 않게.
  async function buildings(complexKey, residentialType = null) {
    const filters = { complex_key: complexKey };
    if (residentialType) filters.residential_type = residentialType;
    const r = await query(ROUTES.buildings, {
      filters,
      limit: 300,
    });
    return { rows: r.data, hasNext: !!r.has_next };
  }

  // 6. 호실 목록 (동 기준 페이지네이션)
  async function units(complexKey, ppk, { offset = 0, limit = 100 } = {}) {
    const r = await query(ROUTES.units, {
      filters: { complex_key: complexKey, ppk },
      sort: { field: "floor_number", order: "asc" },
      limit, offset,
    });
    return { rows: r.data, hasNext: r.has_next };
  }

  // 7. 공시가격 — 210 상품은 최신 스냅숏만 보유하므로 호 선택 시 1건만 조회한다.
  async function noticePricesByJpk(ppk, jpk) {
    const r = await query(ROUTES.notice, {
      filters: { ppk, jpk },
      sort: { field: "notice_standard_ym", order: "desc" },
      limit: 1,
    });
    return r.data;
  }

  // 공시가격에 단지/평형 대표값 함수를 두지 않는다 — 상세 상품에는 집계가 없고
  // 전용면적 필터도 없어, 일부 행 평균은 대단지에서 전체를 대표하지 못한다.
  // 공시가격은 호(ppk+jpk) 단위로만 조회한다.

  // 8. 실거래 — 한 페이지
  async function realdealPage(complexKey, {
    dealDivision = null, dateFrom = null, dateTo = null,
    areaMin = null, areaMax = null, residentialType = null,
    sortField = "contract_date", sortOrder = "desc",
    limit = 30, offset = 0, signal = null,
  } = {}) {
    const filters = { complex_key: complexKey };
    if (dealDivision) filters.deal_division_name = dealDivision;
    if (residentialType) filters.residential_type = residentialType;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (areaMin != null) filters.private_area_min = areaMin;
    if (areaMax != null) filters.private_area_max = areaMax;
    const r = await query(ROUTES.realdeal, {
      filters,
      sort: { field: sortField, order: sortOrder },
      limit, offset,
    }, { signal });
    return { rows: r.data, hasNext: r.has_next };
  }

  // 실거래 다건 자동 수집 함수를 두지 않는다 — 순차 페이지 대기가 첫 화면을 늦추고
  // 단지 하나에 수백 행을 내려받게 된다. 목록·차트는 첫 페이지(100건)를
  // 공유하고, 추가 페이지는 사용자가 "더 보기"를 눌렀을 때만 이어서 조회한다.

  // 9. 산출시세 — 210 상품은 최신 스냅숏만 보유하므로 호 선택 시 1건만 조회한다.
  async function estimatesByJpk(ppk, jpk) {
    const r = await query(ROUTES.estimated, {
      filters: { ppk, jpk },
      sort: { field: "sise_production_standard_ym", order: "desc" },
      limit: 1,
    });
    return r.data;
  }

  return {
    searchComplex, complexProfile, markers, nearbyMarkers, complexShape, buildings, units,
    noticePricesByJpk, realdealPage,
    estimatesByJpk,
  };
})();

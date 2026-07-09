// 빅밸류 데이터 마켓플레이스 주거형 상품 API 클라이언트
// 브라우저는 Data Marketplace를 직접 호출하지 않는다 — server/proxy.mjs의
// 계약(minimum_service_contract) route만 호출하고, 키는 프록시가 env로만 다룬다.
window.api = (() => {
  const C = window.APP_CONFIG;
  const cache = new Map(); // key: route+body → response (단지 단위 데이터는 세션 내 불변으로 취급)
  let lastCreditBalance = null;

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
    if (typeof json.credit_balance === "number") {
      lastCreditBalance = json.credit_balance;
      document.dispatchEvent(new CustomEvent("credit:update", { detail: lastCreditBalance }));
    }
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
  // 마커는 가장 비싼 호출이다 — 같은 뷰(동일 bbox+유형)의 재조회(유형 필터 왕복,
  // 직후 재렌더)가 idle마다 재과금되지 않도록 짧은 TTL 캐시를 둔다.
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
    return r.data;
  }

  // 4. 단지 경계 GeoJSON
  async function complexShape(complexKey) {
    const r = await query(ROUTES.shape, {
      filters: { complex_key: complexKey },
      limit: 5,
    });
    return r.data[0] || null;
  }

  // 5. 동/건물 목록 (단지 하나면 최대 300동으로 충분)
  // 주상복합 대응: residentialType을 주면 해당 유형의 동만 — 진입 유형과 평형/동 정보가 어긋나지 않게.
  async function buildings(complexKey, residentialType = null) {
    const filters = { complex_key: complexKey };
    if (residentialType) filters.residential_type = residentialType;
    const r = await query(ROUTES.buildings, {
      filters,
      limit: 300,
    });
    return r.data;
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

  // 7. 공시가격 — jpk(호) 기준 연도별 이력
  async function noticePricesByJpk(jpk) {
    const r = await query(ROUTES.notice, {
      filters: { jpk },
      sort: { field: "notice_standard_ym", order: "desc" },
      limit: 30,
    });
    return r.data;
  }

  // 7b. 단지 대표 공시가 (최신 기준월 상위 rows)
  async function noticePricesSample(complexKey, { limit = 100, residentialType = null } = {}) {
    const filters = { complex_key: complexKey };
    if (residentialType) filters.residential_type = residentialType;
    const r = await query(ROUTES.notice, {
      filters,
      sort: { field: "notice_standard_ym", order: "desc" },
      limit,
    });
    return r.data;
  }

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

  // 8b. 실거래 다건 수집 (차트용) — offset 상한과 페이지 수를 제한.
  // truncated=true면 조건에 해당하는 거래가 더 있지만 최신순으로 잘렸다는 뜻.
  async function realdealCollect(complexKey, opts = {}, { maxPages = 5, signal = null } = {}) {
    const all = [];
    let truncated = false;
    for (let p = 0; p < maxPages; p++) {
      const { rows, hasNext } = await realdealPage(complexKey, {
        ...opts, limit: 100, offset: p * 100, signal,
      });
      all.push(...rows);
      truncated = hasNext;
      if (!hasNext || rows.length === 0) break;
    }
    return { rows: all, truncated };
  }

  // 9. 산출시세 — 평형(면적 범위) 밴드: 정렬 트릭으로 min/max 정확값 + 샘플 평균
  async function estimateBand(complexKey, { areaMin = null, areaMax = null, residentialType = null } = {}) {
    const filters = { complex_key: complexKey };
    if (residentialType) filters.residential_type = residentialType;
    if (areaMin != null) filters.private_area_min = areaMin;
    if (areaMax != null) filters.private_area_max = areaMax;
    // 최신 기준월 파악 겸 샘플 (기본 정렬: 기준월 desc)
    const sample = await query(ROUTES.estimated, {
      filters,
      sort: { field: "sise_production_standard_ym", order: "desc" },
      limit: 100,
    });
    const rows = sample.data;
    if (!rows.length) return null;
    const latestYm = rows[0].sise_production_standard_ym;
    const latest = rows.filter((r) => r.sise_production_standard_ym === latestYm);
    const filtersYm = { ...filters, sise_production_standard_ym: latestYm };
    const [lo, hi] = await Promise.all([
      query(ROUTES.estimated, { filters: filtersYm, sort: { field: "sise_price", order: "asc" }, limit: 1 }),
      query(ROUTES.estimated, { filters: filtersYm, sort: { field: "sise_price", order: "desc" }, limit: 1 }),
    ]);
    const avg = latest.reduce((s, r) => s + r.sise_price, 0) / latest.length;
    return {
      standardYm: latestYm,
      min: lo.data[0]?.sise_price ?? null,
      max: hi.data[0]?.sise_price ?? null,
      avg,
      lowerAvg: latest.reduce((s, r) => s + (r.lowerlimit_sise_price || r.sise_price), 0) / latest.length,
      upperAvg: latest.reduce((s, r) => s + (r.upperlimit_sise_price || r.sise_price), 0) / latest.length,
      sampleCount: latest.length,
      grade: latest[0]?.sise_grade ?? null,
    };
  }

  // 9b. 호(jpk) 산출시세 이력
  async function estimatesByJpk(jpk) {
    const r = await query(ROUTES.estimated, {
      filters: { jpk },
      sort: { field: "sise_production_standard_ym", order: "desc" },
      limit: 30,
    });
    return r.data;
  }

  return {
    searchComplex, complexProfile, markers, nearbyMarkers, complexShape, buildings, units,
    noticePricesByJpk, noticePricesSample, realdealPage, realdealCollect,
    estimateBand, estimatesByJpk,
    get creditBalance() { return lastCreditBalance; },
  };
})();

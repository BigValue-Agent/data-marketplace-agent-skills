// 단지 상세 패널 — 프로필, 가격 수준계, 실거래, 평형/동/호, 입지, 개요
window.panel = (() => {
  const F = window.fmt;
  const A = window.api;
  const D = window.dataPolicy;
  const Async = window.asyncPolicy;

  const panelEl = document.getElementById("panel");
  const bodyEl = document.getElementById("panel-body");
  const sheetEl = document.getElementById("unit-sheet");

  let openToken = 0; // 최신 open 호출만 렌더하도록 하는 가드
  let cur = null; // {key, profile, buildings, pyeongs, repPy, viewType, typeMismatch, focusDealPromises}
  let deal = null; // {division, pyeong, range, rows, offset, hasNext, chart}

  const unitAreaText = (value) => D.validUnitArea(value) ? F.area(value) : "확인 필요";
  const pyeongText = (value) => D.validPyeong(value) ? `${value}평` : "평형 확인 필요";
  const floorText = (value) => D.validFloor(value) ? `${value}층` : "층 확인 필요";
  const areaMessage = "전용면적 정보가 없어 이 평형 가격을 조회할 수 없어요. 전체를 선택하면 단지 전체 거래를 볼 수 있어요.";

  const moduleContext = {
    F, A, D, Async, bodyEl, sheetEl,
    getCur: () => cur,
    getDeal: () => deal,
    getOpenToken: () => openToken,
    isCurrentOpen: (token) => token === openToken,
    pyeongFilterRange,
    areaMessage,
    renderGaugeSkeleton,
    renderAreaUnavailable,
    getFocusPyeong: focusPyObj,
    formatUnitArea: unitAreaText,
    formatPyeong: pyeongText,
    formatFloor: floorText,
    openComplex: open,
  };
  const priceModule = window.createPanelPriceModule(moduleContext);
  const unitsModule = window.createPanelUnitsModule({ ...moduleContext, onSelectPyeong: selectPyeong });

  // buildings.units_summary → 평형 목록
  function aggregatePyeongs(buildings) {
    const m = new Map();
    for (const b of buildings) {
      for (const u of b.units_summary || []) {
        if (!D.validPyeong(u.pyeong_number)) continue;
        let p = m.get(u.pyeong_number);
        if (!p) {
          p = { py: u.pyeong_number, ho: 0, types: new Set(), areaMin: Infinity, areaMax: -Infinity };
          m.set(u.pyeong_number, p);
        }
        p.ho += u.ho_count || 0;
        if (u.pyeong_type_name) p.types.add(u.pyeong_type_name);
        if (D.validUnitArea(u.private_area)) {
          p.areaMin = Math.min(p.areaMin, u.private_area);
          p.areaMax = Math.max(p.areaMax, u.private_area);
        }
      }
    }
    return [...m.values()].sort((a, b) => a.py - b.py);
  }

  function pyeongFilterRange(p) {
    return D.pyeongAreaRange(p);
  }

  function renderGaugeSkeleton() {
    const el = bodyEl.querySelector("#sec-gauge");
    if (!el) return;
    el.innerHTML = `
      <div class="gauge-lead">
        <span class="gl-eyebrow">가격 수준계</span>
        <div class="skel" style="height:40px;width:150px"></div>
      </div>
      <div class="skel" style="height:110px;margin-top:14px"></div>`;
  }

  function renderAreaUnavailable() {
    const tbody = bodyEl.querySelector("#deal-tbody");
    const more = bodyEl.querySelector("#deal-more");
    const chart = bodyEl.querySelector("#deal-chart");
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:22px 0">${areaMessage}</td></tr>`;
    if (chart) chart.innerHTML = `<div class="chart-empty">${areaMessage}</div>`;
    if (more) { more.hidden = true; more.disabled = false; }
  }

  // null은 사용자가 명시적으로 고른 전체 범위다. 대표평형으로 다시 넓혀 해석하지 않는다.
  function focusPyObj() {
    return cur.pyeongs.find((x) => x.py === deal.pyeong) || null;
  }

  // 진입 residentialType은 혼합 단지의 패널 전체 조회 기준이다.
  async function open(complexKey, residentialType = null) {
    const token = ++openToken;
    panelEl.hidden = false;
    unitsModule.closeSheet();
    bodyEl.innerHTML = `
      <div class="p-loading" role="status" aria-label="단지 정보 불러오는 중">
        <div class="skel" style="height:26px;width:60%"></div>
        <div class="skel" style="height:14px;width:85%"></div>
        <div class="skel" style="height:96px"></div>
        <div class="skel" style="height:190px"></div>
        <div class="skel" style="height:120px"></div>
      </div>`;

    try {
      const [profile, shape, buildings] = await Promise.all([
        A.complexProfile(complexKey),
        A.complexShape(complexKey).catch(() => null),
        // 진입 유형이 있으면 그 유형의 동만 — 주상복합에서 다른 유형의 평형/동이 섞이지 않게
        A.buildings(complexKey, residentialType).catch(() => []),
      ]);
      if (token !== openToken) return;
      if (!profile) throw new Error("단지 정보가 없어요");

      const viewType = residentialType || profile.residential_type || null;
      // 혼합 단지의 전체 요약을 선택 유형의 값으로 오인하지 않는다.
      const typeMismatch = !!(viewType && profile.residential_type && viewType !== profile.residential_type);

      const pyeongs = aggregatePyeongs(buildings);
      const repPy = pyeongs.length
        ? pyeongs.reduce((a, b) => (b.ho > a.ho ? b : a))
        : null;
      cur = {
        key: complexKey, profile, buildings, pyeongs, repPy, viewType, typeMismatch,
        // 게이지·주변 비교·전세가율이 같은 거래유형·평형 요청을 공유한다.
        focusDealPromises: new Map(),
      };
      deal = {
        division: "매매", pyeong: repPy?.py ?? null, range: 36,
        overlayJeonse: false, rows: [], offset: 0, hasNext: false,
      };

      window.mapCtl.select(complexKey);
      window.mapCtl.showPolygon(shape ? shape.polygon_geojson : null);
      window.mapCtl.setDongLabels(buildings);

      renderShell();
      priceModule.hydrateGauge(token);
      priceModule.loadDeals(token, { reset: true });
      priceModule.hydrateNearby(token);
    } catch (e) {
      if (token !== openToken) return;
      console.error(e);
      bodyEl.innerHTML = `
        <div class="p-sec">
          <div class="err-box">단지 정보를 불러오지 못했어요.
            <button type="button" id="p-retry">다시 시도</button>
          </div>
        </div>`;
      bodyEl.querySelector("#p-retry").addEventListener("click", () => open(complexKey, residentialType));
    }
  }

  function close() {
    openToken++;
    panelEl.hidden = true;
    priceModule.dispose();
    unitsModule.closeSheet();
    cur = null;
    window.mapCtl.clearSelection();
  }

  function renderShell() {
    const p = cur.profile;
    // 헤더는 정체성만, 공부 수치는 단지 개요에 둔다.
    const badges = [
      // 주상복합: 지금 보는 유형 외의 유형이 같은 단지에 있음을 명시 (세대수 등은 단지 전체 값)
      cur.typeMismatch && `복합 단지 · <b>${F.esc(p.residential_type)}</b> 포함`,
      p.complex_household_count != null && `<b>${F.count(p.complex_household_count)}</b>세대`,
      p.complex_dong_count != null && `<b>${F.count(p.complex_dong_count)}</b>개동`,
      p.use_approval_date && `${F.dateYm(p.use_approval_date)} <b>(${p.complex_age_number ?? "—"}년차)</b>`,
      p.max_ground_floor_count != null && `최고 <b>${floorText(p.max_ground_floor_count)}</b>`,
    ].filter(Boolean).map((t) => `<span class="p-badge">${t}</span>`).join("");
    const TYPE_BADGE_CLS = { "연립다세대": " villa", "오피스텔": " officetel" };
    const typeBadgeCls = TYPE_BADGE_CLS[cur.viewType || p.residential_type] || "";

    bodyEl.innerHTML = `
      <div class="p-head">
        <div class="p-head-top">
          <h2 class="p-name">${F.esc(p.complex_name || p.road_name_address || "이름 없는 단지")}</h2>
          <span class="p-type-badge${typeBadgeCls}">${F.esc(cur.viewType || p.residential_type || "")}</span>
          <button type="button" class="p-close" id="p-close" aria-label="패널 닫기">×</button>
        </div>
        <div class="p-addr">
          <span>${F.esc(p.road_name_address || p.land_number_address || "")}</span>
          <button type="button" class="p-addr-copy" id="p-copy">복사</button>
        </div>
        <div class="p-badges">${badges}</div>
      </div>

      <section class="gauge-hero" id="sec-gauge" data-testid="price-level-gauge"></section>

      <section class="p-sec" id="sec-deals">
        <h3 class="p-sec-title">실거래가 <span class="p-sec-sub">국토교통부 · ${F.ym(p.standard_ym)} 기준</span></h3>
        <div class="deal-seg" role="group" aria-label="거래유형">
          ${["매매", "전세", "월세"].map((d) =>
            `<button type="button" data-deal="${d}" class="${d === "매매" ? "is-on" : ""}">${d}</button>`).join("")}
        </div>
        <div class="py-chips" id="py-chips"></div>
        <!-- 실거래 상품 적재 범위가 최근 3년이므로 "전체 기간" 같은 라벨은 두지 않는다 -->
        <div class="range-toggle" role="group" aria-label="조회 기간">
          <button type="button" data-range="6">6개월</button>
          <button type="button" data-range="12">1년</button>
          <button type="button" data-range="36" class="is-on">3년</button>
          <button type="button" id="jeonse-overlay" class="overlay-toggle" aria-pressed="false"
                  title="매매 차트 위에 전세 보증금을 겹쳐 매매·전세 간격을 봅니다">전세 겹쳐보기</button>
          <span class="p-sec-sub" id="chart-basis" style="margin-left:auto;align-self:center"></span>
        </div>
        <div class="chart-wrap" id="deal-chart" data-testid="transaction-chart"><div class="chart-empty">거래 내역을 불러오는 중…</div></div>
        <table class="deal-table" aria-label="실거래 내역">
          <thead><tr><th>계약일</th><th>가격</th><th>층</th><th>전용</th></tr></thead>
          <tbody id="deal-tbody"></tbody>
        </table>
        <button type="button" class="btn-more" id="deal-more" hidden>실거래 더보기</button>
      </section>

      <section class="p-sec" id="sec-nearby" data-testid="nearby-comparison-panel">
        <h3 class="p-sec-title">주변 단지 시세 비교 <span class="p-sec-sub" id="nearby-sub">반경 1.2km</span></h3>
        <div id="nearby-body"><div class="skel" style="height:130px"></div></div>
      </section>

      <section class="p-sec" id="sec-py">
        <h3 class="p-sec-title">평형 · 동 정보 <span class="p-sec-sub">${F.count(cur.buildings.length)}개동</span></h3>
        <div class="py-cards" id="py-cards"></div>
        <div style="height:12px"></div>
        <div class="dong-grid" id="dong-grid"></div>
        <p class="sec-note" data-testid="unit-panel-placeholder">동을 선택하면 호실별 면적과 호별 시세·공시가격을 볼 수 있어요.</p>
      </section>

      <section class="p-sec" id="sec-loc">
        <h3 class="p-sec-title">입지 · 학군</h3>
        <div class="school-list" id="loc-list"></div>
      </section>

      <section class="p-sec" id="sec-overview">
        <h3 class="p-sec-title">단지 개요 <span class="p-sec-sub">토지·건축물 공부 기준</span></h3>
        <dl class="info-rows" id="overview-rows"></dl>
        <p class="sec-note">기준시점 ${F.ym(p.standard_ym)} · 빅밸류 데이터 마켓플레이스 주거형 상품</p>
      </section>
    `;

    bodyEl.querySelector("#p-close").addEventListener("click", close);
    bodyEl.querySelector("#p-copy").addEventListener("click", (e) => {
      navigator.clipboard?.writeText(p.road_name_address || p.land_number_address || "");
      e.target.textContent = "복사됨";
      setTimeout(() => { e.target.textContent = "복사"; }, 1200);
    });

    priceModule.bindControls();
    unitsModule.renderPyeongControls();
    unitsModule.renderDongGrid();
    renderLocation();
    renderOverview();
    renderGaugeSkeleton();
  }

  function selectPyeong(nextPyeong) {
    const prev = focusPyObj()?.py ?? null;
    deal.pyeong = nextPyeong;
    unitsModule.renderPyeongControls();
    priceModule.onPyeongChange(prev);
  }

  // 입지·학군
  function renderLocation() {
    const p = cur.profile;
    const items = [];
    if (p.nearby_subway_station_name) {
      items.push({ badge: "역", name: `${p.nearby_subway_station_name}역`, sub: F.distance(p.nearby_subway_station_distance) });
    }
    if (p.assignment_elementary_school_name) {
      items.push({ badge: "초", name: p.assignment_elementary_school_name, sub: "배정 초등학교" });
    }
    if (p.assignment_middle_school_name) {
      const names = p.assignment_middle_school_name.split(",");
      items.push({ badge: "중", name: names.slice(0, 2).join(", ") + (names.length > 2 ? ` 외 ${names.length - 2}곳` : ""), sub: "배정 가능 중학교" });
    }
    if (p.assignment_high_school_name) {
      const names = p.assignment_high_school_name.split(",");
      items.push({ badge: "고", name: names.slice(0, 2).join(", ") + (names.length > 2 ? ` 외 ${names.length - 2}곳` : ""), sub: "배정 가능 고등학교" });
    }
    if (p.nearby_park_distance != null) items.push({ badge: "공원", name: "가까운 공원", sub: F.distance(p.nearby_park_distance) });
    if (p.nearby_hospital_distance != null) items.push({ badge: "병원", name: "가까운 병원", sub: F.distance(p.nearby_hospital_distance) });
    if (p.nearby_large_store_count != null) items.push({ badge: "마트", name: `대형마트 ${p.nearby_large_store_count}곳`, sub: "주변 1km 기준" });

    document.getElementById("loc-list").innerHTML = items.length
      ? items.map((i) => `
        <div class="school-item">
          <span class="sc-badge">${F.esc(i.badge)}</span>
          <div><div class="sc-name">${F.esc(i.name)}</div><div class="sc-sub">${F.esc(i.sub)}</div></div>
        </div>`).join("")
      : `<p class="sec-note">입지 정보가 없어요.</p>`;
  }

  // 단지 개요
  function renderOverview() {
    const p = cur.profile;
    const rows = [
      ["대지면적", p.land_area != null ? `${F.area(p.land_area)} (${F.area(p.land_area, { forceUnit: F.getAreaUnit() === "pyeong" ? "m2" : "pyeong" })})` : "—"],
      ["지목 · 용도지역", `${p.land_purpose_name || "—"} · ${p.purpose_region_division_1_name || "—"}`],
      ["개별공시지가", p.land_recent_notice_price != null ? `${F.price(p.land_recent_notice_price)}/㎡ <small style="color:var(--ink-3)">(${p.land_recent_notice_year}년)</small>` : "—"],
      ["용적률 · 건폐율", (p.floorarea_rate != null || p.buildingcoverage_rate != null)
        ? `${p.floorarea_rate != null ? `${p.floorarea_rate}%` : "—"} · ${p.buildingcoverage_rate != null ? `${p.buildingcoverage_rate}%` : "—"}` : "—"],
      ["건물 구조", p.representative_title_structure_name || "—"],
      ["주용도", p.representative_title_etc_purpose_name || p.representative_title_purpose_name || "—"],
      ["난방", p.heating_division_name || "—"],
      ["연면적 합계", p.sum_title_total_floor_area != null ? F.area(p.sum_title_total_floor_area) : "—"],
      ["총 호수", p.complex_ho_count != null ? `${F.count(p.complex_ho_count)}호` : "—"],
      ["주차대수", p.complex_parking_count != null
        ? `${F.count(p.complex_parking_count)}대${p.complex_household_count
          ? ` <small style="color:var(--ink-3)">(세대당 ${(p.complex_parking_count / p.complex_household_count).toFixed(2)}대)</small>` : ""}`
        : "—"],
      ["시공사", p.constructor_name || "—"],
      ["시행사", p.developer_name || "—"],
    ];
    document.getElementById("overview-rows").innerHTML = rows.map(([k, v]) =>
      `<div class="info-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }

  function rerender() {
    if (cur) {
      const key = cur.key;
      open(key, cur.viewType);
    }
  }

  return { open, close, rerender, isOpen: () => !panelEl.hidden };
})();

// 단지 상세 패널 — 프로필, 단지 실거래 요약·상세, 동/호, 입지, 개요
window.panel = (() => {
  const F = window.fmt;
  const A = window.api;
  const D = window.dataPolicy;
  const Async = window.asyncPolicy;

  const panelEl = document.getElementById("panel");
  const bodyEl = document.getElementById("panel-body");
  const sheetEl = document.getElementById("unit-sheet");

  let openToken = 0; // 최신 open 호출만 렌더하도록 하는 가드
  let cur = null; // 선택 단지 프로필·동·유형 경계·지연 조회 상태
  let deal = null; // {division, area, observedAreas, range, rows, offset, shown, hasNext, overlayJeonse}

  const unitAreaText = (value) => D.validUnitArea(value) ? F.area(value) : "확인 필요";
  const pyeongText = (value) => D.validPyeong(value) ? `${value}평` : "평형 확인 필요";
  const floorText = (value) => D.validFloor(value) ? `${value}층` : "층 확인 필요";

  const moduleContext = {
    F, A, D, Async, panelEl, bodyEl, sheetEl,
    getCur: () => cur,
    getDeal: () => deal,
    getOpenToken: () => openToken,
    isCurrentOpen: (token) => token === openToken,
    formatUnitArea: unitAreaText,
    formatPyeong: pyeongText,
    formatFloor: floorText,
    openComplex: open,
  };
  const priceModule = window.createPanelPriceModule(moduleContext);
  const unitsModule = window.createPanelUnitsModule({
    ...moduleContext,
    retryBuildings: () => loadBuildings(openToken),
  });

  // 진입 residentialType은 혼합 단지의 패널 전체 조회 기준이다.
  // 첫 화면은 프로필 1건만 기다린다 — 경계·동 목록은 백그라운드로 받아
  // 도착하는 대로 지도 경계·동 영역·주거동 배지를 채운다.
  async function open(complexKey, residentialType = null) {
    const token = ++openToken;
    window.mapCtl.select(complexKey, residentialType);
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
      const profile = await A.complexProfile(complexKey);
      if (token !== openToken) return;
      if (!profile) throw new Error("단지 정보가 없어요");

      const viewType = residentialType || profile.residential_type || null;
      // 혼합 단지의 전체 요약을 선택 유형의 값으로 오인하지 않는다.
      const typeMismatch = !!(viewType && profile.residential_type && viewType !== profile.residential_type);

      cur = {
        key: complexKey, profile, viewType, typeMismatch,
        // 동 목록 도착 전 상태 — 동 영역은 스켈레톤으로 표시된다.
        buildings: [],
        buildingsReady: false, buildingsHasNext: false, buildingsError: false,
        // 매매/전세 비교에서 재사용하는 전세 rows (기간·면적 scope 키 포함)
        jeonseRows: null,
      };
      deal = {
        division: "매매", area: null, observedAreas: new Set(), range: 36,
        overlayJeonse: false, rows: [], offset: 0, shown: 0,
        hasNext: false, truncated: false,
        fromInitialSample: false,
        sourceRowCount: 0, sourceHasNext: false,
        overlayError: false, overlayHasNext: false, overlayTruncated: false,
      };

      window.mapCtl.select(complexKey, viewType);
      window.mapCtl.showComplexPolygon(null);

      renderShell();
      priceModule.hydrateSummary(); // 프로필 요약 기반 — 추가 호출 없음
      priceModule.observeNearby(token); // 주변 비교는 화면에 보일 때만 조회

      A.complexShape(complexKey).then((shape) => {
        if (token !== openToken || !shape) return;
        window.mapCtl.showComplexPolygon(shape.polygon_geojson);
      }).catch(() => {});

      priceModule.loadDeals(token, { reset: true });
      loadBuildings(token);
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

  async function loadBuildings(token) {
    if (!cur || token !== openToken) return;
    cur.buildingsReady = false;
    cur.buildingsError = false;
    updateBuildingCounts();
    unitsModule.renderDongGrid();
    try {
      const { rows, hasNext } = await A.buildings(cur.key, cur.viewType);
      if (!cur || token !== openToken) return;
      cur.buildings = rows;
      cur.buildingsHasNext = hasNext;
      cur.buildingsReady = true;
    } catch (error) {
      if (!cur || token !== openToken) return;
      console.error(error);
      cur.buildings = [];
      cur.buildingsHasNext = false;
      cur.buildingsReady = true;
      cur.buildingsError = true;
    }
    updateBuildingCounts();
    unitsModule.renderDongGrid();
  }

  function close() {
    openToken++;
    panelEl.hidden = true;
    priceModule.dispose();
    unitsModule.closeSheet();
    cur = null;
    window.mapCtl.clearSelection();
  }

  function activateTab(tabName, { focus = false } = {}) {
    const tabs = [...bodyEl.querySelectorAll('[role="tab"][data-panel-tab]')];
    const panels = [...bodyEl.querySelectorAll('[role="tabpanel"][data-panel-tab]')];
    const nextTab = tabs.find((tab) => tab.dataset.panelTab === tabName);
    if (!nextTab) return;

    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.classList.toggle("is-on", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panelTab !== tabName;
    });
    bodyEl.scrollTop = 0;
    if (focus) nextTab.focus();
  }

  function bindTabs() {
    const tabs = [...bodyEl.querySelectorAll('[role="tab"][data-panel-tab]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.panelTab));
      tab.addEventListener("keydown", (event) => {
        let nextIndex = null;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        if (nextIndex == null) return;
        event.preventDefault();
        activateTab(tabs[nextIndex].dataset.panelTab, { focus: true });
      });
    });
  }

  function renderShell() {
    const p = cur.profile;
    // 헤더는 정체성만, 공부 수치는 단지 개요에 둔다.
    const badges = [
      // 주상복합: 지금 보는 유형 외의 유형이 같은 단지에 있음을 명시 (세대수 등은 단지 전체 값)
      cur.typeMismatch && `복합 단지 · <b>${F.esc(p.residential_type)}</b> 포함`,
      p.complex_household_count != null && `<b>${F.count(p.complex_household_count)}</b>세대`,
      // 상품 계약의 범위를 확장 해석하지 않고 프로필 필드명을 그대로 설명한다.
      p.complex_dong_count != null && `단지 동 수 <b>${F.count(p.complex_dong_count)}</b>동`,
      p.use_approval_date && `${F.dateYm(p.use_approval_date)} <b>(${p.complex_age_number ?? "—"}년차)</b>`,
      p.max_ground_floor_count != null && `최고 <b>${floorText(p.max_ground_floor_count)}</b>`,
    ].filter(Boolean).map((t) => `<span class="p-badge">${t}</span>`).join("")
      // 주거동 수는 동 목록이 백그라운드로 도착한 뒤 채운다 (초기 화면을 막지 않음)
      + `<span class="p-badge" id="dong-badge" hidden></span>`;
    const TYPE_BADGE_CLS = { "연립다세대": " villa", "오피스텔": " officetel" };
    const typeBadgeCls = TYPE_BADGE_CLS[cur.viewType || p.residential_type] || "";

    bodyEl.innerHTML = `
      <div class="p-chrome">
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
        <div class="p-tabs" role="tablist" aria-label="단지 상세 메뉴">
          <button type="button" id="p-tab-price" role="tab" data-panel-tab="price"
                  aria-controls="p-tabpanel-price" aria-selected="true" class="is-on">가격</button>
          <button type="button" id="p-tab-units" role="tab" data-panel-tab="units"
                  aria-controls="p-tabpanel-units" aria-selected="false" tabindex="-1">동·호</button>
          <button type="button" id="p-tab-info" role="tab" data-panel-tab="info"
                  aria-controls="p-tabpanel-info" aria-selected="false" tabindex="-1">단지정보</button>
        </div>
      </div>

      <div id="p-tabpanel-price" role="tabpanel" tabindex="0" data-panel-tab="price" aria-labelledby="p-tab-price">
        <section class="price-summary" id="sec-price-summary" data-testid="complex-realdeal-summary"></section>

        <section class="p-sec" id="sec-deals">
          <h3 class="p-sec-title">실거래가 <span class="p-sec-sub">국토교통부 · 데이터 기준 ${F.ym(p.standard_ym)}</span></h3>
          <div class="deal-seg" role="group" aria-label="거래유형">
            ${["매매", "전세", "월세"].map((d) =>
              `<button type="button" data-deal="${d}" class="${d === "매매" ? "is-on" : ""}"
                       aria-pressed="${d === "매매"}">${d}</button>`).join("")}
          </div>
          <label class="deal-area-control" for="deal-area">전용면적
            <select id="deal-area" aria-describedby="deal-area-note" aria-busy="true" disabled></select>
          </label>
          <p class="sec-note" id="deal-area-note">기본 선택된 면적의 가격 추이를 보여줘요. 다른 면적으로 바꿀 수 있어요.</p>
          <!-- 실거래 상품 적재 범위가 최근 3년이므로 "전체 기간" 같은 라벨은 두지 않는다 -->
          <div class="range-toggle" role="group" aria-label="조회 기간">
            <button type="button" data-range="36" class="is-on" aria-pressed="true">3년</button>
            <button type="button" data-range="12" aria-pressed="false">1년</button>
            <button type="button" data-range="6" aria-pressed="false">6개월</button>
            <button type="button" id="jeonse-overlay" class="overlay-toggle" aria-pressed="false"
                    title="매매 차트 위에 전세 보증금을 겹쳐 매매·전세 간격을 봅니다">매매/전세</button>
            <span class="p-sec-sub" id="chart-basis" style="margin-left:auto;align-self:center"></span>
          </div>
          <div class="chart-wrap" id="deal-chart" data-testid="transaction-chart"><div class="chart-empty">거래 내역을 불러오는 중…</div></div>
          <p class="load-note" id="deal-load-note" hidden></p>
          <table class="deal-table" aria-label="실거래 내역">
            <thead><tr><th>계약일</th><th>가격</th><th>층</th><th>전용</th></tr></thead>
            <tbody id="deal-tbody"></tbody>
          </table>
          <button type="button" class="btn-more" id="deal-more" hidden>실거래 더 보기</button>
        </section>

        <section class="p-sec" id="sec-nearby" data-testid="nearby-comparison-panel">
          <h3 class="p-sec-title">주변 단지 실거래 비교 <span class="p-sec-sub" id="nearby-sub">반경 1.2km</span></h3>
          <div id="nearby-body"><p class="sec-note" style="margin:0">주변 단지를 불러오는 중…</p></div>
        </section>
      </div>

      <div id="p-tabpanel-units" role="tabpanel" tabindex="0" data-panel-tab="units" aria-labelledby="p-tab-units" hidden>
        <section class="p-sec" id="sec-units">
          <h3 class="p-sec-title">동·호 정보 <span class="p-sec-sub" id="dong-count-sub">동 목록 불러오는 중…</span></h3>
          <div class="dong-grid" id="dong-grid"></div>
          <p class="sec-note" data-testid="unit-panel-placeholder">동과 호를 선택하면 AI 산출시세와 신뢰등급, 공시가격을 확인할 수 있어요.</p>
        </section>
      </div>

      <div id="p-tabpanel-info" role="tabpanel" tabindex="0" data-panel-tab="info" aria-labelledby="p-tab-info" hidden>
        <section class="p-sec" id="sec-loc">
          <h3 class="p-sec-title">입지 · 학군</h3>
          <div class="school-list" id="loc-list"></div>
        </section>

        <section class="p-sec" id="sec-overview">
          <h3 class="p-sec-title">단지 개요 <span class="p-sec-sub">토지대장·건축물대장 기준</span></h3>
          <dl class="info-rows" id="overview-rows"></dl>
          <p class="sec-note">기준시점 ${F.ym(p.standard_ym)} · 빅밸류 데이터 마켓플레이스 주거형 상품</p>
        </section>
      </div>
    `;

    bodyEl.querySelector("#p-close").addEventListener("click", close);
    bodyEl.querySelector("#p-copy").addEventListener("click", async (e) => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        await navigator.clipboard.writeText(p.road_name_address || p.land_number_address || "");
        button.textContent = "복사됨";
      } catch {
        button.textContent = "복사 실패";
      }
      setTimeout(() => {
        button.textContent = "복사";
        button.disabled = false;
      }, 1200);
    });

    bindTabs();
    priceModule.bindControls();
    unitsModule.renderDongGrid();
    renderLocation();
    renderOverview();
  }

  // 프로필 단지 동 수와 선택 유형의 동 상품 행 수를 구분한다. 첫 페이지가 잘리면
  // 추가 페이지를 자동 조회하지 않고 "N+"로 표시한다.
  function updateBuildingCounts() {
    if (!cur) return;
    const badge = bodyEl.querySelector("#dong-badge");
    const sub = bodyEl.querySelector("#dong-count-sub");
    const count = new Set(cur.buildings.map((b) => b.ppk)).size;
    const suffix = cur.buildingsHasNext ? `${F.count(count)}+` : `${F.count(count)}동`;
    const typeLabel = cur.viewType || "주거";
    if (badge) {
      badge.hidden = !cur.buildingsReady || cur.buildingsError || count === 0;
      if (count > 0) badge.innerHTML = `${F.esc(typeLabel)} 주거동 <b>${suffix}</b>`;
    }
    if (sub) {
      sub.textContent = !cur.buildingsReady
        ? "동 목록 불러오는 중…"
        : cur.buildingsError
          ? "동 정보 조회 실패"
          : count > 0 ? `주거동 ${suffix}` : "동 정보 없음";
    }
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
      ["총괄표제부 구조", p.representative_title_structure_name || "미제공"],
      ["주용도", p.representative_title_etc_purpose_name || p.representative_title_purpose_name || "—"],
      ["난방", p.heating_division_name || "—"],
      ["총괄표제부 연면적", p.sum_title_total_floor_area != null ? F.area(p.sum_title_total_floor_area) : "—"],
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

// 단지 상세 패널 — 프로필, 가격 수준계, 실거래, 평형/동/호, 입지, 개요
window.panel = (() => {
  const F = window.fmt;
  const A = window.api;

  const panelEl = document.getElementById("panel");
  const bodyEl = document.getElementById("panel-body");
  const sheetEl = document.getElementById("unit-sheet");

  let openToken = 0; // 최신 open 호출만 렌더하도록 하는 가드
  let cur = null; // {key, profile, buildings, pyeongs, repPy, viewType, typeMismatch, focusDealsPromises}
  let deal = null; // {division, pyeong, range, rows, offset, hasNext, chart}
  let chartHandle = null;
  // 평형 변경으로 게이지/주변비교를 다시 채울 때, 앞선 요청이 늦게 도착해
  // 최신 렌더를 덮지 않도록 하는 세대 가드 (openToken은 패널 단위라 부족하다)
  let gaugeGen = 0;
  let nearbyGen = 0;

  // ── 평형 집계: buildings.units_summary → 평형 목록 ──
  function aggregatePyeongs(buildings) {
    const m = new Map();
    for (const b of buildings) {
      for (const u of b.units_summary || []) {
        if (u.pyeong_number == null) continue;
        let p = m.get(u.pyeong_number);
        if (!p) {
          p = { py: u.pyeong_number, ho: 0, types: new Set(), areaMin: Infinity, areaMax: -Infinity };
          m.set(u.pyeong_number, p);
        }
        p.ho += u.ho_count || 0;
        if (u.pyeong_type_name) p.types.add(u.pyeong_type_name);
        if (u.private_area != null) {
          p.areaMin = Math.min(p.areaMin, u.private_area);
          p.areaMax = Math.max(p.areaMax, u.private_area);
        }
      }
    }
    return [...m.values()].sort((a, b) => a.py - b.py);
  }

  function pyeongFilterRange(p) {
    if (!p) return { areaMin: null, areaMax: null };
    return {
      areaMin: Math.max(0, (p.areaMin === Infinity ? p.py * 3.3 : p.areaMin) - 0.5),
      areaMax: (p.areaMax === -Infinity ? p.py * 3.3 : p.areaMax) + 0.5,
    };
  }

  function sixMonthDateFrom() {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`;
  }

  // 대표평형 실거래 rows → {avg, count, unitAvg(전용 평당가)} — 게이지·주변비교 공용
  function dealStats(rows) {
    const valid = rows.filter((d) => d.price != null && !d.cancel_date);
    if (!valid.length) return null;
    const prices = valid.map((d) => d.price);
    const unitPrices = valid
      .filter((d) => d.private_area > 0)
      .map((d) => d.price / (d.private_area / 3.305785));
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((s, x) => s + x, 0) / prices.length,
      count: prices.length,
      unitAvg: unitPrices.length ? unitPrices.reduce((s, x) => s + x, 0) / unitPrices.length : null,
    };
  }

  // ── 기준 평형 — 사용자가 평형 칩/카드를 고르면 실거래뿐 아니라
  //    게이지·주변비교까지 화면 전체가 이 기준을 따른다 (없으면 대표평형).
  function focusPyObj() {
    return cur.pyeongs.find((x) => x.py === deal.pyeong) || cur.repPy;
  }

  // 기준 평형의 최근 6개월 매매 수집 — 평형별로 메모해 평형을 오가도 재호출하지 않는다.
  // 평형 정보가 없어도 typeMismatch(주상복합)면 유형 필터로 수집한다:
  // 프로필 6개월 요약은 유형 혼합값이라 진입 유형의 숫자로 쓸 수 없기 때문.
  function focusDealsPromise() {
    const focus = focusPyObj();
    const key = focus ? focus.py : "__complex__";
    let promise = cur.focusDealsPromises.get(key);
    if (promise) return promise;
    if (!focus && !cur.typeMismatch) {
      promise = Promise.resolve({ rows: [], truncated: false });
    } else {
      const range = pyeongFilterRange(focus);
      promise = A.realdealCollect(cur.key, {
        dealDivision: "매매", dateFrom: sixMonthDateFrom(),
        areaMin: range.areaMin, areaMax: range.areaMax,
        residentialType: cur.viewType,
      }, { maxPages: 3 }).catch(() => ({ rows: [], truncated: false }));
    }
    cur.focusDealsPromises.set(key, promise);
    return promise;
  }

  // 기준 평형의 최근 6개월 전세 수집 — 전세가율(매매 평균 대비 전세 보증금 평균) 산출용.
  // 같은 면적 버킷의 매매·전세가 모두 있을 때만 의미가 있다 (ui-recipes 파생지표 규칙).
  function focusJeonsePromise() {
    const focus = focusPyObj();
    const key = focus ? focus.py : "__complex__";
    let promise = cur.focusJeonsePromises.get(key);
    if (promise) return promise;
    if (!focus && !cur.typeMismatch) {
      // 매매 쪽(focusDealsPromise)도 안 모으는 조건 — 전세가율이 성립할 수 없으니 호출하지 않는다
      promise = Promise.resolve({ rows: [], truncated: false });
    } else {
      const range = pyeongFilterRange(focus);
      promise = A.realdealCollect(cur.key, {
        dealDivision: "전세", dateFrom: sixMonthDateFrom(),
        areaMin: range.areaMin, areaMax: range.areaMax,
        residentialType: cur.viewType,
      }, { maxPages: 3 }).catch(() => ({ rows: [], truncated: false }));
    }
    cur.focusJeonsePromises.set(key, promise);
    return promise;
  }

  function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // ── 열기 ──────────────────────────────────────
  // residentialType: 진입 컨텍스트(마커·검색·주변행에서 클릭한 유형).
  // 주상복합은 같은 complex_key에 유형별 데이터가 섞여 있으므로, 이 값이 패널 전체
  // (뱃지·게이지·실거래·주변비교·평형/동)의 조회 기준이 된다. 없으면 프로필 대표 유형.
  async function open(complexKey, residentialType = null) {
    const token = ++openToken;
    panelEl.hidden = false;
    closeSheet();
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
      // 프로필 대표 유형과 진입 유형이 다르면 주상복합 — 단지 전체 요약(유형 혼합)을
      // 진입 유형의 숫자인 것처럼 쓰면 안 된다.
      const typeMismatch = !!(viewType && profile.residential_type && viewType !== profile.residential_type);

      const pyeongs = aggregatePyeongs(buildings);
      const repPy = pyeongs.length
        ? pyeongs.reduce((a, b) => (b.ho > a.ho ? b : a))
        : null;
      cur = {
        key: complexKey, profile, buildings, pyeongs, repPy, viewType, typeMismatch,
        // 기준 평형별 최근 6개월 매매/전세 수집 Promise 메모 — 게이지·주변 비교·전세가율이
        // 같은 Promise를 공유해 중복 호출과 기준 숫자 불일치를 막는다.
        focusDealsPromises: new Map(),
        focusJeonsePromises: new Map(),
      };
      deal = { division: "매매", pyeong: null, range: 36, overlayJeonse: false, rows: [], offset: 0, hasNext: false };

      window.mapCtl.select(complexKey);
      window.mapCtl.showPolygon(shape ? shape.polygon_geojson : null);
      window.mapCtl.setDongLabels(buildings);

      renderShell();
      // 비동기 보강: 가격 수준계 + 실거래 + 주변 비교
      hydrateGauge(token);
      loadDeals(token, { reset: true });
      hydrateNearby(token);
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
    closeSheet();
    cur = null;
    if (chartHandle) { chartHandle.destroy(); chartHandle = null; }
    window.mapCtl.clearSelection();
  }

  // ── 골격 렌더 ─────────────────────────────────
  function renderShell() {
    const p = cur.profile;
    // 헤더는 단지 "정체성"까지만 — 용적률·건폐율·주차·난방은 단지 개요 섹션으로 이관
    // (호갱노노 헤더 문법: 첫 화면은 압축, 공부 수치는 하단 섹션)
    const badges = [
      // 주상복합: 지금 보는 유형 외의 유형이 같은 단지에 있음을 명시 (세대수 등은 단지 전체 값)
      cur.typeMismatch && `복합 단지 · <b>${F.esc(p.residential_type)}</b> 포함`,
      p.complex_household_count != null && `<b>${F.count(p.complex_household_count)}</b>세대`,
      p.complex_dong_count != null && `<b>${F.count(p.complex_dong_count)}</b>개동`,
      p.use_approval_date && `${F.dateYm(p.use_approval_date)} <b>(${p.complex_age_number ?? "—"}년차)</b>`,
      p.max_ground_floor_count != null && `최고 <b>${p.max_ground_floor_count}층</b>`,
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

    // 거래유형 세그먼트
    bodyEl.querySelectorAll(".deal-seg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        bodyEl.querySelectorAll(".deal-seg button").forEach((b) => b.classList.toggle("is-on", b === btn));
        deal.division = btn.dataset.deal;
        syncOverlayBtn();
        loadDeals(openToken, { reset: true });
      });
    });
    // 기간 토글 — data-range 있는 버튼만 (전세 겹쳐보기 토글은 별도)
    bodyEl.querySelectorAll(".range-toggle button[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        bodyEl.querySelectorAll(".range-toggle button[data-range]").forEach((b) => b.classList.toggle("is-on", b === btn));
        deal.range = +btn.dataset.range || null;
        loadDeals(openToken, { reset: true });
      });
    });
    // 전세 겹쳐보기 — 매매 탭에서만 의미가 있으므로 다른 거래유형에서는 숨긴다.
    // 거래유형 세그의 의미(단일 유형 보기)는 그대로 두고, 비교는 명시적 토글로만 켠다.
    const overlayBtn = bodyEl.querySelector("#jeonse-overlay");
    const syncOverlayBtn = () => {
      overlayBtn.hidden = deal.division !== "매매";
      overlayBtn.classList.toggle("is-on", deal.overlayJeonse);
      overlayBtn.setAttribute("aria-pressed", String(deal.overlayJeonse));
    };
    overlayBtn.addEventListener("click", () => {
      deal.overlayJeonse = !deal.overlayJeonse;
      syncOverlayBtn();
      renderChartLoading();
      hydrateChart(openToken, dealOpts());
    });
    syncOverlayBtn();
    bodyEl.querySelector("#deal-more").addEventListener("click", () => loadDeals(openToken, { reset: false }));

    renderPyeongChips();
    renderPyeongCards();
    renderDongGrid();
    renderLocation();
    renderOverview();
    renderGaugeSkeleton();
  }

  // ── 가격 수준계 (시그니처) ─────────────────────
  function renderGaugeSkeleton() {
    document.getElementById("sec-gauge").innerHTML = `
      <div class="gauge-lead">
        <span class="gl-eyebrow">가격 수준계</span>
        <div class="skel" style="height:40px;width:150px"></div>
      </div>
      <div class="skel" style="height:110px;margin-top:14px"></div>`;
  }

  async function hydrateGauge(token) {
    const gen = ++gaugeGen;
    const p = cur.profile;
    const rep = focusPyObj();
    const vt = cur.viewType;
    const range = pyeongFilterRange(rep);

    // 세 레인은 반드시 같은 기준(기준 평형 + 진입 유형)으로 비교한다.
    // 기준 평형 6개월 실거래는 공유 Promise(평형별 메모)를 쓰고, 없으면 단지 전체 요약으로 폴백.
    let est = null, noticeAvg = null, noticeYm = null;
    let dealMin = null, dealAvg = null, dealMax = null;
    let dealCount = null;
    let dealBasis = rep ? `${rep.py}평` : (cur.typeMismatch ? `${vt} 전체` : "단지 전체");

    const [estR, noticeR, dealR, highR, jeonseR] = await Promise.allSettled([
      A.estimateBand(cur.key, { ...range, residentialType: vt }),
      A.noticePricesSample(cur.key, { residentialType: vt }),
      focusDealsPromise(),
      // 최고가 1건 — 실거래 적재 범위가 최근 3년이므로 "역대"가 아니라 "3년 내"다.
      // 취소 거래가 최고가일 수 있어 여유분(3건)에서 유효 거래를 고른다.
      A.realdealPage(cur.key, {
        dealDivision: "매매", areaMin: range.areaMin, areaMax: range.areaMax,
        residentialType: vt, sortField: "price", sortOrder: "desc", limit: 3,
      }),
      focusJeonsePromise(),
    ]);
    if (gen !== gaugeGen) return; // 더 최신 평형 기준으로 다시 그리는 중
    if (estR.status === "fulfilled") est = estR.value;
    if (noticeR.status === "fulfilled" && noticeR.value.length) {
      const rows = noticeR.value;
      const latest = rows[0].notice_standard_ym;
      const inPy = rows.filter((r) => r.notice_standard_ym === latest &&
        (!rep || r.pyeong_number === rep.py));
      const use = inPy.length ? inPy : rows.filter((r) => r.notice_standard_ym === latest);
      noticeAvg = use.reduce((s, r) => s + r.notice_price, 0) / use.length;
      noticeYm = latest;
    }
    if (dealR.status === "fulfilled") {
      const stats = dealStats(dealR.value.rows);
      if (stats) {
        ({ min: dealMin, max: dealMax, avg: dealAvg, count: dealCount } = stats);
      }
    }
    if (dealAvg == null && !cur.typeMismatch) {
      // 대표평형 거래가 없으면 단지 전체 6개월 요약으로 폴백.
      // 단, 주상복합(typeMismatch)에서는 이 요약이 유형 혼합값이라 폴백하지 않는다 —
      // 진입 유형의 숫자인 것처럼 보이는 거짓 레인보다 레인 생략이 정직하다.
      dealMin = p.recent_month6_min_realdeal_price;
      dealAvg = p.recent_month6_average_realdeal_price;
      dealMax = p.recent_month6_max_realdeal_price;
      dealCount = p.recent_month6_realdeal_count;
      dealBasis = "단지 전체";
    }
    if (token !== openToken) return;

    const vals = [dealMin, dealAvg, dealMax, est?.min, est?.max, est?.avg, noticeAvg]
      .filter((v) => v != null && v > 0);
    const el = document.getElementById("sec-gauge");
    if (!vals.length) {
      el.innerHTML = `
        <div class="gauge-lead"><span class="gl-eyebrow">가격 수준계</span></div>
        <div class="chart-empty" style="height:90px">최근 거래·시세 데이터가 아직 없는 단지예요.</div>`;
      return;
    }
    const lo = Math.min(...vals) * 0.96;
    const hi = Math.max(...vals) * 1.04;
    const pct = (v) => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
    const width = (a, b) => `${(((b - a) / (hi - lo)) * 100).toFixed(1)}%`;

    const lanes = [];
    if (dealMin != null && dealMax != null) {
      lanes.push(`
        <div class="gauge-row">
          <div class="gauge-row-label">실거래<small>${F.esc(dealBasis)} · 6개월</small></div>
          <div class="gauge-track">
            <div class="gauge-band deal" style="left:${pct(dealMin)};width:${width(dealMin, dealMax)}"></div>
            ${dealAvg != null ? `<div class="gauge-point deal" style="left:${pct(dealAvg)}" title="평균 ${F.price(dealAvg)}"></div>` : ""}
          </div>
          <div class="gauge-val deal">${dealAvg != null ? F.price(dealAvg, { compact: true }) : "—"}</div>
        </div>`);
    }
    if (est && est.min != null && est.max != null) {
      lanes.push(`
        <div class="gauge-row">
          <div class="gauge-row-label">산출시세<small>${rep ? `${rep.py}평` : (cur.typeMismatch ? F.esc(vt) : "단지")} · ${F.ym(est.standardYm)}</small></div>
          <div class="gauge-track">
            <div class="gauge-band est" style="left:${pct(est.min)};width:${width(est.min, est.max)}"></div>
            <div class="gauge-point est" style="left:${pct(est.avg)}" title="평균 ${F.price(est.avg)}"></div>
          </div>
          <div class="gauge-val est">${F.price(est.avg, { compact: true })}</div>
        </div>`);
    }
    if (noticeAvg != null) {
      lanes.push(`
        <div class="gauge-row">
          <div class="gauge-row-label">공시가격<small>${rep ? `${rep.py}평` : (cur.typeMismatch ? F.esc(vt) : "단지")} · ${F.ym(noticeYm)}</small></div>
          <div class="gauge-track">
            <div class="gauge-point notice" style="left:${pct(noticeAvg)}" title="평균 ${F.price(noticeAvg)}"></div>
          </div>
          <div class="gauge-val notice">${F.price(noticeAvg, { compact: true })}</div>
        </div>`);
    }

    const leadPrice = dealAvg ?? est?.avg ?? noticeAvg;
    const leadLabel = dealAvg != null
      ? `${F.esc(dealBasis)} 최근 6개월 실거래 평균 <b>${F.count(dealCount)}건</b>`
      : (est ? "산출시세 평균" : "공시가격 평균");

    // 리드 보조 지표 — '얼마'만이 아니라 '어디쯤·어디로'까지 답한다.
    const subSegs = [];
    const high = highR.status === "fulfilled"
      ? (highR.value.rows.find((d) => d.price != null && !d.cancel_date) || null)
      : null;
    if (high) {
      let seg = `3년 내 최고 <b>${F.price(high.price, { compact: true })}</b> <small>${F.dateShort(high.contract_date)}</small>`;
      if (dealAvg != null && high.price > 0) {
        const pct = Math.round(((dealAvg - high.price) / high.price) * 100);
        seg += ` · 평균 대비 ${trendTxt(pct)}`;
      }
      subSegs.push(seg);
    }
    if (dealR.status === "fulfilled") {
      // 직전 3개월 대비 증감 — 표본이 얇으면(구간당 5건 미만) 정밀해 보이는 노이즈라 표시하지 않는다.
      const valid = dealR.value.rows.filter((d) => d.price != null && !d.cancel_date);
      const d3 = new Date(); d3.setMonth(d3.getMonth() - 3);
      const cut = `${d3.getFullYear()}${String(d3.getMonth() + 1).padStart(2, "0")}01`;
      const recent = valid.filter((d) => String(d.contract_date) >= cut);
      const prior = valid.filter((d) => String(d.contract_date) < cut);
      if (recent.length >= MIN_TREND_SAMPLE && prior.length >= MIN_TREND_SAMPLE) {
        const avgOf = (a) => a.reduce((s, d) => s + d.price, 0) / a.length;
        const pct = Math.round(((avgOf(recent) - avgOf(prior)) / avgOf(prior)) * 100);
        subSegs.push(`직전 3개월 대비 ${trendTxt(pct)} <small>${prior.length}→${recent.length}건</small>`);
      }
    }
    // 전세가율 — 같은 면적 버킷의 매매 체결가·전세 보증금이 모두 있을 때만 유효한 파생 지표.
    // API 요약 필드가 아니라 불러온 rows로 앱에서 계산한 값이므로 표본을 함께 표기한다.
    if (dealR.status === "fulfilled" && jeonseR.status === "fulfilled") {
      const sales = dealR.value.rows.filter((d) => d.price != null && !d.cancel_date);
      const leases = jeonseR.value.rows.filter((d) => d.deposit_price != null && !d.cancel_date);
      if (sales.length >= MIN_RATIO_SAMPLE && leases.length >= MIN_RATIO_SAMPLE) {
        const saleAvg = sales.reduce((s, d) => s + d.price, 0) / sales.length;
        const leaseAvg = leases.reduce((s, d) => s + d.deposit_price, 0) / leases.length;
        if (saleAvg > 0) {
          const ratio = Math.round((leaseAvg / saleAvg) * 100);
          subSegs.push(`<span data-testid="jeonse-ratio-chip">전세가율 <b>${ratio}%</b> <small>매매 ${sales.length}·전세 ${leases.length}건 기준</small></span>`);
        }
      }
    }

    el.innerHTML = `
      <div class="gauge-lead">
        <span class="gl-eyebrow">${leadLabel}</span>
        <span class="gl-price">${F.price(leadPrice)}</span>
      </div>
      ${subSegs.length ? `<div class="gauge-stats">${subSegs.map((s) => `<span class="stat-chip">${s}</span>`).join("")}</div>` : ""}
      <div class="gauge">
        ${lanes.join("")}
        <div class="gauge-row gauge-scale-row">
          <div></div>
          <div class="gauge-scale"><span>${F.price(lo, { compact: true })}</span><span>${F.price(hi, { compact: true })}</span></div>
          <div></div>
        </div>
      </div>
      <p class="gauge-note">
        <i class="c-deal">실거래</i>는 신고 기반 체결가,
        <i class="c-est">산출시세</i>는 빅밸류 AI 산정 범위${est?.grade ? ` (신뢰등급 ${F.esc(est.grade)})` : ""},
        <i class="c-notice">공시가격</i>은 보유세 산정 기준이에요. 세 층의 간격이 이 단지 가격의 현재 위치예요.
      </p>`;
  }

  // ── 주변 단지 시세 비교 ────────────────────────
  // 2단 구조: ① 단지 중심 반경 마커 1회로 후보 확보(거리순 응답 활용)
  //           ② 상위 후보만 대표평형 동일 면적대 실거래로 정밀 단가 비교
  // 증감률 표시의 최소 표본 — 양 구간 모두 이 건수 이상일 때만 % 를 보여준다
  const MIN_TREND_SAMPLE = 5;
  // 전세가율 표시의 최소 표본 — 매매·전세 각 이 건수 이상일 때만 계산한다
  const MIN_RATIO_SAMPLE = 3;

  // 증감률 → "▲4%" / "▼11%" / "보합" (상승 빨강 · 하락 파랑 관례)
  function trendTxt(pct) {
    if (pct > 0) return `<b class="up">▲${pct}%</b>`;
    if (pct < 0) return `<b class="down">▼${Math.abs(pct)}%</b>`;
    return `<b>보합</b>`;
  }

  const NEARBY_PRECISE_COUNT = 6;
  async function hydrateNearby(token) {
    const gen = ++nearbyGen;
    const p = cur.profile;
    const rep = focusPyObj();
    const vt = cur.viewType || p.residential_type;
    const bodyBox = () => bodyEl.querySelector("#nearby-body");
    const subEl = () => bodyEl.querySelector("#nearby-sub");
    if (p.latitude == null || p.longitude == null) {
      bodyBox().innerHTML = `<p class="sec-note" style="margin:0">좌표 정보가 없어 주변 비교를 할 수 없어요.</p>`;
      return;
    }
    try {
      // 후보 마커는 api 세션 캐시에 남으므로 평형 변경으로 돌아와도 다시 호출하지 않는다.
      const around = await A.nearbyMarkers(p.latitude, p.longitude, vt);
      if (token !== openToken || gen !== nearbyGen) return;
      const candidates = around
        .filter((r) => r.complex_key !== cur.key && r.latitude != null)
        .map((r) => ({
          ...r,
          distM: haversineM(p.latitude, p.longitude, r.latitude, r.longitude),
        }))
        .filter((r) => r.recent_month6_average_realdeal_price != null)
        .sort((a, b) => a.distM - b.distM)
        .slice(0, NEARBY_PRECISE_COUNT);

      if (!candidates.length) {
        bodyBox().innerHTML = `<p class="sec-note" style="margin:0">반경 1.2km에 최근 거래가 있는 ${F.esc(vt || "")} 단지가 없어요.</p>`;
        return;
      }

      if (rep) {
        await renderNearbyPrecise(token, gen, candidates, rep);
      } else {
        renderNearbyRough(token, candidates);
      }
    } catch (e) {
      if (token !== openToken || gen !== nearbyGen) return;
      console.error(e);
      const box = bodyBox();
      if (box) box.innerHTML = `<p class="sec-note" style="margin:0">주변 단지 정보를 불러오지 못했어요.</p>`;
    }
  }

  // 정밀 모드: 선택 단지의 기준 평형 면적대와 같은 조건으로 각 단지 실거래를 집계
  async function renderNearbyPrecise(token, gen, candidates, rep) {
    const range = pyeongFilterRange(rep);
    const dateFrom = sixMonthDateFrom();
    const [selfR, ...neighborRs] = await Promise.allSettled([
      focusDealsPromise(),
      ...candidates.map((c) => A.realdealPage(c.complex_key, {
        dealDivision: "매매", dateFrom,
        areaMin: range.areaMin, areaMax: range.areaMax, limit: 100,
        residentialType: c.residential_type || cur.viewType,
      })),
    ]);
    if (token !== openToken || gen !== nearbyGen) return;

    const selfStats = selfR.status === "fulfilled" ? dealStats(selfR.value.rows) : null;
    const rows = candidates.map((c, i) => {
      const r = neighborRs[i];
      const stats = r.status === "fulfilled" ? dealStats(r.value.rows) : null;
      return { c, stats };
    });
    // 거래 있는 단지를 위로, 각 그룹 안에서는 거리순 유지
    rows.sort((a, b) => ((b.stats ? 1 : 0) - (a.stats ? 1 : 0)));

    const sub = bodyEl.querySelector("#nearby-sub");
    if (sub) sub.textContent = `전용 ${rep.py}평 기준 · 최근 6개월 매매 · 반경 1.2km`;

    const delta = (v, base, unit) => {
      if (v == null || base == null) return "";
      const d = v - base;
      if (Math.abs(d) < (unit ? 10000 : 1000000)) return `<small class="nb-delta">비슷</small>`;
      return `<small class="nb-delta">(${d > 0 ? "+" : ""}${F.price(d, { compact: true })})</small>`;
    };

    const selfRow = `
      <div class="nb-row is-self" role="row">
        <div class="nb-name"><b>${F.esc(cur.profile.complex_name || "이 단지")}</b><small>기준 단지</small></div>
        <div class="nb-price">${selfStats ? F.price(selfStats.avg, { compact: true }) : "거래 없음"}</div>
        <div class="nb-unit">${selfStats?.unitAvg ? `${F.price(selfStats.unitAvg, { compact: true })}/평` : "—"}</div>
      </div>`;

    const neighborRows = rows.map(({ c, stats }) => `
      <button type="button" class="nb-row${stats ? "" : " no-deal"}" data-key="${F.esc(c.complex_key)}"
              data-type="${F.esc(c.residential_type || "")}"
              data-lat="${c.latitude}" data-lng="${c.longitude}">
        <div class="nb-name">${F.esc(c.complex_name || c.residential_type)}<small>${Math.round(c.distM).toLocaleString()}m · ${F.count(c.complex_household_count)}세대</small></div>
        <div class="nb-price">${stats
          ? `${F.price(stats.avg, { compact: true })} ${delta(stats.avg, selfStats?.avg, false)}`
          : `<span class="nb-none">동일 평형 거래 없음</span>`}</div>
        <div class="nb-unit">${stats?.unitAvg
          ? `${F.price(stats.unitAvg, { compact: true })}/평 ${delta(stats.unitAvg, selfStats?.unitAvg, true)}`
          : "—"}</div>
      </button>`).join("");

    let areaLabel = `${rep.py}평형과 같은 면적대`;
    if (rep.areaMin !== Infinity) {
      const lo = rep.areaMin.toFixed(0), hi = rep.areaMax.toFixed(0);
      areaLabel = `같은 전용면적대(${lo === hi ? `약 ${lo}㎡` : `${lo}~${hi}㎡`})`;
    }
    const box = bodyEl.querySelector("#nearby-body");
    box.innerHTML = `
      <div class="nb-table" role="table" aria-label="주변 단지 시세 비교">
        <div class="nb-head" role="row"><span>단지</span><span>평균가</span><span>평당가(전용)</span></div>
        ${selfRow}${neighborRows}
      </div>
      <p class="sec-note">${areaLabel} 매매 실거래끼리 비교했어요. 단지를 누르면 이동해요.</p>`;
    bindNearbyRows(box);
  }

  // 근사 모드(대표평형 없음): 단지 전체 6개월 평균으로만 비교
  function renderNearbyRough(token, candidates) {
    const p = cur.profile;
    const selfAvg = p.recent_month6_average_realdeal_price;
    const sub = bodyEl.querySelector("#nearby-sub");
    if (sub) sub.textContent = "단지 전체 평균 기준 · 최근 6개월 · 반경 1.2km";
    const box = bodyEl.querySelector("#nearby-body");
    box.innerHTML = `
      <div class="nb-table" role="table" aria-label="주변 단지 시세 비교">
        <div class="nb-head" role="row"><span>단지</span><span>평균가</span><span>거리</span></div>
        <div class="nb-row is-self"><div class="nb-name"><b>${F.esc(p.complex_name || "이 단지")}</b><small>기준 단지</small></div>
          <div class="nb-price">${selfAvg != null ? F.price(selfAvg, { compact: true }) : "거래 없음"}</div><div class="nb-unit">—</div></div>
        ${candidates.map((c) => `
          <button type="button" class="nb-row" data-key="${F.esc(c.complex_key)}"
                  data-type="${F.esc(c.residential_type || "")}"
                  data-lat="${c.latitude}" data-lng="${c.longitude}">
            <div class="nb-name">${F.esc(c.complex_name || c.residential_type)}<small>${F.count(c.complex_household_count)}세대</small></div>
            <div class="nb-price">${F.price(c.recent_month6_average_realdeal_price, { compact: true })}</div>
            <div class="nb-unit">${Math.round(c.distM).toLocaleString()}m</div>
          </button>`).join("")}
      </div>
      <p class="sec-note">평형 구성 정보가 없어 단지 전체 평균으로 비교했어요. 평형이 다르면 가격 차이가 클 수 있어요.</p>`;
    bindNearbyRows(box);
  }

  function bindNearbyRows(box) {
    box.querySelectorAll(".nb-row[data-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { key, type, lat, lng } = btn.dataset;
        if (lat && lng) window.mapCtl.panTo(+lat, +lng);
        open(key, type || null);
      });
    });
  }

  // ── 실거래 ────────────────────────────────────
  function dealOpts() {
    const p = cur.pyeongs.find((x) => x.py === deal.pyeong) || null;
    const { areaMin, areaMax } = pyeongFilterRange(p);
    const opts = {
      dealDivision: deal.division, areaMin: p ? areaMin : null, areaMax: p ? areaMax : null,
      residentialType: cur.viewType,
    };
    if (deal.range) {
      const d = new Date();
      d.setMonth(d.getMonth() - deal.range);
      opts.dateFrom = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`;
    }
    return opts;
  }

  async function loadDeals(token, { reset }) {
    const tbody = bodyEl.querySelector("#deal-tbody");
    const moreBtn = bodyEl.querySelector("#deal-more");
    if (!tbody) return;
    if (reset) {
      deal.rows = []; deal.offset = 0; deal.hasNext = false;
      tbody.innerHTML = `<tr><td colspan="4"><div class="skel" style="height:60px"></div></td></tr>`;
      renderChartLoading();
      const basis = bodyEl.querySelector("#chart-basis");
      if (basis) basis.textContent =
        deal.division === "월세" ? "차트는 월세액 기준" :
        deal.division === "전세" ? "보증금 기준" : "체결가 기준";
    }
    moreBtn.disabled = true;
    try {
      const opts = dealOpts();
      const { rows, hasNext } = await A.realdealPage(cur.key, { ...opts, limit: 30, offset: deal.offset });
      if (token !== openToken) return;
      deal.rows.push(...rows);
      deal.offset += rows.length;
      deal.hasNext = hasNext && deal.offset < 2000;
      renderDealTable();
      if (reset) hydrateChart(token, opts);
    } catch (e) {
      if (token !== openToken) return;
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="4"><div class="err-box">거래 내역을 불러오지 못했어요.
        <button type="button" id="deal-retry">다시 시도</button></div></td></tr>`;
      tbody.querySelector("#deal-retry")?.addEventListener("click", () => loadDeals(openToken, { reset: true }));
    } finally {
      moreBtn.disabled = false;
    }
  }

  function renderDealTable() {
    const tbody = bodyEl.querySelector("#deal-tbody");
    const moreBtn = bodyEl.querySelector("#deal-more");
    if (!deal.rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:22px 0">
        이 조건의 거래가 없어요. 기간을 넓히거나 평형 필터를 풀어 보세요.</td></tr>`;
      moreBtn.hidden = true;
      return;
    }
    const cls = deal.division === "매매" ? "sale" : deal.division === "전세" ? "jeonse" : "rent";
    tbody.innerHTML = deal.rows.map((d) => {
      const priceTxt = deal.division === "월세"
        ? F.rent(d.deposit_price, d.price)
        : F.price(deal.division === "전세" ? d.deposit_price : d.price, { compact: true });
      const tags =
        (d.registry_date ? `<span class="tag registry" title="등기 ${F.dateShort(d.registry_date)}">등기</span>` : "") +
        (d.cancel_date ? `<span class="tag cancel" title="취소 ${F.dateShort(d.cancel_date)}">취소</span>` : "");
      return `<tr${d.cancel_date ? ' class="is-cancel"' : ""}>
        <td class="dt-sub">${F.dateShort(d.contract_date)}</td>
        <td><span class="dt-price ${cls}">${priceTxt}</span>${tags}</td>
        <td class="dt-sub">${d.floor_name ? `${F.esc(d.floor_name)}층` : "—"}</td>
        <td class="dt-sub">${F.area(d.private_area)}</td>
      </tr>`;
    }).join("");
    moreBtn.hidden = !deal.hasNext;
  }

  function renderChartLoading() {
    const wrap = bodyEl.querySelector("#deal-chart");
    if (chartHandle) { chartHandle.destroy(); chartHandle = null; }
    wrap.innerHTML = `<div class="chart-empty">거래 내역을 불러오는 중…</div>`;
  }

  async function hydrateChart(token, opts) {
    try {
      // 전세 겹쳐보기: 매매와 같은 조건(기간·면적·유형)으로 전세를 함께 수집해
      // 한 축 위에서 매매·전세 간격(전세가율의 시각화)을 보여준다.
      const wantOverlay = deal.division === "매매" && deal.overlayJeonse;
      const [baseR, overlayR] = await Promise.all([
        A.realdealCollect(cur.key, {
          dealDivision: opts.dealDivision, dateFrom: opts.dateFrom || null,
          areaMin: opts.areaMin, areaMax: opts.areaMax,
          residentialType: opts.residentialType,
        }, { maxPages: 6 }),
        wantOverlay
          ? A.realdealCollect(cur.key, {
              dealDivision: "전세", dateFrom: opts.dateFrom || null,
              areaMin: opts.areaMin, areaMax: opts.areaMax,
              residentialType: opts.residentialType,
            }, { maxPages: 6 }).catch(() => ({ rows: [], truncated: false }))
          : Promise.resolve(null),
      ]);
      const { rows: all, truncated } = baseR;
      if (token !== openToken) return;
      const wrap = bodyEl.querySelector("#deal-chart");
      if (!wrap) return;
      if (chartHandle) chartHandle.destroy();
      chartHandle = window.dealChart.render(wrap, all, deal.division, {
        monthsBack: deal.range || null,
        overlay: overlayR && overlayR.rows.length
          ? { deals: overlayR.rows, dealType: "전세", label: "전세(보증금)" }
          : null,
      });
      if (truncated) {
        const basis = bodyEl.querySelector("#chart-basis");
        if (basis) basis.textContent += ` · 최신 ${all.length.toLocaleString()}건 표시`;
      }
    } catch (e) {
      if (token !== openToken) return;
      console.error(e);
      const wrap = bodyEl.querySelector("#deal-chart");
      if (wrap) wrap.innerHTML = `<div class="chart-empty">차트를 그리지 못했어요.</div>`;
    }
  }

  // ── 평형 칩/카드, 동 그리드 ────────────────────
  // 평형 선택은 실거래만이 아니라 게이지·주변비교의 기준이기도 하다 — 기준이 실제로
  // 바뀌었을 때만 두 섹션을 스켈레톤으로 되돌리고 새 기준으로 다시 채운다.
  function onPyeongChange(prevFocusPy) {
    const nextFocusPy = focusPyObj()?.py ?? null;
    renderPyeongChips();
    renderPyeongCards();
    loadDeals(openToken, { reset: true });
    if (prevFocusPy === nextFocusPy) return;
    renderGaugeSkeleton();
    hydrateGauge(openToken);
    const box = bodyEl.querySelector("#nearby-body");
    if (box) box.innerHTML = `<div class="skel" style="height:130px"></div>`;
    hydrateNearby(openToken);
  }

  function renderPyeongChips() {
    const wrap = bodyEl.querySelector("#py-chips");
    if (!cur.pyeongs.length) { wrap.hidden = true; return; }
    const chips = [{ py: null, label: "전체" }, ...cur.pyeongs.map((p) => ({ py: p.py, label: `${p.py}평`, ho: p.ho }))];
    wrap.innerHTML = chips.map((c) =>
      `<button type="button" class="py-chip${c.py === deal.pyeong ? " is-on" : ""}" data-py="${c.py ?? ""}">
        ${c.label}${c.ho ? `<small>${F.count(c.ho)}호</small>` : ""}</button>`).join("");
    wrap.querySelectorAll(".py-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prev = focusPyObj()?.py ?? null;
        deal.pyeong = btn.dataset.py === "" ? null : +btn.dataset.py;
        onPyeongChange(prev);
      });
    });
  }

  function renderPyeongCards() {
    const wrap = bodyEl.querySelector("#py-cards");
    if (!cur.pyeongs.length) {
      // 주상복합에서 진입 유형의 동 데이터가 상품에 없을 수 있다 — 다른 유형의 동을
      // 조용히 보여주는 대신 유형을 명시해 비어 있음을 알린다.
      wrap.innerHTML = `<p class="sec-note">${cur.typeMismatch
        ? `이 단지의 ${F.esc(cur.viewType)} 동·평형 정보는 제공되지 않아요.`
        : "평형 정보가 없어요."}</p>`;
      return;
    }
    wrap.innerHTML = cur.pyeongs.map((p) => `
      <button type="button" class="py-card${p.py === deal.pyeong ? " is-on" : ""}" data-py="${p.py}" data-testid="area-summary-card">
        <div class="pc-py">${p.py}평형</div>
        <div class="pc-types">타입 ${[...p.types].sort().join("·") || "—"}</div>
        <div class="pc-ho">전용 ${p.areaMin === Infinity ? "—"
          : (p.areaMax - p.areaMin < 0.05 ? `${p.areaMin.toFixed(1)}㎡` : `${p.areaMin.toFixed(1)}~${p.areaMax.toFixed(1)}㎡`)} · ${F.count(p.ho)}호</div>
      </button>`).join("");
    wrap.querySelectorAll(".py-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prev = focusPyObj()?.py ?? null;
        deal.pyeong = +btn.dataset.py === deal.pyeong ? null : +btn.dataset.py;
        onPyeongChange(prev);
        bodyEl.querySelector("#sec-deals").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  const DONG_VISIBLE = 24;
  let dongExpanded = false;
  function renderDongGrid() {
    const wrap = bodyEl.querySelector("#dong-grid");
    const sorted = [...cur.buildings].sort((a, b) =>
      String(a.dong_name).localeCompare(String(b.dong_name), "ko", { numeric: true }));
    const list = dongExpanded ? sorted : sorted.slice(0, DONG_VISIBLE);
    wrap.innerHTML = list.map((b) => `
      <button type="button" class="dong-cell" data-ppk="${F.esc(b.ppk)}" data-testid="building-card">
        ${F.esc(b.dong_name)}동 <small>${b.total_ho_count ?? "—"}호</small>
      </button>`).join("") +
      (sorted.length > DONG_VISIBLE && !dongExpanded
        ? `<button type="button" class="dong-cell dong-more" id="dong-more">+${sorted.length - DONG_VISIBLE}개 더보기</button>`
        : "");
    wrap.querySelectorAll(".dong-cell[data-ppk]").forEach((btn) => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll(".dong-cell").forEach((b) => b.classList.toggle("is-on", b === btn));
        const b = cur.buildings.find((x) => x.ppk === btn.dataset.ppk);
        if (b) openSheet(b);
      });
    });
    wrap.querySelector("#dong-more")?.addEventListener("click", () => {
      dongExpanded = true;
      renderDongGrid();
    });
  }

  // ── 입지·학군 ─────────────────────────────────
  function renderLocation() {
    const p = cur.profile;
    const items = [];
    if (p.nearby_subway_station_name) {
      items.push({ badge: "역", name: `${p.nearby_subway_station_name}역`, sub: F.walk(p.nearby_subway_station_distance) });
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
    if (p.nearby_park_distance != null) items.push({ badge: "공원", name: "가까운 공원", sub: F.walk(p.nearby_park_distance) });
    if (p.nearby_hospital_distance != null) items.push({ badge: "병원", name: "가까운 병원", sub: F.walk(p.nearby_hospital_distance) });
    if (p.nearby_large_store_count != null) items.push({ badge: "마트", name: `대형마트 ${p.nearby_large_store_count}곳`, sub: "주변 1km 기준" });

    document.getElementById("loc-list").innerHTML = items.length
      ? items.map((i) => `
        <div class="school-item">
          <span class="sc-badge">${F.esc(i.badge)}</span>
          <div><div class="sc-name">${F.esc(i.name)}</div><div class="sc-sub">${F.esc(i.sub)}</div></div>
        </div>`).join("")
      : `<p class="sec-note">입지 정보가 없어요.</p>`;
  }

  // ── 단지 개요 ─────────────────────────────────
  function renderOverview() {
    const p = cur.profile;
    // 헤더에서 이관된 공부 수치(용적률·건폐율·주차 세대당·난방)는 여기가 정위치다
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

  // ── 호실 시트 ─────────────────────────────────
  let sheetToken = 0;
  async function openSheet(building) {
    const token = ++sheetToken;
    sheetEl.hidden = false;
    sheetEl.innerHTML = `
      <div class="us-head">
        <h3>${F.esc(building.dong_name)}동</h3>
        <span class="p-badge">${building.total_ho_count ?? "—"}호 · 지상 ${building.ground_floor_count ?? "—"}층</span>
        <button type="button" class="p-close" id="us-close" aria-label="호실 시트 닫기">×</button>
      </div>
      <div class="us-body">
        <div class="skel" style="height:200px"></div>
      </div>`;
    sheetEl.querySelector("#us-close").addEventListener("click", closeSheet);
    window.mapCtl.panTo(building.latitude, building.longitude, Math.min(window.mapCtl.getLevel() ?? 3, 3));

    try {
      const collected = [];
      let offset = 0, hasNext = true;
      while (hasNext && offset < 500) {
        const r = await A.units(cur.key, building.ppk, { offset, limit: 100 });
        collected.push(...r.rows);
        hasNext = r.hasNext;
        offset += r.rows.length;
        if (!r.rows.length) break;
      }
      if (token !== sheetToken) return;
      renderUnits(building, collected);
    } catch (e) {
      if (token !== sheetToken) return;
      console.error(e);
      sheetEl.querySelector(".us-body").innerHTML = `<div class="err-box">호실 정보를 불러오지 못했어요.</div>`;
    }
  }

  function renderUnits(building, units) {
    const body = sheetEl.querySelector(".us-body");
    if (!units.length) {
      body.innerHTML = `<p class="sec-note" data-testid="unit-empty-state">등록된 호실 정보가 없어요.</p>`;
      return;
    }
    // 층 내림차순 → 호 오름차순
    const sorted = [...units].sort((a, b) =>
      (b.floor_number - a.floor_number) || String(a.ho_name).localeCompare(String(b.ho_name), "ko", { numeric: true }));
    body.innerHTML = `
      <p class="sec-note" style="margin:0 0 10px">호를 선택하면 그 호의 산출시세와 공시가격을 보여드려요.</p>
      <div class="unit-rows">
        ${sorted.map((u) => `
          <button type="button" class="unit-row" data-jpk="${F.esc(u.jpk)}" data-testid="unit-row">
            <span class="ur-ho">${F.esc(u.ho_name)}호</span>
            <span class="ur-meta">${u.floor_number}층 · 전용 ${F.area(u.private_area)}${u.supply_area ? ` · 공급 ${F.area(u.supply_area)}` : ""}</span>
            <span class="ur-py">${u.pyeong_number ?? "—"}평${u.pyeong_type_name ? F.esc(u.pyeong_type_name) : ""}</span>
          </button>`).join("")}
      </div>`;
    body.querySelectorAll(".unit-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        body.querySelectorAll(".unit-row").forEach((b) => b.classList.toggle("is-on", b === btn));
        const u = sorted.find((x) => x.jpk === btn.dataset.jpk);
        if (u) showUnitDetail(btn, u);
      });
    });
  }

  async function showUnitDetail(rowBtn, unit) {
    sheetEl.querySelector(".unit-detail")?.remove();
    const box = document.createElement("div");
    box.className = "unit-detail";
    box.innerHTML = `<h4>${F.esc(unit.ho_name)}호 가격 정보</h4><div class="skel" style="height:80px"></div>`;
    rowBtn.insertAdjacentElement("afterend", box);
    const token = sheetToken;
    try {
      const [ests, notices] = await Promise.all([
        A.estimatesByJpk(unit.jpk).catch(() => []),
        A.noticePricesByJpk(unit.jpk).catch(() => []),
      ]);
      if (token !== sheetToken) return;
      const estRows = ests.slice(0, 6).map((e) => `
        <div class="ud-price-row">
          <span>산출시세 ${F.ym(e.sise_production_standard_ym)}</span>
          <b style="color:var(--est)">${F.price(e.sise_price, { compact: true })}
            <small style="font-weight:500;color:var(--ink-3)">(${F.price(e.lowerlimit_sise_price, { compact: true })}~${F.price(e.upperlimit_sise_price, { compact: true })})</small></b>
        </div>`).join("");
      const ntRows = notices.slice(0, 6).map((n) => `
        <div class="ud-price-row">
          <span>공시가격 ${n.notice_year}년</span>
          <b style="color:var(--notice)">${F.price(n.notice_price, { compact: true })}</b>
        </div>`).join("");
      // 데이터가 여러 기준월이면 "추이", 최신 기준월 1건뿐이면 "현재 가격"으로 정직하게 라벨링.
      // (상품 적재가 최신 스냅샷만일 수 있다 — 1건짜리를 "이력"이라 부르지 않는다.)
      const isHistory = new Set(ests.map((e) => e.sise_production_standard_ym)).size > 1
        || new Set(notices.map((n) => n.notice_standard_ym)).size > 1;
      box.innerHTML = `<h4>${F.esc(unit.ho_name)}호 ${isHistory ? "가격 추이" : "현재 가격"} <small style="font-weight:500;color:var(--ink-3)">전용 ${F.area(unit.private_area)}${isHistory ? "" : " · 최신 기준월"}</small></h4>
        ${estRows || ""}${ntRows || ""}
        ${!estRows && !ntRows ? `<p class="sec-note" style="margin:0">이 호의 시세·공시 정보가 없어요.</p>` : ""}`;
    } catch (e) {
      console.error(e);
      box.innerHTML = `<h4>${F.esc(unit.ho_name)}호</h4><p class="sec-note" style="margin:0">가격 정보를 불러오지 못했어요.</p>`;
    }
  }

  function closeSheet() {
    sheetToken++;
    sheetEl.hidden = true;
    sheetEl.innerHTML = "";
  }

  function rerender() {
    if (cur) {
      const key = cur.key;
      open(key, cur.viewType);
    }
  }

  return { open, close, rerender, isOpen: () => !panelEl.hidden };
})();

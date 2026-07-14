// 단지 상세 패널의 가격 모듈 — 단지 실거래 요약·상세 목록·차트·주변 비교
//
// 조회 전략(성능 계약):
//   · 동 목록에서 대표 평형을 정한 뒤 실거래 첫 페이지(100건)를 1회 조회한다.
//     목록(30건씩 공개)·차트가 이 rows를 공유한다. 단지 전체 요약은
//     프로필의 최근 6개월 요약을 사용하며 첫 페이지 rows로 덮어쓰지 않는다.
//   · 주변 비교는 섹션이 화면에 보일 때 마커 1회로 그린다.
window.createPanelPriceModule = (context) => {
  const {F,A,D,Async,bodyEl,pyeongFilterRange,getFocusPyeong,formatPyeongBand,formatUnitArea,renderAreaUnavailable,openComplex}=context;
  const dealRequest = Async.latestRequest();
  const chartRequest = Async.latestRequest();
  let chartHandle = null;
  let nearbyGen = 0;
  let nearbyObserver = null;
  let nearbyCandidates = null;
  let nearbyTruncated = false;

  const PAGE_LIMIT = 100; // 실거래 페이지 크기 — 첫 1회 조회를 목록·차트가 공유
  const MAX_OFFSET = 2000; // 실거래 상품 offset 상한
  const TABLE_STEP = 30; // 더 보기 1회당 표에 추가 공개되는 행 수
  const NEARBY_DISPLAY_COUNT = 6;

  // ── 실거래 스코프 헬퍼 ───────────────────────────────
  function realdealScopeKey(opts) {
    const cur = context.getCur();
    return D.realdealScopeKey({
      complexKey: cur?.key,
      residentialType: opts?.residentialType,
      areaMin: opts?.areaMin,
      areaMax: opts?.areaMax,
      dealDivision: opts?.dealDivision,
      dateFrom: opts?.dateFrom,
      dateTo: opts?.dateTo,
    });
  }

  const scopedRows = (store, opts) =>
    store && store.key === realdealScopeKey(opts) ? store : null;

  // ── 컨트롤 바인딩 ────────────────────────────────────────
  function bindControls() {
    bodyEl.querySelectorAll(".deal-seg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const deal = context.getDeal();
        if (!deal) return;
        bodyEl.querySelectorAll(".deal-seg button").forEach((b) => b.classList.toggle("is-on", b === btn));
        deal.division = btn.dataset.deal;
        syncOverlayBtn();
        loadDeals(context.getOpenToken(), { reset: true });
      });
    });
    bodyEl.querySelectorAll(".range-toggle button[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const deal = context.getDeal();
        if (!deal) return;
        bodyEl.querySelectorAll(".range-toggle button[data-range]").forEach((b) => b.classList.toggle("is-on", b === btn));
        deal.range = +btn.dataset.range || null;
        loadDeals(context.getOpenToken(), { reset: true });
      });
    });
    const overlayBtn = bodyEl.querySelector("#jeonse-overlay");
    const syncOverlayBtn = () => {
      const deal = context.getDeal();
      if (!overlayBtn || !deal) return;
      overlayBtn.hidden = deal.division !== "매매";
      overlayBtn.classList.toggle("is-on", deal.overlayJeonse);
      overlayBtn.setAttribute("aria-pressed", String(deal.overlayJeonse));
    };
    overlayBtn?.addEventListener("click", () => {
      const deal = context.getDeal();
      if (!deal) return;
      deal.overlayJeonse = !deal.overlayJeonse;
      syncOverlayBtn();
      renderChartLoading();
      // 기본 실거래가 아직 도착하지 않았다면 선택 상태만 보존한다. 실거래
      // 완료 시 현재 overlay 상태로 한 번만 다시 그려 선행 전세 호출을 막는다.
      if (!deal.rows.length) return;
      hydrateChart(context.getOpenToken(), chartRequest.next());
    });
    syncOverlayBtn();
    // 더 보기: 이미 받아 둔 rows를 먼저 공개하고, 다 보여줬을 때만 다음 페이지를 조회한다.
    bodyEl.querySelector("#deal-more")?.addEventListener("click", () => {
      const deal = context.getDeal();
      if (!deal) return;
      if (deal.shown < deal.rows.length) {
        deal.shown = Math.min(deal.shown + TABLE_STEP, deal.rows.length);
        renderDealTable(deal);
      } else if (deal.hasNext) {
        loadDeals(context.getOpenToken(), { reset: false });
      }
    });
  }

  // ── 실거래 목록·차트 ─────────────────────────────────────
  function dealOpts() {
    const cur = context.getCur();
    const deal = context.getDeal();
    if (!cur || !deal) return null;
    const p = cur.pyeongs.find((item) => item.py === deal.pyeong) || null;
    const { areaMin, areaMax } = pyeongFilterRange(p);
    if (p && areaMin == null) return null;
    const opts = {
      dealDivision: deal.division, areaMin: p ? areaMin : null, areaMax: p ? areaMax : null,
      residentialType: cur.viewType,
    };
    if (deal.range) {
      const period = F.productPeriod(cur.profile.standard_ym, deal.range);
      if (period) Object.assign(opts, period);
    }
    return opts;
  }

  async function loadDeals(token, { reset }) {
    const cur = context.getCur();
    const deal = context.getDeal();
    const tbody = bodyEl.querySelector("#deal-tbody");
    const moreBtn = bodyEl.querySelector("#deal-more");
    if (!cur || !deal || !tbody || !moreBtn) return;
    // 평형이 있는 단지를 잠깐 단지 전체로 조회하는 경합을 막는다. 동 상품이
    // 성공적으로 끝난 뒤 대표 평형 또는 평형 없음 fallback이 확정돼야 호출한다.
    if (!cur.buildingsReady) return;
    if (cur.buildingsError) { renderDealDependencyError(); return; }
    const sequence = reset ? dealRequest.next() : dealRequest.current();
    // 새 실거래 범위가 시작되면 이전 차트/전세 요청을 즉시 무효화한다.
    if (reset) chartRequest.next();
    if (reset) {
      deal.rows = []; deal.offset = 0; deal.shown = 0;
      deal.hasNext = false; deal.truncated = false;
      deal.overlayError = false; deal.overlayHasNext = false; deal.overlayTruncated = false;
      tbody.innerHTML = `<tr><td colspan="4"><div class="skel" style="height:60px"></div></td></tr>`;
      renderChartLoading();
      renderLoadNote(deal);
      const basis = bodyEl.querySelector("#chart-basis");
      if (basis) {
        const basisLabel = deal.division === "월세" ? "차트는 월세액 기준" :
          deal.division === "전세" ? "보증금 기준" : "체결가 기준";
        // 전용면적이 겹치는 평형(32/33평)은 한 밴드로 조회됨을 표에서도 밝힌다
        const band = context.getFocusBand();
        basis.textContent = band && band.pys.length > 1
          ? `${formatPyeongBand(getFocusPyeong())} · ${basisLabel}`
          : basisLabel;
      }
    }
    const opts = dealOpts();
    if (!opts) {
      renderAreaUnavailable();
      return;
    }
    moreBtn.disabled = true;
    try {
      const { rows, hasNext } = await A.realdealPage(cur.key, { ...opts, limit: PAGE_LIMIT, offset: deal.offset });
      if (!context.isCurrentOpen(token) || !dealRequest.isCurrent(sequence)) return;
      deal.rows.push(...rows);
      deal.offset += rows.length;
      deal.truncated = !!hasNext && deal.offset >= MAX_OFFSET;
      deal.hasNext = !!hasNext && !deal.truncated;
      deal.shown = Math.min(deal.shown + TABLE_STEP, deal.rows.length);
      // 매매/전세 비교 캐시만 보존한다. 매매 rows는 현재 deal 상태가 이미 들고 있고,
      // 대표가격은 상세 rows가 아니라 프로필 요약을 사용한다.
      const store = {
        key: realdealScopeKey(opts), rows: deal.rows,
        hasNext: deal.hasNext, truncated: deal.truncated,
      };
      if (deal.division === "전세") cur.jeonseRows = store;
      renderDealTable(deal);
      renderLoadNote(deal);
      // API 대기 중 매매/전세 버튼이 차트 세대를 바꿨어도, 완료된 최신
      // 실거래 rows를 현재 UI 상태로 그릴 새 세대를 여기서 발급한다.
      hydrateChart(token, chartRequest.next());
    } catch (e) {
      if (!context.isCurrentOpen(token) || !dealRequest.isCurrent(sequence)) return;
      console.error(e);
      deal.hasNext = false;
      deal.truncated = false;
      chartRequest.next(); // 진행 중인 전세/차트 요청이 오류 화면을 덮지 못하게 한다.
      tbody.innerHTML = `<tr><td colspan="4"><div class="err-box">실거래 정보를 불러오지 못했어요.
        <button type="button" id="deal-retry">다시 시도</button></div></td></tr>`;
      tbody.querySelector("#deal-retry")?.addEventListener("click", () => loadDeals(context.getOpenToken(), { reset: true }));
      renderChartError("실거래 정보를 불러오지 못했어요.");
      renderLoadNote(deal);
    } finally {
      if (context.isCurrentOpen(token) && dealRequest.isCurrent(sequence)) moreBtn.disabled = false;
    }
  }

  function renderDealTable(deal) {
    const tbody = bodyEl.querySelector("#deal-tbody");
    const moreBtn = bodyEl.querySelector("#deal-more");
    if (!tbody || !moreBtn) return;
    if (!deal.rows.length) {
      // 정상 조회인데 0건 — API 실패(err-box)·면적 누락(areaMessage)과 문구를 구분한다
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:22px 0">
        선택한 기간·면적에 신고된 거래가 없어요. 다른 기간이나 평형을 선택해 보세요.</td></tr>`;
      moreBtn.hidden = true;
      return;
    }
    const cls = deal.division === "매매" ? "sale" : deal.division === "전세" ? "jeonse" : "rent";
    tbody.innerHTML = deal.rows.slice(0, deal.shown).map((row) => {
      const priceTxt = deal.division === "월세"
        ? F.rent(row.deposit_price, row.price)
        : F.price(deal.division === "전세" ? row.deposit_price : row.price, { compact: true });
      const tags =
        (row.registry_date ? `<span class="tag registry" title="등기 ${F.dateShort(row.registry_date)}">등기</span>` : "") +
        (row.cancel_date ? `<span class="tag cancel" title="취소 ${F.dateShort(row.cancel_date)}">취소</span>` : "");
      return `<tr${row.cancel_date ? ' class="is-cancel"' : ""}>
        <td class="dt-sub">${F.dateShort(row.contract_date)}</td>
        <td><span class="dt-price ${cls}">${priceTxt}</span>${tags}</td>
        <td class="dt-sub">${row.floor_name ? `${F.esc(row.floor_name)}층` : "—"}</td>
        <td class="dt-sub">${formatUnitArea(row.private_area)}</td>
      </tr>`;
    }).join("");
    const canReveal = deal.shown < deal.rows.length;
    moreBtn.hidden = !(canReveal || deal.hasNext);
    moreBtn.textContent = `더 보기 · ${F.count(deal.shown)}/${F.count(deal.rows.length)}${deal.hasNext ? "+" : ""}건`;
  }

  // 일부만 조회된 상태를 명시 — 전체 요약처럼 읽히지 않게 한다
  function renderLoadNote(deal) {
    const note = bodyEl.querySelector("#deal-load-note");
    if (!note) return;
    const messages = [];
    if (deal.truncated) {
      messages.push(`최신 ${F.count(deal.offset)}건 표시 · 상품 조회 한도에 도달해 전체 거래가 아니에요`);
    } else if (deal.hasNext) {
      messages.push(`최신 ${F.count(deal.rows.length)}건 표시 · 추가 거래가 있어요`);
    }
    if (deal.division === "매매" && deal.overlayJeonse) {
      if (deal.overlayError) messages.push("전세 정보를 불러오지 못해 매매만 표시해요");
      else if (deal.overlayTruncated) messages.push("전세 차트는 상품 조회 한도까지 표시하며 전체 거래가 아니에요");
      else if (deal.overlayHasNext) messages.push(`전세 차트는 최신 ${PAGE_LIMIT}건 기준이에요`);
    }
    note.textContent = messages.join(" · ");
    note.hidden = messages.length === 0;
  }

  function renderChartLoading() {
    const wrap = bodyEl.querySelector("#deal-chart");
    if (!wrap) return;
    if (chartHandle) { chartHandle.destroy(); chartHandle = null; }
    wrap.innerHTML = `<div class="chart-empty">거래 내역을 불러오는 중…</div>`;
  }

  function renderChartError(message) {
    const wrap = bodyEl.querySelector("#deal-chart");
    if (!wrap) return;
    if (chartHandle) { chartHandle.destroy(); chartHandle = null; }
    wrap.innerHTML = `<div class="chart-empty">${F.esc(message)}</div>`;
  }

  // 차트는 목록과 같은 rows를 그린다 — 차트용 다건 수집 호출을 따로 만들지 않는다.
  async function hydrateChart(token, sequence) {
    const cur = context.getCur();
    const deal = context.getDeal();
    if (!cur || !deal || sequence == null) return;
    const wrap = bodyEl.querySelector("#deal-chart");
    if (!wrap) return;
    try {
      // 조회 창(dateFrom/dateTo)은 축 경계 전달에도 쓰인다 — 면적 미확정이면 null
      const opts = dealOpts();
      let overlay = null;
      deal.overlayError = false;
      deal.overlayHasNext = false;
      deal.overlayTruncated = false;
      if (deal.division === "매매" && deal.overlayJeonse) {
        // 전세 rows는 같은 스코프 캐시가 있으면 재사용, 없으면 100건 1회
        if (!opts) return;
        const jeonseOpts = { ...opts, dealDivision: "전세" };
        let jeonseStore = scopedRows(cur.jeonseRows, jeonseOpts);
        if (!jeonseStore) {
          let r = null;
          try {
            r = await A.realdealPage(cur.key, { ...jeonseOpts, limit: PAGE_LIMIT });
          } catch (error) {
            console.error(error);
            if (!context.isCurrentOpen(token) || !chartRequest.isCurrent(sequence)) return;
            deal.overlayError = true;
          }
          if (!context.isCurrentOpen(token) || !chartRequest.isCurrent(sequence)) return;
          if (r) {
            jeonseStore = {
              key: realdealScopeKey(jeonseOpts),
              rows: r.rows,
              hasNext: !!r.hasNext,
            };
            cur.jeonseRows = jeonseStore;
          }
        }
        deal.overlayHasNext = !!jeonseStore?.hasNext;
        deal.overlayTruncated = !!jeonseStore?.truncated;
        if (jeonseStore?.rows.length) {
          overlay = { deals: jeonseStore.rows, dealType: "전세", label: "전세(보증금)" };
        }
      }
      if (!context.isCurrentOpen(token) || !chartRequest.isCurrent(sequence)) return;
      renderLoadNote(deal);
      if (chartHandle) { chartHandle.destroy(); chartHandle = null; }
      if (!deal.rows.length) {
        wrap.innerHTML = `<div class="chart-empty">선택한 기간·면적에 신고된 거래가 없어요.</div>`;
        return;
      }
      // 축 경계 계약: 오른쪽 끝 = 조회 종료일(상품 기준월 말일, standard_ym에서 매월 동적 계산),
      // 왼쪽 끝 = 완전 조회(!hasNext && !truncated)일 때만 조회 시작일. 부분 로드는 첫 거래일.
      chartHandle = window.dealChart.render(wrap, deal.rows, deal.division, {
        overlay,
        dateFrom: opts?.dateFrom ?? null,
        dateTo: opts?.dateTo ?? null,
        hasNext: deal.hasNext,
        truncated: deal.truncated,
      });
    } catch (e) {
      if (!context.isCurrentOpen(token) || !chartRequest.isCurrent(sequence)) return;
      console.error(e);
      wrap.innerHTML = `<div class="chart-empty">차트를 그리지 못했어요.</div>`;
    }
  }

  // ── 단지 실거래 요약 ─────────────────────────────────────
  // 프로필에 사전 집계된 최근 6개월 값만 보여주고 호실 단위 산출시세와 비교하지 않는다.
  function hydrateSummary() {
    const cur = context.getCur();
    if (!cur) return;
    const el = bodyEl.querySelector("#sec-price-summary");
    if (!el) return;
    const p = cur.profile;
    // 대표가격은 단지 프로필의 사전 집계만 사용한다. 선택 평형의 일부 상세 rows를
    // 대표 평균으로 승격하지 않으며, 복합단지 유형이 다르면 프로필 가격도 숨긴다.
    const evidence = D.profilePriceEvidence({
      min: p.recent_month6_min_realdeal_price,
      avg: p.recent_month6_average_realdeal_price,
      max: p.recent_month6_max_realdeal_price,
      count: p.recent_month6_realdeal_count,
    }, { typeMismatch: cur.typeMismatch });

    if (!evidence) {
      const statusText = cur.typeMismatch
        ? `프로필 가격은 ${p.residential_type || "대표 유형"} 기준이라 ${cur.viewType || "선택 유형"} 가격으로 표시하지 않아요.`
        : "단지 프로필에 최근 6개월 실거래 요약이 없어요.";
      el.innerHTML = `
        <div class="price-summary-head">
          <h3 class="price-summary-title">최근 6개월 실거래 요약</h3>
          <p class="price-summary-empty">${F.esc(statusText)}</p>
        </div>
        <p class="price-summary-note">선택 평형의 거래는 아래 실거래 목록과 차트에서 확인할 수 있어요.</p>`;
      return;
    }

    el.innerHTML = `
      <div class="price-summary-head">
        <h3 class="price-summary-title">최근 6개월 실거래 요약</h3>
        <span class="price-summary-label">단지 전체 평균 · <b>${F.count(evidence.count)}건 기준</b></span>
        <strong class="price-summary-value">${F.price(evidence.avg)}</strong>
      </div>
      <div class="price-summary-facts">
        <span>데이터 기준 <b>${F.ym(p.standard_ym)}</b></span>
        <span>최저·최고 거래가 <b>${F.price(evidence.min, { compact: true })}~${F.price(evidence.max, { compact: true })}</b></span>
      </div>
      <p class="price-summary-note">신고 기반 체결가의 단지 전체 요약이에요. 선택 평형의 거래는 아래 목록과 차트에서 보여줘요.</p>`;
  }

  // ── 주변 단지 비교 ───────────────────────────────────────
  // 섹션이 화면에 보일 때 마커 1회로 단지 전체 대표가격을 비교한다.
  function observeNearby(token) {
    nearbyCandidates = null;
    nearbyTruncated = false;
    if (nearbyObserver) { nearbyObserver.disconnect(); nearbyObserver = null; }
    const target = bodyEl.querySelector("#sec-nearby");
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      hydrateNearby(token);
      return;
    }
    nearbyObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (nearbyObserver) { nearbyObserver.disconnect(); nearbyObserver = null; }
      hydrateNearby(context.getOpenToken());
    }, { root: bodyEl, rootMargin: "160px 0px" });
    nearbyObserver.observe(target);
  }

  async function hydrateNearby(token) {
    const cur = context.getCur();
    if (!cur) return;
    const gen = ++nearbyGen;
    const p = cur.profile;
    const vt = cur.viewType || p.residential_type;
    const box = bodyEl.querySelector("#nearby-body");
    if (!D.validCoordinate(p.longitude, p.latitude)) {
      if (box) box.innerHTML = `<p class="sec-note" style="margin:0">좌표 정보가 없어 주변 비교를 할 수 없어요.</p>`;
      return;
    }
    if (box) box.innerHTML = `<div class="skel" style="height:130px"></div>`;
    try {
      const { rows, truncated } = await A.nearbyMarkers(p.latitude, p.longitude, vt);
      if (!context.isCurrentOpen(token) || gen !== nearbyGen) return;
      nearbyTruncated = truncated;
      nearbyCandidates = rows
        .filter((row) => row.complex_key !== cur.key && D.validCoordinate(row.longitude, row.latitude))
        .map((row) => ({ ...row, distM: D.distanceMeters(p.latitude, p.longitude, row.latitude, row.longitude) }))
        .filter((row) => D.validPrice(row.recent_month6_average_realdeal_price))
        .sort((a, b) => a.distM - b.distM)
        .slice(0, NEARBY_DISPLAY_COUNT);
      if (!nearbyCandidates.length) {
        const target = bodyEl.querySelector("#nearby-body");
        if (target) target.innerHTML = `<p class="sec-note" style="margin:0">반경 1.2km에 최근 거래가 있는 ${F.esc(vt || "")} 단지가 없어요.</p>`;
        return;
      }
      renderNearbyRough();
    } catch (e) {
      if (!context.isCurrentOpen(token) || gen !== nearbyGen) return;
      console.error(e);
      const target = bodyEl.querySelector("#nearby-body");
      if (target) target.innerHTML = `<p class="sec-note" style="margin:0">주변 단지 정보를 불러오지 못했어요.</p>`;
    }
  }

  // 간단 비교: 마커 상품이 이미 들고 있는 단지 요약가로 그린다 — 추가 호출 없음
  function renderNearbyRough() {
    const cur = context.getCur();
    if (!cur || !nearbyCandidates) return;
    const p = cur.profile;
    const selfAvg = D.validPrice(p.recent_month6_average_realdeal_price)
      ? p.recent_month6_average_realdeal_price
      : null;
    const sub = bodyEl.querySelector("#nearby-sub");
    if (sub) sub.textContent = "단지 전체 최근 6개월 실거래 평균 · 반경 1.2km";
    const box = bodyEl.querySelector("#nearby-body");
    if (!box) return;
    box.innerHTML = `
      <div class="nb-table" role="table" aria-label="주변 단지 실거래 비교">
        <div class="nb-head" role="row"><span>단지</span><span>평균 거래가</span><span>거리</span></div>
        <div class="nb-row is-self"><div class="nb-name"><b>${F.esc(p.complex_name || "이 단지")}</b><small>기준 단지</small></div>
          <div class="nb-price">${selfAvg != null ? F.price(selfAvg, { compact: true }) : "거래 없음"}</div><div class="nb-unit">—</div></div>
        ${nearbyCandidates.map((candidate) => `
          <button type="button" class="nb-row" data-key="${F.esc(candidate.complex_key)}"
                  data-type="${F.esc(candidate.residential_type || "")}"
                  data-lat="${candidate.latitude}" data-lng="${candidate.longitude}">
            <div class="nb-name">${F.esc(candidate.complex_name || candidate.residential_type)}<small>${F.count(candidate.complex_household_count)}세대</small></div>
            <div class="nb-price">${D.validPrice(candidate.recent_month6_average_realdeal_price)
              ? F.price(candidate.recent_month6_average_realdeal_price, { compact: true })
              : "거래 없음"}</div>
            <div class="nb-unit">${Math.round(candidate.distM).toLocaleString()}m</div>
          </button>`).join("")}
      </div>
      <p class="sec-note">가격은 주거유형별 값이 아닌 단지 전체의 최근 6개월 실거래 평균이에요.${nearbyTruncated ? " 가까운 일부 단지 기준입니다." : ""}</p>`;
    bindNearbyRows(box);
  }

  function bindNearbyRows(box) {
    box.querySelectorAll(".nb-row[data-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { key, type, lat, lng } = btn.dataset;
        if (lat && lng) window.mapCtl.panTo(+lat, +lng);
        openComplex(key, type || null);
      });
    });
  }

  // ── 평형 전환 ────────────────────────────────────────────
  function onPyeongChange() {
    loadDeals(context.getOpenToken(), { reset: true });
  }

  function renderDealDependencyError() {
    const tbody = bodyEl.querySelector("#deal-tbody");
    const more = bodyEl.querySelector("#deal-more");
    const note = bodyEl.querySelector("#deal-load-note");
    if (tbody) tbody.innerHTML = `<tr><td colspan="4"><div class="err-box">동·평형 정보를 불러오지 못해 실거래 범위를 정하지 못했어요.</div></td></tr>`;
    if (more) { more.hidden = true; more.disabled = false; }
    if (note) { note.hidden = true; note.textContent = ""; }
    renderChartError("동·평형 정보를 불러오지 못해 실거래를 조회하지 않았어요.");
  }

  function dispose() {
    nearbyGen++;
    nearbyCandidates = null;
    nearbyTruncated = false;
    if (nearbyObserver) { nearbyObserver.disconnect(); nearbyObserver = null; }
    dealRequest.next();
    chartRequest.next();
    if (chartHandle) chartHandle.destroy();
    chartHandle = null;
  }

  return {
    bindControls, hydrateSummary, observeNearby, loadDeals,
    onPyeongChange, renderDealDependencyError, dispose,
  };
};

window.createPanelUnitsModule = (context) => {
  const { F, A, D, panelEl, bodyEl, sheetEl, formatUnitArea, formatPyeong, formatFloor } = context;
  const DONG_VISIBLE = 24;
  let dongExpanded = false;
  let sheetToken = 0;
  let sheetReturnFocus = null;

  sheetEl.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || sheetEl.hidden) return;
    event.preventDefault();
    closeSheet(true);
  });

  function suspendPanel(suspended) {
    if (!panelEl) return;
    panelEl.inert = suspended;
    if (suspended) panelEl.setAttribute("aria-hidden", "true");
    else panelEl.removeAttribute("aria-hidden");
  }

  function bindBuildingsRetry(wrap) {
    wrap.querySelectorAll("[data-retry-buildings]").forEach((button) => {
      button.addEventListener("click", () => context.retryBuildings());
    });
  }

  function renderDongGrid() {
    const cur = context.getCur();
    const wrap = bodyEl.querySelector("#dong-grid");
    if (!cur || !wrap) return;
    if (!cur.buildingsReady) {
      wrap.innerHTML = `<div class="skel" style="height:96px;width:100%"></div>`;
      return;
    }
    if (cur.buildingsError) {
      wrap.innerHTML = `<div class="err-box">동 정보를 불러오지 못했어요.
        <button type="button" data-retry-buildings>다시 시도</button></div>`;
      bindBuildingsRetry(wrap);
      return;
    }
    const sorted = [...cur.buildings].sort((a, b) =>
      String(a.dong_name).localeCompare(String(b.dong_name), "ko", { numeric: true }));
    const list = dongExpanded ? sorted : sorted.slice(0, DONG_VISIBLE);
    wrap.innerHTML = list.map((building) => `
      <button type="button" class="dong-cell" data-ppk="${F.esc(building.ppk)}" data-testid="building-card">
        ${F.esc(building.dong_name)}동 <small>${building.total_ho_count ?? "—"}호</small>
      </button>`).join("") +
      (sorted.length > DONG_VISIBLE && !dongExpanded
        ? `<button type="button" class="dong-cell dong-more" id="dong-more">+${sorted.length - DONG_VISIBLE}개 더보기</button>`
        : "") +
      (cur.buildingsHasNext
        ? `<p class="sec-note" style="grid-column:1/-1">현재 ${F.count(sorted.length)}개 동만 표시하고 있어요. 전체 목록이 아닐 수 있어요.</p>`
        : "");
    wrap.querySelectorAll(".dong-cell[data-ppk]").forEach((btn) => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll(".dong-cell").forEach((cell) => cell.classList.toggle("is-on", cell === btn));
        const current = context.getCur();
        const building = current?.buildings.find((item) => item.ppk === btn.dataset.ppk);
        if (building) openSheet(building, btn);
      });
    });
    wrap.querySelector("#dong-more")?.addEventListener("click", () => {
      dongExpanded = true;
      renderDongGrid();
    });
  }

  async function openSheet(building, trigger) {
    const cur = context.getCur();
    if (!cur) return;
    const token = ++sheetToken;
    sheetReturnFocus = trigger || null;
    sheetEl.hidden = false;
    sheetEl.innerHTML = `
      <div class="us-head">
        <button type="button" class="us-back" id="us-close" aria-label="단지 상세로 돌아가기">←</button>
        <h3>${F.esc(building.dong_name)}동</h3>
        <span class="p-badge">${building.total_ho_count ?? "—"}호 · 지상 ${formatFloor(building.ground_floor_count)}</span>
      </div>
      <div class="us-body">
        <div class="skel" style="height:200px"></div>
      </div>`;
    sheetEl.querySelector("#us-close")?.addEventListener("click", () => closeSheet(true));
    sheetEl.querySelector("#us-close")?.focus();
    suspendPanel(true);

    try {
      // 첫 페이지(100호)를 받는 즉시 표시한다 — 대단지도 한 번의 대기로 화면이 열린다.
      // 다음 100호는 사용자가 "호실 더 보기"를 눌렀을 때만 이어서 조회한다.
      const first = await A.units(cur.key, building.ppk, { offset: 0, limit: 100 });
      if (token !== sheetToken) return;
      renderUnits(building, first.rows, { hasNext: first.hasNext, offset: first.rows.length, token });
    } catch (e) {
      if (token !== sheetToken) return;
      console.error(e);
      const body = sheetEl.querySelector(".us-body");
      if (body) body.innerHTML = `<div class="err-box">호 정보를 불러오지 못했어요.</div>`;
    }
  }

  function renderUnits(building, units, paging) {
    const body = sheetEl.querySelector(".us-body");
    if (!body) return;
    if (!units.length) {
      body.innerHTML = `<p class="sec-note" data-testid="unit-empty-state">제공되는 호 정보가 없어요.</p>`;
      return;
    }
    const sorted = [...units].sort((a, b) => {
      const aFloor = D.validFloor(a.floor_number);
      const bFloor = D.validFloor(b.floor_number);
      if (aFloor !== bFloor) return aFloor ? -1 : 1;
      if (aFloor && a.floor_number !== b.floor_number) return b.floor_number - a.floor_number;
      return String(a.ho_name).localeCompare(String(b.ho_name), "ko", { numeric: true });
    });
    body.innerHTML = `
      <p class="sec-note" style="margin:0 0 10px">호를 선택하면 그 호의 AI 산출시세·신뢰등급·공시가격을 보여드려요.</p>
      <div class="unit-rows">
        ${sorted.map((unit) => `
          <button type="button" class="unit-row" data-jpk="${F.esc(unit.jpk)}" data-testid="unit-row">
            <span class="ur-ho">${F.esc(unit.ho_name)}호</span>
             <span class="ur-meta">${formatFloor(unit.floor_number)} · 전용 ${formatUnitArea(unit.private_area)}${unit.supply_area != null ? ` · 공급 ${formatUnitArea(unit.supply_area)}` : ""}</span>
             <span class="ur-py">${formatPyeong(unit.pyeong_number)}${unit.pyeong_type_name ? F.esc(unit.pyeong_type_name) : ""}</span>
          </button>`).join("")}
      </div>
      ${paging.hasNext
        ? `<button type="button" class="btn-more" id="us-more">호 더 보기 · ${F.count(units.length)}호 표시</button>`
        : ""}`;
    body.querySelectorAll(".unit-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        body.querySelectorAll(".unit-row").forEach((row) => row.classList.toggle("is-on", row === btn));
        const unit = sorted.find((item) => item.jpk === btn.dataset.jpk);
        if (unit) showUnitDetail(btn, unit);
      });
    });
    body.querySelector("#us-more")?.addEventListener("click", async (event) => {
      const cur = context.getCur();
      if (!cur || paging.token !== sheetToken) return;
      event.target.disabled = true;
      event.target.textContent = "호 정보 불러오는 중…";
      try {
        const next = await A.units(cur.key, building.ppk, { offset: paging.offset, limit: 100 });
        if (paging.token !== sheetToken) return;
        renderUnits(building, [...units, ...next.rows], {
          hasNext: next.hasNext, offset: paging.offset + next.rows.length, token: paging.token,
        });
      } catch (e) {
        console.error(e);
        if (paging.token !== sheetToken) return;
        event.target.disabled = false;
        event.target.textContent = "호 정보 다시 불러오기";
      }
    });
  }

  // 호 선택 시 현재 210 스냅숏의 최신 1건씩만 동시 조회한다.
  async function loadUnitPrices(unit) {
    const [estimateResult, noticeResult] = await Promise.allSettled([
      A.estimatesByJpk(unit.ppk, unit.jpk),
      A.noticePricesByJpk(unit.ppk, unit.jpk),
    ]);
    const stateOf = (result) => result.status === "fulfilled"
      ? { rows: result.value, error: false, loading: false }
      : { rows: [], error: true, loading: false };
    return {
      estimates: stateOf(estimateResult),
      notices: stateOf(noticeResult),
    };
  }

  async function showUnitDetail(rowBtn, unit) {
    sheetEl.querySelector(".unit-detail")?.remove();
    const box = document.createElement("div");
    box.className = "unit-detail";
    box.innerHTML = `<h4>${F.esc(unit.ho_name)}호 가격 정보</h4><div class="skel" style="height:80px"></div>`;
    rowBtn.insertAdjacentElement("afterend", box);
    const token = sheetToken;
    try {
      const state = await loadUnitPrices(unit);
      if (token !== sheetToken || !box.isConnected) return;
      renderUnitPrices(box, unit, state, token);
    } catch (e) {
      if (token !== sheetToken || !box.isConnected) return;
      console.error(e);
      box.innerHTML = `<h4>${F.esc(unit.ho_name)}호</h4><p class="sec-note" style="margin:0">가격 정보를 불러오지 못했어요.</p>`;
    }
  }

  function renderUnitPrices(box, unit, state, token) {
    const ests = state.estimates.rows;
    const notices = state.notices.rows;
    // 신뢰등급(estimated_grade)은 호 단위 속성 — 단지·평형 화면으로 승격하지 않고 여기서만 보여준다.
    const estRows = ests.slice(0, 6).map((estimate) => `
      <div class="ud-price-row">
        <span>산출시세 ${F.ym(estimate.estimated_standard_ym)}</span>
        <b style="color:var(--est)">${F.price(estimate.estimated_price, { compact: true })}
          <small style="font-weight:500;color:var(--ink-3)">(${F.price(estimate.lowerlimit_estimated_price, { compact: true })}~${F.price(estimate.upperlimit_estimated_price, { compact: true })})${estimate.estimated_grade ? ` · 신뢰등급 ${F.esc(estimate.estimated_grade)}` : ""}</small></b>
      </div>`).join("");
    const noticeRows = notices.slice(0, 6).map((notice) => `
      <div class="ud-price-row">
        <span>공시가격 ${F.esc(notice.notice_year)}년</span>
        <b style="color:var(--notice)">${F.price(notice.notice_price, { compact: true })}</b>
      </div>`).join("");
    const errorRows = [["estimates", "산출시세"], ["notices", "공시가격"]].map(([kind, label]) => {
      const price = state[kind];
      if (!price.error && !price.loading) return "";
      return `<p class="sec-note" style="margin:6px 0">${label}${price.loading ? "를 불러오는 중이에요." : "를 불러오지 못했어요."}
        <button type="button" class="link-more" data-retry-price="${kind}" ${price.loading ? "disabled" : ""}>${price.loading ? "불러오는 중…" : "다시 시도"}</button></p>`;
    }).join("");
    const hasError = state.estimates.error || state.notices.error;
    box.innerHTML = `<h4>${F.esc(unit.ho_name)}호 최신 가격 정보 <small style="font-weight:500;color:var(--ink-3)">전용 ${formatUnitArea(unit.private_area)} · 최신 기준월</small></h4>
      ${estRows || ""}${noticeRows || ""}
      ${errorRows}
      ${!estRows && !noticeRows && !hasError ? `<p class="sec-note" style="margin:0">이 호의 산출시세·공시가격 정보가 없어요.</p>` : ""}`;
    box.querySelectorAll("[data-retry-price]").forEach((button) => {
      button.addEventListener("click", async () => {
        const kind = button.dataset.retryPrice;
        if (token !== sheetToken || !box.isConnected || state[kind].loading) return;
        // 이 호실의 상태 객체를 공유한다. 다른 상품의 완료·진행 상태를 되돌리지 않는다.
        state[kind] = { ...state[kind], loading: true };
        renderUnitPrices(box, unit, state, token);
        try {
          const rows = kind === "estimates"
            ? await A.estimatesByJpk(unit.ppk, unit.jpk)
            : await A.noticePricesByJpk(unit.ppk, unit.jpk);
          if (token !== sheetToken || !box.isConnected) return;
          state[kind] = { rows, error: false, loading: false };
        } catch (error) {
          console.error(error);
          if (token !== sheetToken || !box.isConnected) return;
          state[kind] = { ...state[kind], error: true, loading: false };
        }
        renderUnitPrices(box, unit, state, token);
      });
    });
  }

  function closeSheet(restoreFocus = false) {
    sheetToken++;
    sheetEl.hidden = true;
    sheetEl.innerHTML = "";
    suspendPanel(false);
    if (restoreFocus && sheetReturnFocus?.isConnected) sheetReturnFocus.focus();
    sheetReturnFocus = null;
  }

  return { renderDongGrid, closeSheet, loadUnitPrices };
};

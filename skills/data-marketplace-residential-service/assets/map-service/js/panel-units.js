window.createPanelUnitsModule = (context) => {
  const { F, A, D, bodyEl, sheetEl, formatUnitArea, formatPyeong, formatFloor, onSelectPyeong } = context;
  const DONG_VISIBLE = 24;
  let dongExpanded = false;
  let sheetToken = 0;

  function bindBuildingsRetry(wrap) {
    wrap.querySelectorAll("[data-retry-buildings]").forEach((button) => {
      button.addEventListener("click", () => context.retryBuildings());
    });
  }

  function renderPyeongControls() {
    renderPyeongChips();
    renderPyeongCards();
  }

  function renderPyeongChips() {
    const cur = context.getCur();
    const deal = context.getDeal();
    const wrap = bodyEl.querySelector("#py-chips");
    if (!cur || !deal || !wrap) return;
    if (cur.buildingsError || !cur.pyeongs.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const chips = cur.pyeongs.map((p) => ({ py: p.py, label: `${p.py}평`, ho: p.ho }));
    wrap.innerHTML = chips.map((chip) =>
      `<button type="button" class="py-chip${chip.py === deal.pyeong ? " is-on" : ""}" data-py="${chip.py ?? ""}">
        ${chip.label}${chip.ho ? `<small>${F.count(chip.ho)}호${cur.buildingsHasNext ? "+" : ""}</small>` : ""}</button>`).join("");
    wrap.querySelectorAll(".py-chip").forEach((btn) => {
      btn.addEventListener("click", () => onSelectPyeong(btn.dataset.py === "" ? null : +btn.dataset.py));
    });
  }

  function renderPyeongCards() {
    const cur = context.getCur();
    const deal = context.getDeal();
    const wrap = bodyEl.querySelector("#py-cards");
    if (!cur || !deal || !wrap) return;
    // 동 목록은 백그라운드로 도착한다 — 도착 전에는 "없음"이 아니라 로딩으로 표시
    if (!cur.buildingsReady) {
      wrap.innerHTML = `<div class="skel" style="height:74px;width:100%"></div>`;
      return;
    }
    if (cur.buildingsError) {
      wrap.innerHTML = `<div class="err-box">동·평형 정보를 불러오지 못했어요.
        <button type="button" data-retry-buildings>다시 시도</button></div>`;
      bindBuildingsRetry(wrap);
      return;
    }
    if (!cur.pyeongs.length) {
      wrap.innerHTML = `<p class="sec-note">${cur.typeMismatch
        ? `이 단지의 ${F.esc(cur.viewType)} 동·평형 정보는 제공되지 않아요.`
        : "평형 정보가 없어요."}</p>`;
      return;
    }
    const partialNote = cur.buildingsHasNext
      ? `<p class="sec-note" style="margin:0 0 10px">평형과 호수는 불러온 일부 동 기준이며 전체 합계가 아니에요.</p>`
      : "";
    wrap.innerHTML = partialNote + cur.pyeongs.map((p) => `
       <button type="button" class="py-card${p.py === deal.pyeong ? " is-on" : ""}" data-py="${p.py}" data-testid="area-summary-card">
         <div class="pc-py">${p.py}평형</div>
         <div class="pc-types">타입 ${[...p.types].sort().join("·") || "—"}</div>
         <div class="pc-ho">전용 ${p.areaMin === Infinity ? "확인 필요"
           : (p.areaMax - p.areaMin < 0.05
             ? formatUnitArea(p.areaMin)
             : `${formatUnitArea(p.areaMin)}~${formatUnitArea(p.areaMax)}`)} · ${F.count(p.ho)}호${cur.buildingsHasNext ? "+ · 일부 동 기준" : ""}</div>
       </button>`).join("");
    wrap.querySelectorAll(".py-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const currentDeal = context.getDeal();
        if (!currentDeal) return;
        const py = +btn.dataset.py;
        onSelectPyeong(py);
        bodyEl.querySelector("#sec-deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
        if (building) openSheet(building);
      });
    });
    wrap.querySelector("#dong-more")?.addEventListener("click", () => {
      dongExpanded = true;
      renderDongGrid();
    });
  }

  async function openSheet(building) {
    const cur = context.getCur();
    if (!cur) return;
    const token = ++sheetToken;
    sheetEl.hidden = false;
    sheetEl.innerHTML = `
      <div class="us-head">
        <h3>${F.esc(building.dong_name)}동</h3>
        <span class="p-badge">${building.total_ho_count ?? "—"}호 · 지상 ${formatFloor(building.ground_floor_count)}</span>
        <button type="button" class="p-close" id="us-close" aria-label="호 정보 닫기">×</button>
      </div>
      <div class="us-body">
        <div class="skel" style="height:200px"></div>
      </div>`;
    sheetEl.querySelector("#us-close")?.addEventListener("click", closeSheet);
    window.mapCtl.panTo(building.latitude, building.longitude, Math.min(window.mapCtl.getLevel() ?? 3, 3));

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
        event.target.textContent = "호 정보를 더 불러오지 못했어요 — 다시 시도";
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
      ? { rows: result.value, error: false }
      : { rows: [], error: true };
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
      if (token !== sheetToken) return;
      renderUnitPrices(box, unit, state, token);
    } catch (e) {
      if (token !== sheetToken) return;
      console.error(e);
      box.innerHTML = `<h4>${F.esc(unit.ho_name)}호</h4><p class="sec-note" style="margin:0">가격 정보를 불러오지 못했어요.</p>`;
    }
  }

  function renderUnitPrices(box, unit, state, token) {
    const ests = state.estimates.rows;
    const notices = state.notices.rows;
    // 신뢰등급(sise_grade)은 호 단위 속성 — 단지·평형 화면으로 승격하지 않고 여기서만 보여준다.
    const estRows = ests.slice(0, 6).map((estimate) => `
      <div class="ud-price-row">
        <span>산출시세 ${F.ym(estimate.sise_production_standard_ym)}</span>
        <b style="color:var(--est)">${F.price(estimate.sise_price, { compact: true })}
          <small style="font-weight:500;color:var(--ink-3)">(${F.price(estimate.lowerlimit_sise_price, { compact: true })}~${F.price(estimate.upperlimit_sise_price, { compact: true })})${estimate.sise_grade ? ` · 신뢰등급 ${F.esc(estimate.sise_grade)}` : ""}</small></b>
      </div>`).join("");
    const noticeRows = notices.slice(0, 6).map((notice) => `
      <div class="ud-price-row">
        <span>공시가격 ${F.ym(notice.notice_standard_ym)}</span>
        <b style="color:var(--notice)">${F.price(notice.notice_price, { compact: true })}</b>
      </div>`).join("");
    const errorRows = [
      state.estimates.error
        ? `<p class="sec-note" style="margin:6px 0">산출시세를 불러오지 못했어요. <button type="button" class="link-more" data-retry-price="estimates">다시 시도</button></p>`
        : "",
      state.notices.error
        ? `<p class="sec-note" style="margin:6px 0">공시가격을 불러오지 못했어요. <button type="button" class="link-more" data-retry-price="notices">다시 시도</button></p>`
        : "",
    ].join("");
    const hasError = state.estimates.error || state.notices.error;
    box.innerHTML = `<h4>${F.esc(unit.ho_name)}호 최신 가격 정보 <small style="font-weight:500;color:var(--ink-3)">전용 ${formatUnitArea(unit.private_area)} · 최신 기준월</small></h4>
      ${estRows || ""}${noticeRows || ""}
      ${errorRows}
      ${!estRows && !noticeRows && !hasError ? `<p class="sec-note" style="margin:0">이 호의 산출시세·공시가격 정보가 없어요.</p>` : ""}`;
    box.querySelectorAll("[data-retry-price]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (token !== sheetToken) return;
        const kind = button.dataset.retryPrice;
        button.disabled = true;
        button.textContent = "불러오는 중…";
        try {
          const rows = kind === "estimates"
            ? await A.estimatesByJpk(unit.ppk, unit.jpk)
            : await A.noticePricesByJpk(unit.ppk, unit.jpk);
          if (token !== sheetToken) return;
          renderUnitPrices(box, unit, {
            ...state,
            [kind]: { rows, error: false },
          }, token);
        } catch (error) {
          console.error(error);
          if (token !== sheetToken) return;
          button.disabled = false;
          button.textContent = "다시 시도";
        }
      });
    });
  }

  function closeSheet() {
    sheetToken++;
    sheetEl.hidden = true;
    sheetEl.innerHTML = "";
  }

  return { renderPyeongControls, renderDongGrid, closeSheet, loadUnitPrices };
};

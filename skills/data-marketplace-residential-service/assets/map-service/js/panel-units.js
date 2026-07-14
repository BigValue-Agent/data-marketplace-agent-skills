// 단지 상세 패널의 평형·동·호실 모듈
window.createPanelUnitsModule = (context) => {
  const { F, A, D, bodyEl, sheetEl, formatUnitArea, formatPyeong, formatFloor, onSelectPyeong } = context;
  const DONG_VISIBLE = 24;
  let dongExpanded = false;
  let sheetToken = 0;

  function renderPyeongControls() {
    renderPyeongChips();
    renderPyeongCards();
  }

  function renderPyeongChips() {
    const cur = context.getCur();
    const deal = context.getDeal();
    const wrap = bodyEl.querySelector("#py-chips");
    if (!cur || !deal || !wrap) return;
    if (!cur.pyeongs.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const chips = [{ py: null, label: "전체" }, ...cur.pyeongs.map((p) => ({ py: p.py, label: `${p.py}평`, ho: p.ho }))];
    wrap.innerHTML = chips.map((chip) =>
      `<button type="button" class="py-chip${chip.py === deal.pyeong ? " is-on" : ""}" data-py="${chip.py ?? ""}">
        ${chip.label}${chip.ho ? `<small>${F.count(chip.ho)}호</small>` : ""}</button>`).join("");
    wrap.querySelectorAll(".py-chip").forEach((btn) => {
      btn.addEventListener("click", () => onSelectPyeong(btn.dataset.py === "" ? null : +btn.dataset.py));
    });
  }

  function renderPyeongCards() {
    const cur = context.getCur();
    const deal = context.getDeal();
    const wrap = bodyEl.querySelector("#py-cards");
    if (!cur || !deal || !wrap) return;
    if (!cur.pyeongs.length) {
      wrap.innerHTML = `<p class="sec-note">${cur.typeMismatch
        ? `이 단지의 ${F.esc(cur.viewType)} 동·평형 정보는 제공되지 않아요.`
        : "평형 정보가 없어요."}</p>`;
      return;
    }
    wrap.innerHTML = cur.pyeongs.map((p) => `
       <button type="button" class="py-card${p.py === deal.pyeong ? " is-on" : ""}" data-py="${p.py}" data-testid="area-summary-card">
         <div class="pc-py">${p.py}평형</div>
         <div class="pc-types">타입 ${[...p.types].sort().join("·") || "—"}</div>
         <div class="pc-ho">전용 ${p.areaMin === Infinity ? "확인 필요"
           : (p.areaMax - p.areaMin < 0.05
             ? formatUnitArea(p.areaMin)
             : `${formatUnitArea(p.areaMin)}~${formatUnitArea(p.areaMax)}`)} · ${F.count(p.ho)}호</div>
       </button>`).join("");
    wrap.querySelectorAll(".py-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const currentDeal = context.getDeal();
        if (!currentDeal) return;
        const py = +btn.dataset.py;
        onSelectPyeong(py === currentDeal.pyeong ? null : py);
        bodyEl.querySelector("#sec-deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function renderDongGrid() {
    const cur = context.getCur();
    const wrap = bodyEl.querySelector("#dong-grid");
    if (!cur || !wrap) return;
    const sorted = [...cur.buildings].sort((a, b) =>
      String(a.dong_name).localeCompare(String(b.dong_name), "ko", { numeric: true }));
    const list = dongExpanded ? sorted : sorted.slice(0, DONG_VISIBLE);
    wrap.innerHTML = list.map((building) => `
      <button type="button" class="dong-cell" data-ppk="${F.esc(building.ppk)}" data-testid="building-card">
        ${F.esc(building.dong_name)}동 <small>${building.total_ho_count ?? "—"}호</small>
      </button>`).join("") +
      (sorted.length > DONG_VISIBLE && !dongExpanded
        ? `<button type="button" class="dong-cell dong-more" id="dong-more">+${sorted.length - DONG_VISIBLE}개 더보기</button>`
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
        <button type="button" class="p-close" id="us-close" aria-label="호실 시트 닫기">×</button>
      </div>
      <div class="us-body">
        <div class="skel" style="height:200px"></div>
      </div>`;
    sheetEl.querySelector("#us-close")?.addEventListener("click", closeSheet);
    window.mapCtl.panTo(building.latitude, building.longitude, Math.min(window.mapCtl.getLevel() ?? 3, 3));

    try {
      const collected = [];
      let offset = 0, hasNext = true;
      while (hasNext && offset < 500) {
        const result = await A.units(cur.key, building.ppk, { offset, limit: 100 });
        if (token !== sheetToken) return;
        collected.push(...result.rows);
        hasNext = result.hasNext;
        offset += result.rows.length;
        if (!result.rows.length) break;
      }
      if (token !== sheetToken) return;
      renderUnits(building, collected);
    } catch (e) {
      if (token !== sheetToken) return;
      console.error(e);
      const body = sheetEl.querySelector(".us-body");
      if (body) body.innerHTML = `<div class="err-box">호실 정보를 불러오지 못했어요.</div>`;
    }
  }

  function renderUnits(building, units) {
    const body = sheetEl.querySelector(".us-body");
    if (!body) return;
    if (!units.length) {
      body.innerHTML = `<p class="sec-note" data-testid="unit-empty-state">등록된 호실 정보가 없어요.</p>`;
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
      <p class="sec-note" style="margin:0 0 10px">호를 선택하면 그 호의 산출시세와 공시가격을 보여드려요.</p>
      <div class="unit-rows">
        ${sorted.map((unit) => `
          <button type="button" class="unit-row" data-jpk="${F.esc(unit.jpk)}" data-testid="unit-row">
            <span class="ur-ho">${F.esc(unit.ho_name)}호</span>
             <span class="ur-meta">${formatFloor(unit.floor_number)} · 전용 ${formatUnitArea(unit.private_area)}${unit.supply_area != null ? ` · 공급 ${formatUnitArea(unit.supply_area)}` : ""}</span>
             <span class="ur-py">${formatPyeong(unit.pyeong_number)}${unit.pyeong_type_name ? F.esc(unit.pyeong_type_name) : ""}</span>
          </button>`).join("")}
      </div>`;
    body.querySelectorAll(".unit-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        body.querySelectorAll(".unit-row").forEach((row) => row.classList.toggle("is-on", row === btn));
        const unit = sorted.find((item) => item.jpk === btn.dataset.jpk);
        if (unit) showUnitDetail(btn, unit);
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
      const estRows = ests.slice(0, 6).map((estimate) => `
        <div class="ud-price-row">
          <span>산출시세 ${F.ym(estimate.sise_production_standard_ym)}</span>
          <b style="color:var(--est)">${F.price(estimate.sise_price, { compact: true })}
            <small style="font-weight:500;color:var(--ink-3)">(${F.price(estimate.lowerlimit_sise_price, { compact: true })}~${F.price(estimate.upperlimit_sise_price, { compact: true })})</small></b>
        </div>`).join("");
      const noticeRows = notices.slice(0, 6).map((notice) => `
        <div class="ud-price-row">
          <span>공시가격 ${F.ym(notice.notice_standard_ym)}</span>
          <b style="color:var(--notice)">${F.price(notice.notice_price, { compact: true })}</b>
        </div>`).join("");
      const distinctPeriods = (rows, field) =>
        new Set(rows.map((row) => row[field]).filter((value) => value != null)).size;
      const isHistory = distinctPeriods(ests, "sise_production_standard_ym") > 1
        || distinctPeriods(notices, "notice_standard_ym") > 1;
      box.innerHTML = `<h4>${F.esc(unit.ho_name)}호 ${isHistory ? "가격 추이" : "현재 가격"} <small style="font-weight:500;color:var(--ink-3)">전용 ${formatUnitArea(unit.private_area)}${isHistory ? "" : " · 최신 기준월"}</small></h4>
        ${estRows || ""}${noticeRows || ""}
        ${!estRows && !noticeRows ? `<p class="sec-note" style="margin:0">이 호의 시세·공시 정보가 없어요.</p>` : ""}`;
    } catch (e) {
      if (token !== sheetToken) return;
      console.error(e);
      box.innerHTML = `<h4>${F.esc(unit.ho_name)}호</h4><p class="sec-note" style="margin:0">가격 정보를 불러오지 못했어요.</p>`;
    }
  }

  function closeSheet() {
    sheetToken++;
    sheetEl.hidden = true;
    sheetEl.innerHTML = "";
  }

  return { renderPyeongControls, renderDongGrid, closeSheet };
};

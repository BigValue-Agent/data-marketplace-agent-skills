window.createPanelPriceModule = (context) => {
  const {F,A,D,Async,bodyEl,pyeongFilterRange,areaMessage,getFocusPyeong,formatUnitArea,renderGaugeSkeleton,renderAreaUnavailable,openComplex}=context;
  const dealRequest = Async.latestRequest();
  const chartRequest = Async.latestRequest();
  let chartHandle = null;
  let gaugeGen = 0;
  let nearbyGen = 0;
  const emptyDeals = () => ({ rows: [], truncated: false });

  function focusDealPromise(dealDivision) {
    const cur = context.getCur();
    if (!cur) return Promise.resolve({ rows: [], truncated: false });
    const focus = getFocusPyeong();
    const key = `${dealDivision}:${focus ? focus.py : "__complex__"}`;
    let promise = cur.focusDealPromises.get(key);
    if (promise) return promise;
    const range = pyeongFilterRange(focus);
    promise = focus && range.areaMin == null
      ? Promise.resolve(emptyDeals())
      : A.realdealCollect(cur.key, {
          dealDivision, dateFrom: F.monthsAgoStart(6),
          areaMin: range.areaMin, areaMax: range.areaMax,
          residentialType: cur.viewType,
        }, { maxPages: 3 }).catch(emptyDeals);
    cur.focusDealPromises.set(key, promise);
    return promise;
  }

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
      const opts = dealOpts();
      if (opts) hydrateChart(context.getOpenToken(), opts, chartRequest.next());
    });
    syncOverlayBtn();
    bodyEl.querySelector("#deal-more")?.addEventListener("click", () =>
      loadDeals(context.getOpenToken(), { reset: false }));
  }

  async function hydrateGauge(token) {
    const cur = context.getCur();
    if (!cur) return;
    const gen = ++gaugeGen;
    const p = cur.profile;
    const rep = getFocusPyeong();
    const vt = cur.viewType;
    const range = pyeongFilterRange(rep);
    const areaUnavailable = !!rep && range.areaMin == null;
    let est = null;
    const dealBasis = rep ? `${rep.py}평` : cur.typeMismatch ? `${vt} 전체` : "단지 전체";

    const [estR, noticeR, dealR, highR, jeonseR] = await Promise.allSettled([
      areaUnavailable ? Promise.resolve(null) : A.estimateBand(cur.key, { ...range, residentialType: vt }),
      A.noticePricesSample(cur.key, { residentialType: vt }),
      focusDealPromise("매매"),
      areaUnavailable
        ? Promise.resolve({ rows: [], hasNext: false })
        : A.realdealPage(cur.key, {
            dealDivision: "매매", areaMin: range.areaMin, areaMax: range.areaMax,
            residentialType: vt, sortField: "price", sortOrder: "desc", limit: 3,
          }),
      focusDealPromise("전세"),
    ]);
    if (!context.isCurrentOpen(token) || gen !== gaugeGen) return;
    if (estR.status === "fulfilled") est = estR.value;
    const notice = noticeR.status === "fulfilled"
      ? D.noticeSummary(noticeR.value, {
          pyeong: rep?.py ?? null,
          areaMin: range.areaMin,
          areaMax: range.areaMax,
        })
      : { standardYm: null, average: null, count: 0, scope: rep ? "pyeong" : "complex" };
    const rowStats = dealR.status === "fulfilled" ? D.dealStats(dealR.value.rows) : null;
    const evidence = D.priceEvidence(rowStats, {
      min: p.recent_month6_min_realdeal_price,
      avg: p.recent_month6_average_realdeal_price,
      max: p.recent_month6_max_realdeal_price,
      count: p.recent_month6_realdeal_count,
    }, {
      scope: rep ? "pyeong" : "complex",
      typeMismatch: cur.typeMismatch,
    });
    const dealMin = evidence?.min ?? null;
    const dealAvg = evidence?.avg ?? null;
    const dealMax = evidence?.max ?? null;
    const dealCount = evidence?.count ?? null;

    const vals = [dealMin, dealAvg, dealMax, est?.min, est?.max, est?.avg, notice.average]
      .filter((v) => v != null && v > 0);
    const el = bodyEl.querySelector("#sec-gauge");
    if (!el) return;
    if (!vals.length) {
      el.innerHTML = `
        <div class="gauge-lead"><span class="gl-eyebrow">가격 수준계</span></div>
        <div class="chart-empty" style="height:90px">${areaUnavailable
          ? areaMessage
          : "최근 거래·시세 데이터가 아직 없는 단지예요."}</div>`;
      return;
    }
    const lo = Math.min(...vals) * 0.96;
    const hi = Math.max(...vals) * 1.04;
    const pct = (v) => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
    const width = (a, b) => `${(((b - a) / (hi - lo)) * 100).toFixed(1)}%`;
    const gaugeLane = (kind, label, detail, min, max, value) => `
      <div class="gauge-row">
        <div class="gauge-row-label">${label}<small>${detail}</small></div>
        <div class="gauge-track">
          ${min != null && max != null
            ? `<div class="gauge-band ${kind}" style="left:${pct(min)};width:${width(min, max)}"></div>`
            : ""}
          ${value != null
            ? `<div class="gauge-point ${kind}" style="left:${pct(value)}" title="평균 ${F.price(value)}"></div>`
            : ""}
        </div>
        <div class="gauge-val ${kind}">${value != null ? F.price(value, { compact: true }) : "—"}</div>
      </div>`;

    const lanes = [];
    if (dealMin != null && dealMax != null) {
      lanes.push(gaugeLane("deal", "실거래", `${F.esc(dealBasis)} · 6개월`, dealMin, dealMax, dealAvg));
    }
    if (est && est.min != null && est.max != null) {
      const basis = rep ? `${rep.py}평` : (cur.typeMismatch ? F.esc(vt) : "단지");
      lanes.push(gaugeLane("est", "산출시세", `${basis} · ${F.ym(est.standardYm)}`, est.min, est.max, est.avg));
    }
    if (notice.average != null) {
      const basis = rep ? `${rep.py}평` : (cur.typeMismatch ? F.esc(vt) : "단지");
      lanes.push(gaugeLane("notice", "공시가격", `${basis} · ${F.ym(notice.standardYm)}`, null, null, notice.average));
    }

    const leadPrice = dealAvg ?? est?.avg ?? notice.average;
    const leadLabel = dealAvg != null
      ? `${F.esc(dealBasis)} 최근 6개월 실거래 평균 <b>${F.count(dealCount)}건</b>`
      : (est ? "산출시세 평균" : "공시가격 평균");
    const subSegs = [];
    const high = highR.status === "fulfilled"
      ? (highR.value.rows.find((d) => D.validPrice(d.price) && !d.cancel_date) || null)
      : null;
    if (high) {
      let seg = `3년 내 최고 <b>${F.price(high.price, { compact: true })}</b> <small>${F.dateShort(high.contract_date)}</small>`;
      if (dealAvg != null && high.price > 0) {
        const change = Math.round(((dealAvg - high.price) / high.price) * 100);
        seg += ` · 평균 대비 ${F.trend(change)}`;
      }
      subSegs.push(seg);
    }
    if (dealR.status === "fulfilled") {
      const valid = dealR.value.rows.filter((d) => D.validPrice(d.price) && !d.cancel_date);
      const d3 = new Date(); d3.setMonth(d3.getMonth() - 3);
      const cut = `${d3.getFullYear()}${String(d3.getMonth() + 1).padStart(2, "0")}01`;
      const recent = valid.filter((d) => String(d.contract_date) >= cut);
      const prior = valid.filter((d) => String(d.contract_date) < cut);
      if (recent.length >= MIN_TREND_SAMPLE && prior.length >= MIN_TREND_SAMPLE) {
        const avgOf = (rows) => rows.reduce((sum, row) => sum + row.price, 0) / rows.length;
        const change = Math.round(((avgOf(recent) - avgOf(prior)) / avgOf(prior)) * 100);
        subSegs.push(`직전 3개월 대비 ${F.trend(change)} <small>${prior.length}→${recent.length}건</small>`);
      }
    }
    if (dealR.status === "fulfilled" && jeonseR.status === "fulfilled") {
      const sales = dealR.value.rows.filter((d) => D.validPrice(d.price) && !d.cancel_date);
      const leases = jeonseR.value.rows.filter((d) => D.validPrice(d.deposit_price) && !d.cancel_date);
      if (sales.length >= MIN_RATIO_SAMPLE && leases.length >= MIN_RATIO_SAMPLE) {
        const saleAvg = sales.reduce((sum, row) => sum + row.price, 0) / sales.length;
        const leaseAvg = leases.reduce((sum, row) => sum + row.deposit_price, 0) / leases.length;
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
      ${subSegs.length ? `<div class="gauge-stats">${subSegs.map((segment) => `<span class="stat-chip">${segment}</span>`).join("")}</div>` : ""}
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

  const MIN_TREND_SAMPLE = 5;
  const MIN_RATIO_SAMPLE = 3;
  const NEARBY_PRECISE_COUNT = 6;

  async function hydrateNearby(token) {
    const cur = context.getCur();
    if (!cur) return;
    const gen = ++nearbyGen;
    const p = cur.profile;
    const rep = getFocusPyeong();
    const vt = cur.viewType || p.residential_type;
    const bodyBox = () => bodyEl.querySelector("#nearby-body");
    if (rep && pyeongFilterRange(rep).areaMin == null) {
      const sub = bodyEl.querySelector("#nearby-sub");
      if (sub) sub.textContent = "동일 전용면적 비교 불가";
      const box = bodyBox();
      if (box) box.innerHTML = `<p class="sec-note" style="margin:0">${areaMessage}</p>`;
      return;
    }
    if (!D.validCoordinate(p.longitude, p.latitude)) {
      const box = bodyBox();
      if (box) box.innerHTML = `<p class="sec-note" style="margin:0">좌표 정보가 없어 주변 비교를 할 수 없어요.</p>`;
      return;
    }
    try {
      const around = await A.nearbyMarkers(p.latitude, p.longitude, vt);
      if (!context.isCurrentOpen(token) || gen !== nearbyGen) return;
      const candidates = around
        .filter((row) => row.complex_key !== cur.key && D.validCoordinate(row.longitude, row.latitude))
        .map((row) => ({ ...row, distM: D.distanceMeters(p.latitude, p.longitude, row.latitude, row.longitude) }))
        .filter((row) => D.validPrice(row.recent_month6_average_realdeal_price))
        .sort((a, b) => a.distM - b.distM)
        .slice(0, NEARBY_PRECISE_COUNT);
      const box = bodyBox();
      if (!box) return;
      if (!candidates.length) {
        box.innerHTML = `<p class="sec-note" style="margin:0">반경 1.2km에 최근 거래가 있는 ${F.esc(vt || "")} 단지가 없어요.</p>`;
        return;
      }
      if (rep) await renderNearbyPrecise(token, gen, candidates, rep, cur);
      else renderNearbyRough(candidates, cur);
    } catch (e) {
      if (!context.isCurrentOpen(token) || gen !== nearbyGen) return;
      console.error(e);
      const box = bodyBox();
      if (box) box.innerHTML = `<p class="sec-note" style="margin:0">주변 단지 정보를 불러오지 못했어요.</p>`;
    }
  }

  async function renderNearbyPrecise(token, gen, candidates, rep, cur) {
    const range = pyeongFilterRange(rep);
    const dateFrom = F.monthsAgoStart(6);
    const [selfR, ...neighborRs] = await Promise.allSettled([
      focusDealPromise("매매"),
      ...candidates.map((candidate) => A.realdealPage(candidate.complex_key, {
        dealDivision: "매매", dateFrom,
        areaMin: range.areaMin, areaMax: range.areaMax, limit: 100,
        residentialType: candidate.residential_type || cur.viewType,
      })),
    ]);
    if (!context.isCurrentOpen(token) || gen !== nearbyGen) return;
    const selfStats = selfR.status === "fulfilled" ? D.dealStats(selfR.value.rows) : null;
    const rows = candidates.map((candidate, index) => {
      const result = neighborRs[index];
      return { candidate, stats: result.status === "fulfilled" ? D.dealStats(result.value.rows) : null };
    });
    rows.sort((a, b) => ((b.stats ? 1 : 0) - (a.stats ? 1 : 0)));
    const sub = bodyEl.querySelector("#nearby-sub");
    if (sub) sub.textContent = `전용 ${rep.py}평 기준 · 최근 6개월 매매 · 반경 1.2km`;
    const delta = (value, base, unit) => {
      if (value == null || base == null) return "";
      const diff = value - base;
      if (Math.abs(diff) < (unit ? 10000 : 1000000)) return `<small class="nb-delta">비슷</small>`;
      return `<small class="nb-delta">(${diff > 0 ? "+" : ""}${F.price(diff, { compact: true })})</small>`;
    };
    const selfRow = `
      <div class="nb-row is-self" role="row">
        <div class="nb-name"><b>${F.esc(cur.profile.complex_name || "이 단지")}</b><small>기준 단지</small></div>
        <div class="nb-price">${selfStats ? F.price(selfStats.avg, { compact: true }) : "거래 없음"}</div>
        <div class="nb-unit">${selfStats?.unitAvg ? `${F.price(selfStats.unitAvg, { compact: true })}/평` : "—"}</div>
      </div>`;
    const neighborRows = rows.map(({ candidate, stats }) => `
      <button type="button" class="nb-row${stats ? "" : " no-deal"}" data-key="${F.esc(candidate.complex_key)}"
              data-type="${F.esc(candidate.residential_type || "")}" data-lat="${candidate.latitude}" data-lng="${candidate.longitude}">
        <div class="nb-name">${F.esc(candidate.complex_name || candidate.residential_type)}<small>${Math.round(candidate.distM).toLocaleString()}m · ${F.count(candidate.complex_household_count)}세대</small></div>
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
    if (!box) return;
    box.innerHTML = `
      <div class="nb-table" role="table" aria-label="주변 단지 시세 비교">
        <div class="nb-head" role="row"><span>단지</span><span>평균가</span><span>평당가(전용)</span></div>
        ${selfRow}${neighborRows}
      </div>
      <p class="sec-note">${areaLabel} 매매 실거래끼리 비교했어요. 단지를 누르면 이동해요.</p>`;
    bindNearbyRows(box);
  }

  function renderNearbyRough(candidates, cur) {
    const p = cur.profile;
    const selfAvg = D.validPrice(p.recent_month6_average_realdeal_price)
      ? p.recent_month6_average_realdeal_price
      : null;
    const sub = bodyEl.querySelector("#nearby-sub");
    if (sub) sub.textContent = "단지 전체 평균 기준 · 최근 6개월 · 반경 1.2km";
    const box = bodyEl.querySelector("#nearby-body");
    if (!box) return;
    box.innerHTML = `
      <div class="nb-table" role="table" aria-label="주변 단지 시세 비교">
        <div class="nb-head" role="row"><span>단지</span><span>평균가</span><span>거리</span></div>
        <div class="nb-row is-self"><div class="nb-name"><b>${F.esc(p.complex_name || "이 단지")}</b><small>기준 단지</small></div>
          <div class="nb-price">${selfAvg != null ? F.price(selfAvg, { compact: true }) : "거래 없음"}</div><div class="nb-unit">—</div></div>
        ${candidates.map((candidate) => `
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
      <p class="sec-note">평형 구성 정보가 없어 단지 전체 평균으로 비교했어요. 평형이 다르면 가격 차이가 클 수 있어요.</p>`;
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
    if (deal.range) opts.dateFrom = F.monthsAgoStart(deal.range);
    return opts;
  }

  async function loadDeals(token, { reset }) {
    const cur = context.getCur();
    const deal = context.getDeal();
    const tbody = bodyEl.querySelector("#deal-tbody");
    const moreBtn = bodyEl.querySelector("#deal-more");
    if (!cur || !deal || !tbody || !moreBtn) return;
    const sequence = reset ? dealRequest.next() : dealRequest.current();
    const chartSequence = reset ? chartRequest.next() : null;
    if (reset) {
      deal.rows = []; deal.offset = 0; deal.hasNext = false;
      tbody.innerHTML = `<tr><td colspan="4"><div class="skel" style="height:60px"></div></td></tr>`;
      renderChartLoading();
      const basis = bodyEl.querySelector("#chart-basis");
      if (basis) basis.textContent = deal.division === "월세" ? "차트는 월세액 기준" :
        deal.division === "전세" ? "보증금 기준" : "체결가 기준";
    }
    const opts = dealOpts();
    if (!opts) {
      renderAreaUnavailable();
      return;
    }
    moreBtn.disabled = true;
    try {
      const offset = deal.offset;
      const { rows, hasNext } = await A.realdealPage(cur.key, { ...opts, limit: 30, offset });
      if (!context.isCurrentOpen(token) || !dealRequest.isCurrent(sequence)) return;
      deal.rows.push(...rows);
      deal.offset += rows.length;
      deal.hasNext = hasNext && deal.offset < 2000;
      renderDealTable(deal);
      if (reset) hydrateChart(token, opts, chartSequence);
    } catch (e) {
      if (!context.isCurrentOpen(token) || !dealRequest.isCurrent(sequence)) return;
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="4"><div class="err-box">거래 내역을 불러오지 못했어요.
        <button type="button" id="deal-retry">다시 시도</button></div></td></tr>`;
      tbody.querySelector("#deal-retry")?.addEventListener("click", () => loadDeals(context.getOpenToken(), { reset: true }));
    } finally {
      if (context.isCurrentOpen(token) && dealRequest.isCurrent(sequence)) moreBtn.disabled = false;
    }
  }

  function renderDealTable(deal) {
    const tbody = bodyEl.querySelector("#deal-tbody");
    const moreBtn = bodyEl.querySelector("#deal-more");
    if (!tbody || !moreBtn) return;
    if (!deal.rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:22px 0">
        이 조건의 거래가 없어요. 기간을 넓히거나 평형 필터를 풀어 보세요.</td></tr>`;
      moreBtn.hidden = true;
      return;
    }
    const cls = deal.division === "매매" ? "sale" : deal.division === "전세" ? "jeonse" : "rent";
    tbody.innerHTML = deal.rows.map((row) => {
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
    moreBtn.hidden = !deal.hasNext;
  }

  function renderChartLoading() {
    const wrap = bodyEl.querySelector("#deal-chart");
    if (!wrap) return;
    if (chartHandle) { chartHandle.destroy(); chartHandle = null; }
    wrap.innerHTML = `<div class="chart-empty">거래 내역을 불러오는 중…</div>`;
  }

  async function hydrateChart(token, opts, sequence) {
    const cur = context.getCur();
    const deal = context.getDeal();
    if (!cur || !deal || sequence == null) return;
    try {
      const dealDivision = opts.dealDivision;
      const monthsBack = deal.range || null;
      const wantOverlay = dealDivision === "매매" && deal.overlayJeonse;
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
      if (!context.isCurrentOpen(token) || !chartRequest.isCurrent(sequence)) return;
      const wrap = bodyEl.querySelector("#deal-chart");
      if (!wrap) return;
      if (chartHandle) chartHandle.destroy();
      chartHandle = window.dealChart.render(wrap, all, dealDivision, {
        monthsBack,
        overlay: overlayR && overlayR.rows.length
          ? { deals: overlayR.rows, dealType: "전세", label: "전세(보증금)" }
          : null,
      });
      if (truncated) {
        const basis = bodyEl.querySelector("#chart-basis");
        if (basis) basis.textContent += ` · 최신 ${all.length.toLocaleString()}건 표시`;
      }
    } catch (e) {
      if (!context.isCurrentOpen(token) || !chartRequest.isCurrent(sequence)) return;
      console.error(e);
      const wrap = bodyEl.querySelector("#deal-chart");
      if (wrap) wrap.innerHTML = `<div class="chart-empty">차트를 그리지 못했어요.</div>`;
    }
  }

  function onPyeongChange(prevFocusPy) {
    const nextFocusPy = getFocusPyeong()?.py ?? null;
    loadDeals(context.getOpenToken(), { reset: true });
    if (prevFocusPy === nextFocusPy) return;
    renderGaugeSkeleton();
    hydrateGauge(context.getOpenToken());
    const box = bodyEl.querySelector("#nearby-body");
    if (box) box.innerHTML = `<div class="skel" style="height:130px"></div>`;
    hydrateNearby(context.getOpenToken());
  }

  function dispose() {
    gaugeGen++;
    nearbyGen++;
    dealRequest.next();
    chartRequest.next();
    if (chartHandle) chartHandle.destroy();
    chartHandle = null;
  }

  return { bindControls, hydrateGauge, hydrateNearby, loadDeals, onPyeongChange, dispose };
};

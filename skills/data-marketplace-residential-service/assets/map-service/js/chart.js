// 실거래 차트 — 금액축(산점 + 월평균 라인)과 거래량 바를 분리 렌더, 외부 의존성 없는 캔버스 구현
window.dealChart = (() => {
  const COLORS = {
    "매매": "#0e6b4f",
    "전세": "#1d63d8",
    "월세": "#c97a10",
  };

  function valueOf(deal, dealType) {
    if (dealType === "전세") return deal.deposit_price;
    return deal.price; // 매매=매매가, 월세=월세액
  }

  // deals → [{t: monthIndex, v, raw}], 월 인덱스는 1970-01부터의 개월 수
  function toPoints(deals, dealType) {
    const pts = [];
    for (const d of deals) {
      const v = valueOf(d, dealType);
      if (v == null || !d.contract_date || d.cancel_date) continue;
      const s = String(d.contract_date);
      const y = +s.slice(0, 4), m = +s.slice(4, 6), day = +s.slice(6, 8);
      pts.push({ t: (y - 1970) * 12 + (m - 1) + (day - 1) / 31, v, raw: d });
    }
    return pts.sort((a, b) => a.t - b.t);
  }

  function monthlyAvg(pts) {
    const byM = new Map();
    for (const p of pts) {
      const key = Math.floor(p.t);
      if (!byM.has(key)) byM.set(key, []);
      byM.get(key).push(p.v);
    }
    return [...byM.entries()]
      .map(([t, vs]) => ({ t: t + 0.5, v: vs.reduce((s, x) => s + x, 0) / vs.length, n: vs.length }))
      .sort((a, b) => a.t - b.t);
  }

  function niceTicks(min, max, n = 4) {
    const span = max - min || 1;
    const step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || 10 * mag;
    const lo = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = lo; v <= max + step * 0.01; v += step) if (v >= min - step * 0.01) ticks.push(v);
    return ticks;
  }

  function axisPrice(v) {
    if (v === 0) return "0";
    if (v >= 1e8) {
      const eok = v / 1e8;
      return `${eok >= 10 ? Math.round(eok) : Math.round(eok * 10) / 10}억`;
    }
    return `${Math.round(v / 1e4).toLocaleString()}만`;
  }

  // container에 캔버스+툴팁 렌더. 반환: destroy()
  // overlay: {deals, dealType, label} — 기본 시리즈와 같은 축 위에 겹쳐 그리는 보조 시리즈
  // (예: 매매 위에 전세 보증금 — 두 라인의 간격이 전세가율의 시각화다).
  function render(container, deals, dealType, { monthsBack = null, overlay = null } = {}) {
    container.innerHTML = "";
    let pts = toPoints(deals, dealType);
    let ovPts = overlay ? toPoints(overlay.deals, overlay.dealType) : [];
    if (monthsBack) {
      const now = new Date();
      const nowT = (now.getFullYear() - 1970) * 12 + now.getMonth() + 1;
      pts = pts.filter((p) => p.t >= nowT - monthsBack);
      ovPts = ovPts.filter((p) => p.t >= nowT - monthsBack);
    }
    if (!pts.length && !ovPts.length) {
      const empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.innerHTML = "이 조건의 거래가 없어요.<br/>기간을 넓히거나 다른 평형을 선택해 보세요.";
      container.appendChild(empty);
      return { destroy() {} };
    }

    const canvas = document.createElement("canvas");
    canvas.className = "chart-canvas";
    canvas.dataset.testid = "price-trend-chart";
    container.appendChild(canvas);
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.style.display = "none";
    container.appendChild(tip);
    const volCanvas = document.createElement("canvas");
    volCanvas.className = "chart-canvas vol";
    volCanvas.dataset.testid = "volume-bars";
    container.appendChild(volCanvas);

    const color = COLORS[dealType] || COLORS["매매"];
    const ovColor = overlay ? (COLORS[overlay.dealType] || COLORS["전세"]) : null;
    const baseAvg = monthlyAvg(pts);
    const ovAvg = monthlyAvg(ovPts);
    // 축 도메인은 두 시리즈를 합쳐 잡는다 — 같은 축이어야 간격이 비교다
    const allPts = pts.concat(ovPts).sort((a, b) => a.t - b.t);
    const PAD = { l: 44, r: 12, t: 12, b: 24 };
    let W = 0, H = 0, dpr = 1;
    let xMin, xMax, yMin, yMax;
    let screenPts = [];

    function layout() {
      dpr = window.devicePixelRatio || 1;
      W = container.clientWidth;
      H = 190;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = `${H}px`;

      xMin = allPts[0].t; xMax = allPts[allPts.length - 1].t;
      if (xMax - xMin < 6) { const c = (xMin + xMax) / 2; xMin = c - 3; xMax = c + 3; }
      const vs = allPts.map((p) => p.v);
      yMin = Math.min(...vs); yMax = Math.max(...vs);
      if (yMin === yMax) { yMin *= 0.9; yMax *= 1.1; }
      const yPad = (yMax - yMin) * 0.12;
      yMin = Math.max(0, yMin - yPad); yMax += yPad;
    }

    const sx = (t) => PAD.l + ((t - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
    const sy = (v) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
    const FONT = '10.5px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

    // 월별 거래 건수 바 — 금액축 차트와 분리된 보조 캔버스
    function drawVol() {
      const VH = 44;
      volCanvas.width = W * dpr;
      volCanvas.height = VH * dpr;
      volCanvas.style.height = `${VH}px`;
      const vctx = volCanvas.getContext("2d");
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vctx.clearRect(0, 0, W, VH);
      const inRange = baseAvg.filter((a) => a.t >= xMin && a.t <= xMax);
      if (!inRange.length) return;
      const maxN = Math.max(...inRange.map((a) => a.n), 1);
      const bw = Math.max(2, Math.min(10, ((W - PAD.l - PAD.r) / Math.max(1, xMax - xMin)) * 0.7));
      vctx.fillStyle = color;
      vctx.globalAlpha = 0.35;
      for (const a of inRange) {
        const h = Math.max(1, (a.n / maxN) * (VH - 16));
        vctx.fillRect(sx(a.t) - bw / 2, VH - h, bw, h);
      }
      vctx.globalAlpha = 1;
      vctx.font = FONT;
      vctx.fillStyle = "#75827b";
      vctx.textAlign = "left";
      vctx.textBaseline = "top";
      vctx.fillText(`월별 거래량 · 최대 ${maxN}건`, PAD.l, 1);
    }

    function draw() {
      layout();
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = FONT;

      // y 그리드
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = "#75827b";
      for (const v of niceTicks(yMin, yMax, 4)) {
        const y = sy(v);
        ctx.strokeStyle = "#eef1ee"; ctx.beginPath();
        ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
        ctx.fillText(axisPrice(v), PAD.l - 6, y);
      }
      // x 라벨: 연 단위
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const startY = Math.ceil((xMin + 11) / 12); // 다음 1월
      const endY = Math.floor(xMax / 12) + 1970;
      const spanYears = endY - (startY + 1969);
      const stepY = spanYears > 8 ? Math.ceil(spanYears / 6) : 1;
      for (let yy = startY + 1970 - 1; yy <= endY; yy += stepY) {
        const t = (yy - 1970) * 12;
        if (t < xMin || t > xMax) continue;
        const x = sx(t);
        ctx.strokeStyle = "#f2f4f1"; ctx.beginPath();
        ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke();
        ctx.fillText(String(yy), x, H - PAD.b + 6);
      }

      // 시리즈(산점 + 월평균 라인 + 마지막 평균점) — 기본/겹침 공용
      screenPts = [];
      const drawSeries = (seriesPts, seriesAvg, seriesColor, seriesType) => {
        ctx.fillStyle = seriesColor; ctx.globalAlpha = 0.28;
        for (const p of seriesPts) {
          const x = sx(p.t), y = sy(p.v);
          screenPts.push({ x, y, p, type: seriesType });
          ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (seriesAvg.length > 1) {
          ctx.strokeStyle = seriesColor; ctx.lineWidth = 2; ctx.lineJoin = "round";
          ctx.beginPath();
          let started = false;
          for (const a of seriesAvg) {
            if (a.t < xMin || a.t > xMax) continue;
            const x = sx(a.t), y = sy(a.v);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        const lastA = seriesAvg[seriesAvg.length - 1];
        if (lastA) {
          ctx.fillStyle = seriesColor;
          ctx.beginPath(); ctx.arc(sx(lastA.t), sy(lastA.v), 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
        }
      };
      drawSeries(pts, baseAvg, color, dealType);
      if (ovPts.length) drawSeries(ovPts, ovAvg, ovColor, overlay.dealType);

      // 범례 — 겹침일 때만 (단일 시리즈는 세그먼트 색이 곧 범례다)
      if (ovPts.length) {
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        let lx = PAD.l + 4;
        for (const [c2, label] of [[color, dealType], [ovColor, overlay.label || overlay.dealType]]) {
          ctx.fillStyle = c2; ctx.fillRect(lx, 4, 8, 8);
          ctx.fillStyle = "#45524c"; ctx.fillText(label, lx + 11, 3);
          lx += 11 + ctx.measureText(label).width + 14;
        }
      }
      drawVol();
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let best = null, bestD = 20 * 20;
      for (const s of screenPts) {
        const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
        if (d < bestD) { bestD = d; best = s; }
      }
      if (!best) { tip.style.display = "none"; return; }
      const d = best.p.raw;
      const sType = best.type || dealType; // 겹침 모드에서는 점이 속한 시리즈 기준으로 표기
      const priceTxt = sType === "월세"
        ? window.fmt.rent(d.deposit_price, d.price)
        : window.fmt.price(valueOf(d, sType), { compact: true });
      tip.innerHTML = `${ovPts.length ? `<b>${sType}</b> · ` : ""}${window.fmt.dateShort(d.contract_date)} · ${window.fmt.area(d.private_area)} ${d.floor_name ? `· ${window.fmt.esc(d.floor_name)}층` : ""}<br/><b>${priceTxt}</b>`;
      tip.style.left = `${best.x}px`;
      tip.style.top = `${best.y}px`;
      tip.style.display = "block";
    }
    function onLeave() { tip.style.display = "none"; }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    draw();

    return {
      destroy() {
        ro.disconnect();
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mouseleave", onLeave);
      },
    };
  }

  return { render, COLORS };
})();

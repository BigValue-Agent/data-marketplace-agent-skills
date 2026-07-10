// 앱 부트스트랩 — 검색, 필터, 도구, 지도-패널 연결
(() => {
  const F = window.fmt;
  const C = window.APP_CONFIG;

  // ── 브랜드 적용 — 각색 시 config의 APP_NAME/APP_TAGLINE만 바꾸면 된다 ──
  document.title = `${C.APP_NAME} — ${C.APP_TAGLINE}`;
  document.getElementById("brand-name").textContent = C.APP_NAME;
  document.getElementById("brand-tag").textContent = C.APP_TAGLINE;

  // ── 지도 초기화 ──────────────────────────────
  const fallbackEl = document.getElementById("map-fallback");
  async function bootMap() {
    fallbackEl.hidden = true;
    try {
      await window.mapCtl.init({
        onMarkerClick: (row) => {
          // 마커 row grain은 complex_key + residential_type — 주상복합에서 클릭한 유형이
          // 프로필 대표 유형에 덮이지 않도록 유형을 함께 넘긴다.
          window.panel.open(row.complex_key, row.residential_type);
          window.mapCtl.select(row.complex_key);
        },
      });
    } catch (e) {
      console.error(e);
      fallbackEl.hidden = false;
    }
  }
  document.getElementById("map-retry").addEventListener("click", bootMap);
  bootMap();

  // ── 검색 자동완성 ────────────────────────────
  const input = document.getElementById("search-input");
  const resultsEl = document.getElementById("search-results");
  const clearBtn = document.getElementById("search-clear");
  const combo = document.getElementById("search-combo");
  let searchTimer = null;
  let searchAbort = null;
  let items = [];
  let activeIdx = -1;

  input.addEventListener("input", () => {
    clearBtn.hidden = input.value.length === 0;
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideResults(); return; }
    searchTimer = setTimeout(() => runSearch(q), 250);
  });

  async function runSearch(q) {
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    try {
      items = await window.api.searchComplex(q, { signal: searchAbort.signal });
      renderResults(q);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error(e);
      items = [];
      resultsEl.innerHTML = `<li class="sr-empty">검색 중 오류가 났어요. 잠시 후 다시 시도해 주세요.</li>`;
      resultsEl.hidden = false;
    }
  }

  function renderResults(q) {
    activeIdx = -1;
    if (!items.length) {
      resultsEl.innerHTML = `<li class="sr-empty">"${F.esc(q)}" 단지를 찾지 못했어요. 단지명을 다시 확인해 주세요.</li>`;
      resultsEl.hidden = false;
      combo.setAttribute("aria-expanded", "true");
      return;
    }
    const TYPE_BADGE = {
      "연립다세대": { cls: " villa", label: "연립" },
      "오피스텔": { cls: " officetel", label: "오피스텔" },
    };
    resultsEl.innerHTML = items.map((it, i) => {
      const badge = TYPE_BADGE[it.residential_type] || { cls: "", label: it.residential_type || "아파트" };
      const name = F.esc(it.complex_name).replace(
        new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
      return `<li role="option" data-i="${i}">
        <span class="sr-type${badge.cls}">${badge.label}</span>
        <div class="sr-main">
          <div class="sr-name">${name}</div>
          <div class="sr-addr">${F.esc(it.display_address || "")}</div>
        </div>
      </li>`;
    }).join("");
    resultsEl.hidden = false;
    combo.setAttribute("aria-expanded", "true");
    resultsEl.querySelectorAll("li[data-i]").forEach((li) => {
      li.addEventListener("click", () => pick(+li.dataset.i));
    });
  }

  function hideResults() {
    resultsEl.hidden = true;
    combo.setAttribute("aria-expanded", "false");
    activeIdx = -1;
  }

  function pick(i) {
    const it = items[i];
    if (!it) return;
    input.value = it.complex_name;
    hideResults();
    if (it.latitude != null && it.longitude != null) {
      window.mapCtl.panTo(it.latitude, it.longitude, 4);
    }
    window.panel.open(it.complex_key, it.residential_type);
    window.mapCtl.select(it.complex_key);
  }

  input.addEventListener("keydown", (e) => {
    if (resultsEl.hidden) return;
    const n = items.length;
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = (activeIdx + 1) % n; }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = (activeIdx - 1 + n) % n; }
    else if (e.key === "Enter") { e.preventDefault(); pick(activeIdx >= 0 ? activeIdx : 0); return; }
    else if (e.key === "Escape") { hideResults(); return; }
    else return;
    resultsEl.querySelectorAll("li[data-i]").forEach((li, i) =>
      li.classList.toggle("is-active", i === activeIdx));
    resultsEl.querySelector("li.is-active")?.scrollIntoView({ block: "nearest" });
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.hidden = true;
    hideResults();
    input.focus();
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target) && !resultsEl.contains(e.target)) hideResults();
  });

  // ── 주거유형 필터 ────────────────────────────
  document.querySelectorAll(".type-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".type-seg .seg-btn").forEach((b) =>
        b.classList.toggle("is-on", b === btn));
      window.mapCtl.setTypeFilter(btn.dataset.type);
    });
  });

  // ── 지도 도구 ────────────────────────────────
  document.getElementById("tool-zoomin").addEventListener("click", () => window.mapCtl.zoom(-1));
  document.getElementById("tool-zoomout").addEventListener("click", () => window.mapCtl.zoom(1));
  document.getElementById("tool-maptype").addEventListener("click", (e) => {
    const on = window.mapCtl.toggleMapType();
    e.target.classList.toggle("is-on", on);
    e.target.textContent = on ? "지도" : "위성";
  });
  document.getElementById("tool-area").addEventListener("click", (e) => {
    const next = F.getAreaUnit() === "pyeong" ? "m2" : "pyeong";
    F.setAreaUnit(next);
    e.target.textContent = next === "pyeong" ? "평" : "㎡";
    if (window.panel.isOpen()) window.panel.rerender();
  });
})();

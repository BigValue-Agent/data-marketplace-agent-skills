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
          // 마커는 complex_key당 한 행이며 residential_type은 대표 유형이다.
          window.panel.open(row.complex_key, row.residential_type);
        },
        onRegionOverview: () => window.panel.close(),
        onSelectionCleared: () => window.panel.close(),
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
  const searchRequest = window.asyncPolicy.latestRequest();
  let searchTimer = null;
  let searchAbort = null;
  let items = [];
  let activeIdx = -1;
  let pickGeneration = 0;
  let regionAbort = null;

  const SEARCH_GROUPS = [
    { type: "region", id: "search-group-region", label: "지역" },
    { type: "complex", id: "search-group-complex", label: "단지" },
  ];

  function invalidateSearch() {
    clearTimeout(searchTimer);
    searchAbort?.abort();
    searchAbort = null;
    searchRequest.next();
  }

  function currentOptions() {
    return [...resultsEl.querySelectorAll('[role="option"][data-i]')];
  }

  input.addEventListener("input", () => {
    clearBtn.hidden = input.value.length === 0;
    invalidateSearch();
    items = [];
    hideResults();
    const q = input.value.trim();
    if (q.length < 2) return;
    searchTimer = setTimeout(() => runSearch(q), 250);
  });

  async function runSearch(q) {
    const sequence = searchRequest.next();
    const controller = new AbortController();
    searchAbort = controller;
    try {
      const rows = await window.api.searchLocation(q, { signal: controller.signal });
      if (!searchRequest.isCurrent(sequence) || input.value.trim() !== q) return;
      items = SEARCH_GROUPS.flatMap(({ type }) => rows.filter((row) => row.result_type === type));
      renderResults(q);
    } catch (e) {
      if (e.name === "AbortError" || !searchRequest.isCurrent(sequence)) return;
      console.error(e);
      items = [];
      resultsEl.innerHTML = `<li class="sr-empty" role="none">검색 중 오류가 났어요. 잠시 후 다시 시도해 주세요.</li>`;
      resultsEl.hidden = false;
      input.setAttribute("aria-expanded", "true");
    } finally {
      if (searchAbort === controller) searchAbort = null;
    }
  }

  function renderResults(q) {
    activeIdx = -1;
    if (!items.length) {
      resultsEl.innerHTML = `<li class="sr-empty" role="none">"${F.esc(q)}" 지역이나 단지를 찾지 못했어요.</li>`;
      resultsEl.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }
    const RESIDENTIAL_BADGE = {
      "연립다세대": { cls: " villa", label: "연립" },
      "오피스텔": { cls: " officetel", label: "오피스텔" },
      "아파트": { cls: "", label: "아파트" },
    };
    let index = 0;
    resultsEl.innerHTML = SEARCH_GROUPS.map((group) => {
      const groupItems = items.filter((item) => item.result_type === group.type);
      if (!groupItems.length) return "";
      const options = groupItems.map((item) => {
        const itemIndex = index++;
        const badge = item.result_type === "region"
          ? { cls: " region", label: "지역" }
          : RESIDENTIAL_BADGE[item.residential_type] || { cls: "", label: item.residential_type || "단지" };
        const name = F.esc(item.title).replace(
          new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
        return `<li id="search-option-${itemIndex}" role="option" aria-selected="false" data-i="${itemIndex}">
          <span class="sr-type${badge.cls}">${F.esc(badge.label)}</span>
          <div class="sr-main">
            <div class="sr-name">${name}</div>
            <div class="sr-addr">${F.esc(item.subtitle || "")}</div>
          </div>
        </li>`;
      }).join("");
      return `<li class="sr-group" role="group" aria-labelledby="${group.id}">
        <div class="sr-group-title" id="${group.id}">${group.label}</div>
        <ul class="sr-options" role="presentation">${options}</ul>
      </li>`;
    }).join("");
    resultsEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
    currentOptions().forEach((li) => {
      li.addEventListener("click", () => pick(+li.dataset.i));
    });
  }

  function setActiveOption(index) {
    activeIdx = index;
    const options = currentOptions();
    options.forEach((option, optionIndex) => {
      const active = optionIndex === activeIdx;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", String(active));
    });
    const activeOption = options[activeIdx];
    if (activeOption) {
      input.setAttribute("aria-activedescendant", activeOption.id);
      activeOption.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function hideResults() {
    resultsEl.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIdx = -1;
  }

  async function pick(i) {
    const it = items[i];
    if (!it) return;
    invalidateSearch();
    regionAbort?.abort();
    regionAbort = null;
    const generation = ++pickGeneration;
    input.value = it.title;
    hideResults();

    if (it.result_type === "region") {
      window.panel.close();
      window.mapCtl.enterRegionOverview({
        lat: it.latitude,
        lng: it.longitude,
        title: it.title,
        bbox: {
          min_lat: it.bbox_min_lat,
          max_lat: it.bbox_max_lat,
          min_lng: it.bbox_min_lng,
          max_lng: it.bbox_max_lng,
        },
      });

      if (it.polygon_available) {
        const controller = new AbortController();
        regionAbort = controller;
        try {
          const detail = await window.api.regionDetail(it.result_key, { signal: controller.signal });
          if (generation !== pickGeneration) return;
          if (detail?.polygon_geojson) window.mapCtl.showRegionPolygon(detail.polygon_geojson);
          if (Number.isInteger(detail?.apartment_complex_count)) {
            window.mapCtl.showRegionPin(it.latitude, it.longitude, it.title, detail.apartment_complex_count);
          }
        } catch (e) {
          if (e.name === "AbortError") return;
          console.error(e);
        } finally {
          if (regionAbort === controller) regionAbort = null;
        }
      }
      return;
    }

    window.mapCtl.enterComplexViewport();
    window.mapCtl.clearSelection();
    if (it.latitude != null && it.longitude != null) {
      window.mapCtl.focusOn(it.latitude, it.longitude, "complex");
    }
    window.panel.open(it.result_key, it.residential_type);
  }

  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Escape") {
      invalidateSearch();
      items = [];
      hideResults();
      return;
    }
    if (resultsEl.hidden) return;
    const n = items.length;
    if (!n) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveOption((activeIdx + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveOption((activeIdx - 1 + n) % n); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(activeIdx); return; }
    else return;
  });

  clearBtn.addEventListener("click", () => {
    invalidateSearch();
    input.value = "";
    items = [];
    clearBtn.hidden = true;
    hideResults();
    input.focus();
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target) && !resultsEl.contains(e.target)) {
      invalidateSearch();
      hideResults();
    }
  });

  // ── 주거유형 필터 ────────────────────────────
  const typeButtons = [...document.querySelectorAll(".type-seg .seg-btn")];
  typeButtons.forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.classList.contains("is-on")));
    btn.addEventListener("click", () => {
      typeButtons.forEach((b) => {
        const selected = b === btn;
        b.classList.toggle("is-on", selected);
        b.setAttribute("aria-pressed", String(selected));
      });
      window.mapCtl.setTypeFilter(btn.dataset.type);
    });
  });

  // ── 지도 도구 ────────────────────────────────
  document.getElementById("tool-zoomin").addEventListener("click", () => window.mapCtl.zoomIn());
  document.getElementById("tool-zoomout").addEventListener("click", () => window.mapCtl.zoomOut());
  // 위성 지도를 제공하지 않는 지도(오픈소스 맵)에서는 버튼을 감춘다 — 눌러도 아무 일이
  // 없는 버튼을 남기지 않는다.
  const mapTypeBtn = document.getElementById("tool-maptype");
  if (window.mapCtl.supportsSatellite()) {
    mapTypeBtn.addEventListener("click", (e) => {
      const on = window.mapCtl.toggleMapType();
      e.target.classList.toggle("is-on", on);
      e.target.textContent = on ? "지도" : "위성";
    });
  } else {
    mapTypeBtn.hidden = true;
  }
  document.getElementById("tool-area").addEventListener("click", (e) => {
    const next = F.getAreaUnit() === "pyeong" ? "m2" : "pyeong";
    F.setAreaUnit(next);
    e.target.textContent = next === "pyeong" ? "평" : "㎡";
    if (window.panel.isOpen()) window.panel.rerender();
  });
})();

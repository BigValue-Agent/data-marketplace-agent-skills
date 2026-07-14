window.dataPolicy = (() => {
  const DISPLAY_LIMITS = Object.freeze({
    pyeong: Object.freeze({ minExclusive: 0, maxInclusive: 1000 }),
    unitAreaM2: Object.freeze({ minExclusive: 0, maxInclusive: 3305.785 }),
    floor: Object.freeze({ minInclusive: -20, maxInclusive: 300 }),
  });

  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const validPrice = (value) => finite(value) && value > 0;
  const validPyeong = (value) => finite(value) &&
    value > DISPLAY_LIMITS.pyeong.minExclusive && value <= DISPLAY_LIMITS.pyeong.maxInclusive;
  const validUnitArea = (value) => finite(value) &&
    value > DISPLAY_LIMITS.unitAreaM2.minExclusive && value <= DISPLAY_LIMITS.unitAreaM2.maxInclusive;
  const validFloor = (value) => finite(value) &&
    value >= DISPLAY_LIMITS.floor.minInclusive && value <= DISPLAY_LIMITS.floor.maxInclusive;
  const validCoordinate = (longitude, latitude) => finite(longitude) && finite(latitude) &&
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;

  function distanceMeters(latitude1, longitude1, latitude2, longitude2) {
    if (!validCoordinate(longitude1, latitude1) || !validCoordinate(longitude2, latitude2)) return null;
    const radius = 6371000;
    const rad = Math.PI / 180;
    const dLat = (latitude2 - latitude1) * rad;
    const dLng = (longitude2 - longitude1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(latitude1 * rad) * Math.cos(latitude2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(a));
  }

  function pyeongAreaRange(pyeong) {
    if (!pyeong || !validUnitArea(pyeong.areaMin) || !validUnitArea(pyeong.areaMax) ||
        pyeong.areaMin > pyeong.areaMax) {
      return { areaMin: null, areaMax: null };
    }
    return {
      areaMin: Math.max(0, pyeong.areaMin - 0.5),
      areaMax: pyeong.areaMax + 0.5,
    };
  }

  // 첫 실거래 화면은 전용면적을 안전하게 조회할 수 있는 평형 중 호수가 가장
  // 많은 평형을 선택한다. 모든 평형의 면적이 없으면 최다 호수 평형을 선택
  // 상태로만 남겨 조회 불가를 표시하고, 단지 전체 범위로 조용히 넓히지 않는다.
  function representativePyeong(pyeongs) {
    const all = Array.isArray(pyeongs) ? pyeongs : [];
    const withArea = all.filter((pyeong) => pyeongAreaRange(pyeong).areaMin != null);
    return [...(withArea.length ? withArea : all)]
      .sort((left, right) =>
        (Number(right.ho) || 0) - (Number(left.ho) || 0) || left.py - right.py)[0] || null;
  }

  // 전용면적 필터 범위가 겹치는 공급평형(예: 32·33평이 모두 전용 84.9㎡)을
  // 하나의 실거래 조회 밴드로 묶는다. 실거래 상품에는 공급평형 키가 없어
  // 전용면적으로만 조회할 수 있고, 겹치는 평형을 따로 조회하면 같은 거래가
  // 양쪽에 중복 집계된다.
  function pyeongBands(pyeongs) {
    const ranged = (Array.isArray(pyeongs) ? pyeongs : [])
      .map((pyeong) => ({ pyeong, range: pyeongAreaRange(pyeong) }))
      .filter((entry) => entry.range.areaMin != null)
      .sort((a, b) => a.range.areaMin - b.range.areaMin);
    const bands = [];
    for (const { pyeong, range } of ranged) {
      const last = bands[bands.length - 1];
      if (last && range.areaMin <= last.filterMax) {
        last.pys.push(pyeong.py);
        last.areaMin = Math.min(last.areaMin, pyeong.areaMin);
        last.areaMax = Math.max(last.areaMax, pyeong.areaMax);
        last.filterMax = Math.max(last.filterMax, range.areaMax);
      } else {
        bands.push({
          pys: [pyeong.py],
          areaMin: pyeong.areaMin,
          areaMax: pyeong.areaMax,
          filterMin: range.areaMin,
          filterMax: range.areaMax,
        });
      }
    }
    return bands;
  }

  function profilePriceEvidence(fallback, { typeMismatch = false } = {}) {
    // 단지 전체 대표값은 상품이 미리 집계한 최근 6개월 프로필 요약을 정본으로 쓴다.
    // 상세 API 첫 페이지 rows는 목록·차트용이며 단지 전체 통계를 덮어쓰지 않는다.
    if (!typeMismatch && validPrice(fallback?.avg)) {
      const avg = fallback.avg;
      return {
        min: validPrice(fallback.min) ? fallback.min : avg,
        max: validPrice(fallback.max) ? fallback.max : avg,
        avg,
        count: finite(fallback.count) && fallback.count >= 0 ? fallback.count : 0,
        unitAvg: null,
        unitCount: 0,
        source: "profile",
        scope: "complex",
      };
    }
    return null;
  }

  const keyPart = (value) => value == null ? "" : String(value);

  // 실거래는 거래유형과 조회 기간까지 같을 때만 같은 rows로 취급한다.
  function realdealScopeKey({
    complexKey, residentialType, areaMin, areaMax, dealDivision, dateFrom, dateTo,
  }) {
    return [
      "realdeal", complexKey, residentialType, areaMin, areaMax,
      dealDivision, dateFrom, dateTo,
    ].map(keyPart).join("|");
  }

  const sameCoordinate = (left, right) => left[0] === right[0] && left[1] === right[1];
  function validOuterRing(ring) {
    return Array.isArray(ring) && ring.length >= 4 && ring.every((coordinate) =>
      Array.isArray(coordinate) && coordinate.length === 2 &&
      validCoordinate(coordinate[0], coordinate[1])) &&
      sameCoordinate(ring[0], ring[ring.length - 1]);
  }

  function geoJsonOuterRings(value) {
    if (!value || typeof value !== "object") return null;
    let rings;
    if (value.type === "Polygon" && Array.isArray(value.coordinates)) {
      rings = [value.coordinates[0]];
    } else if (value.type === "MultiPolygon" && Array.isArray(value.coordinates)) {
      rings = value.coordinates.map((polygon) => Array.isArray(polygon) ? polygon[0] : null);
    } else {
      return null;
    }
    if (!rings.length || rings.some((ring) => !validOuterRing(ring))) return null;
    return rings.map((ring) => ring.map((coordinate) => [...coordinate]));
  }

  return {
    DISPLAY_LIMITS,
    validPrice,
    validPyeong,
    validUnitArea,
    validFloor,
    validCoordinate,
    distanceMeters,
    pyeongAreaRange,
    representativePyeong,
    pyeongBands,
    profilePriceEvidence,
    realdealScopeKey,
    geoJsonOuterRings,
  };
})();

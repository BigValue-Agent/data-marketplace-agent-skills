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
    profilePriceEvidence,
    realdealScopeKey,
    geoJsonOuterRings,
  };
})();

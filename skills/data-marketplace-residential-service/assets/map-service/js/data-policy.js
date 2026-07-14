// API 원본은 보존하고, 화면 표시와 파생계산에 사용할 수 있는 값만 판정한다.
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

  const standardYearMonth = (value) => {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalized = String(value);
    return /^\d{6}$/.test(normalized) ? normalized : null;
  };

  function latestSnapshot(rows, field) {
    if (!Array.isArray(rows) || typeof field !== "string") {
      return { standardYm: null, rows: [] };
    }
    const candidates = rows
      .map((row) => standardYearMonth(row?.[field]))
      .filter((value) => value !== null);
    if (!candidates.length) return { standardYm: null, rows: [] };

    const standardYm = candidates.reduce((latest, value) => value > latest ? value : latest);
    return {
      standardYm,
      rows: rows.filter((row) => standardYearMonth(row?.[field]) === standardYm),
    };
  }

  function noticeSummary(rows, { pyeong = null, areaMin = null, areaMax = null } = {}) {
    const snapshot = latestSnapshot(rows, "notice_standard_ym");
    const validAreaRange = validUnitArea(areaMin) && validUnitArea(areaMax) && areaMin <= areaMax;
    const scoped = pyeong == null
      ? snapshot.rows
      : validPyeong(pyeong)
        ? snapshot.rows.filter((row) => {
            if (row?.pyeong_number === pyeong) return true;
            // 유효한 다른 평형번호를 면적만으로 현재 평형에 편입하지 않는다.
            if (validPyeong(row?.pyeong_number)) return false;
            return validAreaRange && validUnitArea(row?.private_area) &&
              row.private_area >= areaMin && row.private_area <= areaMax;
          })
        : [];
    const prices = scoped.map((row) => row?.notice_price).filter(validPrice);
    return {
      standardYm: snapshot.standardYm,
      average: prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null,
      count: prices.length,
      scope: pyeong == null ? "complex" : "pyeong",
    };
  }

  function dealStats(rows) {
    if (!Array.isArray(rows)) return null;
    const active = rows.filter((row) => !row?.cancel_date && validPrice(row?.price));
    if (!active.length) return null;

    const prices = active.map((row) => row.price);
    const unitPrices = active
      .filter((row) => validUnitArea(row?.private_area))
      .map((row) => row.price / (row.private_area / 3.305785));
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((sum, value) => sum + value, 0) / prices.length,
      count: prices.length,
      unitAvg: unitPrices.length
        ? unitPrices.reduce((sum, value) => sum + value, 0) / unitPrices.length
        : null,
      unitCount: unitPrices.length,
    };
  }

  function priceEvidence(stats, fallback, { scope, typeMismatch }) {
    if (stats) return { ...stats, source: "rows", scope };
    if (scope !== "complex" || typeMismatch || !validPrice(fallback?.avg)) return null;

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
    latestSnapshot,
    noticeSummary,
    dealStats,
    priceEvidence,
    geoJsonOuterRings,
  };
})();

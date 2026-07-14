window.fmt = (() => {
  const EOK = 100000000; // 1억
  const MAN = 10000; // 1만

  // 27.9억 / 6억 2,000 / 4,500만 — 지면에 맞는 축약형
  function price(won, { compact = false } = {}) {
    if (won == null || isNaN(won)) return "—";
    const neg = won < 0 ? "-" : "";
    const v = Math.abs(Math.round(won));
    if (v >= EOK) {
      const eokInt = Math.floor(v / EOK);
      const man = Math.round((v % EOK) / MAN);
      if (man === 0) return `${neg}${eokInt.toLocaleString()}억`;
      if (compact || eokInt >= 100) {
        // 지면이 좁거나 100억 이상이면 소수 한 자리 축약: 27.9억
        return `${neg}${trimZero((v / EOK).toFixed(1))}억`;
      }
      return `${neg}${eokInt}억 ${man.toLocaleString()}`;
    }
    if (v >= MAN) return `${neg}${Math.round(v / MAN).toLocaleString()}만`;
    return `${neg}${v.toLocaleString()}원`;
  }

  function trimZero(s) {
    return s.replace(/\.0$/, "");
  }

  // 월세 표기: 보증금/월세
  function rent(deposit, monthly) {
    return `${price(deposit, { compact: true })} / ${price(monthly, { compact: true })}`;
  }

  // "20260605" → "26.06.05"
  function dateShort(yyyymmdd) {
    if (!yyyymmdd) return "—";
    const s = String(yyyymmdd);
    if (s.length !== 8) return s;
    return `${s.slice(2, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
  }

  // "20181228" → "2018년 12월"
  function dateYm(yyyymmdd) {
    if (!yyyymmdd) return "—";
    const s = String(yyyymmdd);
    return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6), 10)}월`;
  }

  // "202606" → "2026.06"
  function ym(yyyymm) {
    if (!yyyymm) return "—";
    const s = String(yyyymm);
    return `${s.slice(0, 4)}.${s.slice(4, 6)}`;
  }

  // 상품 기준월을 끝월로 하는 포함 기간. 브라우저 현재 날짜가 바뀌어도 같은
  // 상품 스냅숏은 같은 조회 범위를 사용한다. 202606의 6개월은 20260101~20260630.
  function productPeriod(standardYm, months) {
    const value = String(standardYm ?? "");
    if (!/^\d{6}$/.test(value) || !Number.isInteger(months) || months <= 0) return null;
    const year = Number(value.slice(0, 4));
    const monthIndex = Number(value.slice(4, 6)) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    const start = new Date(Date.UTC(year, monthIndex - (months - 1), 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0));
    const ymd = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
    return { dateFrom: ymd(start), dateTo: ymd(end) };
  }

  // 면적: 전역 단위 설정(평/㎡)에 따름
  let areaUnit = "pyeong"; // 'pyeong' | 'm2'
  function setAreaUnit(u) { areaUnit = u; }
  function getAreaUnit() { return areaUnit; }
  function area(m2, { forceUnit = null } = {}) {
    if (m2 == null || isNaN(m2)) return "—";
    const unit = forceUnit || areaUnit;
    if (unit === "pyeong") {
      const p = m2 / 3.305785;
      return `${p >= 100 ? Math.round(p).toLocaleString() : p.toFixed(1)}평`;
    }
    return `${m2 >= 1000 ? Math.round(m2).toLocaleString() : m2.toFixed(1)}㎡`;
  }

  function count(n) {
    return n == null ? "—" : Number(n).toLocaleString();
  }

  // 경로 정보가 없는 profile 값은 이동시간으로 추정하지 않고 원래 거리만 표시한다.
  function distance(meters) {
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) return "—";
    return `약 ${Math.round(meters).toLocaleString()}m`;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  return { price, rent, dateShort, dateYm, ym, productPeriod, area, count, distance, esc, setAreaUnit, getAreaUnit };
})();

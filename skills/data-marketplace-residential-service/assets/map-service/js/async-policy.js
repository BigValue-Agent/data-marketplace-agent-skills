// 비동기 화면 요청은 시작 순서와 완료 순서가 다를 수 있다.
window.asyncPolicy = (() => {
  function latestRequest() {
    let current = 0;
    return {
      next: () => ++current,
      current: () => current,
      isCurrent: (sequence) => sequence === current,
    };
  }

  return { latestRequest };
})();

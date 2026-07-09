# Data Marketplace Residential Service Skill

[한국어](README.md) | [English](README.en.md)

Data Marketplace 주거형 부동산 서비스를 만들 때 쓰는 AI 코드제너레이터용 스킬입니다.

단지 검색, 지도 마커, 상세 패널, 동/호 드릴다운, 실거래, 공시가격, 산출시세 화면을 만들 때 어떤 데이터 상품을 어떤 순서로 조합해야 하는지 안내합니다.

## 설치

Node.js 18 이상에서 설치합니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

## 스킬

| 스킬 | 설명 |
|---|---|
| `data-marketplace-residential-service` | 단지 검색, 지도 마커, 상세 정보, 가격 탭, 동/호 드릴다운, 서버 사이드 API 연동을 위한 Data Marketplace 주거형 서비스 가이드 |

## 사용

설치 후 AI 코드제너레이터에게 만들고 싶은 부동산 서비스 화면을 요청하면 됩니다.

예시:

```text
주거형 부동산 지도 서비스 만들어줘.
```

전체 지도 서비스용 시작 템플릿은 스킬의 `assets/map-service/`에 포함되어 있습니다.

## 인증

실제 API를 호출하려면 서버 사이드 API key와 API base URL이 필요하며, 두 값 모두 온보딩 시 제공됩니다. 이 스킬은 상품 선택·조합 규칙을 제공하고, 상품별 필터·필드·응답 스키마 스냅샷은 `references/api/`에 포함됩니다 — 함께 제공된 더 최신 API Reference가 있으면 그쪽이 우선합니다.

```bash
export DATA_MARKETPLACE_API_KEY=<your-api-key>
export DATA_MARKETPLACE_BASE_URL=<data-marketplace-base-url>
```

API key는 서버에서만 `X-API-KEY` 헤더로 사용해야 합니다. 코드에 직접 넣거나 브라우저에 노출하지 마세요.

## 라이선스

내부 사용 전용입니다. 자세한 내용은 `LICENSE.md`를 확인하세요.

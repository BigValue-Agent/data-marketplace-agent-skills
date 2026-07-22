# Data Marketplace Residential Service Skill

[한국어](README.md) | [English](README.en.md)

Data Marketplace 주거형 부동산 서비스를 만들 때 쓰는 AI 코드제너레이터용 스킬입니다.

단지 검색, 지도 마커, 상세 패널, 동/호 드릴다운, 실거래, 공시가격, 산출시세 화면을 만들 때 어떤 데이터 상품을 어떤 순서로 조합해야 하는지 안내합니다.

## 설치

도구별로 아래 방법 중 **하나만** 선택하세요. 여러 방법을 겹쳐 설치하면 같은 스킬이 두 벌 로드됩니다.

### 방법 A — Claude Code 플러그인 (권장: 스킬 + MCP 도구 + 키 설정 한 번에)

Claude Code에서 아래 순서로 실행합니다.

```text
/plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
/plugin install bigvalue-realestate@bigvalue-agent-skills
/reload-plugins
/bigvalue-realestate:setup
```

설치할 때 온보딩 때 제공받은 **MCP 서버 URL**과 **API key**를 입력하라는 창이 뜹니다.
API key는 안전한 저장소(OS 키체인)에 보관되며 MCP 서버 인증 헤더로만 사용됩니다.
`/reload-plugins` 뒤에 스킬과 Data Marketplace MCP 도구(상품 계약·레시피·템플릿·라이브 조회)가 함께 활성화됩니다.
마지막 `/bigvalue-realestate:setup`은 MCP 연결이 실제로 됐는지 확인하고, 안 됐으면 설정을 안내합니다.

### 방법 A-2 — Codex / ChatGPT 데스크톱 플러그인 (스킬 + MCP 수동 연결)

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
```

추가 후 ChatGPT 데스크톱 앱(Work 모드 또는 Codex)의 Plugins Directory에서 `BigValue Real Estate`를 설치합니다.
이 플러그인은 스킬을 담고, MCP 연결은 `setup` 스킬이 안내합니다 — 설치 후 `setup`을 실행하면 환경변수 이름 방식으로 API 키를 안전하게 등록하는 순서를 따라 할 수 있습니다.

### 방법 B — 스킬만 설치 (npx, 플러그인을 쓸 수 없는 도구용)

플러그인을 지원하지 않는 도구에서만 씁니다. Node.js 18 이상에서 설치합니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

MCP 연결이 필요하면 온보딩 안내의 도구별 등록 방법을 따로 따라 합니다.

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

# 빅밸류 부동산 (BigValue Real Estate)

[한국어](README.md) | [English](README.en.md)

빅밸류 부동산 데이터를 **AI에게 말로 요청**해서 쓰는 플러그인입니다. 아파트·오피스텔·연립다세대의 거래·가격·입지·주거 구성을 진단하거나 비교하고, 필요하면 부동산 서비스 화면까지 만들 수 있습니다.

## 이 플러그인이 하는 일

- **무엇을 하나요** — 궁금한 주거 시장이나 단지를 한국어로 물으면, AI가 질문에 필요한 빅밸류 데이터만 골라 **근거와 한계가 담긴 진단 리포트**를 만들어 줍니다.
- **누가 쓰면 좋나요** — 부동산 데이터를 자주 다루는 **기획자(PO)·마케터·중개사·분석 담당자**, 그리고 부동산 서비스를 만드는 **개발자**.
- **어떻게 쓰나요** — Claude Code(또는 Codex·ChatGPT)에 플러그인을 한 번 설치한 뒤, **채팅창에 한국어로 요청**하면 됩니다. 명령어를 외울 필요가 없습니다.

> **용어 한 줄 정리**
> - **MCP** — AI에 붙이는 '데이터 연결 도구'입니다. 이 플러그인의 MCP가 질문에 필요한 빅밸류 주거 데이터를 가져옵니다.
> - **스킬(Skill)** — "이런 요청이 오면 이렇게 처리하라"를 적어 둔 작업 설명서입니다. AI가 이걸 보고 전문가처럼 순서대로 일합니다.

## 설치

도구별로 아래 방법 중 **하나만** 선택하세요. 여러 방법을 겹쳐 설치하면 같은 스킬이 두 벌 로드됩니다.

### 방법 A — Claude Code 플러그인 (권장)

Claude Code에서 아래 명령을 순서대로 실행합니다.

```text
/plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
/plugin install bigvalue-realestate@bigvalue-agent-skills
/reload-plugins
/bigvalue-realestate:setup
```

플러그인이 MCP를 자동 등록합니다. `/mcp`에서 `bigvalue-realestate`를 선택해 브라우저 로그인하거나, 터미널에서 아래 명령을 실행합니다. 마지막 `setup`은 연결 상태를 확인합니다.

```bash
claude mcp login plugin:bigvalue-realestate:bigvalue-realestate
```

### 방법 A-2 — Codex CLI

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
codex plugin add bigvalue-realestate@bigvalue-agent-skills
```

MCP는 플러그인과 함께 등록됩니다. 처음 데이터를 요청하면 브라우저에서 계정 연결이 시작됩니다.

미리 연결하려면:

```bash
codex mcp login bigvalue-realestate
```

### 방법 A-3 — ChatGPT 데스크톱

마켓플레이스를 추가한 뒤 ChatGPT 데스크톱 앱(Work 모드 또는 Codex)의 Plugins Directory에서 `BigValue Real Estate`를 설치합니다. 처음 데이터를 요청하면 브라우저에서 계정 연결이 시작됩니다.

### 방법 B — 스킬만 설치 (npx, 플러그인을 쓸 수 없는 도구용)

플러그인을 지원하지 않는 도구에서만 씁니다. Node.js 18 이상에서 설치합니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

MCP 연결이 필요하면 온보딩 안내의 도구별 등록 방법을 따로 따라 합니다.

## 들어있는 스킬 3종

| 스킬 | 하는 일 | 누구에게 |
|---|---|---|
| **주거 진단 리포트** (`residential-diagnostic-report`) | 단지·지역·주거 유형의 거래·가격·입지·주거 구성 중 질문에 필요한 근거만 골라 **상태와 의미를 진단**합니다. | 기획자·마케터·중개사 등 누구나 |
| **주거 비교 리포트** (`residential-comparison-report`) | 단지·지역·주거 유형·평형 등 둘 이상의 대상을 같은 기준으로 **비교하거나 순위화**하고, 기준별 차이와 한계를 보여줍니다. | 기획자·마케터·중개사 등 누구나 |
| **부동산 서비스 개발** (`data-marketplace-residential-service`) | 단지 검색·지도 마커·상세 패널·동/호 상세·가격 화면 등 **주거용 부동산 서비스**를 만들 때, 어떤 데이터를 어떤 순서로 조합할지 안내합니다. | 개발자 |

## 이렇게 쓰세요

설치가 끝나면 채팅창에 한국어로 요청하면 됩니다.

**주거 시장이나 단지를 진단할 때**

```text
잠실동 아파트 시장의 단지 구성과 최근 거래 현황을 분석해줘.
```

→ 질문에 맞는 실제 데이터 근거와 해석 한계를 담은 진단 리포트가 만들어집니다.

![주거 진단 리포트 데모](docs/price-check-v2.gif)

**주거 대상을 비교하거나 순위를 정할 때**

```text
리센츠와 헬리오시티의 실거주 여건을 비교해줘.
```

→ 질문에 맞는 기준으로 대상을 나란히 비교하고, 순위가 적절하면 기준을 밝힌 순위표를 만듭니다.

![주거 비교·순위 리포트 데모](docs/region-ranking-v2.gif)

**부동산 서비스를 만들 때**

```text
주거형 부동산 지도 서비스 만들어줘.
```

→ 지도 서비스 시작 템플릿은 '부동산 서비스 개발' 스킬의 `assets/map-service/`에 들어 있습니다.

![주거형 부동산 지도 서비스 데모](docs/map-service.gif)

## 데이터 연결과 인증

**대부분의 사용자 (진단·비교·순위 등 조회·분석)**

플러그인을 설치하면 키를 입력할 일이 없습니다. 첫 사용 때 브라우저에서 구글 로그인 한 번이면 연결되고, 로그인 토큰은 클라이언트가 안전하게 보관하고 자동 갱신합니다. **API 키도 환경변수도 직접 만질 필요가 없습니다.**

**부동산 서비스를 개발하는 경우**

'부동산 서비스 개발' 스킬이 만들어 주는 서버 코드는 빅밸류 API를 직접 호출합니다. 이때는 서버 환경변수로 키를 넣습니다. 주소는 `https://datamarket-api.bigvalue.ai`가 기본값이라 따로 넣지 않아도 됩니다. API 키는 **서버에서만** `X-API-KEY` 헤더로 쓰고, 코드에 직접 적거나 브라우저에 노출하지 마세요.

```bash
export DATA_MARKETPLACE_API_KEY=<발급받은 API 키>
```

개발 스킬은 `https://datamarket.bigvalue.ai/llms.txt`를 상품 색인으로 읽고, 구현에 필요한 상품의 최신 필터·필드·응답 문서만 따라갑니다.

## 라이선스

내부 사용 전용입니다. 자세한 내용은 `LICENSE.md`를 확인하세요.

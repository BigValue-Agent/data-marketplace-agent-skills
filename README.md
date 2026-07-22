# 빅밸류 부동산 (BigValue Real Estate)

[한국어](README.md) | [English](README.en.md)

빅밸류 부동산 데이터를 **AI에게 말로 요청**해서 쓰는 플러그인입니다. 아파트·오피스텔·연립다세대의 **실거래가·AI 산출시세·공시가격**을 조회하고, 필요하면 부동산 서비스 화면까지 만들 수 있습니다.

## 이 플러그인이 하는 일

- **무엇을 하나요** — "이 아파트 가격 진단해줘"처럼 한국어로 말하면, AI가 빅밸류 데이터를 조회해 **실거래가·시세·공시가격을 비교한 진단 카드**를 만들어 줍니다.
- **누가 쓰면 좋나요** — 부동산 데이터를 자주 다루는 **기획자(PO)·마케터·중개사·분석 담당자**, 그리고 부동산 서비스를 만드는 **개발자**.
- **어떻게 쓰나요** — Claude Code(또는 Codex·ChatGPT)에 플러그인을 한 번 설치한 뒤, **채팅창에 한국어로 요청**하면 됩니다. 명령어를 외울 필요가 없습니다.

> **용어 한 줄 정리**
> - **MCP** — AI에 붙이는 '데이터 연결 도구'입니다. 이 플러그인의 MCP가 빅밸류의 실거래가·시세·공시가격을 실시간으로 가져옵니다.
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

설치 중 온보딩 때 받은 **MCP 서버 주소**와 **API 키**를 입력하는 창이 뜹니다. 입력하면 스킬과 데이터 연결(MCP)이 함께 켜지고, 마지막 `setup`이 연결 상태까지 확인해 줍니다.

### 방법 A-2 — Codex · ChatGPT 데스크톱

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
```

추가한 뒤 ChatGPT 데스크톱 앱(Work 모드 또는 Codex)의 Plugins Directory에서 `BigValue Real Estate`를 설치합니다. 그다음 `setup`을 실행하면 데이터 연결(MCP) 방법을 안내해 줍니다.

### 방법 B — 스킬만 설치 (npx, 플러그인을 쓸 수 없는 도구용)

플러그인을 지원하지 않는 도구에서만 씁니다. Node.js 18 이상에서 설치합니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

MCP 연결이 필요하면 온보딩 안내의 도구별 등록 방법을 따로 따라 합니다.

## 들어있는 스킬 2종

| 스킬 | 하는 일 | 누구에게 |
|---|---|---|
| **아파트 가격 진단** (`apartment-price-check`) | "이 아파트 얼마야?" 한마디에 **실거래가·AI 산출시세·공시가격을 한 장에 비교**한 진단 카드(HTML)를 만들어 줍니다. | 기획자·마케터·중개사 등 누구나 |
| **부동산 서비스 개발** (`data-marketplace-residential-service`) | 단지 검색·지도 마커·상세 패널·동/호 상세·가격 화면 등 **주거용 부동산 서비스**를 만들 때, 어떤 데이터를 어떤 순서로 조합할지 안내합니다. | 개발자 |

## 이렇게 쓰세요

설치가 끝나면 채팅창에 한국어로 요청하면 됩니다.

**가격이 궁금할 때**

```text
이 아파트 가격 진단해줘.
```

→ 실거래가·산출시세·공시가격을 비교한 진단 카드가 HTML 파일로 만들어집니다.

![아파트 가격 진단 데모](docs/price-check.gif)

**부동산 서비스를 만들 때**

```text
주거형 부동산 지도 서비스 만들어줘.
```

→ 지도 서비스 시작 템플릿은 '부동산 서비스 개발' 스킬의 `assets/map-service/`에 들어 있습니다.

![주거형 부동산 지도 서비스 데모](docs/map-service.gif)

## 데이터 연결과 인증

**대부분의 사용자 (가격 진단 등 조회·분석)**

플러그인을 설치하고 `/bigvalue-realestate:setup`을 실행하면, 온보딩 때 받은 **MCP 서버 주소와 API 키**를 한 번만 입력합니다. 키는 안전한 저장소(OS 키체인)에 보관되고 데이터 연결에만 쓰입니다. **환경변수를 직접 만질 필요가 없습니다.**

**부동산 서비스를 개발하는 경우**

'부동산 서비스 개발' 스킬이 만들어 주는 서버 코드는 빅밸류 API를 직접 호출합니다. 이때는 서버 환경변수로 키와 주소를 넣습니다. API 키는 **서버에서만** `X-API-KEY` 헤더로 쓰고, 코드에 직접 적거나 브라우저에 노출하지 마세요.

```bash
export DATA_MARKETPLACE_API_KEY=<발급받은 API 키>
export DATA_MARKETPLACE_BASE_URL=<데이터 마켓플레이스 주소>
```

상품별 필터·필드·응답 스키마 스냅샷은 개발 스킬 안의 `references/api/`에 들어 있으며, 함께 제공된 더 최신 API Reference가 있으면 그쪽이 우선합니다.

## 라이선스

내부 사용 전용입니다. 자세한 내용은 `LICENSE.md`를 확인하세요.

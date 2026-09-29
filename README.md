# 빅밸류 부동산 (BigValue Real Estate)

한국어 | [English](README.en.md)

빅밸류 부동산은 빅밸류 데이터 마켓플레이스의 주거용 부동산 데이터를 활용하는 AI 에이전트용 플러그인입니다. 아파트·오피스텔·연립다세대를 대상으로 조건별 단지 탐색, 주거 데이터 진단·비교, 부동산 서비스 개발을 지원합니다.

작업 절차를 담은 스킬과 데이터 조회용 MCP(Model Context Protocol) 연결이 포함되어 있습니다. MCP는 AI 도구를 외부 데이터에 연결하는 표준 규약입니다. 설치와 인증을 마치면 대화창에서 작업을 요청할 수 있습니다.

## 제공 스킬

| 스킬 | 주요 기능 | 상세 문서 |
| --- | --- | --- |
| 조건별 단지 탐색 | 지역·세대수·면적·가격 등의 조건에 맞는 단지를 찾고, 확인한 조건과 추가 확인이 필요한 항목을 구분합니다. | [residential-complex-finder](skills/residential-complex-finder/SKILL.md) |
| 주거 진단 | 단지나 지역의 거래·가격·입지·주거 구성을 분석하고, 주요 특징과 유의할 점을 정리합니다. | [residential-diagnostic-report](skills/residential-diagnostic-report/SKILL.md) |
| 주거 비교 | 둘 이상의 단지·지역 등을 같은 기준으로 비교합니다. 요청에 따라 순위나 우선순위도 정리합니다. | [residential-comparison-report](skills/residential-comparison-report/SKILL.md) |
| 부동산 서비스 개발 | 단지 검색, 지도 표시, 단지·동·호별 정보 조회 등을 갖춘 서비스의 데이터 연동과 코드 작성을 지원합니다. | [data-marketplace-residential-service](skills/data-marketplace-residential-service/SKILL.md) |

설치 후 연결 상태를 확인하는 [setup 스킬](skills/setup/SKILL.md)도 포함되어 있습니다.

## 설치 및 인증

사용하는 도구에 맞는 설치 방법을 선택합니다. 같은 도구에 플러그인과 개별 스킬을 중복으로 설치하지 않습니다.

데이터를 조회하려면 빅밸류 데이터 이용 권한이 있는 계정이 필요합니다. 플러그인의 MCP 연결은 브라우저 로그인(OAuth)으로 인증하며, API 키를 직접 입력할 필요는 없습니다. 계정에 이용 권한이 없으면 온보딩 담당자에게 계정 승인을 요청합니다.

### Claude Code

플러그인 기능을 지원하는 Claude Code의 대화창에 다음 명령을 입력합니다.

```text
/plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
/plugin install bigvalue-realestate@bigvalue-agent-skills
```

설치 안내에 따라 적용 범위를 선택합니다. 플러그인을 다시 불러와야 하면 다음 명령을 실행합니다.

```text
/reload-plugins
```

플러그인에 포함된 MCP 서버가 함께 등록됩니다. `/mcp`에서 `bigvalue-realestate` 서버를 선택하고 브라우저에서 로그인을 완료합니다. 로그인 후 새 세션에서 다음 명령으로 연결 상태를 확인합니다.

```text
/bigvalue-realestate:setup
```

### Codex CLI

`codex plugin` 명령을 지원하는 Codex CLI가 필요합니다. 터미널에서 마켓플레이스를 등록하고 플러그인을 설치합니다.

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
codex plugin add bigvalue-realestate@bigvalue-agent-skills
```

플러그인에 포함된 MCP 서버가 함께 등록됩니다. 다음 명령을 직접 실행하고 브라우저에서 로그인을 완료합니다.

```bash
codex mcp login bigvalue-realestate
```

설치와 인증을 마치면 Codex를 다시 시작하고, 터미널에서 등록된 MCP 서버를 확인합니다.

```bash
codex mcp list --json
```

이후 아래 사용 예시 중 하나를 새 대화에 입력해 데이터가 조회되는지 확인합니다.

### ChatGPT 데스크톱

로컬 마켓플레이스를 지원하는 ChatGPT 데스크톱 앱에서 사용할 수 있습니다. Codex CLI가 설치된 환경의 터미널에서 다음 명령으로 이 저장소를 등록합니다.

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
```

앱을 다시 시작한 뒤 Work 모드 또는 Codex의 Plugins Directory에서 등록한 마켓플레이스를 선택합니다. `빅밸류 부동산 (BigValue Real Estate)`을 설치하고 브라우저에서 로그인을 완료합니다.

로컬 마켓플레이스는 공개 플러그인 디렉터리와 별개입니다. 이용 가능한 메뉴와 관리 정책은 사용 환경에 따라 다를 수 있습니다. 자세한 내용은 [OpenAI 플러그인 문서](https://developers.openai.com/plugins/build/plugins)를 참고합니다.

### 스킬만 설치

스킬 설치를 지원하는 다른 AI 도구에서는 다음 명령을 사용할 수 있습니다. 실행하려면 Node.js와 npm이 필요합니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

안내에 따라 사용할 도구와 설치할 스킬을 선택합니다. MCP는 함께 설정되지 않으므로 [빅밸류 AI 연결 가이드](https://datamarket.bigvalue.ai/ai#platforms)에 따라 별도로 연결해야 데이터를 조회할 수 있습니다.

ChatGPT 등에서 데이터 조회 기능만 연결하려는 경우에도 위 가이드를 참고합니다. MCP만 연결하면 이 저장소의 스킬은 설치되지 않습니다.

### 연결 확인

인증 후에도 연결되지 않으면 새 세션에서 다시 확인합니다. 플러그인으로 설치했다면 MCP 서버를 같은 이름으로 중복 등록하지 말고 [연결 확인 안내](skills/setup/SKILL.md)를 참고합니다. 스킬만 설치한 경우에는 [빅밸류 AI 연결 가이드](https://datamarket.bigvalue.ai/ai#platforms)의 해당 도구 설정을 확인합니다.

## 사용 예시

설치와 인증을 마친 뒤 대화창에 아래와 같이 요청합니다.

탐색·진단·비교 결과는 기본적으로 Markdown으로 제공하며, 요청하면 HTML 보고서로도 작성할 수 있습니다. 별도의 파일 업로드나 지도 API 키는 필요하지 않습니다.

### 조건별 단지 탐색

```text
마포구에서 전용 84㎡가 최근 12억 원 이하에 거래된 아파트 단지를 찾아주세요.
지하철역이 가까운 곳이면 좋겠어요.
```

후보별로 거래 가격과 역까지의 거리 등 조건에 해당하는 정보를 정리합니다. 확인하지 못한 항목은 따로 표시합니다.

단지 단위로 후보를 찾는 기능이며, 현재 매물이나 호가를 조회하지는 않습니다.

### 주거 진단

```text
잠실동 아파트는 요즘 거래가 얼마나 되나요?
최근 거래 가격대와 거래량을 정리해 주세요.
```

조회한 기간의 거래 가격대와 거래량을 정리하고, 데이터를 해석할 때 유의할 점을 설명합니다.

### 주거 비교

```text
리센츠와 헬리오시티 중 이사할 곳을 고민하고 있어요.
가격과 교통, 주변 생활시설을 비교해 주세요.
```

가격과 교통, 주변 생활시설의 차이를 항목별로 정리합니다. 순위를 요청하면 평가 기준도 함께 설명합니다.

### 부동산 서비스 개발

```text
관심 지역의 아파트를 지도에서 찾아보고,
단지를 누르면 최근 실거래 내역을 볼 수 있는 웹서비스를 만들어 주세요.
```

필요한 데이터를 연동하고 서비스 코드를 작성합니다. 지도 서비스 템플릿은 개발에 참고할 수 있는 코드로, 그대로 배포하는 완성품은 아닙니다. 요구사항에 맞게 수정해 사용하며, 구성과 실행 방법은 [지도 서비스 템플릿 안내](skills/data-marketplace-residential-service/assets/map-service/README.md)를 참고합니다.

## 서비스 개발 설정

생성한 서비스가 빅밸류 REST API를 직접 호출하는 경우에는 MCP 로그인과 별도로 API 키가 필요합니다. API 키는 서버 환경변수로 설정합니다.

```bash
export DATA_MARKETPLACE_API_KEY="발급받은_API_키"
```

기본 API 주소는 `https://datamarket-api.bigvalue.ai`입니다. API 키는 서버에서 `X-API-KEY` 헤더로 전송하며, 브라우저 코드나 저장소에 포함하지 않습니다. 지도 SDK를 사용하는 경우에는 지도 제공사의 키와 도메인 설정이 별도로 필요할 수 있습니다.

## 관련 문서

- [빅밸류 AI 연결 가이드](https://datamarket.bigvalue.ai/ai): 도구별 데이터 연결 및 인증 안내
- [데이터 상품 문서 색인](https://datamarket.bigvalue.ai/llms.txt): 상품별 최신 필터·필드·응답 문서
- [플러그인 연결 확인](skills/setup/SKILL.md): 설치 상태와 MCP 인증 상태 확인 절차
- [지도 서비스 템플릿](skills/data-marketplace-residential-service/assets/map-service/README.md): 서비스 구성과 실행 방법

## 라이선스

이 저장소는 내부 사용 전용입니다. 재배포 또는 공개 게시에는 빅밸류의 별도 승인이 필요합니다. 자세한 내용은 [LICENSE.md](LICENSE.md)를 확인합니다.

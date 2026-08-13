---
name: setup
description: BigValue Real Estate 플러그인 설치 후 Data Marketplace MCP 연결 상태를 확인하고, 아직 로그인 전이면 클라이언트에 맞는 브라우저 로그인 방법을 안내한다. 사용자가 설치 상태 확인이나 MCP 연결을 요청했을 때만 사용한다.
---

# BigValue Real Estate 설정

플러그인 설치 뒤 MCP 연결 상태를 확인하고, 아직 로그인 전이면 클라이언트에 맞는 로그인 방법을 안내한다.

인증은 API 키 입력이 아니라 **브라우저 구글 로그인(OAuth)** 이다. 설치 중에 입력할 값은 없고, 첫 사용 때 로그인 한 번이면 연결된다. 토큰 보관과 갱신은 클라이언트가 알아서 한다.

이 스킬은 상태를 확인하고 안내만 한다. **로그인 명령을 대신 실행하지 않는다** — 브라우저 왕복은 사용자가 대화형 터미널에서 직접 마쳐야 안정적으로 끝난다. 설정 파일이나 자격증명 파일도 직접 편집하지 않는다.

`npx skills add`로 스킬만 설치했다면 MCP 연결은 온보딩 안내를 따르고 이 스킬은 건너뛴다.

## 상태 확인

1. 현재 클라이언트를 식별한다. Claude Code에서는 `claude plugin list --json`과 `claude mcp list`, Codex에서는 `codex plugin list --json`과 `codex mcp list --json`을 쓴다. 셸 승인이 필요하면 먼저 받는다.
2. 플러그인 `bigvalue-realestate`가 설치·활성 상태인지 확인한다.
3. MCP 서버 `bigvalue-realestate`의 상태를 확인한다. 로그인 전에는 서버가 연결 자체를 거절하므로 `! Needs authentication`으로 표시되고, `✔ Connected`면 로그인된 것이다. 확실히 하려면 대표 도구를 한 번 호출해 확인한다.
4. 상태만 요청받았으면 판정 결과를 한국어로 보고하고 아무것도 바꾸지 않는다.

## Claude Code 경로

플러그인을 설치하면 MCP 서버는 자동 등록된다. 남는 것은 로그인 한 번이다.

따로 명령이 필요 없다 — 첫 데이터 질문에서 클라이언트가 브라우저 로그인을 띄운다. 아래는 수동 경로다.

1. `claude mcp list`에 `! Needs authentication`이 보이면 정상이다 — 아직 로그인 전이라는 뜻이다.
2. 사용자에게 `/mcp`를 실행해 `bigvalue-realestate`를 선택하게 안내한다. 브라우저가 열리고 구글 로그인과 동의를 거치면 연결이 끝난다.
3. 대안: 외부 대화형 터미널에서 `claude mcp login plugin:bigvalue-realestate:bigvalue-realestate`를 직접 실행해도 된다. 이 명령을 스킬이 대신 실행하지 않는다.
4. 첫 로그인 직후에는 **새 세션에서** 확인한다. 로그인 전에 떠 있던 프로세스는 인증 상태를 못 읽을 수 있다.
5. 로그인 계정이 허용 목록에 없으면 "연결할 수 없는 계정입니다" 화면이 뜬다. 그 경우 온보딩 담당자에게 계정 허용을 요청하게 안내한다.

Claude Desktop의 채팅에서 쓰려면 플러그인 대신 커스텀 커넥터를 안내한다 — Settings → Connectors → Add custom connector에 `https://datamarket-mcp.bigvalue.ai/mcp`를 넣고 Connect를 누르면 같은 구글 로그인이 뜬다.

## Codex 경로

Codex 플러그인은 MCP 서버를 자동 등록한다. 남는 것은 첫 사용 때 브라우저 로그인 한 번이다.

1. `codex mcp list --json`에 `bigvalue-realestate`가 보이면 자동 등록된 것이다. 로그인 전 상태는 정상이며, 서버 주소를 다시 등록하거나 설정 파일을 편집하지 않는다.
2. 첫 데이터 질문에서 클라이언트가 브라우저 로그인을 띄운다. 자동으로 열리지 않을 때만 사용자가 외부 대화형 터미널에서 아래 명령을 직접 실행하게 안내한다. 이 명령을 스킬이 대신 실행하지 않는다.

   ```
   codex mcp login bigvalue-realestate
   ```

3. Codex를 새 프로세스로 다시 시작한다. 설정과 로그인 상태는 실행 중 프로세스에 반영되지 않는다.
4. `codex mcp list --json`과 대표 도구 호출로 연결을 확인한다.

## 확인

연결되면 대표 도구를 한 번 호출해 응답을 확인한다(예: 단지 검색). 로그인 URL·인가 코드·토큰을 출력하거나 기록하지 않는다.

## 보안 경계

- 로그인 URL·인가 코드·토큰을 요청·출력·복사·기록하지 않는다. 브라우저 왕복은 사용자 몫이다.
- Codex·Claude 설정 파일, 자격증명 파일, 플러그인 cache를 직접 편집하지 않는다. 플러그인이 자동 등록한 MCP 서버를 같은 이름으로 중복 등록하지 않는다.
- 사용자가 직접 구성한 다른 MCP 서버나 무관한 플러그인을 제거·변경하지 않는다.

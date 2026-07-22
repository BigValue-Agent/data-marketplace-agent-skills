---
name: setup
description: BigValue Real Estate 플러그인 설치 후 Data Marketplace MCP 연결 상태를 확인하고, 연결이 안 됐으면 클라이언트에 맞게 API 키·URL 설정을 안내한다. 사용자가 설치 상태 확인이나 MCP 연결 설정을 요청했을 때만 사용한다.
---

# BigValue Real Estate 설정

플러그인 설치 뒤 MCP 연결 상태를 확인하고, 연결이 안 됐으면 클라이언트에 맞는 방법으로 API 키·URL 설정을 안내한다. 설치된 플러그인·MCP 목록을 상태 근거로 삼고, 설정 파일이나 자격증명 파일을 직접 편집하지 않는다.

이 스킬은 플러그인 설치 후 연결·확인용이다. `npx skills add`로 스킬만 설치했다면 MCP 연결은 온보딩 안내를 따르고 이 스킬은 건너뛴다.

## 상태 확인

1. 현재 클라이언트를 식별한다. Claude Code에서는 `claude plugin list --json`과 `/mcp`, Codex에서는 `codex plugin list --json`과 `codex mcp list --json`을 쓴다. 셸 승인이 필요하면 먼저 받는다.
2. 플러그인 `bigvalue-realestate`가 설치·활성 상태인지 확인한다.
3. MCP 서버 `bigvalue-realestate`가 연결됐는지 확인한다.
4. 상태만 요청받았으면 판정 결과를 한국어로 보고하고 아무것도 바꾸지 않는다.

## Claude Code 경로 — 대개 자동

플러그인 설치 때 `userConfig`가 MCP URL과 API 키를 입력받아 연결 헤더에 자동으로 넣는다. 별도 등록 명령이 없다.

1. `/mcp`에 `bigvalue-realestate` 서버가 보이면 연결된 것이다. 대표 도구를 한 번 호출해 확인한다.
2. 서버가 없거나 인증 오류면, 설치 때 값 입력을 건너뛴 경우다. `/plugin configure bigvalue-realestate@bigvalue-agent-skills`로 MCP URL과 API 키를 설정하게 안내하고, 이어 `/reload-plugins`와 `/mcp`를 실행하게 한다.
3. API 키 값을 채팅에 받거나 출력하지 않는다. 값 입력은 플러그인 설정 UI에서 사용자가 직접 한다.

## Codex 경로 — MCP 수동 등록

Codex 플러그인은 스킬만 담고 MCP 연결은 담지 못한다(플러그인이 키를 넣는 방법이 없다). MCP는 아래로 따로 등록한다.

1. 환경변수 이름 하나를 정한다(예: `DATA_MARKETPLACE_API_KEY`). 이 이름을 등록 명령에 쓰고, 실제 키 값은 사용자가 그 이름의 환경변수에 따로 넣는다.
2. 등록 명령을 보여주고 승인받아 실행한다. 이 명령에는 키 값이 아니라 이름만 들어간다. `<MCP-URL>`은 온보딩 때 받은 값으로 바꾼다.

   ```
   codex mcp add bigvalue-realestate --transport http <MCP-URL> --bearer-token-env-var DATA_MARKETPLACE_API_KEY
   ```

3. 사용자가 실제 키 값을 그 환경변수에 넣게 한다. 이 값 설정은 스킬이 대신 실행하지 않는다. 예: `setx DATA_MARKETPLACE_API_KEY "<키>"`(Windows) 또는 셸 `export`.
   - **주의**: `--bearer-token-env-var`에는 키 값이 아니라 환경변수 이름을 넣는다. 값을 넣으면 그 이름의 환경변수가 비어 401이 난다.
4. Codex를 새 프로세스로 다시 시작한다. 설정은 실행 중 프로세스에 반영되지 않는다.
5. `codex mcp list`와 대표 도구 호출로 연결을 확인한다.

## 확인

연결되면 대표 도구를 한 번 호출해 응답을 확인한다(예: 단지 검색). 인증 URL·키·토큰을 출력하거나 기록하지 않는다.

## 보안 경계

- API 키를 요청·반복 출력·기록하거나 명령 인자에 넣지 않는다.
- 환경변수 확인 결과는 이름별 `설정됨` 또는 `누락`으로만 보고한다.
- `~/.codex/config.toml`, Claude 설정·자격증명 파일, 플러그인 cache를 직접 편집하지 않는다. 등록은 공식 명령으로만 한다.
- 사용자가 직접 구성한 다른 MCP 서버나 무관한 플러그인을 제거·변경하지 않는다.

---
name: bigvalue-api-key-setup
description: 빅밸류 API 키 발급·연결·허용 도메인 설정 요청에 맞는 웹 발급 링크를 준비합니다. API key setup, client key, secret key, allowed origins.
---

# 빅밸류 API 키 설정

프로젝트의 실제 API 호출 위치와 실행 주소를 확인하고, 고객이 웹에서 확인·발급할 링크를 제공한다. 배포 여부와 무관하게 로컬 개발에도 적용한다.

| 호출 위치 | 발급 링크 | 고객 설정 |
|---|---|---|
| HTML·JS 브라우저 직접 호출 | `https://datamarket.bigvalue.ai/api-keys/new?type=web&name={키 명}&origin={실행 주소}` | 클라이언트 키 발급 후 프론트 설정에 입력 |
| Python·Node 등 서버 호출 | `https://datamarket.bigvalue.ai/api-keys/new?type=server&name={키 명}` | 시크릿 키 발급 후 서버 `.env`의 `DATA_MARKETPLACE_API_KEY`에 직접 입력 |
| 기존 키의 허용 도메인 변경 | `https://datamarket.bigvalue.ai/api-keys` | 해당 클라이언트 키의 허용 도메인 수정, 불필요한 재발급 금지 |

- 키 명은 프로젝트 용도에 맞게 준비하고 모든 쿼리 값은 URL 인코딩한다. 여러 주소는 `origin`을 반복한다. 예: `?type=web&name=map-test&origin=http%3A%2F%2Flocalhost%3A3001`
- 주소는 실제 실행 주소의 프로토콜·호스트·포트까지 확인하고 불명확할 때만 고객에게 묻는다. `file://` 대신 로컬 HTTP 서버로 연다.
- 고객이 웹에서 설정을 확인하고 생성한다. MCP 로그인과 웹 로그인은 별개다. 설정 후 실제 호출로 연결을 확인한다.
- 시크릿 키는 대화·도구 인자·로그로 요청하거나 출력하지 않고, 고객이 비공개 파일에 직접 입력하도록 안내한다.

# Workers 서버 준비

서버(Worker script)가 있는 앱만 읽는다. 정적 사이트는 해당하지 않는다.

Workers로 처음 배포하거나 런타임·어댑터를 변경할 때는 해당 언어·프레임워크의 Cloudflare 공식 가이드를 먼저 읽고, 프로젝트 버전에 맞는 진입점·의존성·빌드 방식을 확인한다. 이미 검증한 동일 구성의 재배포는 기존 결과를 재사용한다. 최종 업로드는 BIGVALUE CLI로 진행한다.

## 프레임워크 앱

빌드 전에 `whoami`의 `base_path` + `{slug}/`를 프레임워크의 기본 경로에 반영한다(예: Vite `base`, Next.js `basePath`). 서버에 전달되는 `X-Forwarded-Prefix`만으로 이미 빌드된 브라우저 경로가 바뀌지는 않는다.

1. [Cloudflare Framework guides](https://developers.cloudflare.com/workers/framework-guides/)에서 해당 프레임워크의 가이드를 확인해 프로젝트 버전에 맞는 Workers 호환 형태로 준비한다. 목록에 없으면 Cloudflare 공식 문서에서 해당 런타임의 호환 방법을 확인한다. 기존 코드·의존성을 우선 유지하고, 호환되지 않는 부분만 조정한다.
2. 빌드가 만든 Wrangler 설정에서 진입 파일(`main`)과 정적 폴더(`assets.directory`)를 확인한다.
3. 서버 모듈 전체를 포함하는 출력 폴더와 그 기준 진입 파일 경로를 `deploy.json`의 `server.directory`·`server.main`에, 정적 폴더를 `assets`에 옮긴다. 호환 날짜와 필요한 플래그도 옮긴다(JS: `nodejs_compat`, Python: 아래 절차).
4. `wrangler deploy` 대신 이 스킬의 CLI로 배포한다. Wrangler 설정 파일은 배포에 쓰이지 않는다.

## Python 서버

[Python Workers·패키지 가이드](https://developers.cloudflare.com/workers/languages/python/packages/)를 따른다. Pyodide 호환 패키지만 실행되며, 일반 Linux Python 서버나 모든 pip 패키지를 지원하는 것은 아니다. [FastAPI](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/)는 `workers.asgi.entrypoint(app)`, [Flask](https://developers.cloudflare.com/workers/framework-guides/apis/flask/)는 `workers.wsgi.entrypoint(app)` 연결을 사용한다. 프레임워크 선택은 자유다.

1. `pyproject.toml`에 앱 의존성, `wrangler.jsonc`에 Python 진입점·호환 날짜·`python_workers`를 설정한다.
2. 공식 `workers-py`의 `pywrangler deploy --dry-run --outdir dist/worker`로 로컬 산출물을 만든다. 이 명령은 Cloudflare에 배포하지 않으며 회사 토큰도 필요 없다. 검증 조합은 `workers-py 1.17.8`, `uv 0.13.5`, Wrangler `4.152.0`이다. 프로젝트 도구가 다르면 해당 버전의 공식 안내를 확인한다.
3. 출력의 `.py` 진입점과 **`python_modules` 전체**를 함께 보존한다. `requirements.txt`만 보내거나 Python SDK·패키지를 빼면 실행되지 않는다. BIGVALUE CLI가 공식 산출물의 모듈 유형을 구분해 전송한다.
4. `server.directory`는 `dist/worker`, `server.main`은 출력 기준 진입점(예: `entry.py`), `compatibility_flags`는 `["python_workers"]`로 둔다. `nodejs_compat`과 섞지 않는다. 정적 파일은 별도 `assets` 폴더로 지정한다.

Python의 환경변수·Secret은 Workers SDK의 `env` 또는 프레임워크가 제공하는 env 연결에서 읽는다. 정적 요청은 공식 프레임워크 가이드의 `ASSETS.fetch` 연결로 처리한다. 경로 접두사는 그대로 적용되므로 ASGI `root_path` 등 프레임워크 설정도 맞춘다.

서버 묶음은 multipart 포함 10MiB다. 검증한 FastAPI 최소 앱은 약 9.2MiB여서 추가 의존성에 따라 넘을 수 있다. `--dry-run`의 `gateway_bytes`로 확인하고, 필요한 패키지만 넣는다. 넘으면 한도 해제를 가정하지 말고 지원 범위를 설명한다.

## JavaScript 서버

- 기존 Node HTTP 서버는 공식 [`httpServerHandler`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/) 연결을 먼저 검토하고, 프로젝트의 의존성과 필요한 기능이 Workers에서 호환되는지 확인한다.
- 직접 Worker 진입점을 작성하는 경우 `export default { fetch(request, env, ctx) }`에서 경로별로 분기한다. 정적 파일 요청은 `env.ASSETS.fetch(request)`로 넘긴다.

## JavaScript 런타임 규칙

[Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) 중 자주 틀리는 것:

- 환경변수·Secret은 `env`에서 읽는다. `nodejs_compat`과 호환 날짜 2025-04-01 이후면 [`process.env`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)도 채워진다.
- 요청마다 달라지는 값을 모듈 전역에 두지 않는다. 요청 사이에 데이터가 섞인다.
- 응답 뒤에도 이어지는 작업은 [`ctx.waitUntil()`](https://developers.cloudflare.com/workers/runtime-apis/context/)에 묶는다.
- 큰 요청·응답 본문은 한 번에 읽지 않고 스트리밍한다. Worker 메모리는 128MB다.

## 지원하지 않는 것

- 일반 Python 서버 프로세스(`uvicorn`·`gunicorn`)·Docker 실행: Workers 진입점으로 준비해야 한다.
- KV·D1·R2·Durable Objects·Queues 등 플랫폼 연결: 해당 기능을 끄고 빌드하거나 외부 서비스를 쓴다. 꼭 필요하면 알리고 중단한다.
- 서버 묶음 10MiB 초과: 불필요한 산출물을 줄인다.

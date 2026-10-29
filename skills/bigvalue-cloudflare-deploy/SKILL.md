---
name: bigvalue-cloudflare-deploy
description: "BIGVALUE 배포가 허용된 사용자의 HTML·정적 프론트·Cloudflare Workers 호환 서버를 공개 HTTPS 주소에 배포한다. 앱 게시·호스팅·공개 URL 공유·재배포·배포 상태 확인·앱 관리 요청에 사용한다."
---

# BIGVALUE 앱 배포

## 준비

요청받은 앱만 공개한다. 기존 프레임워크·원본을 보존하고, 공식 어댑터나 프로젝트 빌드로 정적 디렉터리와 Workers 호환 서버 모듈을 준비한다. 특정 프레임워크를 강제하지 않는다. JavaScript·Python Workers를 지원하며, 일반 서버 프로세스를 그대로 실행하는 방식은 아니다. **서버가 있으면 [workers-runtime.md](references/workers-runtime.md)를 먼저 읽는다.** 비호환 백엔드의 재작성은 먼저 사용자와 범위를 확인한다.

공개할 파일만 정적 폴더에 둔다. 서버 소스·배포 기록·비밀 파일은 제외한다. 비밀값은 서버 Secret, 공개 가능한 값은 일반 변수로 구분한다. D1·KV·R2 등 플랫폼 내부 바인딩이 필수인 앱은 현재 지원하지 않으므로 알리고 중단한다.

## 인증과 명령

Node 20 이상에서 아래 고정 버전 CLI를 사용한다.

```sh
npx -y @bigvalue-datamarketplace/deploy@0.3.0 login
npx -y @bigvalue-datamarketplace/deploy@0.3.0 deploy deploy.json
```

MCP는 이 스킬을 제공하고, 실제 배포·관리는 CLI로 실행한다. MCP 연결과 CLI 로그인은 별개다. 로그인은 사용자가 브라우저에서 완료한다. CLI가 내부 허가증·정적 업로드 토큰·갱신을 처리하므로 AI가 이 값을 읽거나 옮기지 않는다. 로그인 자격은 사용자 홈, 비밀값 없는 앱·배포 ID는 프로젝트 `.bigvalue/<환경>.json`에 저장한다. `.bigvalue/`는 Git에서 제외하고 재배포를 위해 보존한다.

`login`은 링크를 출력하고 최대 10분 기다린다. 중간 출력을 읽을 수 있는 실행 세션으로 시작해 링크를 즉시 사용자에게 그대로 전달하고, 같은 프로세스의 로그인 완료를 확인한다.

CLI는 운영 HTTPS API에 연결한다. 배포 권한이 허용된 활성 계정이 필요하다. CI에서는 웹 발급 배포 키를 `BIGVALUE_DEPLOY_KEY`로 제공할 수 있다.

아래 명령은 `npx -y @bigvalue-datamarketplace/deploy@0.3.0` 뒤에 붙인다.

| 명령 | 용도 |
|---|---|
| `login` / `whoami` / `logout` | 로그인·현재 인증 확인·로그인 연결 폐기 |
| `deploy deploy.json --dry-run` | 전송 전 파일·설정 확인 |
| `deploy deploy.json` | 배포·재배포·같은 작업 재개 |
| `list` | 내 앱 목록·주소 확인 |
| `status [배포ID]` | 배포 결과 확인. ID 생략 시 현재 프로젝트 기록 사용 |
| `secret put 이름 --input-file 파일` / `secret delete 이름` | 서버 Secret 등록·변경·삭제 |
| `delete <slug> --yes` | 현재 프로젝트에 연결된 앱 삭제 |

## 설정

`deploy.json`의 경로는 설정 파일 기준이다. 정적 또는 서버 중 없는 쪽은 생략한다.

```json
{
  "slug": "my-demo",
  "assets": "dist/client",
  "server": {"directory": "dist/worker", "main": "index.js"},
  "vars": {"SITE_NAME": "My Demo"},
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "spa": false
}
```

주소는 `https://{slug}.bigvalue.app/`다. 고객은 `slug`만 정하고, 앱 이름은 전체 사용자 중 중복될 수 없다. 이름은 영문 소문자로 시작하는 3~48자의 소문자·숫자·하이픈이며 끝 하이픈, 3·4번째 글자의 `--`, 플랫폼 예약 이름은 사용할 수 없다. `whoami`는 `url_mode: subdomain`, `apps_domain`, `base_path: /`를 제공한다. **빌드 기준은 `/` 그대로이며 handle이나 slug를 경로에 붙이지 않는다.** 최종 공유 URL은 CLI/API의 반환값을 사용한다. 서버에는 원래 경로가 전달되고 `X-Forwarded-Prefix`는 제공하지 않는다. 필요한 정적 요청은 `env.ASSETS.fetch(request)`로 처리한다.

앱마다 origin은 다르지만 같은 상위 도메인을 공유한다. 앱 인증 쿠키는 `__Host-` 접두사·Secure·Path=/·Domain 미지정 방식을 권장하고 상태 변경 요청에는 CSRF 방어를 적용한다. 카카오·네이버 지도 등 도메인 제한 키를 사용하면 고객 키에 새 앱 주소를 등록하고 실제 지도 로드를 확인한다. 와일드카드 DNS가 지도 키의 허용 도메인을 자동 등록하지는 않는다.

## 실행과 확인

1. `whoami`로 인증을 확인하고 필요할 때 `login`한다. `url_mode: subdomain`과 `base_path: /`를 확인한다. 서버가 옛 사용자 경로를 반환하면 새 계약 적용 전이므로 배포를 중단하고 설정을 확인한다.
2. 그 경로에 맞춰 빌드하고 공개 파일 범위·서버 진입점을 확인한다. 가능하면 Workers 런타임에서 대표 요청을 확인하되 정적 사이트에 서버 검사를 강제하지 않는다.
3. `deploy deploy.json --dry-run`으로 파일·설정을 확인한 뒤 `deploy deploy.json`을 실행한다. dry-run은 네트워크 요청이나 허가증 발급을 하지 않는다.
4. `completed`와 공개 URL을 확인하고 HTML·정적 파일·대표 서버 API를 직접 요청한다. 배포 성공을 앱 기능 성공으로 대신하지 않는다.
5. 결과에는 URL·확인한 기능·못한 검사만 적고 직접 띄운 임시 프로세스를 정리한다.

명령 성공은 stdout JSON 한 개, 실패는 stderr의 `code`·`next_action`·가능한 `deployment_id`로 확인한다. 응답이 끊기면 ID가 있을 때 `status [배포ID]`부터 조회한다. 같은 내용은 기존 요청을 재사용하고, 내용이 달라졌으면 백엔드가 새 작업 가능 여부를 판단한다. 진행 중 작업과 충돌하면 반환된 ID로 상태를 확인한다. 자세한 경우는 [recovery.md](references/recovery.md)를 따른다.

## Secret과 앱 관리

프로젝트 루트에서 실행한다. Secret 값은 JSON이 아닌 **원문**을 비공개 파일 또는 원문이 출력되지 않는 파이프로 전달한다. 명령 인자·대화·Git에 값을 쓰지 않는다.

```sh
npx -y @bigvalue-datamarketplace/deploy@0.3.0 secret put MY_SECRET --input-file /private/value.txt
npx -y @bigvalue-datamarketplace/deploy@0.3.0 secret delete MY_SECRET
```

서버는 `env.MY_SECRET`으로 읽는다. 기존 Secret은 재배포해도 유지된다. 최초 공개와 Secret 등록은 별도이므로 등록 전 값이 없는 구간을 고려한다. 직접 만든 비공개 입력 파일은 처리 후 정리하고 사용자 원본은 지우지 않는다.

명시적인 삭제 요청에만 연결된 앱의 slug를 확인해 `delete <slug> --yes`를 실행한다. Secret·삭제 명령에는 현재 프로젝트의 `.bigvalue/<환경>.json`이 필요하다. 연결 기록이 없으면 기존 프로젝트에서 실행하도록 안내한다.

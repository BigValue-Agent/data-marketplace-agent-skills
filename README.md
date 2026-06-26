# 데이터 마켓플레이스 에이전트 스킬

[한국어](README.md) | [English](README.en.md)

Data Marketplace API로 주거 부동산 서비스를 만들 때 쓰는 AI 에이전트용 스킬입니다.

복합단지 검색, 지도 마커, 상세 패널, 동/호 드릴다운, 실거래, 공시가격, 시세 화면을 만들 때 어떤 API를 먼저 호출하고 어떤 키를 이어서 써야 하는지 안내합니다. 제품 API 문서를 대체하지 않고, 호출 순서와 안전장치를 정리합니다.

## 설치

Node.js 18 이상이 필요합니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

전역으로 설치하려면 `-g`를 붙입니다.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills -g
```

이 저장소에서 로컬 테스트를 할 때는 아래 명령을 사용합니다.

```bash
npx skills add ./ -l
npx skills add ./ -y
```

## 스킬

| 스킬 | 설명 |
|---|---|
| `data-marketplace-agent-skills` | 단지 검색, 지도 마커, 상세 정보, 가격 화면, 서버 사이드 API 연동을 위한 Data Marketplace 주거 API 가이드 |

## 인증

실제 API를 호출하려면 Data Marketplace base URL과 API key가 필요합니다.

```bash
export DATA_MARKETPLACE_BASE_URL=<your-data-marketplace-url>
export DATA_MARKETPLACE_API_KEY=<your-api-key>
```

API key는 서버에서만 `X-API-KEY` 헤더로 사용해야 합니다. 코드에 직접 넣거나 브라우저에 노출하지 마세요.

## 사용 메모

- 호출 경로는 `POST /api/v1/data-products/{product_id}/call`입니다.
- 필터는 JSON body의 `filters`에 넣습니다.
- bbox 값은 JSON body 최상위의 `bbox` 객체로 보냅니다.
- 응답 row는 `result.data`에서 읽습니다.
- `complex_key`, `pnu`, `ppk`, `jpk`는 문자열로 유지합니다.
- 정확한 `product_id`, 지원 필터, fields, 응답 스키마는 프로젝트에 제공된 API reference에서 확인합니다.

## 라이선스

내부 사용 전용입니다. 자세한 내용은 `LICENSE.md`를 확인하세요.

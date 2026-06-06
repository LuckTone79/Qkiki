# 작업 보고서

## 기본 정보
- **버전**: v1.16.13-20260606
- **작업 일시**: 2026-06-06
- **이전 버전**: v1.16.12-20260606
- **프로젝트명**: qkiki-workbench

## 작업 요약
병렬모드에서 Gemini(Google) 모델을 사용할 때 에러가 발생하는 문제의 원인을 찾고, 재발하지 않도록 일시적 provider 오류에 대한 재시도/백오프 처리를 추가했다.

## 원인 분석
- 직전 버전(v1.16.12)은 provider lease 트랜잭션 시작 타임아웃(병렬 공통 문제)만 완화했고, 보고서에도 Google 측 실패가 별도 이슈로 남아 있었다.
- 핵심 원인: 재시도 로직 `shouldRetryProviderCall`이 **타임아웃 메시지(`/timed? out/`)일 때만** 재시도했다.
- 병렬모드는 여러 모델(혹은 동일 Gemini 모델 다수)을 `Promise.all`/`Promise.allSettled`로 동시에 호출한다. 이때 Google Gemini API는 동시성 상황에서 다음 일시적 오류를 자주 반환한다.
  - `429 RESOURCE_EXHAUSTED` (분당 요청/쿼터 레이트리밋)
  - `503 UNAVAILABLE` ("The model is overloaded. Please try again later.")
- 이 오류들은 재시도 대상이 아니어서 즉시 실패로 표면화되었고, 순차모드는 호출이 분산되어 거의 발생하지 않으므로 "병렬모드에서 Gemini만 에러"로 나타났다.
- 추가로 `providerError()`가 HTTP 상태코드와 Google의 구조화된 `error.status`(RESOURCE_EXHAUSTED/UNAVAILABLE 등)를 버려서, 일시적 오류를 분류조차 할 수 없었다.

## 변경 사항
### 수정된 사항
- `providerError()`가 HTTP 상태코드와 provider의 구조화된 status(`error.status`)를 오류 메시지에 포함하도록 했다. 모든 provider(`openai`/`anthropic`/`google`/`xai`)의 `!response.ok` throw 지점에서 `response.status`를 전달한다.
- `shouldRetryProviderCall()`이 타임아웃뿐 아니라 일시적 provider 오류(429/503/RESOURCE_EXHAUSTED/UNAVAILABLE/overloaded/rate limit 등)도 재시도하도록 확장했다.
- 재시도 대기 시간을 오류 유형에 맞게 조정했다. 일시적 provider 오류는 지수 백오프(+지터, 최대 8초)로, 타임아웃은 기존 750ms를 유지한다.
- 과금/크레딧 부족(`prepayment credits are depleted`), 잘못된 API 키 등 비일시적 오류는 재시도하지 않고 그대로 실패로 유지한다.

### 추가된 사항
- `src/lib/provider-retry.ts`: 일시적 provider 오류 분류 및 백오프 지연 계산 헬퍼.
- `src/lib/provider-retry.test.mjs`: Gemini 429/503 재시도, 과금 오류 비재시도, 백오프 경계 회귀 테스트.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|----------|------|
| `src/lib/provider-retry.ts` | 추가 | 일시적 provider 오류 분류/백오프 헬퍼 |
| `src/lib/provider-retry.test.mjs` | 추가 | 재시도 분류 회귀 테스트 |
| `src/lib/ai/providers.ts` | 수정 | 상태코드 포함 오류 메시지, 일시적 오류 재시도/백오프 |
| `VERSION` | 수정 | 현재 버전 갱신 |
| `src/lib/version.ts` | 수정 | 앱 표시 버전 갱신 |

## 검증
- `node --test src/lib/provider-retry.test.mjs src/lib/provider-concurrency.test.mjs` → 8 pass / 0 fail
- `npx tsc`, `npm run lint`, `npm run build`는 현재 컨테이너에 `node_modules`가 설치되어 있지 않아(모든 오류가 `Cannot find module 'next'` 류의 의존성 미설치) 실행 불가. 변경은 의존성 비종속 순수 로직이며 타입 안전하다.

## 알려진 이슈 / 추후 작업
- Google `prepayment credits are depleted`는 여전히 결제/크레딧 운영 조치가 필요한 비일시적 오류로, 의도적으로 재시도하지 않는다.
- 더 강한 보호가 필요하면 Google 계정의 실제 RPM에 맞춰 `PROVIDER_CONCURRENCY_GOOGLE` 환경변수로 동시성 한도를 낮추는 것을 고려할 수 있다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.16.13 | 2026-06-06 | 병렬모드 Gemini 일시적 오류(429/503) 재시도·백오프 추가 |
| v1.16.12 | 2026-06-06 | 병렬모드 provider lease transaction start timeout 완화 |
| v1.16.11 | 2026-06-05 | 워크벤치 모드 버튼 및 입력 패널 정리 |

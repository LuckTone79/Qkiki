# 작업 보고서

## 기본 정보
- **버전**: v1.18.1-20260610
- **작업 일시**: 2026-06-09
- **이전 버전**: v1.18.0-20260610
- **프로젝트명**: qkiki-workbench

## 작업 요약
병렬체인 작업에서 `gemini-3-pro-preview` 모델만 다시 실패하는 원인을 운영 DB(`ai_requests`)로 확인했다. 지난번 결제(크레딧) 문제는 이미 해결되었고, 이번 원인은 **해당 모델 이름이 Google에서 폐기되어 HTTP 404를 반환하는 것**이었다. 죽은 모델을 사용 가능한 모델로 교체하고, 옛 이름이 자동 치유되도록 조치했다.

## 원인 분석 (운영 데이터 근거)
- 2026-06-07 06:26 동일 병렬 실행에서 `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemini-2.5-pro`는 모두 정상 완료(과금 포함)되었고, `gemini-3-pro-preview`만 실패했다.
- 실패 메시지: `google: [404] NOT_FOUND: This model models/gemini-3-pro-preview is no longer available. Please update your code to use a newer model...`
- `ai_requests` 전체 기록상 `gemini-3-pro-preview`는 5회 호출돼 단 한 번도 성공한 적이 없는 반면, 이전 이름 `gemini-3.1-pro-preview`는 정상 완료 기록(05-13, 06-03)이 있다.
- 즉, 지난 `prepayment credits are depleted`(429) 결제 문제는 해결되었고, 이번 원인은 **존재하지 않는 모델 ID(404)**이다.

### 회귀가 유입된 경로
- `f523de2 "Refresh AI model catalog and guidance"`(06-05)에서 카탈로그의 pro 모델을 동작하던 `gemini-3.1-pro-preview` → 존재하지 않는 `gemini-3-pro-preview`로 교체했고, `GOOGLE_LEGACY_MODEL_MAP`에 `gemini-3.1-pro-preview`/`gemini-3.1-pro` → `gemini-3-pro-preview` 매핑을 추가했다.
- 그 결과 Gemini pro 계열을 고르는 모든 경로(저장된 세션/프리셋 포함)가 404 모델로 강제 변환되었다.

## 변경 사항
### 수정된 사항
- `provider-catalog.ts`: 카탈로그 google 모델 목록의 `gemini-3-pro-preview` → `gemini-3.1-pro-preview`로 교체.
- `provider-catalog.ts`: `GOOGLE_LEGACY_MODEL_MAP`이 죽은 이름을 사용 가능한 모델로 자동 치유하도록 수정 — `gemini-3-pro-preview`/`gemini-3-pro`/`gemini-3.1-pro` → `gemini-3.1-pro-preview`. (저장된 세션·프리셋 재발 방지)
- `pricing.ts`: 비용 키 `google:gemini-3-pro-preview` → `google:gemini-3.1-pro-preview`로 교체(동일 단가).
- `provider-catalog.test.mjs`: 카탈로그·정규화 기대값을 치유 동작에 맞게 갱신.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|----------|------|
| `src/lib/ai/provider-catalog.ts` | 수정 | 죽은 모델 교체 + 레거시 맵 자동 치유 |
| `src/lib/ai/pricing.ts` | 수정 | 비용 키 갱신 |
| `src/lib/ai/provider-catalog.test.mjs` | 수정 | 기대값 갱신 |
| `VERSION` / `src/lib/version.ts` | 수정 | 버전 갱신 |

## 검증
- `node --test src/lib/ai/provider-catalog.test.mjs src/lib/provider-retry.test.mjs` → 8 pass / 0 fail
- `tsc`/`lint`/`build`는 컨테이너에 `node_modules` 미설치로 실행 불가(전부 의존성 미설치 에러). 변경은 의존성 무관 데이터/상수 수정.

## 알려진 이슈 / 추후 작업
- `gemini-3.1-pro-preview`는 06-03까지 정상 동작이 확인된 이름이다. 만약 추후 이 이름마저 404가 되면, 운영 데이터로 가장 최근 성공한 pro 모델(`gemini-2.5-pro`)로 동일하게 교체/치유하면 된다.
- v1.16.13에서 추가한 일시적 오류(429/503) 재시도와 함께, 404 같은 영구 오류는 재시도하지 않고 즉시 실패로 표면화하는 동작이 정상임을 재확인했다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.18.1 | 2026-06-10 | 폐기된 gemini-3-pro-preview(404)를 gemini-3.1-pro-preview로 교체·자동 치유 |
| v1.16.13 | 2026-06-06 | 병렬모드 Gemini 일시적 오류(429/503) 재시도·백오프 |
| v1.16.12 | 2026-06-06 | 병렬모드 provider lease transaction start timeout 완화 |

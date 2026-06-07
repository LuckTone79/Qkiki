# 작업 보고서

## 기본 정보
- **버전**: v1.16.13-20260607
- **작업 일시**: 2026-06-07
- **이전 버전**: v1.16.12-20260606
- **프로젝트명**: qkiki-workbench

## 작업 요약
병렬검토모드에서 Gemini 모델들이 모두 실패하는 현상을 조사했다.
저장된 최근 Google provider 실패 로그의 공통 원인은 Google Gemini API 프로젝트의 선불 크레딧 소진이었다.
앱에는 관리자 fallback provider 설정이 있었지만 병렬 실행 경로에서 비활성화되어 있어, 병렬 실행은 설정된 대체 공급자로 이어질 수 있도록 수정했다.

## 변경 사항
### 추가된 기능
- 병렬 워크벤치 실행에서 관리자 설정 fallback provider를 허용하는 정책 함수를 추가했다.
- fallback 정책 회귀 테스트를 추가했다.
- `/api/providers` 응답에 `fallbackProvider`를 포함해 클라이언트가 공급자별 fallback 설정을 알 수 있게 했다.

### 수정된 사항
- 병렬 실행 및 병렬 스트리밍 실행에서 provider 오류 발생 시 관리자 설정 대체 공급자를 사용할 수 있도록 `allowFallback`을 활성화했다.
- 워크벤치 모델 선택 안내 문구를 실제 fallback 동작과 맞게 수정했다.
- 앱 버전을 v1.16.13-20260607로 갱신했다.

### 삭제/제거된 사항
- 없음

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| VERSION | 수정 | 현재 버전을 v1.16.13-20260607로 갱신 |
| src/lib/version.ts | 수정 | UI 표시용 앱 버전 상수 갱신 |
| src/lib/workbench-provider-fallback.ts | 추가 | 병렬 실행 fallback 허용 정책 추가 |
| src/lib/workbench-provider-fallback.test.mjs | 추가 | 병렬/순차 fallback 정책 회귀 테스트 |
| src/lib/ai/workflow.ts | 수정 | 병렬 실행 provider 호출에 fallback 정책 적용 |
| src/app/api/providers/route.ts | 수정 | provider payload에 fallbackProvider 포함 |
| src/components/workbench/ProviderSelectorRow.tsx | 수정 | fallback 설정 여부에 맞춘 모델 선택 안내 문구 |

## 알려진 이슈 / 추후 작업
- Google Gemini API 자체의 `RESOURCE_EXHAUSTED / prepayment credits are depleted` 오류는 앱 코드가 해결할 수 없는 외부 결제 상태다. Google AI Studio 또는 Cloud Billing에서 해당 프로젝트의 결제/선불 크레딧을 복구해야 Gemini 모델 자체 응답이 다시 가능하다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.16.13 | 2026-06-07 | 병렬검토모드 provider fallback 적용 및 Gemini 크레딧 소진 원인 기록 |
| v1.16.12 | 2026-06-06 | 이전 작업 |

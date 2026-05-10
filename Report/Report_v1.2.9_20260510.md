# 작업 보고서

## 기본 정보
- 버전: v1.2.9-20260510
- 작업 일시: 2026-05-10
- 이전 버전: v1.2.8-20260510
- 프로젝트명: qkiki

## 작업 요약
OpenAI와 Claude가 결과를 반환하지 않던 문제를 운영 환경 기준으로 점검하고 수정했습니다.

이번 턴에서 확인된 핵심 원인은 두 가지였습니다.
- Claude / Anthropic 호출 헤더의 `anthropic-version` 값이 잘못되어 있어 API가 요청을 거절하던 문제
- Claude 모델명이 UI/기존 세션에는 구형 별칭(`claude-sonnet-4-6`)으로 남아 있을 수 있는데, API는 공식 모델명(`claude-sonnet-4-20250514`)을 요구하던 문제

## 변경 사항
### 수정한 내용
- Anthropic 요청 헤더의 `anthropic-version` 값을 `2023-06-01`로 수정
- Claude 모델 카탈로그를 공식 API 모델명 기준으로 갱신
- 기존 세션/프리셋에 남아 있는 구형 Claude 별칭을 공식 모델명으로 자동 변환하는 alias 매핑 추가
- 앱 버전을 `v1.2.9-20260510`으로 갱신

### 검증한 내용
- `npm run lint` 통과
- `npm run build` 통과
- Vercel 프로덕션 재배포 완료
- 프로덕션 URL `https://qkiki.vercel.app` 에서 임시 검증 계정으로 실제 `/api/auth/sign-up` 후 `/api/workbench/run` 실행 검증
- 아래 3개 provider가 모두 `completed` 상태로 정상 응답함
  - OpenAI `gpt-5.5`
  - Anthropic `claude-sonnet-4-6` (내부적으로 공식 모델명으로 변환되어 성공)
  - xAI `grok-4.3`

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| `src/lib/ai/provider-catalog.ts` | 수정 | Claude 기본 모델 및 모델 목록을 공식 API 모델명 기준으로 갱신 |
| `src/lib/ai/providers.ts` | 수정 | Anthropic 버전 헤더 수정 및 Claude 구형 alias 자동 변환 추가 |
| `VERSION` | 수정 | 현재 버전 갱신 |
| `src/lib/version.ts` | 수정 | UI 표시 버전 갱신 |
| `Report/Report_v1.2.9_20260510.md` | 재작성 | 한글 인코딩 정상화 및 최종 검증 결과 반영 |

## 검증 결과 요약
- OpenAI 결과: `Hello!`
- Claude 결과: `Hello!`
- Grok 결과: `Hello!`

따라서 현재 프로덕션 기준으로는 사용자가 새로 실행한 작업에서 OpenAI와 Claude도 정상 결과를 반환해야 합니다.

## 남은 참고 사항
- 기존 실패 카드나 이전 세션의 오류 기록은 자동으로 성공 상태로 바뀌지 않습니다.
- 이미 실패한 세션이라면 `다시 실행` 또는 새 세션에서 다시 돌려야 최신 수정이 반영된 결과를 확인할 수 있습니다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.2.9 | 2026-05-10 | Claude 헤더/모델명 문제 수정 및 프로덕션 실검증 완료 |
| v1.2.8 | 2026-05-10 | OpenAI temperature 파라미터 제거 |

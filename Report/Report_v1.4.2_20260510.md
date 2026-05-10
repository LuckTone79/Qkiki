# 작업 보고서

## 기본 정보
- 버전: v1.4.2-20260510
- 작업 일시: 2026-05-10
- 이전 버전: v1.4.1-20260510
- 프로젝트명: qkiki

## 작업 요약
OpenAI 모델이 다른 모델과 달리 결과를 내지 못하고 타임아웃 에러를 발생시키는 문제를 처음부터 다시 조사하고, 원인을 최소 단위까지 분해해 수정했습니다.

이번 최종 버전에서는 다음까지 반영했습니다.
- OpenAI 전용 고정 60초/180초 타임아웃 구조 제거
- OpenAI 장시간 작업을 위한 Responses API background polling 적용
- OpenAI GPT-5 계열의 추론 강도 조정
- OpenAI Responses API 사용 후 누락되던 토큰 사용량 집계 복구

## 원인 분석 요약
### 1차 원인
- 기존 구조는 공급자 호출을 `AbortSignal.timeout(runtime.timeoutSeconds * 1000)`로 중단함
- OpenAI 기본 timeout이 legacy 60초에 묶여 있었고, 이후 180초로 늘려도 무거운 작업에서는 다시 180초에 끊김

### 2차 원인
- GPT-5 계열은 reasoning 작업이 길어질 수 있는데도 Chat Completions 동기 호출만 사용하고 있었음
- OpenAI 공식 문서도 reasoning 모델의 장시간 작업에는 background mode를 권장함

### 3차 원인
- OpenAI Responses API로 전환한 뒤 `usage.input_tokens` / `usage.output_tokens` 구조를 기존 Chat Completions용 토큰 필드로 읽고 있어, 사용량/비용 집계가 비는 부가 문제 발생

## 변경 사항
### 수정한 내용
- 공급자 카탈로그에 공급자별 기본 타임아웃 정책 추가
  - OpenAI 300초
  - Anthropic 90초
  - Google 90초
  - xAI 90초
- OpenAI는 Chat Completions 대신 `Responses API + background=true + polling`으로 호출하도록 변경
- OpenAI GPT-5 계열 요청에 `reasoning.effort = "low"` 적용
- OpenAI 타임아웃 발생 시 더 명확한 오류 메시지를 반환하도록 수정
- 관리자 공급자 설정 및 헬스체크 경로도 공급자별 기본 타임아웃을 사용하도록 수정
- OpenAI Responses API의 `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens`를 올바르게 매핑하도록 수정

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| `src/lib/ai/provider-catalog.ts` | 수정 | 공급자별 기본 타임아웃 및 timeout 해석 함수 추가 |
| `src/lib/ai/providers.ts` | 수정 | OpenAI Responses API background polling 전환, reasoning 설정, timeout 메시지 개선, usage 매핑 수정 |
| `src/app/api/admin/providers/route.ts` | 수정 | 공급자별 기본 timeout 반영 |
| `src/app/api/admin/providers/[providerName]/health-check/route.ts` | 수정 | 헬스체크 생성 시 공급자별 기본 timeout 반영 |
| `VERSION` | 수정 | 버전 갱신 |
| `src/lib/version.ts` | 수정 | UI 표시 버전 갱신 |
| `Report/Investigation_openai_timeout_20260510.md` | 추가 | 상세 조사 보고서 |

## 검증
- `npm run lint` 통과
- `npm run build` 통과
- GitHub `main` 브랜치 푸시 완료
- Vercel Git 연동 프로덕션 배포 완료

### 실서비스 검증 1
- 고부하 OpenAI 단독 실행
- 입력: AI-first software company 운영 모델 설계 장문 프롬프트
- 결과: `completed`
- 실측 소요 시간: 약 212초
- 결과 요약: 장문 구조 설계 문서 정상 생성

### 실서비스 검증 2
- OpenAI 짧은 실행 후 rawResponse 확인
- 결과: `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens` 구조 확인
- 후속 수정으로 사용량/비용 집계 복구 반영

## 남은 참고 사항
- 기존 실패 카드는 과거 실행 기록이므로 자동으로 성공 카드로 바뀌지 않음
- 반드시 새 실행 또는 `다시 실행`으로 최신 수정 효과를 확인해야 함

## 관련 조사 문서
- `Report/Investigation_openai_timeout_20260510.md`

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.4.2 | 2026-05-10 | OpenAI Responses API background polling 전환 및 usage 집계 복구 |
| v1.4.1 | 2026-05-10 | OpenAI timeout 정책 구조 개선 |

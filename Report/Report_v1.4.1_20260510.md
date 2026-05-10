# 작업 보고서

## 기본 정보
- 버전: v1.4.1-20260510
- 작업 일시: 2026-05-10
- 이전 버전: v1.4.0-20260510
- 프로젝트명: qkiki

## 작업 요약
OpenAI만 결과를 내지 못하고 60초 부근에서 타임아웃으로 실패하던 문제를 구조적으로 수정했습니다.

이번 수정은 단순 재시도가 아니라, 공급자별 타임아웃 정책과 OpenAI GPT-5 계열의 추론 시간 특성을 반영하는 방향으로 이루어졌습니다.

## 변경 사항
### 수정한 내용
- 공급자 카탈로그에 공급자별 기본 타임아웃을 추가
  - OpenAI: 180초
  - Anthropic: 90초
  - Google: 90초
  - xAI: 90초
- OpenAI의 기존 legacy 공통 기본값 `60초`를 자동으로 더 안전한 OpenAI 기본값으로 승격
- OpenAI GPT-5 계열 요청에 `reasoning_effort: "low"` 적용
- 타임아웃 오류 메시지를 공급자/시간 기준으로 더 명확하게 표시하도록 개선
- 관리자 공급자 설정 API와 헬스체크 API도 새로운 공급자별 기본 타임아웃을 사용하도록 수정

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| `src/lib/ai/provider-catalog.ts` | 수정 | 공급자별 기본 타임아웃 및 timeout 해석 함수 추가 |
| `src/lib/ai/providers.ts` | 수정 | OpenAI 전용 reasoning/timeout 정책 및 명확한 오류 메시지 추가 |
| `src/app/api/admin/providers/route.ts` | 수정 | 관리자 설정 화면에 공급자별 기본 타임아웃 반영 |
| `src/app/api/admin/providers/[providerName]/health-check/route.ts` | 수정 | 신규/헬스체크 레코드에 공급자별 기본 타임아웃 반영 |
| `VERSION` | 수정 | 버전 갱신 |
| `src/lib/version.ts` | 수정 | UI 표시 버전 갱신 |
| `Report/Investigation_openai_timeout_20260510.md` | 추가 | 상세 원인 조사 보고서 |

## 검증
- `npm run lint` 예정
- `npm run build` 예정
- GitHub 푸시 및 Vercel Git 연동 배포 예정
- OpenAI 실제 실행 검증 예정

## 남은 참고 사항
- 기존 실패 카드의 상태는 과거 기록이므로 자동으로 성공으로 바뀌지 않음
- 수정 효과는 새 실행 또는 다시 실행에서 반영됨

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.4.1 | 2026-05-10 | OpenAI timeout 정책 구조 개선 및 공급자별 기본 타임아웃 도입 |
| v1.4.0 | 2026-05-10 | 이전 버전 |

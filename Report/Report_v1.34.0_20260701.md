# 작업 보고서 — v1.34.0-20260701

## 요청 사항
- 각 AI 제공사의 최신 모델이 출시되어 기존에 설정된 모델이 정상 동작하지 않는다는 보고
- 모든 AI(OpenAI/Anthropic/Google/xAI)의 현재 최신 모델을 조사해 반영, 커밋 및 배포까지 진행

## 조사 방법
- Anthropic: 이 세션 자체의 모델 신원 정보와 사내 `claude-api` 스킬(캐시된 공식 모델 카탈로그)로 최신 모델 ID를 확인.
- OpenAI / Google / xAI: `WebSearch`로 각 사의 2026년 최신 모델 발표를 조사(WebFetch는 프록시에서 대상 도메인 접근이 차단되어 WebSearch 결과 요약에 의존).

## 조사 결과
| 제공사 | 기존 기본 모델 | 최신 상태 | 조치 |
|---|---|---|---|
| Anthropic | `claude-sonnet-4-6` | **Claude Sonnet 5**(`claude-sonnet-5`) 2026-06-30 정식 출시 확인(TechCrunch) | 기본 모델 변경 |
| Google | `gemini-3-flash-preview` | **Gemini 3.5 Flash**(`gemini-3.5-flash`) 2026-05-19 GA(Google I/O) — 가격 $1.50/$9.00 per 1M 확인 | 기본 모델 변경 |
| Google (Pro) | `gemini-3.1-pro-preview` | **Gemini 3.5 Pro**는 아직 미출시(7월 예정, 제한된 프리뷰만 존재) | 변경 보류 |
| xAI | `grok-4.3` | 이미 xAI 공식 문서 기준 최신 플래그십 | 변경 없음 |
| OpenAI | `gpt-5.4-mini` 외 | **GPT-5.6**(Sol/Terra/Luna) 발표됐으나 "일부 신뢰 파트너 대상 제한 프리뷰"이며 일반 API 키로는 아직 사용 불가 | 변경 보류(오히려 접근 불가 사용자에게 오류 유발 위험) |

## 코드 변경
- `src/lib/ai/provider-catalog.ts`
  - Anthropic `defaultModel` → `claude-sonnet-5`, `models`에 추가(기존 `claude-sonnet-4-6`은 유지, 아직 활성 모델).
  - Google `defaultModel` → `gemini-3.5-flash`, `models`에 추가.
  - **버그 수정**: `GOOGLE_LEGACY_MODEL_MAP`에 있던 `"gemini-3.5-flash": "gemini-3-flash-preview"` 항목 제거. 이 항목 때문에 세션/프리셋에 저장된 `gemini-3.5-flash`가 항상 구형 preview 모델로 강제 치환되고 있었음 — 사용자가 "새 모델을 골라도 안 먹힌다"고 느꼈을 근본 원인 중 하나로 추정.
  - `getMinimumTimeoutSecondsForModel`에 `claude-sonnet-5` 타임아웃 하한(120초) 추가.
- `src/lib/ai/model-display.ts`: `claude-sonnet-5`, `gemini-3.5-flash` 표시 이름 추가.
- `src/lib/credits.ts`: `claude-sonnet-5`(인트로가 $2/$10, 2026-08-31까지), `gemini-3.5-flash`($1.50/$9.00) 크레딧 단가 추가.
- `src/components/workbench/WorkbenchClient.tsx`: 기본 프리셋("3단계 검토 체인") 3번째 단계 모델을 `gemini-3-flash-preview` → `gemini-3.5-flash`로 갱신.
- 테스트 갱신: `src/lib/ai/provider-catalog.test.mjs`의 카탈로그·정규화 기대값을 새 기본값에 맞게 수정.

## 검증
- `node --test`로 전체 `*.test.mjs` 실행: 139개 중 138개 통과. 실패 1건(`extractAttachmentTextContent reads docx body text`)은 변경 전 상태에서도 동일하게 실패함을 확인(사전 존재하던 무관한 실패, docx 픽스처/환경 문제로 추정).
- `tsc --noEmit`: 의존성 미설치(`@prisma/client`, `next`, `react` 등 node_modules 없음)로 인한 기존 오류만 존재, 이번에 수정한 4개 파일에서 새로 발생한 오류 없음.

## 참고
- OpenAI GPT-5.6, Google Gemini 3.5 Pro는 아직 제한 접근/미출시 상태라 의도적으로 기본값을 바꾸지 않았음. 두 모델이 정식 출시(GA)되면 후속 패치로 반영 필요.

## 버전
- `VERSION`, `src/lib/version.ts` → **v1.34.0-20260701**

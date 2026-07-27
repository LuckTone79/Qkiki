# 작업 보고서

## 기본 정보
- **버전**: v1.36.3-20260727
- **작업 일시**: 2026-07-27
- **이전 버전**: v1.36.2-20260718
- **프로젝트명**: Yapp / Qkiki Multi AI Workbench

## 작업 요약
공식 공급자 문서를 기준으로 앱의 AI 모델 카탈로그를 최신 모델군으로 갱신했다. OpenAI, Anthropic, Google Gemini, xAI의 선택 가능 모델과 기본 모델, legacy alias normalization, 가격 추정, 표시명, 기본 순차 워크플로우, 테스트를 함께 정리했다.

## 변경 사항

### 추가/갱신된 모델
- OpenAI: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`
- Anthropic: `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`, `claude-fable-5`
- Google Gemini: `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-preview`
- xAI: `grok-4.5`

### 수정된 사항
- 이전 OpenAI `gpt-5.5/5.4` 계열을 GPT-5.6 계열로 자동 승격하도록 정리
- 이전 Claude 4.x Opus/Sonnet 계열을 Claude 5 계열로 자동 승격하도록 정리
- 이전 Gemini 2.5/3 preview 계열을 현재 지원되는 Gemini 3.x 모델로 자동 승격하도록 정리
- 이전 Grok 4.3/4.20 계열을 `grok-4.5`로 자동 승격하도록 정리
- 워크벤치 기본 순차 체인을 `gpt-5.6-terra` -> `grok-4.5` -> `gemini-3.6-flash`로 변경
- 병렬 비교 요약 모델을 `gpt-5.6-sol`로 변경
- 크레딧 가격 추정표와 모델 안내 trait 분류를 최신 모델군 기준으로 갱신
- 가이드/README의 지원 모델 설명을 최신 카탈로그와 일치시킴

### 삭제/제외된 사항
- 선택 가능한 텍스트 모델 목록에서 구형 OpenAI GPT-5.5/5.4, Claude Opus/Sonnet 4.x, Gemini 2.5, Grok 4.3/4.20 계열을 제거
- 이미지 생성 모델은 이번 텍스트 모델 최신화 범위에서 유지

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|----------|------|
| `src/lib/ai/provider-catalog.ts` | 수정 | 모델 카탈로그, 기본 모델, alias normalization, timeout 갱신 |
| `src/lib/credits.ts` | 수정 | 최신 텍스트 모델 가격 추정 갱신 |
| `src/lib/ai/model-display.ts` | 수정 | 최신 모델 표시명 추가 |
| `src/components/workbench/WorkbenchClient.tsx` | 수정 | 기본 순차 워크플로우 모델 갱신 |
| `src/lib/ai/summary-model.ts` | 수정 | 병렬 비교 요약 모델 갱신 |
| `src/lib/workbench-model-guidance.ts` | 수정 | 최신 모델 trait 분류 갱신 |
| `src/app/guide/page.tsx` | 수정 | 지원 모델 수 갱신 |
| `README.md` | 수정 | 모델 카탈로그 설명 갱신 |
| `VERSION`, `src/lib/version.ts` | 수정 | 앱 버전 갱신 |

## 공식 확인 소스
- OpenAI Models: https://developers.openai.com/api/docs/models
- OpenAI Pricing: https://developers.openai.com/api/docs/pricing
- Anthropic Models overview: https://docs.anthropic.com/en/docs/about-claude/models/overview
- Anthropic Pricing: https://docs.anthropic.com/en/docs/about-claude/pricing
- Google Gemini Models: https://ai.google.dev/gemini-api/docs/models
- Google Gemini Pricing: https://ai.google.dev/gemini-api/docs/pricing
- xAI Models: https://docs.x.ai/developers/models
- xAI Grok 4.5: https://docs.x.ai/developers/models/grok-4.5
- xAI Pricing: https://docs.x.ai/developers/pricing

## 검증 결과
- 통과: `node --test --experimental-strip-types src/lib/ai/provider-catalog.test.mjs src/lib/workbench-model-guidance.test.mjs src/lib/ai/summary-model.test.mjs src/lib/ai/token-budget.test.mjs src/lib/credits.test.mjs src/lib/workbench-provider-selection.test.mjs src/lib/workbench-run-payload.test.mjs src/lib/workbench-result-board.test.mjs src/lib/validation-actions.test.mjs src/lib/admin-usage-metrics.test.mjs`
- 통과: `npx tsc -p tsconfig.json --noEmit`
- 통과: `npm run lint`
- 통과: `npm run build`
- 통과: 의도한 변경 파일 범위의 `git diff --check`
- 예정: commit, push, Vercel production deploy, live HTTP check

## 알려진 이슈 / 추후 작업
- 작업 시작 전부터 존재하던 별도 미커밋 변경과 로그/문서 파일은 이번 모델 최신화 커밋 범위에서 제외한다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.36.3 | 2026-07-27 | 최신 AI 모델 카탈로그 반영 |
| v1.36.2 | 2026-07-18 | 이전 작업 버전 |

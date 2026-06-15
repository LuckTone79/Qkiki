# 작업 보고서 — v1.23.0-20260615

## 목표
모든 모델이 텍스트만 생성하던 프로그램에 **이미지 생성** 기능을 추가한다. 각 AI 회사별로 이미지 생성이
가능한 모델이 존재하므로(OpenAI, Google, xAI), 이를 본 프로그램에서도 사용할 수 있도록 로직을 적용한다.
(Claude/Anthropic은 이미지 생성 모델이 없어 제외.)

## 사용자 결정 사항
- **트리거 방식**: 전용 "이미지 생성" 모드 토글 (사용자 선택).
- **포함 모델**: OpenAI(`gpt-image-1`, `gpt-image-2`), Google(Imagen/Gemini Image), xAI(Grok Image).

## 설계 개념
- **백엔드 신규 모드 없음**: 이미지 생성은 기존 **병렬(parallel) 실행 경로를 그대로 재사용**한다. "이미지
  모드"는 모델 선택기를 이미지 모델로 한정하는 UI 토글일 뿐이며, 실제 실행은 mode `"parallel"`로 전송된다.
  덕분에 durable workflow / execution-run / 사용량·동시성 인프라를 건드리지 않는다.
- **모델 단위 라우팅**: `executeProviderCall`에서 `isImageModel(provider, model)`이면 해당 공급자의 이미지
  엔드포인트로 분기한다. 따라서 lease·재시도·비용·영속화 등 기존 파이프라인이 그대로 적용된다.
- **저장/렌더링**: 생성 이미지는 base64 data URL(`data:image/...;base64,...`) 형태로 `Result.outputText`에
  저장한다(스키마 변경 없음). `ResultCard`가 data URL을 감지하면 `<img>`로 렌더링하며, 워크벤치와 공유
  뷰 모두 동일 컴포넌트를 사용하므로 양쪽에서 이미지가 보인다.
- **텍스트 컨텍스트 보호**: 이미지 data URL이 순차 체인의 소스 텍스트나 병렬 비교 요약 같은 텍스트
  프롬프트로 새어 들어가지 않도록 `stripImageDataUrlForText`/`isImageDataUrl`로 차단·치환한다.
- **이미지 프롬프트**: 이미지 API에는 오케스트레이션 보일러플레이트 대신 사용자 설명만 전달하도록
  `composeImagePrompt`를 별도로 사용한다.

## 이미지 엔드포인트
- OpenAI: `POST /v1/images/generations` → `data[0].b64_json` (gpt-image-1 / gpt-image-2)
- xAI: `POST /v1/images/generations` (OpenAI 호환, `response_format: b64_json`) → `data[0].b64_json`
- Google: `POST .../models/{model}:predict` → `predictions[0].bytesBase64Encoded` (Imagen 4)

## 변경 파일
- `src/lib/ai/provider-catalog.ts` — `imageModels` 추가 + `isImageModel`/`getImageModels` 헬퍼.
- `src/lib/ai/image-output.ts` (신규) — `isImageDataUrl`/`imageOutputPlaceholder`/`stripImageDataUrlForText`.
- `src/lib/ai/pricing.ts` — 이미지 단가 표 + `estimateImageCost`.
- `src/lib/ai/prompt.ts` — `composeImagePrompt`.
- `src/lib/ai/providers.ts` — 이미지 모델 라우팅 + `callOpenAiImage`/`callGoogleImage`/`callXaiImage`.
- `src/lib/ai/workflow.ts` — 병렬 실행 시 이미지 프롬프트 사용(`composeParallelTargetPrompt`),
  소스 텍스트/비교 요약에서 이미지 출력 차단.
- `src/lib/ai/model-display.ts` — 이미지 모델 표시명.
- `src/app/api/providers/route.ts` — 응답에 `imageModels` 포함.
- `src/components/workbench/ProviderSelectorRow.tsx` — `ProviderOption`에 `imageModels?` 추가.
- `src/components/workbench/ResultCard.tsx` — data URL 이미지 인라인 렌더링.
- `src/components/workbench/WorkbenchClient.tsx` — "이미지 생성" 토글, `effectiveProviders`(이미지 모델만
  노출), 토글 시 병렬 강제.
- 테스트: `provider-catalog.test.mjs`, `prompt.test.mjs`, `image-output.test.mjs`(신규).
- `src/lib/version.ts`, `VERSION`, `CHANGELOG.md` — 버전 v1.23.0-20260615.

## 검증
- `npx tsc --noEmit` — 통과
- `node --test` (catalog/prompt/image-output) — **18/18 통과**
- `npx eslint <변경 파일들>` — 통과

## 비고 / 한계
- 텍스트 모델명과 마찬가지로 이미지 모델명도 각 공급자 실제 엔드포인트로 직접 전송된다(프록시 없음).
  `gpt-image-2`는 사용자가 명시 요청하여 포함했으며, 미지원 시 API 오류로 안전하게 처리된다.
- 이미지 생성은 병렬 경로만 지원한다(순차 체인 단계 유형으로는 노출하지 않음). 첨부 입력은 텍스트→이미지
  단계에서는 사용하지 않는다.

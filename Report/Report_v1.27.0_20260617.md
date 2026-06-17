# Report v1.27.0-20260617 — Image generation across providers

## 목표
프로그램에서 **각 AI 회사의 이미지 생성 모델로 이미지도 생성**할 수 있게 한다. 웹과 모바일에서 모두 동일하게 사용 가능해야 한다. (Anthropic/Claude는 이미지 생성 모델이 없어 제외.)

## 배경 (이미 main에 있던 것)
- `provider-catalog.ts`: 공급자별 `imageModels` 목록과 `isImageModel`/`getImageModels`.
- `credits.ts`: `IMAGE_GENERATION_PRICING`(모델별 장당 단가), `estimateImageGenerationCostUsd`, `billingKind: "image"` 분기.
- `pricing.ts`: `estimateCost`가 이미지 모델이면 이미지 단가를 먼저 반환.
- `/api/providers`: 응답에 `imageModels` 포함.

즉 **카탈로그/단가/크레딧 토대는 준비**되어 있었으나 **실제 이미지 생성 실행과 UI가 없었다**. 이번 작업은 그 실행/렌더링 계층을 추가한다.

## 변경 범위

### 백엔드 (실행)
- `src/lib/ai/image-output.ts` (신규): `buildImageDataUrl`, `isImageDataUrl`, `textOutputForPrompt`(이미지 data URL을 텍스트 프롬프트에 넣지 않도록 치환). 서버·클라이언트 공용(순수 모듈).
- `src/lib/ai/providers.ts`: `executeProviderCall`에서 `isImageModel`이면 이미지 경로로 분기.
  - OpenAI: `POST /v1/images/generations` → `data[0].b64_json`
  - xAI: `POST /v1/images/generations`(OpenAI 호환, `response_format: b64_json`) → `data[0].b64_json`
  - Google Imagen(`imagen-*`): `:predict` → `predictions[0].bytesBase64Encoded`
  - Google Gemini 이미지(`gemini-*-image`): `:generateContent`(`responseModalities: [TEXT, IMAGE]`) → 인라인 이미지 데이터
  - 결과는 `data:` URL로 `outputText`에 저장(스키마 변경 없음). 단가/크레딧은 기존 `withCost`→`estimateCost`가 이미지 단가로 처리. `rawResponse`에는 대용량 base64를 중복 저장하지 않음.
- `src/lib/ai/prompt.ts`: `composeImagePrompt()` 추가 — 이미지 모델에는 오케스트레이션 보일러플레이트 없이 사용자 설명만 전달(언어/스타일 지시문이 이미지에 그려지는 것 방지).
- `src/lib/ai/workflow.ts`: 병렬 실행 시 이미지 모델 타깃은 `composeImagePrompt` 사용. 순차 소스 텍스트/브랜치 리뷰/병렬 비교 요약에서 이미지 data URL을 `textOutputForPrompt`로 차단해 텍스트 프롬프트로 새지 않게 함.

### 프런트엔드 (웹·모바일 공용)
- `ProviderSelectorRow.tsx`: `availableModels`/`variant="image"` 지원, `ProviderOption`에 `imageModels` 추가.
- `WorkbenchClient.tsx`: "🖼 이미지 생성" 토글. 켜면 모델 선택기가 이미지 모델로 바뀌고 실행은 병렬 경로로 전송(`effectiveMode/effectiveTargets`). 이미지 모드에선 병렬 비교 요약 패널/호출을 숨김. 기존 반응형 패널(모델/입력/결과)을 그대로 사용하므로 모바일에서도 동일하게 동작.
- `ResultCard.tsx`: `outputText`가 이미지 data URL이면 인라인 `<img>`(반응형 `w-full max-w-md`)로 렌더링하고 다운로드 링크 제공. 워크벤치·공유 뷰 공통.
- `model-display.ts`: 이미지 모델 표시 라벨 추가.

### 버전/문서
- `VERSION`, `src/lib/version.ts` → `v1.27.0-20260617`
- `CHANGELOG.md` Patch 24 추가, 본 보고서 추가.

### 테스트
- `src/lib/ai/image-output.test.mjs` (신규): data URL 빌드/감지/텍스트 치환.
- `src/lib/ai/prompt.test.mjs`: `composeImagePrompt`가 보일러플레이트 없이 설명만 반환하는지 검증.

## 검증
- `npx tsc --noEmit`
- `node --test`
- `npx eslint` (변경 파일)

## 한계
- 이미지 모델명은 각 공급자 실제 엔드포인트로 직접 전송된다(프록시 없음). 환경 키/계정에 해당 모델 접근 권한이 필요하며, 미지원 모델은 공급자 API 오류로 안전 처리된다.
- 이미지 생성은 병렬 경로만 지원(순차 체인 단계 유형으로는 노출하지 않음). 호출당 1장 생성(기존 장당 단가와 일치).

# Report v1.35.0 - 2026-07-02

## 변경 요약

결과 카드의 AI 모델 배지를 더 눈에 띄게 개선 — 글자 크기 확대 + 회사별 브랜드 색상 적용.

## 배경

결과 메뉴의 모델 표시("anthropic / Sonnet 5")가 옅은 회색 배경(`bg-[#f1f0ee]`)에
작은 글씨(`text-xs`)라 어떤 모델의 결과인지 한눈에 구분하기 어려웠음.

## 변경 내용

### `src/lib/ai/model-display.ts`
- `getProviderBrandBadgeClass(provider)` 헬퍼 추가 — 회사별 브랜드 색상 클래스 반환
  - **anthropic (Claude)**: `#D97757` — Claude 로고 코랄색
  - **openai (GPT)**: `#10A37F` — OpenAI 그린
  - **google (Gemini)**: `#4285F4` — Google/Gemini 블루
  - **xai (Grok)**: `#1A1A1A` — xAI/Grok 블랙
  - 모두 흰색 글자로 대비 확보

### `src/components/workbench/ResultCard.tsx`
- 모델 배지: `text-xs` → **`text-sm font-bold`**로 글자 크기·굵기 확대
- 배경: 단일 회색 → **회사별 브랜드 색상**(위 헬퍼) + `shadow-sm`
- padding 소폭 확대(`px-2.5`)

## 버전
- `VERSION`, `src/lib/version.ts` → `v1.35.0-20260702`

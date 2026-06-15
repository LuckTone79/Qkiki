# 작업 보고서 — v1.22.0-20260615

## 목표
순차 검토 체인(Sequential Review Chain)의 "작업 선택"에 **코드 리뷰(Code Review)** 작업 유형을 추가한다.
사용자가 원하는 설계의 코드를 이전 모델이 작성하면, 다음 모델이 그 코드의 개선해야 할 점을 찾아 수정·개선하는
로직을 반영한다. **가장 중요한 요구사항**: 더 이상 개선할 점이 없을 정도로 완벽한 고품질 코드일 때는
억지로 개선하지 않고 그대로 반영하도록 로직을 설계한다.

### 사용 예시(요구사항)
- step1: 코딩
- step2: 코드 리뷰/수정
- step3: 코드 리뷰/수정
- step4: 코드 리뷰 모드이나 더 수정할 것이 없는 고품질 코드 → 그대로 반영
- step5: 코드 리뷰 모드이나 더 수정할 것이 없는 고품질 코드 → 그대로 반영

## 설계 개념
- 모든 작업은 단일 `ActionType` 유니온을 통과하고 `Record<ActionType, …>` 형태의 망라형(exhaustive) 맵으로
  처리된다. 유니온에 `"code_review"`를 추가하면 TypeScript가 모든 맵에 항목을 채우도록 강제하므로
  컴파일 단계에서 "반쪽 구현"을 방지한다.
- 코드 리뷰 로직은 `composePrompt`에 전용 지시문 블록(`buildCodeReviewDirectives`)으로 구현했다.
  - 리뷰 관점: 정확성/엣지 케이스 버그, 보안, 성능, 에러 처리, 가독성·네이밍, 중복·죽은 코드,
    누락된 테스트, 과제 요구사항 이탈 등 구체적 문제를 점검.
  - 개선이 필요할 때: 수정을 적용하고 **전체 실행 가능한 개선 코드**를 반환한 뒤 "Changes" 요약을 덧붙인다.
  - **핵심(억지 개선 금지)**: 분명하고 의미 있는 개선점을 찾지 못하면 코드를 **변경 없이 그대로** 반환하고
    `NO_CHANGES:` 한 줄을 덧붙인다. 무변경 통과가 "고품질 코드의 올바른 결과"임을 명시.
  - 단순 미관/사소/스타일 전용 편집을 생산성 과시용으로 만들어내는 것을 명시적으로 금지.
  - 원래 언어·프레임워크·구조·공개 인터페이스는 실제 문제 해결에 꼭 필요한 경우가 아니면 보존.
- 체인 흐름과의 적합성: 각 코드 리뷰 스텝의 출력은 `sourceMode: "previous"`로 다음 스텝의 입력이 된다.
  모델이 무변경을 선택하면 동일 코드가 다음 스텝으로 흘러 자연스럽게 수렴한다. 별도의 조기 중단(stop condition)
  없이도 사용자 예시(step4·5의 무변경 통과)가 그대로 구현된다. 기존 `QUALITY_SCORE` 기반 중단 조건과도 독립.
- 소스 헤딩도 코드 리뷰 전용 문구("Code from the previous model to review …")로 분기해 모델이 리뷰 대상임을
  명확히 인지하도록 했다.

## 변경 파일
- `src/lib/ai/types.ts` — `ActionType`에 `"code_review"` 추가.
- `src/lib/ai/prompt.ts` — 코드 리뷰 액션 라벨 + `buildCodeReviewDirectives()` 전용 로직, 소스 헤딩 분기.
- `src/lib/ai/action-display.ts` — 표시 라벨(EN: Code review / KO: 코드 리뷰).
- `src/lib/validation.ts` — `workflowStepSchema` 및 `branchRunSchema` enum에 `code_review` 추가.
- `src/components/workbench/WorkflowStepRow.tsx` — 순차 체인 작업 드롭다운에 항목 추가.
- `src/components/workbench/ResultCard.tsx` — "다른 모델로 검토" 작업 목록에 항목 추가.
- `src/components/presets/PresetsClient.tsx` — 프리셋 미리보기 라벨 추가.
- `src/app/guide/page.tsx` — 가이드의 작업 유형 목록(EN/KO) 갱신.
- `src/lib/ai/prompt.test.mjs` — 코드 리뷰 단위 테스트 3건 추가.
- `src/lib/version.ts`, `VERSION`, `CHANGELOG.md` — 버전 v1.22.0-20260615 반영.

## 검증 결과
1. **정확성 / 망라성**: `npx tsc --noEmit` 무오류 — 모든 `Record<ActionType,…>` 맵이 채워졌음을 보장.
   검증 스키마(체인 + 브랜치) 양쪽에 enum 반영.
2. **동작 / 단위 테스트**: `node --test` 8/8 통과. 코드 리뷰 라벨, 리뷰 규칙 주입, `NO_CHANGES` 가드,
   타 액션 비누출(누수 방지)을 모두 검증.
3. **엣지 케이스 / 보안**: 순수 추가형 enum이라 기존 세션·프리셋 무영향. 지시문은 정적 문자열이며
   `sourceText`는 상류에서 이미 truncate. 반복 블록·중단 조건과 독립적으로 동작.

## 검증 명령
- `npx tsc --noEmit` — 통과
- `node --test --experimental-strip-types src/lib/ai/prompt.test.mjs` — 8/8 통과
- `npx eslint <변경 파일들>` — 통과

# 작업 보고서 — v1.18.0-20260610

## 목표
순차 검토 체인(Sequential Review Chain)의 "작업 선택"에 **브레인스토밍(Brainstorm)** 작업 유형을 추가한다.
브레인스토밍 모드는 주제에 편협하게 갇히지 않고, AI 모델별로 매우 창의적인 아이디어를 서로 추가·논의하면서
여러 가지 다양한 결과를 낼 수 있도록 로직을 설계한다. 코딩 후 서로 다른 관점으로 3회 검증하고 적용, 커밋·배포까지 완료한다.

## 설계 개념
- 핵심은 모든 작업이 단일 `ActionType` 유니온을 통과하고, `Record<ActionType, …>` 형태의 망라형(exhaustive) 맵으로
  처리된다는 점이다. 유니온에 `"brainstorm"`을 추가하면 TypeScript가 모든 맵에 항목을 채우도록 강제하므로
  컴파일 단계에서 "반쪽 구현"을 방지한다.
- 브레인스토밍 로직은 `composePrompt`에 전용 지시문 블록으로 구현했다.
  - 항상: 발산적 사고(다른 분야·유추·반대 시각·"what if"), 모델별 고유 관점, 최소 5개의 서로 다른 아이디어,
    완성도보다 독창성·다양성 우선, "Threads worth pursuing" 요약.
  - 이전 결과(소스)가 있을 때만: 기존 아이디어를 "살아있는 다중 모델 토론"으로 재구성하여 "yes, and" 확장,
    두 아이디어 재조합, 아무도 제기하지 않은 새 각도 추가, 요약·반복 금지(반드시 신규 또는 진화).

## 변경 파일
- `src/lib/ai/types.ts` — `ActionType`에 `"brainstorm"` 추가.
- `src/lib/ai/prompt.ts` — 브레인스토밍 액션 라벨 + `buildBrainstormDirectives()` 전용 로직, 소스 헤딩 재구성.
- `src/lib/ai/action-display.ts` — 표시 라벨(EN: Brainstorm / KO: 브레인스토밍).
- `src/lib/validation.ts` — `workflowStepSchema` 및 `branchRunSchema` enum에 `brainstorm` 추가.
- `src/components/workbench/WorkflowStepRow.tsx` — 순차 체인 작업 드롭다운에 항목 추가.
- `src/components/workbench/ResultCard.tsx` — "모델로 검토" 작업 목록에 항목 추가.
- `src/components/presets/PresetsClient.tsx` — 프리셋 미리보기 라벨 추가.
- `src/app/guide/page.tsx` — 가이드의 작업 유형 목록(EN/KO) 갱신.
- `src/lib/version.ts`, `VERSION`, `CHANGELOG.md` — 버전 v1.18.0-20260610 반영.
- `src/lib/ai/prompt.test.mjs` — 신규 단위 테스트.

## 3회 검증 결과
1. **정확성 / 망라성**: `npx tsc --noEmit` 무오류 — 모든 `Record<ActionType,…>` 맵이 채워졌음을 보장.
   검증 스키마(체인+브랜치) 통과, v2 러너는 `actionType`을 문자열로 보관·캐스팅하므로 그대로 흐름.
2. **프롬프트 / UX 품질**: 발산성·모델별 차별성·다양한 결과·타 모델 아이디어 확장 요구사항 충족.
   소스 유무에 따른 조건부 지시문으로 첫 스텝/연쇄 스텝 모두 자연스럽게 동작. 체인·브랜치 양쪽 진입점 제공.
3. **엣지 케이스 / 보안**: 순수 추가형 enum이라 기존 세션·프리셋 무영향. 지시문은 정적 문자열,
   sourceText는 상류에서 이미 truncate. 반복 블록·중단 조건과 독립적으로 동작. 브랜치 기본값(critique) 유지.

## 검증 명령
- `npx tsc --noEmit` — 통과
- `npx eslint <변경 파일들>` — 통과
- `node --test src/lib/ai/prompt.test.mjs` — 5/5 통과
- `node --test src/lib/workbench-run-payload.test.mjs` — 2/2 통과(회귀 확인)

## UI 버전 표시
앱 셸 사이드바/하단 및 가이드·관리자 About 페이지에서 `APP_VERSION`(v1.18.0-20260610) 노출.

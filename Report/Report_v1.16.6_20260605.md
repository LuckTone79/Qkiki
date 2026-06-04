# 작업 보고서
## 기본 정보
- 버전: `v1.16.6-20260605`
- 작업 일시: `2026-06-05`
- 이전 버전: `v1.16.5-20260605`
- 프로젝트: `Qkiki / Multi AI Workbench`

## 작업 목적
순차검토체인의 반복 설정에서 기본 반복 횟수 숫자를 수정하려고 백스페이스를 누르면, 입력값이 최소값 `1`에 즉시 고정되어 숫자를 전부 지울 수 없는 문제가 있었습니다.

이번 수정의 목표는 사용자가 반복 횟수를 바꿀 때 입력 도중에는 숫자 전체를 비울 수 있게 하고, 입력이 끝난 뒤에만 최소값 규칙을 적용하는 것입니다.

## 원인 분석
반복 횟수 입력 필드는 `type="number"`, `min={1}` 상태에서 `onChange`마다 곧바로 `clampInteger(..., 1, MAX_TOTAL_SEQUENTIAL_STEPS)`를 적용하고 있었습니다.

이 구조에서는 사용자가 `1`을 지우는 순간:
- 빈 문자열이 `Number("")` 처리로 바로 숫자화됨
- 최소값 clamp가 즉시 다시 `1`을 넣음

즉, 입력 중의 임시 빈 상태를 UI가 허용하지 않아 백스페이스 편집이 막히는 구조였습니다.

## 적용한 수정
- `src/lib/repeat-count-input.ts`
  - 반복 횟수 입력용 draft sanitizing / finalize 헬퍼 추가
- `src/lib/repeat-count-input.test.mjs`
  - 빈 값 허용, 숫자만 허용, blur 시 clamp 동작 테스트 추가
- `src/components/workbench/WorkbenchClient.tsx`
  - 반복 횟수 입력에 `repeatCountDraftById` 로컬 draft 상태 추가
  - 입력 중에는 `""`를 유지할 수 있게 변경
  - 숫자를 다시 입력하면 즉시 해당 숫자로 반영
  - 포커스를 벗어나면 최소 1, 최대 제한값으로 정리되도록 변경

## 기대 효과
- 반복 횟수 수정 시 기존 숫자를 백스페이스로 전부 지운 뒤 새 숫자를 자연스럽게 입력할 수 있습니다.
- 입력 도중에는 빈 값이 허용되지만, 최종 저장값은 여전히 1 이상 유효한 숫자로 유지됩니다.

## 검증
- `node --test src/lib/repeat-count-input.test.mjs`
- 이후 전체 타입/린트/빌드 검증 예정

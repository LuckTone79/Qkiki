# Report v1.14.4

## 기본 정보
- 버전: `v1.14.4-20260603`
- 이전 버전: `v1.14.3-20260603`
- 작업 일시: `2026-06-03`

## 작업 요약
- production V2 runner에서 실제 `cancel` 스모크 테스트를 수행했다.
- step 상태는 정상적으로 `canceled`로 바뀌지만 run 최종 상태가 `canceled`가 아니라 `partial`로 종료되는 문제를 재현했다.
- `finalizeExecutionRunV2()`가 run-level cancel intent보다 step 집계를 우선하던 로직을 수정했다.

## 재현 결과
- 대상: production `qkiki.vercel.app`
- 조건:
  - `runnerVersion=v2`
  - sequential run 실행 중 `POST /api/workbench/runs/[runId]/cancel`
- 관찰:
  - 완료된 앞 단계는 `completed`
  - 실행 중/대기 단계는 `canceled`
  - 그러나 run status는 `partial`

## 근본 원인
- `src/lib/execution-run-steps.ts`의 `finalizeExecutionRunV2()`는
  - `counts.canceled === total` 이면 `canceled`
  - 그 외 `completed`가 하나라도 있으면 `partial`
  로 계산했다.
- 즉, 사용자가 run 전체 중지를 요청해 `executionRun.status="canceling"`이 된 경우에도,
  앞 단계가 이미 일부 완료돼 있으면 run이 `partial`로 강등됐다.

## 수정 사항
- 파일: `src/lib/execution-run-steps.ts`
- 변경:
  - `executionRun.status`가 `canceling` 또는 `canceled`면 step 집계보다 우선해서 최종 status를 `canceled`로 확정

## 기대 효과
- 사용자가 전체 중지를 누른 run은 이전 completed step이 있더라도 최종 run status가 `canceled`로 일관되게 표시된다.
- step 수준 불변성은 유지된다.
  - 이미 완료된 step은 `completed` 유지
  - 남은 step은 `canceled`
  - run-level 상태만 `partial` 대신 `canceled`

## 변경 파일
- `src/lib/execution-run-steps.ts`
- `VERSION`
- `src/lib/version.ts`


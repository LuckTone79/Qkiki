# 작업 보고서

## 기본 정보
- **버전**: v1.13.3-20260518
- **작업 일시**: 2026-05-18
- **이전 버전**: v1.12.5-20260516
- **프로젝트명**: Qkiki Workbench

## 작업 요약
순차검토체인 Step4 멈춤처럼 보이던 문제를 취소 신호 전파와 단계별 제어 구조로 정리했고, 각 단계별 중지 기능과 결과 상단 고정을 추가했다. 이후 서로 다른 모델 검증을 반복하며 queued 취소, started 취소, stale watchdog, canceled snapshot, 병렬 취소 정산 경합, run 범위 오염까지 보강해 배포 가능한 상태로 마무리했다.

## 원인 분석
- 기존 전체 중지는 `ExecutionRun` 상태만 바꾸고 이미 진행 중인 provider 호출과 provider lease 대기에 즉시 중지 신호를 전달하지 못했다.
- 순차 실행 루프에는 특정 단계만 건너뛰거나 중지하는 영속 상태가 없어 장시간 단계가 끝날 때까지 사용자가 개입할 수 없었다.
- 진행 카드 완료 매핑이 결과 배열 순서에 의존해 스킵/취소가 끼면 카드와 실제 결과가 어긋날 수 있었다.
- 중지와 사용량 예약 정산이 서로 다른 경로에서 처리되어 queued 취소, started 취소, stale canceled run에서 누수나 오정산 경합이 있었다.
- 세션과 시간만으로 현재 실행 결과를 추정하면 같은 세션의 나중 rerun 결과가 이전 canceled run의 snapshot/정산에 섞일 수 있었다.

## 변경 사항

### 추가된 기능
- `ExecutionRun.stepControlJson`과 Prisma 마이그레이션을 추가해 단계별 중지 요청을 영속 저장한다.
- 순차 실행 전용 단계 중지 API를 추가했다.
- 진행 카드에 각 단계별 `단계 중지` 버튼과 중지/스킵 상태 표시를 추가했다.
- provider 호출과 provider lease 대기에 abort 신호를 연결했다.
- `Result.executionRunId`를 추가해 결과를 durable run 단위로 정확히 묶었다.

### 수정된 사항
- Step4처럼 오래 걸리는 provider 호출도 사용자가 중지하면 fetch/lease 수준에서 빠르게 중단되도록 개선했다.
- queued 상태 전체 중지는 workflow가 시작되지 않은 경우에만 예약을 release하고, 실행 시작 후에는 DB 취소 신호와 workflow 정산 경로를 사용하도록 분기했다.
- 병렬 취소는 `Promise.allSettled`로 시작된 형제 작업이 정리된 뒤 정산하도록 바꿨다.
- canceled 실행의 stream snapshot은 `executionRunId`로 현재 실행 결과만 반환하고, 시작 전 취소된 run은 빈 결과로 처리한다.
- stale watchdog은 queued/running/canceled run을 모두 보되, `executionRunId` 기준으로 현재 실행 결과만 settle/release 하도록 보강했다.
- trial처럼 `usageReservationId`가 없는 stale run도 watchdog에서 정상 종료 처리되도록 복구했다.
- stale canceled run에 남은 `running` 결과도 같은 run 범위 안에서 `canceled`로 정리되도록 보강했다.
- 진행 카드 완료 처리를 `workflowStep.orderIndex` 기반으로 바꿔 스킵/취소가 있어도 올바른 단계에 반영되게 했다.
- `진행 step중 최신결과`와 `최종결과`가 결과 상단에 오도록 정렬을 보강했고, 병렬 비고정 루트도 최신 업데이트 우선으로 맞췄다.
- canceled/skipped 상태 배지와 결과 카드 표시를 추가했다.
- AI 요청 감사 로그의 canceled 메시지를 사용자 중지 메시지와 일치시켰다.
- 앱 버전을 `v1.13.3-20260518`로 갱신했다.

### 제거/정리된 사항
- 실행 시작 이후 예약을 즉시 release하던 취약한 전체 중지 경로를 제거했다.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| `src/lib/ai/workflow.ts` | 수정 | 순차/병렬 실행 중지, provider abort, `executionRunId` 저장 |
| `src/lib/ai/providers.ts` | 수정 | provider 요청 abort 신호 연결 |
| `src/lib/provider-concurrency.ts` | 수정 | provider lease 대기 abort 지원 |
| `src/lib/execution-runs.ts` | 수정 | 단계별 중지 상태 저장/조회, step index 상수 |
| `src/workflows/workbench-run.ts` | 수정 | durable workflow 진행 이벤트, 중지 정산, canceled 처리 |
| `src/lib/workbench-run-watchdog.ts` | 수정 | stale queued/running/canceled run 회수 및 예약 정산 |
| `src/app/api/workbench/runs/[runId]/route.ts` | 수정 | 전체 중지와 queued 예약 release 보강 |
| `src/app/api/workbench/runs/[runId]/stream/route.ts` | 수정 | canceled 실행 snapshot을 run 단위로 제한 |
| `src/app/api/workbench/runs/[runId]/steps/[stepIndex]/route.ts` | 추가 | 순차 단계별 중지 API |
| `src/components/workbench/WorkbenchClient.tsx` | 수정 | 단계별 중지 UI, 진행 카드 매핑, 결과 상단 고정 |
| `src/components/workbench/ResultCard.tsx` | 수정 | 최종/최신 진행 결과 및 canceled 표시 |
| `src/components/StatusBadge.tsx` | 수정 | canceled/skipped 배지 |
| `prisma/schema.prisma` | 수정 | `ExecutionRun.stepControlJson`, `Result.executionRunId` 추가 |
| `prisma/migrations/20260516160000_add_execution_run_step_control/migration.sql` | 추가 | step control DB 마이그레이션 |
| `prisma/migrations/20260518093000_add_result_execution_run_id/migration.sql` | 추가 | result run 범위 DB 마이그레이션 |
| `VERSION`, `src/lib/version.ts` | 수정 | v1.13.3-20260518 반영 |

## 검증 결과
- `npx prisma generate`: 성공
- `npx tsc -p tsconfig.json --noEmit`: 성공
- `npm run lint`: 성공
- `npm run build`: 성공
- `git diff --check`: 성공 (Windows 줄끝 경고만 표시)
- 서로 다른 AI 모델 검증을 반복 수행했고, queued 취소, started 취소, stale canceled run, 병렬 취소 정산, run 범위 오염 관련 지적 사항을 반영했다.

## 알려진 이슈 / 추후 작업
- 로컬 브라우저에서 보호된 `/app/workbench` 전체 플로우를 재현하려면 `.env`의 `DATABASE_URL`이 Prisma schema와 일치하는 PostgreSQL URL이어야 한다.
- 장시간 provider 호출의 단계 중지 폴링은 현재 750ms 간격이며, 사용량이 커지면 캐시나 이벤트 기반 최적화를 검토할 수 있다.
- Vercel/GitHub 배포 환경에서는 새 Prisma 마이그레이션 2건 적용이 필요하다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.13.3 | 2026-05-18 | 순차검토체인 중지/취소 안정화, 단계별 중지, 결과 상단 고정, run 단위 결과 스코프 추가 |
| v1.12.5 | 2026-05-16 | 이전 버전 |

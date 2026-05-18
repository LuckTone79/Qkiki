# 작업 보고서
## 기본 정보
- **버전**: v1.13.4-20260519
- **작업 일시**: 2026-05-19
- **이전 버전**: v1.13.3-20260518
- **프로젝트명**: Qkiki Workbench

## 작업 요약
production 배포본에서 `Result.executionRunId` 및 `ExecutionRun.stepControlJson` 컬럼이 누락된 상태로 최신 코드가 먼저 배포되어, 새 워크 시작과 기존 세션 상세 로딩이 함께 실패하던 문제를 수정했다.

라이브 DB에는 누락 컬럼과 인덱스를 즉시 반영했고, 코드에는 첫 요청 시 필요한 컬럼을 자동 보정하는 런타임 스키마 가드를 추가해 같은 유형의 배포 불일치가 다시 발생해도 워크벤치 전체가 바로 무너지지 않도록 보강했다.

## 변경 사항
### 추가된 기능
- `Result.executionRunId`와 `ExecutionRun.stepControlJson`을 자동 감지/보정하는 런타임 스키마 가드 추가
- 워크벤치 run/watchdog/session/result 진입 경로에서 스키마 보정 호출 추가

### 수정된 사항
- active run 복구 실패가 세션 전체 로딩 실패처럼 보이지 않도록 워크벤치 클라이언트 복구 UX 수정
- Prisma migration lock provider를 현재 PostgreSQL 스키마와 일치하도록 정정

### 운영 조치
- production DB에 아래 변경을 즉시 반영
  - `ALTER TABLE "ExecutionRun" ADD COLUMN IF NOT EXISTS "stepControlJson" TEXT`
  - `ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "executionRunId" TEXT`
  - `CREATE INDEX IF NOT EXISTS "Result_executionRunId_idx" ON "Result"("executionRunId")`

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| src/lib/workbench-run-schema.ts | 추가 | 런타임 스키마 감지/자동 보정 helper |
| src/lib/execution-runs.ts | 수정 | ExecutionRun 접근 전 stepControl 컬럼 보장 |
| src/lib/workbench-run-watchdog.ts | 수정 | watchdog 시작 전 run/result 스키마 보장 |
| src/lib/ai/workflow.ts | 수정 | Result read/write 전 executionRunId 컬럼 보장 |
| src/app/api/workbench/run/route.ts | 수정 | 새 워크 시작 전 스키마 보장 |
| src/app/api/workbench/runs/[runId]/route.ts | 수정 | run 상태/취소 조회 전 스키마 보장 |
| src/app/api/workbench/runs/[runId]/stream/route.ts | 수정 | stream 재개 전 스키마 보장 |
| src/app/api/sessions/[id]/route.ts | 수정 | 세션 상세 로딩 전 Result 스키마 보장 |
| src/app/api/sessions/[id]/duplicate/route.ts | 수정 | 세션 복제 전 Result 스키마 보장 |
| src/app/api/results/[id]/route.ts | 수정 | 결과 삭제 전 Result 스키마 보장 |
| src/app/api/results/[id]/mark-final/route.ts | 수정 | 최종 선택 전 Result 스키마 보장 |
| src/app/api/results/[id]/rerun/route.ts | 수정 | 결과 재실행 전 Result 스키마 보장 |
| src/components/workbench/WorkbenchClient.tsx | 수정 | active run 복구 실패 시 세션 내용 유지 |
| prisma/migrations/migration_lock.toml | 수정 | provider를 `postgresql`로 정정 |
| VERSION | 수정 | 버전 갱신 |
| src/lib/version.ts | 수정 | UI 버전 표시 갱신 |

## 검증 결과
- `npx prisma generate` 통과
- `npx tsc -p tsconfig.json --noEmit` 통과
- `npm run lint` 통과
- `npm run build` 통과
- production DB에서 누락 컬럼 존재 여부 재확인 완료

## 알려진 이슈 / 추후 작업
- production DB는 `_prisma_migrations` 테이블이 없는 상태라, Prisma migration 이력 기반 배포 체인이 아직 완전히 정상화된 것은 아니다.
- 현재 패치는 서비스 복구와 재발 완화에는 충분하지만, 추후 production DB를 Prisma migration 기준으로 baseline 정리하는 작업이 권장된다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.13.4 | 2026-05-19 | production 스키마 불일치 복구 및 런타임 스키마 가드 추가 |
| v1.13.3 | 2026-05-18 | 순차 실행 취소 안정화 및 step stop 추가 |

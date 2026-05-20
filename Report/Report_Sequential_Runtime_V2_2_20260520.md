# Report: Sequential Runtime V2.2

## 1. 기존 문제 요약
- `WorkflowStep`, `Result`, `ExecutionRun`이 실행 템플릿과 실제 실행 인스턴스 역할을 섞어 가지고 있어 반복 확장, 재시도, 세션 복구, 상태 표시가 서로 충돌했다.
- 순차 체인이 길어질수록 `Result.status`와 stream 이벤트가 실제 실행 상태처럼 취급되며 `completed -> running` 되감김, orphan step, 4단계 이후 고착이 발생했다.
- Prisma migration discipline이 약했고 `DIRECT_URL` 분리가 빠져 있어 production drift와 shadow DB 실패가 누적됐다.

## 2. 근본 원인
- 템플릿 단계와 실행 단계가 분리되지 않았다.
- provider 산출물인 `Result`가 상태 source of truth 역할까지 떠안고 있었다.
- 전체 sequential chain이 한 invocation 또는 legacy durable workflow에 과하게 묶여 Hobby 환경에서 timeout과 reconnect에 취약했다.
- 기존 migration history가 SQLite 스타일 SQL과 누락된 생성 이력을 포함하고 있어 PostgreSQL shadow DB 기준으로 깨졌다.

## 3. 왜 기존 patch들이 실패했는지
- timeout 증가, UI 문구 수정, watchdog 보완만으로는 실행 인스턴스 책임 분리를 해결할 수 없었다.
- `WorkflowStep.create`가 provider 호출 직전에도 일어나던 구조라 반복 스텝과 템플릿 스텝이 계속 섞였다.
- stream hint를 진실원천처럼 사용해 재연결 때 낮은 우선순위 상태가 상위 상태를 덮어쓸 수 있었다.

## 4. V2.2 구조 설명
- `WorkflowStep`: 템플릿 전용.
- `ExecutionRun`: 한 번의 전체 실행과 runner routing, branch metadata 보유.
- `ExecutionRunStep`: 반복 확장 후 실제 실행 단위와 상태 source of truth.
- `Result`: provider 산출물과 결과 카드.
- sequential V2는 run 시작 시 전체 plan을 한 번만 펼쳐 `ExecutionRunStep`으로 저장하고, 실행 중에는 plan을 재계산하지 않는다.

## 5. Hobby plan 기준 왜 QStash를 선택했는지
- Vercel Hobby의 촘촘한 cron/watchdog 의존을 피해야 했기 때문에 step enqueue, delayed retry, watchdog self-schedule을 `QStash` 우선으로 설계했다.
- inline continuation은 남은 함수 예산이 충분한 짧은 step에서만 허용하고, 그 외에는 즉시 queue handoff 한다.

## 6. Supabase DATABASE_URL / DIRECT_URL 분리 여부
- `prisma/schema.prisma` datasource에 `directUrl = env("DIRECT_URL")`를 추가했다.
- `.env.example`에 pooler용 `DATABASE_URL`, direct connection용 `DIRECT_URL`, `APP_BASE_URL`, `QSTASH_*`, `INTERNAL_WORKER_SECRET` 샘플을 추가했다.
- runtime은 여전히 `DATABASE_URL` 우선, legacy `POSTGRES_PRISMA_URL` fallback을 유지할 수 있지만 production prebuild는 `DATABASE_URL`과 `DIRECT_URL` 모두를 요구한다.

## 7. Prisma migration 강제 방식
- `scripts/prebuild-migrate.mjs`를 추가했다.
- production build일 때 `DATABASE_URL`과 `DIRECT_URL`이 모두 없으면 실패하고, 있으면 `prisma migrate deploy`를 강제한다.
- `package.json` build script를 `node scripts/prebuild-migrate.mjs && next build`로 바꿨다.

## 8. 추가/변경된 DB schema
- `ExecutionRun.runnerVersion`
- `ExecutionRun.parentExecutionRunId`
- `ExecutionRun.branchFromOrderIndex`
- `ExecutionRun.branchReason`
- `ExecutionRunStep` 신규 모델
- `WorkbenchSession.executionRunSteps`
- `Result.executionRunStep`
- `ExecutionRun` self-branch relation 추가

## 9. ExecutionRunStep 실행 흐름
- run 시작 API가 template steps를 세션에 저장하고, repeat block을 확장해 `ExecutionRunStep` bulk create 한다.
- internal worker endpoint는 step id를 받아 `UPDATE ... RETURNING` 기반 claim을 수행한다.
- claim 성공한 step만 provider 호출을 만든다.
- 첫 호출 전에 `sourceTextSnapshot`, `promptSnapshot`, `promptHash`를 저장한다.
- 성공 시 `Result`를 생성하고 step을 `completed`로 전이한다.
- 실패 시 `retrying` 또는 `failed/canceled`로 전이한다.

## 10. inline continuation / QStash handoff 기준
- `WORKBENCH_FUNCTION_MAX_MS` 기본 50초.
- 남은 함수 예산이 다음 step 예상시간 + safety margin보다 크고, model/sourceMode가 안전한 경우만 inline continuation.
- `all_results`, `opus`, `sonnet`, retrying step은 queue handoff.

## 11. sourceMode 반복 컨텍스트 정의
- `original`: 항상 `WorkbenchSession.originalInput`.
- `previous`: 현재 step보다 앞선 가장 가까운 completed result. 없으면 parent run fallback, 그래도 없으면 original.
- `selected_result`: 고정 result id만 사용.
- `all_results`: 현재 step보다 앞선 completed result만 포함하고 최근 결과 5개로 제한.
- failed/running/retrying/canceled/skipped 결과 텍스트는 source에 넣지 않는다.

## 12. timeout/retry/error policy
- `src/lib/ai/error-policy.ts` 추가.
- timeout, rate limit, auth, bad request, server error, stale timeout 등을 코드화했다.
- retry 여부는 흩어진 문자열 판단이 아니라 error policy helper를 통한다.
- fallback provider는 V2 sequential 실행에서 `allowFallback: false`로 금지한다.

## 13. watchdog 구현 방식
- `POST /api/internal/workbench/watchdog`
- `QStash` signature 또는 HMAC fallback 검증 후 실행.
- advisory lock으로 중복 watchdog을 막는다.
- stale running `ExecutionRunStep`을 `STEP_STALE_TIMEOUT`으로 실패 처리하고 다음 step enqueue 가능 여부를 본다.
- watchdog은 다시 자기 자신을 QStash로 예약한다.

## 14. cancel 구현 방식
- `DELETE /api/workbench/runs/[runId]`와 `POST /api/workbench/runs/[runId]/cancel` 모두 V2 cancel 경로를 지원한다.
- run 상태를 `canceling`으로 올리고 queued/retrying step을 `canceled`로 바꾼다.
- running step이 남아 있지 않으면 즉시 finalize 한다.

## 15. session reload 안정화
- session API는 builder용 template steps와 결과용 run results를 분리한 채 반환한다.
- 결과 정렬은 `executionOrder ASC` 우선으로 바꿨다.
- `ResultCard`는 `executionRunStep` relation이 있으면 실제 실행 번호, 템플릿 번호, 반복 회차를 표시한다.

## 16. canary rollout 방식
- `src/lib/workbench-runner-version.ts` 추가.
- `WORKBENCH_RUNNER_VERSION=v1|v2|cohort`
- allowlist와 cohort percent 기반으로 사용자별 stable routing 가능.
- parallel run은 기존 v1 유지, sequential run만 v2로 점진 전환 가능.

## 17. rollback 정의
- rollback은 schema rollback이 아니라 신규 run routing을 다시 v1로 보내는 것이다.
- expand-only schema는 남겨 두고, v2 run cancel script는 `scripts/cancel-running-v2-runs.mjs`로 제공했다.

## 18. 테스트 결과
- `npx prisma format`: 성공
- `npx prisma validate`: 성공
- `npx prisma generate`: 성공
- `npx tsc -p tsconfig.json --noEmit`: 성공
- `npm run lint`: 성공
- `npm run build`: 성공
- `git diff --check`: 성공
- `npx prisma migrate dev --name add_execution_run_steps_v2`: 실패
  - 원인: 기존 migration history 자체가 PostgreSQL shadow DB 기준으로 드리프트되어 있음
- `npx prisma migrate status`: 실패
  - 원인: 대상 DB의 `_prisma_migrations`/historical baseline이 현재 migration history와 맞지 않음

## 19. 남은 리스크
- 기존 migration history 드리프트가 커서 `migrate dev`를 완전 복구하려면 baseline 재정리 또는 별도 dev DB 정비가 필요하다.
- step-specific running cancel은 provider abort wiring까지는 아직 연결하지 못했고, 전체 run cancel이 우선 경로다.
- stop condition structured output은 이번 턴에서 runtime 핵심 안정화 우선으로 완성하지 못했다.

## 20. 배포 정보
- 버전: `v1.14.0-20260520`
- build는 로컬에서 성공했다.
- production prebuild migrate 강제 스크립트는 추가했지만 실제 production `migrate deploy`는 이 세션에서 실행하지 않았다.

## 21. 커밋 hash
- 이 보고서 작성 시점 기준 미기입. 최종 커밋 hash는 실제 커밋 후 `git rev-parse HEAD` 기준으로 확인해야 한다.

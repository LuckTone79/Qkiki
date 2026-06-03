# Report v1.14.3

## 기본 정보
- 버전: `v1.14.3-20260603`
- 이전 버전: `v1.14.2-20260520`
- 작업 일시: `2026-06-03`

## 작업 요약
- production에서 sequential run API를 실제 호출해 V2 schema drift를 재현했다.
- `ExecutionRun.runnerVersion` 컬럼과 `ExecutionRunStep` 테이블이 production DB에 없는데도 기존 V2 migration이 applied 처리된 상태임을 확인했다.
- repair migration을 추가하고 production DB에 실제 적용했다.
- `APP_BASE_URL`, `WORKBENCH_RUNNER_VERSION` 같은 env 값에 개행이 섞여도 런타임이 흔들리지 않도록 trim 처리했다.
- production에서 `runnerVersion=v2`로 sequential run을 다시 검증했고, 5-step 및 7-step 반복 시나리오가 `ExecutionRunStep` 기준으로 끝까지 완료되는 것을 확인했다.

## 근본 원인
- `20260520153000_add_execution_run_steps_v2` migration이 production에서 실제 DDL 실행 없이 applied 기록만 남은 상태였다.
- 그 결과 앱 코드는 `ExecutionRun.runnerVersion`과 `ExecutionRunStep`을 기대하지만 DB는 구버전 스키마를 유지하고 있었다.
- production env 입력 과정에서 일부 값에 개행이 들어갈 수 있었고, `APP_BASE_URL`과 runner version parser는 그 영향을 그대로 받을 수 있었다.

## 변경 사항

### 1. Production schema repair migration 추가
- 파일: `prisma/migrations/20260603033000_repair_execution_run_steps_v2_schema/migration.sql`
- 목적:
  - `ExecutionRun.runnerVersion`, `parentExecutionRunId`, `branchFromOrderIndex`, `branchReason` 보정
  - `ExecutionRunStep` 테이블/인덱스/외래키 보정
  - V2 migration이 applied-only 상태인 production DB를 실제 스키마와 일치시키기

### 2. QStash base URL 정규화
- 파일: `src/lib/qstash.ts`
- 변경:
  - `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`를 `trim()` 후 사용
- 효과:
  - env 입력 시 개행/공백이 포함돼도 internal worker URL이 깨지지 않음

### 3. Runner version env 정규화
- 파일: `src/lib/workbench-runner-version.ts`
- 변경:
  - `WORKBENCH_RUNNER_VERSION`, `RUNNER_V2_USER_COHORT_PERCENT`를 `trim()` 후 해석
- 효과:
  - env 추가 방식에 따라 개행이 포함돼도 `v2` 라우팅이 정상 작동

### 4. 버전 갱신
- `VERSION` -> `v1.14.3-20260603`
- `src/lib/version.ts` -> `v1.14.3-20260603`

## Production 적용 내역
- `WORKBENCH_RUNNER_VERSION= v2` 를 production env에 추가
- repair migration을 production DB에 `prisma migrate deploy`로 적용
- local source 기준으로 production 배포 실행 후 alias `https://qkiki.vercel.app`에 반영

## 검증 결과

### 정적 검증
- `npx prisma format` 통과
- `npx prisma validate` 통과
  - production env 주입 상태에서 실행
- `npx prisma generate` 통과
- `npx prisma migrate status` 통과
  - production env 주입 상태에서 `Database schema is up to date!`
- `npx tsc -p tsconfig.json --noEmit` 통과
- `npm run lint` 통과
- `npm run build` 통과
- `git diff --check` 통과

### production 재현 및 복구 검증
- 최초 재현:
  - `POST /api/workbench/run`
  - 오류: `The column ExecutionRun.runnerVersion does not exist in the current database.`
- repair 적용 후:
  - 같은 API가 정상적으로 `queued` 응답 반환

### v2 sequential smoke test
- 시나리오 1:
  - 3개 템플릿 step
  - `2~3` 반복 `2회`
  - 기대 planned step: `5`
  - 결과: `runnerVersion=v2`, `planned=5`, step 1~5가 `queued -> running -> completed`로 완료

- 시나리오 2:
  - 3개 템플릿 step
  - `2~3` 반복 `3회`
  - 기대 planned step: `7`
  - 결과:
    - `planned=7`
    - `orderIndex` 1~7 생성 확인
    - 각 step이 순서대로 완료
    - 최종 상태 `completed`, `done=7`, `failed=0`

## 남은 리스크
- 로컬 `.env`에는 아직 `DIRECT_URL`이 없어서, env를 따로 주입하지 않으면 Prisma CLI 일부 명령이 실패할 수 있다.
- production은 정상화됐지만, 개발자 로컬 온보딩 관점에서는 `.env` 또는 `.env.example` 정리가 추가로 필요하다.

## 변경 파일
- `prisma/migrations/20260603033000_repair_execution_run_steps_v2_schema/migration.sql`
- `src/lib/qstash.ts`
- `src/lib/workbench-runner-version.ts`
- `VERSION`
- `src/lib/version.ts`


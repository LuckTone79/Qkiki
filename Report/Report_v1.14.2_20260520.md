# Report v1.14.2

이번 작업은 sequential runtime V2를 production 기준으로 더 안전하게 운영하기 위한 queue readiness / dispatch hardening 보강이다.

## 추가 보강

- `src/lib/qstash.ts`
  - QStash publish 시 `INTERNAL_WORKER_SECRET` 기반 HMAC 헤더를 함께 붙이도록 보강했다.
  - sequential runner readiness를 중앙에서 판단하는 `getSequentialRunnerReadiness()`를 추가했다.
  - 이제 V2 runner는 `QSTASH_TOKEN`, `APP_BASE_URL`, `INTERNAL_WORKER_SECRET`가 모두 준비되어야 시작된다.

- `src/app/api/workbench/run/route.ts`
  - V2 sequential run 시작 전에 queue/runtime readiness를 먼저 검사한다.
  - 첫 step enqueue 실패 시 usage reservation을 해제하고 run을 `failed`로 정리해 queued 고착을 막는다.

- `src/app/api/workbench/runs/[runId]/steps/[orderIndex]/branch-rerun/route.ts`
  - branch rerun도 readiness를 먼저 확인한다.
  - 첫 step dispatch 실패 시 branch run을 `failed`로 정리한다.

- `src/app/api/results/[id]/rerun/route.ts`
  - V2 sequential rerun branch도 readiness를 먼저 확인한다.
  - 첫 step dispatch 실패 시 rerun branch가 queued에 남지 않도록 fail 처리한다.

## 배포/운영 정리

- Vercel production env에 `DATABASE_URL`, `DIRECT_URL`, `APP_BASE_URL`, `INTERNAL_WORKER_SECRET`를 반영했다.
- production DB는 Prisma baseline이 없어서 `migrate deploy`가 막히던 상태였고, 기존 migration 16개를 `resolve --applied`로 정렬해 `migrate status`가 정상 상태가 되도록 맞췄다.
- 최신 production 배포는 성공했고 alias는 `https://qkiki.vercel.app`로 다시 연결됐다.

## 아직 남은 외부 의존성

- 실제 step queue publish를 위해서는 production에 유효한 `QSTASH_TOKEN`이 여전히 필요하다.
- Upstash 서명키(`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`)는 현재 없어도 HMAC fallback으로 worker 검증이 가능하지만, Upstash 기본 서명까지 같이 쓰려면 별도 설정이 필요하다.

## 검증

- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

모두 통과했다.

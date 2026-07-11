# Qkiki 백엔드 구조 최적화 실행 계획 보고서

> **에이전트 작업자 필수 지침**: 실제 구현을 시작하려면 사용자 승인 후 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 방식으로 단계별 실행한다. 이 문서는 계획 산출물이며, 승인 전에는 리팩토링·코드 변경·스키마 변경·배포를 수행하지 않는다.

**목표:** 현재 확보된 Qkiki의 모든 기능과 설정을 유지한 채 백엔드/프로그램 구조를 정리하고, 페이지 전환과 버튼 실행 응답이 느린 근본 원인을 단계적으로 제거한다.

**설계 방향:** 현재 Next.js App Router + Prisma + Vercel/serverless 구조는 유지한다. 대신 서버/클라이언트/공유 도메인 경계를 명확히 하고, 먼저 체감 속도 병목을 수치로 줄인 뒤, 후반부에서 러너 단일화와 대형 모듈 분해로 향후 기능 추가 비용을 낮춘다.

**기술 스택:** Next.js 16.2.3, React 19.2.4, TypeScript 5, Prisma 6.19/PostgreSQL, Vercel/serverless, `workflow` 4.2.4, Upstash QStash, Zod 4.

---

## 0. 승인 전 작업 제한

이 보고서는 **계획 보고서**다. 이번 작업에서는 실제 리팩토링, 앱 동작 변경, DB 스키마 변경, 버전 증가, 배포를 하지 않는다.

구현은 사용자가 아래와 같이 명시적으로 승인한 뒤 시작한다.

- `Phase 0부터 진행해`
- `Phase 0~1 승인`
- `전체 계획대로 진행 승인`
- `이 보고서 기준으로 리팩토링 시작`

승인 후에도 Phase 0을 건너뛰지 않는다. 현재 문제는 성능 문제이므로, 개선 전 기준선을 수치로 확보하지 않으면 이후 변경의 효과와 부작용을 증명할 수 없다.

## 1. 작성 근거

### 1.1 사전검증 보고서

사용자가 제공한 사전검증 보고서를 원격 브랜치에서 확인했다.

- 원격 브랜치: `origin/claude/backend-refactor-plan-ub5vn2`
- 파일: `docs/BACKEND_OPTIMIZATION_PLAN_2026-06-19.md`
- 사용자 제공 커밋: `e325a58`

사전검증 보고서는 다음 핵심 진단을 올바르게 짚고 있다.

- Qkiki는 일반 챗봇이 아니라 결과 카드 중심의 멀티 AI 오케스트레이션 워크벤치다.
- V1 `workflow` 러너와 V2 QStash 스텝 러너가 공존한다.
- 실행 핫패스에 런타임 스키마 보정 코드가 남아 있다.
- 일부 목록 페이지가 Server Component 초기 로딩이 아니라 client `useEffect` fetch에 의존한다.
- `AppShell` 내비게이션에서 `prefetch={false}`가 광범위하게 적용되어 있다.
- `WorkbenchClient.tsx`와 실행/사용량 모듈이 크고 책임이 많다.

이 Codex 보고서는 위 진단을 바탕으로 하되, 2026-06-19 현재 로컬 작업트리에서 다시 확인한 수치와 Next.js 16.2.3 로컬 문서 기준으로 실행 순서를 재정리했다.

### 1.2 현재 로컬 코드 기준 확인 결과

| 항목 | 현재 확인값 |
| --- | --- |
| 프레임워크 | `package.json`: `next` 16.2.3, `react`/`react-dom` 19.2.4 |
| API Route Handler | `src/app/api/**/route.ts` 64개 |
| `src/lib` 직접 파일 | 89개 |
| `src/lib/**/*.test.mjs` | 32개 |
| Prisma 모델 | `prisma/schema.prisma`의 `model` 35개 |
| 대형 클라이언트 컴포넌트 | `src/components/workbench/WorkbenchClient.tsx` 5,456줄 |
| 대형 실행 모듈 | `src/lib/ai/workflow.ts` 1,792줄, `src/lib/execution-run-steps.ts` 1,708줄 |
| 사용량 정책 모듈 | `src/lib/usage-policy.ts` 959줄 |
| Prisma schema | 771줄 |
| 앱 버전 | `VERSION`, `src/lib/version.ts`: `v1.31.2-20260619` |

현재 작업트리에는 사용자 또는 이전 작업으로 보이는 미커밋 변경이 많다. 향후 구현 시에는 승인된 Phase에서 수정한 파일만 stage/commit하고, 기존 미커밋 변경은 되돌리거나 함께 커밋하지 않는다.

### 1.3 Next.js 16 로컬 문서 기준

프로젝트 `AGENTS.md`는 현재 Next.js가 기존 지식과 다를 수 있으므로 `node_modules/next/dist/docs/`를 확인하라고 지시한다. 다음 문서를 확인했다.

- `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`

계획에 반영할 핵심 원칙은 다음과 같다.

- Server Component는 Route Handler를 거치지 말고 데이터 원천(DB/server module)을 직접 조회해야 한다. Server Component에서 내부 API를 fetch하면 추가 HTTP 왕복이 생긴다.
- Route Handler는 공개 HTTP 엔드포인트이므로 내부에서 인증/인가를 반드시 재검증해야 한다. `proxy.ts`는 단독 보안 경계가 아니다.
- 빠른 App Router 내비게이션은 prefetch, `loading.tsx`, 로컬 Suspense boundary, blocking data 위치에 좌우된다.
- 현재 `next.config.ts`에는 `cacheComponents: true`가 없다. 따라서 초반 Phase에서 Next Cache Components 전체 전환을 시도하지 않는다. 먼저 낮은 리스크의 RSC 초기 데이터, request-level cache, `loading.tsx`, prefetch 복구부터 적용한다.

## 2. 프로그램 목적과 백엔드 중심축

Qkiki의 핵심은 하나의 입력을 여러 AI 모델과 워크플로 단계에 태우고, 그 결과를 카드 형태로 저장·비교·분기·공유하는 것이다.

핵심 흐름:

1. 사용자가 과제를 입력한다.
2. 병렬 비교 또는 순차 검토 체인으로 AI 모델을 실행한다.
3. 각 provider/model 출력은 `Result`로 영속화된다.
4. `Result`는 branch, critique, improve, rerun, final 선택의 부모 소스가 된다.
5. `WorkbenchSession`은 프로젝트와 프리셋을 통해 반복 사용된다.
6. 실행은 크레딧/구독/쿠폰/트라이얼 정책의 사용량 게이트를 통과해야 한다.

따라서 백엔드의 핵심 축은 네 가지다.

| 축 | 현재 주요 파일 |
| --- | --- |
| 인증/소유권 | `src/lib/auth.ts`, `src/lib/api-auth.ts`, `src/lib/admin-auth.ts`, `proxy.ts`, `src/app/api/auth/**` |
| AI 실행 | `src/app/api/workbench/run/route.ts`, `src/workflows/workbench-run.ts`, `src/lib/ai/workflow.ts`, `src/lib/execution-run-steps.ts`, `src/lib/qstash.ts` |
| 결과 그래프 | `src/app/api/results/**`, `src/lib/workbench-results.ts`, `src/lib/workbench-result-read.ts`, `prisma.schema`의 `Result` 관련 모델 |
| 사용량/정산 | `src/lib/usage-policy.ts`, `src/lib/credits.ts`, `src/lib/subscription.ts`, `src/app/api/usage`, `src/app/api/subscription`, `src/app/api/coupons` |

최적화는 이 네 축을 보존하면서 요청 왕복, 중복 조회, 핫패스 레거시 작업, 거대 모듈 결합을 줄이는 방식으로 진행한다.

## 3. 현재 구조 문제

### S1. 실행 러너가 두 벌이다

현재 증거:

- `next.config.ts`가 `withWorkflow(nextConfig)`를 사용한다.
- `src/app/api/workbench/run/route.ts`가 `workflow/api`의 `start`와 QStash enqueue helper를 모두 import한다.
- `src/lib/workbench-runner-version.ts`는 기본값을 `v1`로 두고, 순차 실행에서만 allowlist/cohort 기반으로 V2를 선택한다.
- V1은 `src/workflows/workbench-run.ts`와 `src/lib/ai/workflow.ts`를 사용한다.
- V2는 `src/lib/execution-run-steps.ts`, `src/lib/qstash.ts`, `src/app/api/internal/workbench/**`를 사용한다.

영향:

- 실행 기능을 추가하거나 수정할 때 V1/V2 양쪽에 반영해야 할 수 있다.
- 한쪽 러너만 고쳐지는 회귀가 생기기 쉽다.
- 성능 측정도 러너별로 병목이 달라져 원인 분리가 어려워진다.

### S2. `src/lib`가 너무 평탄하다

현재 증거:

- `src/lib` 직접 파일 89개.
- 서버 전용 모듈인 `usage-policy.ts`, `subscription.ts`, `execution-run-steps.ts`가 브라우저 helper인 `browser-storage.ts`, `browser-clipboard.ts`, `local-cache.ts`, `workbench-result-scroll.ts`와 같은 레벨에 있다.

영향:

- 서버/클라이언트 경계가 import 경로로 강제되지 않는다.
- 잘못된 import로 클라이언트 번들에 서버 의도 코드가 섞일 위험이 있다.
- 신규 기능 작업자가 어느 모듈에 추가해야 하는지 판단하기 어렵다.

### S3. 워크벤치가 거대한 단일 client island다

현재 증거:

- `src/components/workbench/WorkbenchClient.tsx` 5,456줄.
- 마운트 시 fetch, 실행 시작, 스트림 읽기, 결과 reconciliation, 첨부, 프리셋, 공유, 결과 상태, 크레딧 표시, 폼 상태를 한 컴포넌트가 넓게 들고 있다.

영향:

- 초기 JS 다운로드/파싱/하이드레이션 부담이 크다.
- 스트림 진행률처럼 자주 바뀌는 상태가 넓은 UI 리렌더로 번질 수 있다.
- 기능 보존 상태에서 수정하기 어렵다.

### S4. 런타임 스키마 보정이 핫패스에 남아 있다

현재 증거:

- `src/lib/workbench-run-schema.ts` 주석에 deprecated runtime schema repair helper라고 명시되어 있다.
- 내부에서 `information_schema.columns`, `pg_indexes`를 조회하고 `ALTER TABLE`, `CREATE INDEX IF NOT EXISTS`를 실행할 수 있다.
- `src/app/api/workbench/run/route.ts`, `runs/[runId]/route.ts`, `runs/[runId]/stream/route.ts`에서 호출된다.

영향:

- 서버리스 콜드 인스턴스가 사용자 실행 요청 중 스키마 확인 비용을 낸다.
- 마이그레이션이 책임져야 할 일을 런타임 요청이 떠안는다.
- stream/status 요청에도 레거시 보정 경로가 붙어 있다.

### S5. 목록 페이지가 client fetch waterfall을 만든다

현재 증거:

- `src/app/app/sessions/page.tsx`: `<SessionsClient />`만 반환.
- `src/app/app/projects/page.tsx`: `<ProjectsClient />`만 반환.
- `src/app/app/presets/page.tsx`: `<PresetsClient />`만 반환.
- 각 client는 `useEffect()`에서 `loadSessions()`, `loadProjects()`, `loadPresets()`를 호출한다.

영향:

- 라우트 이동 후 빈 껍데기 렌더링 → JS hydration → API fetch → 데이터 표시 순서가 된다.
- `src/app/app/layout.tsx`가 이미 서버에서 사용자와 사이드바 데이터를 조회하는데, 페이지 데이터는 다시 API를 돈다.

### S6. 인증 조회가 요청 단위로 dedupe되지 않는다

현재 `src/lib/auth.ts` 구조:

```ts
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = readCookieValue(cookieStore, SESSION_COOKIE_CANDIDATES);
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  ...
}
```

영향:

- 보호 layout, 페이지, API가 각자 세션 DB 조회를 수행한다.
- React `cache()` 기반 request-level dedupe가 없다.

### S7. 실행 버튼 클릭 뒤 queue까지 가는 사전 작업이 길다

`src/app/api/workbench/run/route.ts`는 실행 큐잉 전에 대략 다음 순서를 거친다.

1. `ensureWorkbenchRunSchema()`
2. `closeStaleWorkbenchRuns({ userId })`
3. `estimateWorkbenchRunCredits(...)`
4. `requireUsageAccess(...)`
5. `upsertWorkbenchSession(...)`
6. `reserveUsage(...)`
7. V1/V2별 transaction과 enqueue/start

영향:

- 사용자는 이 전체 직렬 작업을 버튼 클릭 지연으로 느낀다.
- 일부 작업은 실행 요청을 받기 전 반드시 필요하지만, 일부는 watchdog 또는 build/migration 단계로 옮길 수 있다.

### S8. 실행 진행 전달은 push가 아니라 DB polling stream에 가깝다

현재 증거:

- `stream/route.ts`가 `ReadableStream`을 생성한다.
- loop 내부에서 `getExecutionRunStatusSnapshot(...)`을 호출한다.
- 1초마다 `wait(1_000)` 한다.
- 10초마다 `rescueStalledExecutionRunV2(...)`를 호출한다.
- 클라이언트는 `startIndex`와 backoff로 재연결한다.

영향:

- 실행 중인 사용자가 많아질수록 DB snapshot polling 압력이 누적된다.
- 진행 표시가 polling interval만큼 늦을 수 있다.
- 스트림 진입 시 인증/스키마/정리 비용도 붙는다.

### S9. 사용량/크레딧 조회가 중복된다

현재 증거:

- `requireUsageAccess()`가 `getOrCreateUsageRecord()` → `countPendingReservedRequests()` → `getCreditUsageSnapshot()`을 순서대로 호출한다.
- `getCreditUsageSnapshot()` 내부에서도 여러 aggregate를 `Promise.all`로 수행한다.
- `reserveUsage()`는 정확성을 위해 serializable transaction 내부에서 pending 예약을 다시 aggregate한다.

영향:

- 예약 transaction 내부의 재조회는 필요하지만, 그 전 표시/사전 게이트 용도 조회는 합칠 여지가 있다.
- 실행 버튼 클릭 후 큐잉 전 비용이 커진다.

## 4. 응답 지연 근본 원인 매핑

| 원인 | 증상 | 현재 증거 | 해결 Phase |
| --- | --- | --- | --- |
| R1. 내비게이션 prefetch 비활성 | 페이지 전환 지연 | `AppShell.tsx`의 main nav, recent sessions, projects, mobile nav에 `prefetch={false}` | Phase 1 |
| R2. client fetch waterfall | 페이지 전환 후 데이터 표시 지연 | sessions/projects/presets 페이지가 client wrapper이고 `useEffect`에서 fetch | Phase 2 |
| R3. 인증 DB 조회 반복 | 페이지/API 공통 지연 | `getCurrentUser()`가 request cache 없이 Prisma 조회 | Phase 2 |
| R4. 런타임 스키마/오래된 run 정리 | 실행/status/stream 지연 | run/status/stream에서 `ensureWorkbenchRunSchema()`, `closeStaleWorkbenchRuns()` | Phase 3 |
| R5. 거대한 Workbench client island | 워크벤치 진입·입력·실행 중 반응성 저하 | `WorkbenchClient.tsx` 5,456줄 | Phase 5 |
| R6. DB polling stream | 실행 중 진행 표시 지연·DB 부하 | stream route가 1초마다 status snapshot 조회 | Phase 4, Phase 6 |
| R7. usage/credit 중복 조회 | 실행 버튼 사전 지연 | `requireUsageAccess()`와 `reserveUsage()`의 aggregate 경로 | Phase 4 |
| R8. 러너 이중화 | 유지보수·성능 원인 분리 비용 | V1 workflow + V2 QStash 공존 | Phase 6 |

빠른 효과를 내는 순서는 다음이다.

1. 측정 기준선 확보.
2. prefetch와 loading UI 복구.
3. 목록 초기 데이터를 Server Component로 이동.
4. 인증 request cache 적용.
5. 실행 핫패스에서 런타임 스키마 보정 제거.
6. 사용량/stream 조회 비용 축소.
7. Workbench client 분해.
8. 러너 단일화와 구조 재배치.

## 5. 목표 구조

### 5.1 권장 디렉토리 경계

최종 목표는 아래와 같은 경계다.

```text
src/
  server/
    auth/
    usage/
    billing/
    workbench/
      runner/
      results/
      sessions/
    admin/
    db/
  shared/
    validation/
    ai/
    credits/
    i18n/
  client/
    browser/
    workbench/
      hooks/
      state/
  components/
  app/
```

한 번에 이동하지 않는다. 기존 import 호환을 위해 임시 barrel을 둔다.

```ts
// src/lib/usage-policy.ts, 임시 호환 계층
export * from "@/server/usage/policy";
```

규칙:

- `src/server/**`는 `import "server-only"`를 붙인다.
- `src/client/**`는 Prisma, QStash, provider SDK, server auth를 import하지 않는다.
- `src/shared/**`는 순수 계산, 검증 schema, 상수, 표시용 metadata만 둔다.
- Server Component는 Route Handler를 fetch하지 않고 server module을 직접 호출한다.
- Client Component는 mutation/live data에 한해 Route Handler 또는 Server Action을 호출한다.

### 5.2 데이터 로딩 모델

| 데이터 유형 | 권장 패턴 |
| --- | --- |
| 인증된 페이지 첫 렌더 데이터 | Server Component에서 Prisma/server module 직접 조회 |
| 클라이언트 UI mutation | Route Handler 또는 Server Action, 내부 권한 재검증 |
| 실행 진행 상태 | stream/status endpoint 유지 후 polling 비용 축소 |
| 안정적인 공유 설정 | server module + request/global cache, 정확성 검토 후 적용 |
| 크레딧 예약/차감 | stale cache 금지, 신선한 transaction 유지 |

### 5.3 러너 목표

단기:

- V1/V2를 유지한 채 latency, 실패율, rescue 횟수, provider error 분류를 러너별로 측정한다.

중장기:

- 하나의 canonical runner를 결정한다.
- 선택한 runner를 100% cohort로 충분히 운영한다.
- rollback 조건을 충족한 뒤 미사용 runner와 의존성을 제거한다.

권장 방향:

- V2 QStash 러너가 step record, retry, watchdog, resumability를 이미 갖고 있으므로 장기 후보로 적합하다.
- 단, 병렬 실행과 모든 edge case parity가 입증되기 전까지 V1을 삭제하지 않는다.

## 6. 단계별 실행 계획

### Phase 0. 기준선 측정과 안전망

**목표:** 동작 변경 없이 성능 기준선과 회귀 방지 장치를 만든다.

**수정/생성 파일:**

- 생성: `src/server/perf/server-timing.ts`
- 생성: `src/server/perf/query-counter.ts`
- 생성: `src/app/app/WebVitalsReporter.tsx`
- 수정: `src/app/app/layout.tsx`
- 수정: `src/app/api/workbench/run/route.ts`
- 수정: `src/app/api/workbench/runs/[runId]/route.ts`
- 수정: `src/app/api/workbench/runs/[runId]/stream/route.ts`
- 수정: `src/app/api/usage/route.ts`
- 수정: `src/app/api/sessions/route.ts`
- 수정: `src/app/api/projects/route.ts`
- 수정: `src/app/api/presets/route.ts`
- 생성: `tests/e2e/workbench-smoke.spec.ts`
- 생성 또는 수정: `playwright.config.ts`
- 생성: `docs/perf/BASELINE_2026-06-19.md`

**실행 절차:**

- [ ] 1. `PERF_TRACE=1`일 때만 동작하는 `Server-Timing` helper를 만든다.

```ts
import "server-only";

type TimingEntry = {
  name: string;
  dur: number;
  desc?: string;
};

export function isPerfTraceEnabled() {
  return process.env.PERF_TRACE === "1";
}

export async function measureTiming<T>(
  entries: TimingEntry[],
  name: string,
  fn: () => Promise<T>,
  desc?: string,
) {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    entries.push({
      name,
      dur: Math.round((performance.now() - start) * 10) / 10,
      desc,
    });
  }
}

export function buildServerTiming(entries: TimingEntry[]) {
  return entries
    .map((entry) => {
      const desc = entry.desc ? `;desc="${entry.desc.replaceAll('"', "'")}"` : "";
      return `${entry.name};dur=${entry.dur}${desc}`;
    })
    .join(", ");
}
```

- [ ] 2. hot API에 timing을 붙인다.

적용 대상:

- `/api/workbench/run`
- `/api/workbench/runs/[runId]`
- `/api/workbench/runs/[runId]/stream`
- `/api/usage`
- `/api/sessions`
- `/api/projects`
- `/api/presets`

패턴:

```ts
const timings: TimingEntry[] = [];
const user = await measureTiming(timings, "auth", () => requireApiUser());
const payload = await measureTiming(timings, "main", () => runExistingLogic(user));
const response = NextResponse.json(payload);
if (isPerfTraceEnabled()) {
  response.headers.set("Server-Timing", buildServerTiming(timings));
}
return response;
```

- [ ] 3. Web Vitals reporter를 인증 앱 영역에 추가한다.

```tsx
"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      console.info("[web-vitals]", metric.name, metric.value, metric.id);
    }
  });
  return null;
}
```

- [ ] 4. Playwright smoke test를 만든다.

필수 시나리오:

1. 테스트 사용자로 로그인한다.
2. `/app/workbench`를 연다.
3. 워크벤치 입력 UI가 보이는지 확인한다.
4. `/app/sessions`, `/app/projects`, `/app/presets`로 이동한다.
5. 다시 `/app/workbench`로 돌아온다.

provider key가 없는 로컬 환경에서는 실제 모델 호출을 강제하지 않는다. 현재 코드에 안전한 mock provider mode가 없다면, 구현 승인 후 별도 test mode flag를 추가한다.

- [ ] 5. 기준선을 기록한다.

```powershell
$env:PERF_TRACE='1'
npm run build
npm run lint
npx playwright test tests/e2e/workbench-smoke.spec.ts
```

`docs/perf/BASELINE_2026-06-19.md`에 기록할 항목:

- `next build` route summary
- workbench route first-load JS
- workbench/sessions/projects/presets 전환 시간
- `/api/workbench/run`, `/api/workbench/runs/[id]`, `/api/workbench/runs/[id]/stream`, `/api/usage`의 `Server-Timing`
- 가능하면 DB query count와 상위 slow query

**수용 기준:**

- 기준선 문서가 생성된다.
- instrumentation은 `PERF_TRACE=1`일 때만 켜진다.
- smoke test가 통과하거나, 통과하지 못한 외부 의존성이 정확히 문서화된다.
- 사용자에게 보이는 동작은 바뀌지 않는다.

**롤백:**

- `PERF_TRACE`를 끈다.
- instrumentation이 예상치 못한 부담을 만들면 Phase 0 커밋만 revert한다.

### Phase 1. 페이지 전환 즉효 개선

**목표:** 주요 앱 내비게이션의 클릭 후 체감 지연을 줄인다.

**수정/생성 파일:**

- 수정: `src/components/AppShell.tsx`
- 생성: `src/app/app/loading.tsx`
- 생성: `src/app/app/sessions/loading.tsx`
- 생성: `src/app/app/projects/loading.tsx`
- 생성: `src/app/app/projects/[id]/loading.tsx`
- 생성: `src/app/app/presets/loading.tsx`
- 생성: `src/app/app/workbench/loading.tsx`

**실행 절차:**

- [ ] 1. primary nav의 무조건 `prefetch={false}`를 제거한다.

대상:

- `/app/workbench`
- `/app/sessions`
- `/app/projects`
- `/app/presets`
- `/app/account`

변경 패턴:

```tsx
<Link
  href={item.href}
  onClick={item.key === "workbench" ? requestNewWorkbench : undefined}
  className="..."
>
  ...
</Link>
```

- [ ] 2. 동적 링크는 hover/focus prefetch로 제한한다.

최근 세션과 프로젝트 목록처럼 링크 수가 늘 수 있는 영역에는 page load 시점 mass prefetch를 걸지 않는다.

```tsx
const router = useRouter();

function prefetchHref(href: string) {
  router.prefetch(href);
}

<Link
  href={`/app/workbench?session=${session.id}`}
  onMouseEnter={() => prefetchHref(`/app/workbench?session=${session.id}`)}
  onFocus={() => prefetchHref(`/app/workbench?session=${session.id}`)}
  className="..."
>
  ...
</Link>
```

- [ ] 3. route별 `loading.tsx`를 추가한다.

예시:

```tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
      <div className="h-24 animate-pulse rounded-md bg-stone-100" />
      <div className="h-24 animate-pulse rounded-md bg-stone-100" />
    </div>
  );
}
```

- [ ] 4. 측정한다.

```powershell
npm run lint
npm run build
npx playwright test tests/e2e/workbench-smoke.spec.ts
```

`docs/perf/PHASE_1_NAVIGATION_2026-06-19.md`에 전환 전/후 수치를 기록한다.

**수용 기준:**

- primary app navigation이 더 이상 전역적으로 prefetch를 끄지 않는다.
- 동적 side list는 hover/focus 기반으로 선요청한다.
- 앱 route에 즉시 표시되는 loading state가 있다.
- auth redirect, canonical host redirect 동작은 그대로다.

**롤백:**

- Phase 1 커밋만 revert한다.
- 서버 요청량이 늘면 primary route prefetch는 유지하고 동적 side list prefetch부터 제거한다.

### Phase 2. 목록 초기 데이터 RSC화와 인증 dedupe

**목표:** sessions/projects/presets의 client fetch waterfall을 제거하고, 인증 DB 조회 중복을 줄인다.

**수정/생성 파일:**

- 수정: `src/lib/auth.ts`
- 생성: `src/server/app-data/sessions.ts`
- 생성: `src/server/app-data/projects.ts`
- 생성: `src/server/app-data/presets.ts`
- 수정: `src/app/app/sessions/page.tsx`
- 수정: `src/app/app/projects/page.tsx`
- 수정: `src/app/app/presets/page.tsx`
- 수정: `src/components/sessions/SessionsClient.tsx`
- 수정: `src/components/projects/ProjectsClient.tsx`
- 수정: `src/components/presets/PresetsClient.tsx`

**실행 절차:**

- [ ] 1. `getCurrentUser()`를 request-level `cache()`로 감싼다.

```ts
import { cache } from "react";

async function getCurrentUserUncached(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = readCookieValue(cookieStore, SESSION_COOKIE_CANDIDATES);
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  ...
}

export const getCurrentUser = cache(getCurrentUserUncached);
```

주의:

- cross-request cache를 만들지 않는다.
- suspended/expired session 처리와 redirect 동작은 그대로 둔다.

- [ ] 2. 현재 API와 같은 select shape의 server data function을 만든다.

예시:

```ts
import "server-only";
import { prisma } from "@/lib/prisma";

export async function listSessionsForUser(userId: string) {
  return prisma.workbenchSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      originalInput: true,
      mode: true,
      finalResultId: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  });
}
```

- [ ] 3. 목록 page를 async Server Component로 바꾼다.

```tsx
import { SessionsClient } from "@/components/sessions/SessionsClient";
import { requireUser } from "@/lib/auth";
import { listSessionsForUser } from "@/server/app-data/sessions";

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await listSessionsForUser(user.id);
  return <SessionsClient initialSessions={sessions} initialLoaded />;
}
```

- [ ] 4. Client는 `initialData`가 있으면 첫 mount fetch를 생략한다.

```tsx
type SessionsClientProps = {
  initialSessions: SessionListItem[];
  initialLoaded: boolean;
};

export function SessionsClient({
  initialSessions,
  initialLoaded,
}: SessionsClientProps) {
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    if (initialLoaded) return;
    void loadSessions();
  }, [initialLoaded]);
  ...
}
```

빈 목록도 정상 상태이므로 배열 길이로 `initialLoaded`를 추론하지 않는다.

- [ ] 5. 기존 API는 유지한다.

`/api/sessions`, `/api/projects`, `/api/presets`는 삭제하지 않는다. mutation, refresh, client-side 재검증에 계속 필요하다.

- [ ] 6. 검증한다.

```powershell
npm run lint
npm run build
npx playwright test tests/e2e/workbench-smoke.spec.ts
node --test src/lib/auth-handoff.test.mjs src/lib/canonical-host.test.mjs
```

**수용 기준:**

- sessions/projects/presets가 첫 렌더에서 데이터와 함께 표시된다.
- 초기 데이터가 주입된 경우 mount 직후 동일 목록 API를 다시 부르지 않는다.
- API mutation/refresh 기능은 유지된다.
- 인증 redirect와 suspended user 처리 동작은 그대로다.

**롤백:**

- 페이지 단위 커밋으로 나누어 변환한다.
- 문제가 생긴 페이지 하나만 thin client wrapper로 되돌린다.

### Phase 3. 실행 핫패스에서 런타임 스키마 보정 제거

**목표:** run/status/stream 요청 중 schema inspection/DDL을 제거하고, 스키마 보장은 build/migration 단계로 옮긴다.

**수정/생성 파일:**

- 생성: `scripts/assert-workbench-run-schema.mjs`
- 수정: `scripts/prebuild-migrate.mjs`
- 수정: `src/app/api/workbench/run/route.ts`
- 수정: `src/app/api/workbench/runs/[runId]/route.ts`
- 수정: `src/app/api/workbench/runs/[runId]/stream/route.ts`
- 수정: `src/lib/workbench-run-schema.ts`
- 수정: `src/lib/workbench-run-watchdog.ts`

**실행 절차:**

- [ ] 1. required schema assertion script를 추가한다.

검사 대상:

- `ExecutionRun.stepControlJson`
- `Result.executionRunId`
- `Result.executionOrder`
- `Result_executionRunId_idx`
- `Result_executionRunId_executionOrder_key`
- `ExecutionRunStep` table과 V2 관련 index

예시:

```js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const checks = [
  ["ExecutionRun", "stepControlJson"],
  ["Result", "executionRunId"],
  ["Result", "executionOrder"],
];

for (const [tableName, columnName] of checks) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
      AND table_name = $1
      AND column_name = $2
    ) AS "exists"`,
    tableName,
    columnName,
  );
  if (rows[0]?.exists !== true) {
    console.error(`[schema] missing ${tableName}.${columnName}`);
    process.exitCode = 1;
  }
}

await prisma.$disconnect();
```

- [ ] 2. production prebuild에서 migration 후 assertion을 실행한다.

```js
execSync("npx prisma migrate deploy", { stdio: "inherit" });
execSync("node scripts/assert-workbench-run-schema.mjs", { stdio: "inherit" });
```

- [ ] 3. 삭제 전 emergency flag를 둔다.

```text
LEGACY_WORKBENCH_SCHEMA_REPAIR=1
```

패턴:

```ts
if (process.env.LEGACY_WORKBENCH_SCHEMA_REPAIR === "1") {
  await ensureWorkbenchRunSchema();
}
```

- [ ] 4. 기본 hot path에서 호출을 제거한다.

정상 운영에서 아래 route는 `ensureWorkbenchRunSchema()`를 실행하지 않아야 한다.

- `src/app/api/workbench/run/route.ts`
- `src/app/api/workbench/runs/[runId]/route.ts`
- `src/app/api/workbench/runs/[runId]/stream/route.ts`

- [ ] 5. stale run 정리를 요청별 hot path에서 뺀다.

원칙:

- `closeStaleWorkbenchRuns({ userId })`를 모든 실행 시작 전에 호출하지 않는다.
- broad cleanup은 watchdog/maintenance path로 이동한다.
- 사용자 resume에 필요한 좁은 복구만 별도 경량 경로로 유지한다.

- [ ] 6. 검증한다.

```powershell
npm run lint
npm run build
node scripts/assert-workbench-run-schema.mjs
npx playwright test tests/e2e/workbench-smoke.spec.ts
```

`Server-Timing`에서 schema repair 구간이 사라졌는지 확인한다.

**수용 기준:**

- 스키마가 부족하면 production build/migration 단계에서 실패한다.
- 사용자 요청 중 schema inspection/DDL이 기본 실행되지 않는다.
- emergency flag로 legacy repair를 임시 복구할 수 있다.
- run/status/stream 기능이 유지된다.

**롤백:**

- `LEGACY_WORKBENCH_SCHEMA_REPAIR=1`을 설정한다.
- 필요하면 Phase 3 커밋만 revert한다.

### Phase 4. usage/credit 조회와 stream polling 비용 축소

**목표:** 실행 버튼 클릭 후 큐잉 전 비용과 실행 중 DB polling 비용을 줄인다.

**수정/생성 파일:**

- 수정: `src/lib/usage-policy.ts`
- 필요 시 수정: `src/lib/credits.ts`
- 수정: `src/app/api/usage/route.ts`
- 수정: `src/app/api/workbench/run/route.ts`
- 수정: `src/app/api/workbench/runs/[runId]/stream/route.ts`
- 수정: `src/lib/execution-runs.ts`
- 추가 또는 수정: `src/lib/usage-policy.test.mjs`
- 기존 확인: `src/lib/credits.test.mjs`

**실행 절차:**

- [ ] 1. usage access snapshot을 하나로 합친다.

목표 형태:

```ts
type UsageAccessSnapshot = {
  usage: UsageLimit;
  pendingReservedRequests: number;
  credit: CreditUsageSnapshot;
};

async function getUsageAccessSnapshot(input: {
  userId: string;
  policy: ResolvedUsagePolicy;
  userSubscription: UserSubscription | null;
}): Promise<UsageAccessSnapshot> {
  const usage = await getOrCreateUsageRecord(input.userId, input.policy);
  const [pendingRequests, credit] = await Promise.all([
    countPendingReservedRequests({ usageLimitId: usage.id }),
    getCreditUsageSnapshot({
      userId: input.userId,
      usageLimitId: usage.id,
      userSubscription: input.userSubscription,
    }),
  ]);

  return {
    usage,
    pendingReservedRequests: pendingRequests._sum.reservedRequestCount ?? 0,
    credit,
  };
}
```

- [ ] 2. reservation 정확성은 유지한다.

`reserveUsage()` 내부 serializable transaction의 fresh aggregate는 제거하지 않는다. 사용량/크레딧 정산 정확성이 성능보다 우선이다.

- [ ] 3. 표시용 usage에는 짧은 private cache만 검토한다.

허용:

- `/api/usage` 표시용 summary에 `Cache-Control: private, max-age=10`
- 한 요청 안의 `cache()` dedupe

금지:

- 예약/차감 판단에 stale cache 사용
- 사용자 간 공유 cache

- [ ] 4. stream snapshot을 가볍게 분리한다.

현재 stream은 1초마다 full snapshot 성격의 조회를 한다. 다음처럼 분리한다.

- in-progress loop: status cursor와 변경 여부만 확인
- 변경 감지 시: 새 result/status만 fetch
- terminal status 도달 시: full result snapshot fetch

이 Phase에서는 NDJSON 응답 포맷을 유지한다. 포맷 변경은 `WorkbenchClient` 변경 폭이 크므로 별도 승인 없이 섞지 않는다.

- [ ] 5. 검증한다.

```powershell
npm run lint
npm run build
node --test src/lib/credits.test.mjs
node --test src/lib/provider-concurrency.test.mjs
npx playwright test tests/e2e/workbench-smoke.spec.ts
```

비교 항목:

- `/api/workbench/run`의 runId 반환 전 시간
- `/api/usage` 시간
- V2 실행 중 stream endpoint의 분당 query count

**수용 기준:**

- credit/usage limit 동작이 동일하다.
- 예약/차감 테스트가 통과한다.
- run kickoff 사전 구간 시간이 줄거나 query count가 줄었다.
- stream loop의 tick당 DB 작업량이 줄었다.

**롤백:**

- usage snapshot consolidation과 stream snapshot 최적화를 별도 커밋으로 나누고 각각 revert한다.

### Phase 5. `WorkbenchClient` 분해

**목표:** UI 재설계 없이 초기 JS/hydration 부담과 고빈도 리렌더 범위를 줄인다.

**수정/생성 파일:**

- 생성: `src/client/workbench/hooks/useWorkbenchRun.ts`
- 생성: `src/client/workbench/hooks/useRunStream.ts`
- 생성: `src/client/workbench/hooks/useWorkbenchAttachments.ts`
- 생성: `src/client/workbench/hooks/useWorkbenchPresets.ts`
- 생성: `src/client/workbench/hooks/useWorkbenchUsage.ts`
- 생성: `src/client/workbench/state/workbench-reducer.ts`
- 생성: `src/components/workbench/WorkbenchInputPanel.tsx`
- 생성: `src/components/workbench/WorkbenchProgressPanel.tsx`
- 생성: `src/components/workbench/WorkbenchResultsPanel.tsx`
- 생성: `src/components/workbench/WorkbenchPresetDialog.tsx`
- 생성: `src/components/workbench/WorkbenchShareDialog.tsx`
- 수정: `src/components/workbench/WorkbenchClient.tsx`

**실행 절차:**

- [ ] 1. 추출 전 순수 helper 테스트를 보강한다.

우선 확인할 영역:

- run payload assembly
- result ordering/filtering
- stream retry delay
- resume state
- provider fallback

이미 존재하는 `.test.mjs`가 있으면 중복 작성하지 않고 누락 케이스만 추가한다.

- [ ] 2. `useRunStream`부터 추출한다.

JSX를 바꾸지 않고 `readRunStream()` 주변 로직만 hook으로 옮긴다.

```ts
type UseRunStreamInput = {
  t: (key: string) => string;
  onEvent: (event: RunStreamEvent) => void;
  onCompleted: (payload: CompletedRunPayload) => void;
  onError: (message: string) => void;
};
```

- [ ] 3. 실행 시작/취소/branch/rerun 상태를 `useWorkbenchRun`으로 옮긴다.

이동 대상:

- `handleRun`
- `handleBranch`
- `handleRerun`
- cancellation state
- run monitor entries

API endpoint는 바꾸지 않는다.

- [ ] 4. 낮은 위험 순서로 표현 컴포넌트를 분리한다.

순서:

1. progress panel
2. input/settings panel
3. result board wrapper
4. presets dialog
5. share dialog

각 추출 커밋은 같은 props와 callback 계약을 유지해야 한다.

- [ ] 5. 초기 진입에 필요 없는 UI는 dynamic import를 적용한다.

후보:

- preset management dialog
- share dialog
- attachment preview tools
- advanced result comparison panel

패턴:

```tsx
const WorkbenchPresetDialog = dynamic(
  () => import("./WorkbenchPresetDialog").then((mod) => mod.WorkbenchPresetDialog),
  { ssr: false },
);
```

- [ ] 6. 번들/INP를 재측정한다.

```powershell
npm run lint
npm run build
npx playwright test tests/e2e/workbench-smoke.spec.ts
```

기록:

- workbench route first-load JS
- 가장 큰 chunk
- stream 이벤트 중 입력 반응성
- 가능하면 화면 캡처 비교

**수용 기준:**

- 워크벤치 기능과 화면 흐름이 동일하다.
- `WorkbenchClient.tsx`가 의미 있게 줄어든다.
- 초기 JS 또는 고빈도 리렌더 범위가 줄었다는 증거가 있다.
- UI redesign이 섞이지 않는다.

**롤백:**

- 추출을 작은 커밋으로 나누고 마지막 추출 커밋만 revert한다.

### Phase 6. 실행 러너 표준화

**목표:** 증거 기반으로 canonical runner를 정하고 중복 실행 경로를 줄인다.

**수정 대상 파일:**

- `src/lib/workbench-runner-version.ts`
- `src/app/api/workbench/run/route.ts`
- `src/app/api/workbench/runs/[runId]/route.ts`
- `src/app/api/workbench/runs/[runId]/stream/route.ts`
- `src/app/api/workbench/runs/[runId]/steps/[orderIndex]/route.ts`
- `src/app/api/results/[id]/rerun/route.ts`
- `src/app/api/workbench/runs/[runId]/steps/[orderIndex]/branch-rerun/route.ts`
- 안정화 후 제거 후보: `src/workflows/workbench-run.ts`
- 안정화 후 제거 후보: `workflow` dependency, `withWorkflow(nextConfig)`
- 분해 후보: `src/lib/ai/workflow.ts`
- 분해 후보: `src/lib/execution-run-steps.ts`

**실행 절차:**

- [ ] 1. 러너별 비교 지표를 추가한다.

지표:

- kickoff 시간
- queued-to-first-step 시간
- step duration
- provider error rate
- rescue count
- cancellation success
- partial completion rate
- final result persistence success

- [ ] 2. V2 cohort를 단계적으로 올린다.

권장 순서:

```text
RUNNER_V2_USER_COHORT_PERCENT=10
RUNNER_V2_USER_COHORT_PERCENT=25
RUNNER_V2_USER_COHORT_PERCENT=50
RUNNER_V2_USER_COHORT_PERCENT=100
```

각 단계는 실제 오류율과 latency를 비교할 수 있을 만큼 유지한다.

- [ ] 3. V1 삭제 전 parity checklist를 통과한다.

체크 항목:

- sequential review chain
- repeat controls
- stop condition
- branch/rerun from step
- result ordering
- partial failure
- cancellation
- refresh 후 resume
- queue/start 실패 시 credit reservation release
- shared result/session behavior

- [ ] 4. canonical runner를 정한다.

V2가 이기는 경우:

- sequential은 V2를 기본값으로 단순화한다.
- parallel이 아직 V2를 지원하지 않으면 V1을 `parallelRunner`로 명시적으로 축소 명명한다.
- 이후 parallel도 V2로 옮길 별도 계획을 만든다.

V1이 이기는 경우:

- production에 queued `ExecutionRunStep`이 남아 있지 않은지 확인한 뒤 V2 QStash path를 제거한다.

- [ ] 5. 삭제 전 태그를 남긴다.

```powershell
git tag before-runner-consolidation-20260619
```

**수용 기준:**

- 모드별 canonical execution path가 명확하다.
- 신규 실행 기능이 수정해야 할 primary backend 위치가 하나로 줄어든다.
- 진행 중인 production run을 고립시키지 않는다.
- 삭제 전 rollback tag가 있다.

**롤백:**

- env cohort를 이전 값으로 되돌린다.
- runner 삭제 커밋을 revert한다.
- dependency 제거가 넓게 퍼졌다면 rollback tag를 기준으로 복구한다.

### Phase 7. 구조 재배치

**목표:** 기능 추가가 쉬운 server/shared/client 경계를 만든다.

**수정/생성 대상:**

- 생성: `src/server/**`
- 생성: `src/shared/**`
- 생성: `src/client/**`
- 이동: `src/lib` 모듈을 배치별로 이동
- 유지: `src/lib` compatibility barrel
- 수정: import 경로

**실행 절차:**

- [ ] 1. 순수 공유 모듈부터 이동한다.

후보:

- `src/lib/credits.ts` → `src/shared/credits/credits.ts`
- `src/lib/validation.ts` → `src/shared/validation/index.ts`
- `src/lib/ai/model-display.ts` → `src/shared/ai/model-display.ts`
- `src/lib/ai/provider-catalog.ts` → `src/shared/ai/provider-catalog.ts`

- [ ] 2. browser-only helper를 이동한다.

후보:

- `src/lib/browser-storage.ts` → `src/client/browser/storage.ts`
- `src/lib/browser-clipboard.ts` → `src/client/browser/clipboard.ts`
- `src/lib/local-cache.ts` → `src/client/browser/local-cache.ts`

- [ ] 3. server-only module을 이동한다.

후보:

- `src/lib/prisma.ts` → `src/server/db/prisma.ts`
- `src/lib/prisma-url.ts` → `src/server/db/prisma-url.ts`
- `src/lib/usage-policy.ts` → `src/server/usage/policy.ts`
- `src/lib/subscription.ts` → `src/server/billing/subscription.ts`
- `src/lib/execution-runs.ts` → `src/server/workbench/execution-runs.ts`
- `src/lib/execution-run-steps.ts` → `src/server/workbench/runner/v2/*`

- [ ] 4. 임시 compatibility export를 둔다.

```ts
export * from "@/server/usage/policy";
```

- [ ] 5. import를 작은 batch로 갱신한다.

순서:

1. tests
2. server modules
3. route handlers
4. Server Components
5. Client Components

- [ ] 6. 모든 import가 이전된 뒤 compatibility barrel을 제거한다.

확인 명령:

```powershell
rg "@/lib/usage-policy|@/lib/prisma|@/lib/browser-storage"
```

**수용 기준:**

- server module은 `import "server-only"`를 가진다.
- client module은 Prisma, QStash, provider SDK, server auth를 import하지 않는다.
- batch마다 테스트가 통과한다.
- 기능 변경과 파일 이동을 같은 커밋에 섞지 않는다.

**롤백:**

- batch별 커밋으로 나누어 한 batch씩 revert한다.

## 7. 모든 Phase 공통 검증 게이트

Phase 완료를 주장하기 전에 반드시 fresh verification을 실행한다.

```powershell
git status --short
npm run lint
npm run build
```

수정 파일에 따라 focused test를 추가 실행한다.

```powershell
node --test src/lib/canonical-host.test.mjs
node --test src/lib/auth-handoff.test.mjs
node --test src/lib/credits.test.mjs
node --test src/lib/provider-concurrency.test.mjs
node --test src/lib/workbench-run-payload.test.mjs
node --test src/lib/workbench-result-board.test.mjs
node --test src/lib/run-stream-backoff.test.mjs
```

Phase 0에서 e2e가 만들어진 후:

```powershell
npx playwright test tests/e2e/workbench-smoke.spec.ts
```

성능 Phase는 반드시 `docs/perf/PHASE_*` 보고서를 갱신한다. 개선 수치가 없으면, 구조상 필요한 작업인지 설명하고 사용자 확인 후 진행한다.

## 8. 권장 커밋 순서

1. `chore(perf): add baseline instrumentation`
2. `test(e2e): add workbench smoke flow`
3. `perf(nav): restore app route prefetching`
4. `perf(app): render list pages with server initial data`
5. `perf(auth): dedupe current user lookup per request`
6. `perf(workbench): remove schema repair from run hot paths`
7. `perf(usage): consolidate usage access snapshot`
8. `perf(stream): reduce run stream polling query cost`
9. `refactor(workbench): extract run stream hook`
10. `refactor(workbench): split workbench panels`
11. `refactor(runner): make selected runner canonical`
12. `refactor(structure): introduce server shared client boundaries`

성능 동작 변경과 파일 이동을 같은 커밋에 섞지 않는다.

## 9. 리스크와 대응

| 리스크 | Phase | 대응 |
| --- | --- | --- |
| prefetch로 서버 요청량 증가 | 1 | primary route부터 적용, 동적 list는 hover/focus prefetch |
| RSC initial data와 API data shape 불일치 | 2 | server list function과 TypeScript type 공유 |
| auth cache가 세션 변경을 숨김 | 2 | request-level `cache()`만 사용, cross-request cache 금지 |
| runtime repair 제거 후 누락 스키마 발견 | 3 | build-time assertion, emergency env flag |
| credit cache로 정산 오류 | 4 | 표시용 cache만 허용, reservation/charge는 fresh transaction |
| Workbench 추출 중 UI 회귀 | 5 | hook 먼저 추출, 시각 컴포넌트는 소커밋으로 분리 |
| V2 runner parity gap | 6 | cohort rollout, parity checklist 통과 전 삭제 금지 |
| 파일 이동으로 import churn | 7 | compatibility barrel, batch commit |

## 10. 추천 시작 범위

사용자가 "시작해"라고 하면 **Phase 0과 Phase 1만 먼저 진행**하는 것을 권장한다.

이유:

- Phase 0은 문제를 수치로 증명한다.
- Phase 1은 코드 변경 폭이 작고, 페이지 전환 체감 지연에 가장 즉각적인 효과가 예상된다.
- Phase 2는 그 다음으로 큰 waterfall 제거 작업이다.
- Phase 3~4는 실행 버튼 지연을 직접 줄인다.
- Phase 5~7은 구조 개선 효과가 크지만 회귀 위험도 크므로, 앞 단계 측정과 안전망이 갖춰진 뒤 진행해야 한다.

## 11. 결론

현재 느린 응답의 근본 원인은 단일 원인이 아니다. 가장 직접적인 원인은 `prefetch={false}`와 client fetch waterfall이며, 실행 버튼 지연은 런타임 스키마 보정, stale run 정리, 사용량/크레딧 사전 조회, runner 큐잉 전 transaction이 누적되어 발생한다. 장기 유지보수 비용은 V1/V2 러너 공존, `src/lib` 평탄 구조, `WorkbenchClient` 대형화에서 온다.

따라서 작업은 다음 순서로 진행해야 한다.

1. 측정한다.
2. 페이지 전환을 먼저 빠르게 만든다.
3. 초기 데이터를 서버 렌더로 옮긴다.
4. 실행 핫패스의 레거시 작업을 제거한다.
5. 사용량/stream 비용을 줄인다.
6. Workbench와 러너 구조를 정리한다.
7. server/shared/client 경계를 확정한다.

이 순서를 따르면 기능을 유지하면서도 응답 속도와 향후 개발 효율을 모두 개선할 수 있다.

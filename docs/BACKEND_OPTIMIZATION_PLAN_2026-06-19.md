# 백엔드 구성 · 프로그램 설계 최적화 계획 보고서

- 문서 버전: v1 (2026-06-19)
- 대상 코드 기준 커밋: `722b7bb` (branch `claude/backend-refactor-plan-ub5vn2`)
- 앱 버전: `v1.31.2-20260619`
- 작성 목적: 현재 확보된 **모든 기능과 설정을 그대로 유지**한 채, 비효율적으로 누적된 백엔드/프로그램 구조를 정리하고, 페이지 전환·버튼 클릭 시의 응답 지연 근본 원인을 제거하기 위한 **단계별 실행 계획**을 정의한다.
- ⚠️ **중요**: 본 문서는 "계획"이다. 실제 리팩토링·코드 변경은 **사용자 승인 이후**에 착수한다. 본 보고서만 보고 순서대로 따라가면 작업이 가능하도록 작성되었다.

---

## 0. 이 보고서를 읽는 방법

- **2장**: 현재 백엔드가 실제로 어떻게 동작하는지(서랍장 안에 무엇이 들어있는지) 정리.
- **3장**: 구조적 문제(서랍이 왜 어질러졌는지) 진단.
- **4장**: "페이지 전환·버튼 클릭이 느린" 응답 지연의 **근본 원인 7가지**와 측정 방법.
- **5장**: 목표 아키텍처(To-Be).
- **6~7장**: Phase 0~6 단계별 실행 계획. 각 Phase는 *작업 항목 → 절차 → 수용 기준 → 위험/롤백 → 예상 효과* 형식. **이 장만 순서대로 따라 하면 된다.**
- **8~10장**: 검증/측정, 리스크, 작업 순서 요약 체크리스트.

작업의 대원칙: **기능 동결(feature freeze)**. 리팩토링 기간 중 사용자에게 보이는 동작·화면·설정은 1:1로 보존한다. 모든 단계는 독립적으로 머지 가능하며, 각 단계 끝에서 앱은 항상 정상 동작해야 한다.

---

## 1. 프로그램 목적 요약 (조건 1 - 백엔드 완전 파악의 전제)

**Multi AI / Yapp** 은 일반적인 챗봇 UI가 아니라 **결과 카드(result card) 중심의 멀티-AI 오케스트레이션 워크벤치**다. 핵심 흐름:

1. 사용자가 하나의 과제(input)를 입력한다.
2. 여러 모델을 **병렬 비교(Parallel Compare)** 하거나 **순차 검토 체인(Sequential Review Chain)** 으로 실행한다.
3. 각 provider 출력은 **영속화된 결과 카드**가 된다.
4. 결과 카드는 후속 분기(branch)·비평(critique)·개선(improve)·요약(summarize)·재실행(rerun)·최종 선택(final)의 **부모 소스**가 된다.
5. 관련 세션은 **프로젝트 폴더**로 묶여 공유 컨텍스트를 가진다.
6. 워크플로 경로는 **프리셋**으로 저장·재사용된다.

부수 시스템: 이메일/비밀번호 + Google OAuth 인증, **크레딧 기반 사용량 미터링**, 구독/쿠폰, 관리자 패널(대시보드·사용자·쿠폰·대화 열람·피드백·provider 헬스체크), 다국어(en/ko), 첨부파일 서버 인제스트(텍스트/PDF/이미지), 공유 링크.

이 목적상 백엔드의 무게중심은 **(a) AI 실행 파이프라인**, **(b) 사용량/크레딧 정산**, **(c) 결과 그래프 영속화**, **(d) 인증/소유권 검증** 네 축이다. 최적화는 이 네 축을 흩뜨리지 않고 정리하는 것을 목표로 한다.

---

## 2. 현재 백엔드 아키텍처 완전 분석 (As-Is)

### 2.1 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 프레임워크 | Next.js 16.2.3 (App Router), React 19.2.4 |
| 언어 | TypeScript 5 (`strict`) |
| 스타일 | Tailwind CSS v4 |
| ORM/DB | Prisma 6.19 / PostgreSQL |
| 비동기 작업 큐 | Upstash QStash (`@upstash/qstash`) |
| 워크플로 런타임 | `workflow` 4.2.4 (`withWorkflow`, `workflow/api`) |
| 첨부 파싱 | `mammoth`(docx), `pdf-parse`(pdf) |
| 검증 | `zod` 4 |
| 인증 | 자체 구현(bcryptjs + 세션 쿠키) + Google OAuth |
| 호스팅 | Vercel(서버리스) 추정 (`qkiki.vercel.app` redirect, serverless 연결풀 주석) |

### 2.2 디렉토리 구조 개요

```
src/
  app/
    (root)/layout.tsx        # LanguageProvider + LanguageSelector 전역 래핑
    app/                     # 보호된 제품 영역 (/app/*)
      layout.tsx             # requireUser() + projects/sessions DB 조회 → AppShell
      workbench/page.tsx     # → WorkbenchClient (클라이언트)
      sessions|projects|presets|account|pricing/page.tsx  # 대부분 thin client wrapper
    admin/                   # 관리자 패널 ((panel) 그룹)
    api/                     # 수십 개의 route handler (아래 2.4)
    shared/[token], guide, files, open-in-browser, sign-in, sign-up
  components/                # AppShell, WorkbenchClient(5913줄!) 등 UI
  lib/                       # 62개 파일 — 도메인 로직 집중 (아래 2.5)
  lib/ai/                    # provider/prompt/workflow (workflow.ts 60KB)
  workflows/workbench-run.ts # workflow 런타임 진입점 (V1 러너)
prisma/schema.prisma         # 885줄, 약 40개 모델
proxy.ts                     # 미들웨어(호스트 rewrite + canonical redirect + auth gate)
```

### 2.3 요청 처리 파이프라인 (미들웨어)

`proxy.ts` (Next.js middleware, `matcher`로 정적 자원 제외 전 경로 적용):

1. `admin.*` 호스트면 `/admin/*`로 rewrite.
2. canonical host 리다이렉트 판단(`shouldRedirectToCanonicalHost`) — 비-canonical 호스트면 로그인 사용자는 `/api/auth/handoff` 307, 비로그인은 308 리다이렉트.
3. `/app/*` 비로그인 → `/sign-in?next=` 리다이렉트, 로그인 상태로 `/sign-in|/sign-up` 접근 → `/app/workbench`.
4. `/admin/*` 비로그인 → `/admin/sign-in`.

→ 미들웨어는 **쿠키 존재 여부만** 보고(DB 조회 없음) 게이트하므로 가볍다. 문제는 미들웨어가 아니라 그 뒤(레이아웃/페이지/API)에 있다(4장).

### 2.4 API 라우트 표면

도메인별 route handler가 매우 광범위하게 펼쳐져 있다:

- 인증: `api/auth/{sign-in,sign-up,sign-out,handoff,consume-handoff,health,google/*}`
- 워크벤치 실행: `api/workbench/{run, branch, compare, runs/[runId], runs/[runId]/{cancel,stream,steps/...}}`
- 내부 워커(QStash 콜백): `api/internal/workbench/{run-steps/[stepId]/execute, watchdog}`
- 결과/세션/프로젝트/프리셋/첨부: `api/{results,sessions,projects,presets,attachments}/...`
- 사용량/구독/쿠폰/트라이얼: `api/{usage,subscription,coupons,trial}/...`
- 관리자: `api/admin/{dashboard,users,coupons,providers,conversations,feedback,audit-logs,system,auth}/...`
- 피드백: `api/feedback/...`

### 2.5 `src/lib` 의 도메인 로직 집중 (핵심 무게중심)

대형 모듈(라인/바이트 기준):

| 파일 | 크기 | 역할 | export 수 |
|------|------|------|-----------|
| `lib/ai/workflow.ts` | ~60KB | 병렬/순차/분기 실행, 결과 영속화, 프로젝트 컨텍스트, 비교 요약 | 18 |
| `lib/execution-run-steps.ts` | ~53KB | **V2 러너** 스텝 plan/claim/finalize/cancel/watchdog/rescue | 11 |
| `lib/ai/providers.ts` | ~38KB | provider 호출 정규화(OpenAI/Anthropic/Gemini/xAI) | 3 |
| `lib/usage-policy.ts` | ~31KB | 사용량·크레딧 정책/예약/정산 | 12 |
| `lib/subscription.ts` | ~23KB | 구독/쿠폰 상태·발급·정산 | 6 |
| `lib/execution-runs.ts` | ~17KB | ExecutionRun 생성/진행/완료/취소/토큰 | 26 |
| `lib/credits.ts` | ~15KB | 모델 가격표·크레딧 추정 | 21 |

그 외 `workbench-*` 접두 파일이 ~20개로 잘게 쪼개져 있으나, 명명만 `workbench-*`일 뿐 **결과보드/스크롤/확장/리줌/페이로드 등 UI 보조 로직과 서버 로직이 한 폴더에 평탄하게 섞여** 있다(서랍장 비유의 핵심).

### 2.6 AI 실행 파이프라인 — **이중(dual) 러너 공존**

가장 중요한 구조적 사실: 실행기가 **두 벌** 존재하며 사용자별 코호트로 분기한다(`selectWorkbenchRunnerVersion`).

- **V1 러너 (`workflow` 패키지 기반)**
  - 진입: `workflows/workbench-run.ts` (`workbenchRunWorkflow`), `next.config.ts`의 `withWorkflow()`로 래핑.
  - 실행: `lib/ai/workflow.ts`의 `executeParallelRunIncremental` / `executeSequentialRunIncremental`.
  - 병렬 모드와, V2 미할당 사용자의 순차 모드가 이 경로.
- **V2 러너 (QStash 스텝 큐 기반)**
  - 진입: `api/workbench/run` → `ExecutionRun`(status=queued) 생성 → `ExecutionRunStep` plan 생성 → `enqueueExecutionRunStep`(QStash)로 첫 스텝 발행 + `enqueueWorkbenchWatchdog`.
  - 워커: `api/internal/workbench/run-steps/[stepId]/execute` (HMAC 서명 `X-Qkiki-*` 검증) 에서 `claimExecutionRunStep` → 실행 → 다음 스텝 enqueue. `watchdog` 라우트가 정체 스텝을 rescue.
  - 순차 모드에서 `WORKBENCH_RUNNER_VERSION` / `RUNNER_V2_USER_COHORT_PERCENT` / `RUNNER_V2_USER_ALLOWLIST`로 점진 롤아웃 중.

- **진행 상황 전달**: 클라이언트는 `/api/workbench/runs/[runId]/stream`을 **long-poll fetch 루프**(NDJSON, `startIndex` 커서, 재연결 백오프)로 호출. 추가로 `/api/workbench/runs/[runId]` 상태 폴링 경로도 존재. (true SSE/WebSocket push 아님)

### 2.7 데이터 모델 (Prisma, 약 40개 모델)

핵심 그래프: `User → Project → WorkbenchSession → (WorkflowStep | ExecutionRun → ExecutionRunStep) → Result(자기참조 parent/child) → ResultAttachment`. 미터링/빌링: `UsageLimit, UsageReservation, UsageLog, CreditWallet, UserSubscription, Coupon, CouponRedemption, PaymentPlan, SubscriptionLedger, ProviderLease`. 인증: `AuthSession, AuthAccount, AdminSession`. 운영: `AdminAuditLog, AdminContentAccessLog, AdminProviderConfig, AdminSystemSetting, FeedbackPost/Comment/Attachment`.

인덱스는 **대체로 잘 잡혀 있다** (`@@index([userId])`, `ExecutionRunStep`의 `[status,nextAttemptAt]`/`[status,lockExpiresAt]`, `Result`의 `[executionRunId,executionOrder]` unique 등). 즉, 인덱스 누락은 1차 병목이 아니다 — 병목은 **요청당 쿼리 수와 왕복 패턴**(4장).

### 2.8 런타임 스키마 보정(legacy)

`lib/workbench-run-schema.ts`의 `ensureWorkbenchRunSchema()`는 **런타임에 `information_schema` 조회 + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`** 를 수행하는 레거시 보정 코드다. 컬럼 존재 결과는 프로세스별 promise 캐시(`ensureColumnPromiseCache`)되어 워밍 후엔 저렴하지만, 이 함수가 `run`/`runs/[runId]`/`stream` 세 핫패스에 모두 박혀 있고, 함께 호출되는 `closeStaleWorkbenchRuns()`는 매 호출 쿼리를 던진다. 주석 자체가 "deprecated, migrate deploy로 대체하라"고 명시.

---

## 3. 구조적 문제 진단 (서랍장이 어질러진 지점)

| # | 문제 | 근거 | 영향 |
|---|------|------|------|
| S1 | **이중 러너(V1 workflow + V2 QStash) 영구 공존** | `workflow.ts`(60KB) + `execution-run-steps.ts`(53KB)가 동시에 핫패스에 존재, `selectWorkbenchRunnerVersion` 코호트 분기 | 신규 기능 추가 시 **두 곳 모두 수정** 필요 → 변경비용·버그 표면 2배 |
| S2 | **`src/lib` 평탄 구조(62파일)** — 서버 도메인 로직과 UI 보조 로직 혼재 | `workbench-result-scroll.ts`(클라 UI)와 `usage-policy.ts`(서버 정산)가 같은 폴더 | 경계 불명확, 클라 번들에 서버 의도 코드 혼입 위험 |
| S3 | **God Component**: `WorkbenchClient.tsx` 5913줄 | 단일 `"use client"`에 입력·실행·스트림·첨부·프리셋·공유·크레딧·결과보드 전부 | 거대 번들·과도한 리렌더(4장 R5) |
| S4 | **God Module**: `workflow.ts`/`execution-run-steps.ts`/`usage-policy.ts` | 위 표 2.5 | 테스트·리뷰·재사용 곤란 |
| S5 | **런타임 DDL 보정 잔존** | `ensureWorkbenchRunSchema` 핫패스 3곳 | 핫패스에 불필요한 부하/콜드스타트 비용 |
| S6 | **페이지별 데이터 로딩 일관성 없음** | layout은 서버 RSC 조회, list 페이지는 client `useEffect` fetch | 워터폴·중복 인증조회(4장) |
| S7 | **사용량/크레딧 조회의 N-쿼리 분산** | `getUsageStatus`/`requireUsageAccess`가 profile→usage→pending→credit 순차 4+쿼리 | 실행·새로고침마다 누적 지연 |
| S8 | **테스트가 `.test.mjs`로 lib에 산재** | 25+개 `*.test.mjs`가 소스와 동일 폴더 | 빌드 include 범위·구조 가독성 저하 |

---

## 4. 응답 지연 근본 원인 분석 (조건 3 — 가장 중요)

증상: **"페이지가 바뀌거나 버튼을 눌러 실행할 때 느리다."** 이를 *(A) 페이지 전환 지연* 과 *(B) 버튼/액션 지연* 으로 분리해 근본 원인을 규명한다. 미들웨어는 쿠키만 보므로 원인이 아니다. 원인은 **레이아웃·페이지·API 계층의 왕복(round-trip) 누적**이다.

### R1. 모든 내비게이션 링크가 `prefetch={false}` — (A) 페이지 전환의 1차 원인

`AppShell.tsx`의 사이드바/모바일 내비, 최근세션, 프로젝트 링크 **전부** `prefetch={false}`. Next.js App Router의 기본 prefetch(뷰포트 진입 시 RSC 페이로드 선요청)를 끈 상태 → 링크 클릭 시 비로소 **콜드 RSC 요청 + 서버 렌더**가 시작되어 사용자가 그 왕복을 그대로 체감한다.
- 효과 추정: 전환 체감 지연의 가장 큰 단일 요인. prefetch 활성 시 클릭→표시가 거의 즉시가 될 수 있는 경로가 다수.

### R2. List 페이지의 클라이언트 fetch 워터폴 — (A) 전환의 2차 원인

`/app/sessions`, `/app/projects`, `/app/presets` 페이지는 **thin `"use client"` 래퍼**이고, 데이터는 마운트 후 `useEffect`에서 `/api/...` 호출로 가져온다(`SessionsClient` `fetch('/api/sessions')`, `ProjectsClient` `fetch('/api/projects')`, `PresetsClient` `fetch('/api/presets')`).
- 실제 순서: **내비게이트 → 빈 화면 → JS 다운로드/하이드레이트 → fetch 발사 → (서버에서 인증 재조회 + 데이터 조회) → 렌더**. 즉 서버 왕복이 페이지 표시 *이후* 추가로 1회 더 직렬로 발생.
- layout은 이미 서버에서 사용자/프로젝트/세션을 조회하는데, 페이지는 그걸 못 받고 다시 client에서 조회 → **중복·워터폴**.

### R3. 요청당 인증 DB 조회의 미캐싱·중복 — (A)(B) 공통 누적 원인

`getCurrentUser()`는 매 호출 `authSession.findUnique({ where:{tokenHash}, include:{ user:true } })` 1쿼리.
- 한 번의 화면 표시에서 호출 지점: 보호 layout `requireUser()` 1회 + 그 페이지가 띄우는 각 `/api/*`가 각자 `requireApiUser()` 1회씩. 워크벤치 진입 시 `usage`, `providers`, `presets`, (세션이면) `sessions/[id]` 등 **여러 API가 각각 인증 조회를 반복**.
- React `cache()`(요청 단위 메모이즈)나 단기 세션 캐시가 없어, 동일 요청 흐름에서 동일 세션을 매번 DB로 검증 → 왕복 누적.

### R4. 핫패스의 런타임 스키마 보정 + stale-run 정리 — (B) 실행 버튼 지연

`api/workbench/run`, `runs/[runId]`, `stream` 진입마다 `await ensureWorkbenchRunSchema()` + `await closeStaleWorkbenchRuns()`.
- `ensureWorkbenchRunSchema`는 워밍 후 캐시되지만 콜드스타트(서버리스 신규 인스턴스)마다 `information_schema`/`pg_indexes` 조회가 실행 직전에 직렬로 붙는다.
- `closeStaleWorkbenchRuns`는 매 요청 쿼리 → 실행/폴링 빈도만큼 부하.

### R5. `WorkbenchClient.tsx` 5913줄 God Component — (A)(B) 워크벤치 체감 지연

- **번들/하이드레이션**: 워크벤치 진입 시 거대한 단일 클라이언트 청크를 다운로드·파싱·하이드레이트 → 첫 인터랙션까지 지연.
- **리렌더 비용**: 입력·스트림 진행·결과보드·크레딧 표시가 한 컴포넌트 트리에 묶여, 작은 상태 변경(예: 진행률 틱)이 거대한 트리를 리렌더 → 버튼 클릭/타이핑이 무겁게 느껴짐.
- **마운트 시 직렬 fetch**: `usage`/`providers`/`presets`/`project`/`session` 등을 마운트 시 다발 호출(일부 직렬) → 진입 지연.

### R6. 진행 상황이 long-poll 폴링 기반 — (B) 실행 중 반응성

`stream`은 SSE push가 아니라 fetch 재연결 루프 + 별도 status 폴링 + watchdog. 폴링 간격만큼 진행 표시가 지연되고, 매 폴링이 R3/R4 비용을 동반(인증조회 + ensureSchema + closeStale + 상태 스냅샷 쿼리).

### R7. 사용량/크레딧 조회의 다중 쿼리 + 서버리스 커넥션 풀 — (B) 실행 경로 지연

- `requireUsageAccess`는 profile → `getOrCreateUsageRecord` → `countPendingReservedRequests` → `getCreditUsageSnapshot` 등 **직렬 4+ 쿼리**, 이후 `reserveUsage`가 `withSerializableRetries`로 직렬화 트랜잭션(재시도) 수행. 실행 버튼의 "준비" 구간이 길어진다.
- `prisma-url.ts`는 서버리스에서 `connection_limit=5`(인스턴스당). 병렬 fan-out + 폴링 + 쓰기가 겹치면 풀 경합으로 대기가 발생할 수 있다(주석에도 명시된 과거 행 잠김 사례). 실제 Postgres 측 풀러(PgBouncer/Accelerate) 사용 여부 확인 필요.

### 측정 방법 (작업 전 baseline 확보 — Phase 0)

1. **서버 타이밍**: 각 핫 API(run, stream, usage, sessions, projects)에 `Server-Timing` 헤더 + 쿼리 카운트 로깅 추가(임시). 인증조회/사용량조회/메인쿼리 구간별 ms 측정.
2. **클라 전환**: Chrome Performance/Next.js `useReportWebVitals`로 페이지 전환 TTFB·LCP·INP 측정. 워크벤치 진입의 JS transfer 크기 기록.
3. **DB**: Postgres `pg_stat_statements`로 호출빈도·평균시간 상위 쿼리 식별, 슬로우 로그 확인.
4. **번들**: `next build` 결과의 라우트별 First Load JS, `WorkbenchClient` 청크 크기 기록.

이 baseline을 **각 Phase 전후로 동일 측정**하여 개선 효과를 수치로 검증한다(8장).

---

## 5. 목표 아키텍처 (To-Be)

원칙: *기능 동결 · 점진적 · 항상 배포 가능 · 측정 주도*.

1. **데이터 로딩 모델 통일**: 보호 영역의 list/detail 페이지는 **RSC(서버)에서 1차 데이터 로딩**하고, 변이(mutation)·실시간만 클라이언트 fetch. layout이 이미 가진 데이터는 props로 내려 중복 제거.
2. **내비게이션 prefetch 복구**: 핫 경로 링크의 prefetch 재활성(또는 hover-intent prefetch)로 전환 체감 제거.
3. **인증 요청-단위 캐시**: `getCurrentUser`를 React `cache()`로 감싸 요청 내 1회로 dedupe.
4. **핫패스에서 런타임 DDL 제거**: 스키마는 `prisma migrate deploy`로만 관리, `ensureWorkbenchRunSchema`를 빌드/마이그레이션 단계로 이전 후 핫패스에서 제거. stale-run 정리는 watchdog(QStash 주기)로 일원화.
5. **러너 단일화 로드맵**: V2(QStash)를 표준으로 승격, V1(workflow)을 점진 폐기(또는 그 반대) — 한 경로만 유지.
6. **God Component/Module 분해**: `WorkbenchClient`를 기능 도메인별 하위 컴포넌트 + 상태 훅으로, 대형 lib 모듈을 책임별 파일로 분리. `src/lib`를 `server/`·`shared/`·`client/` 경계로 재배치.
7. **사용량 조회 최적화**: N쿼리를 단일 트랜잭션/병렬 조회로 합치고, 짧은 TTL 캐시(이미 client `local-cache`의 usage 15s 캐시 존재 → 서버측에도 도입 검토).
8. **(선택) 진행 전달을 SSE로**: long-poll → SSE 단방향 스트림으로 전환해 폴링 비용·지연 제거.

---

## 6. 단계별 실행 계획 (Phase 0 → 6)

> 각 Phase는 독립 PR. 순서는 **리스크 낮고 효과 큰 것 우선**. Phase 1~2가 응답 지연의 80%를 잡는 것을 목표로 한다. **각 Phase 시작 전 baseline 측정, 종료 후 재측정**.

### Phase 0 — 측정 기반선 + 안전망 (선행 필수, 코드 동작 변경 없음)

- **목적**: 개선을 수치로 증명할 baseline 확보 + 회귀 방지망.
- **작업 항목**
  1. 임시 계측 추가: `lib/server-timing.ts` 헬퍼 작성 → run/stream/usage/sessions/projects API에 `Server-Timing`과 쿼리 수 로깅(환경변수 `PERF_TRACE=1`일 때만).
  2. `useReportWebVitals` 훅을 `app/app/layout` 경로에 추가(콘솔/수집). 
  3. `next build` First Load JS 표 기록 → 본 문서 부록에 baseline 저장.
  4. Playwright(이미 devDeps에 존재)로 **핵심 사용자 시나리오 e2e 스모크** 작성: 로그인→워크벤치→병렬 실행→결과 표시→세션 목록→프로젝트. 이후 모든 Phase의 회귀 가드.
- **절차**: 측정 → 표로 기록 → 머지.
- **수용 기준**: baseline 수치 문서화, e2e 스모크 green.
- **위험/롤백**: 거의 없음(계측은 플래그 가드). 롤백=플래그 off.
- **예상 효과**: 0(측정용). 이후 단계 효과 검증의 기준.

### Phase 1 — 페이지 전환 지연 제거 (R1 + R6 navigation) ⭐최우선

- **목적**: 클릭→표시 체감 지연 제거. 코드 변경 작고 효과 큼.
- **작업 항목**
  1. `components/AppShell.tsx`: 핵심 내비 링크(workbench/projects/sessions/presets/account)의 `prefetch={false}` 제거 또는 명시적 `prefetch={true}`. 단, **새 워크벤치 링크**처럼 동적/대용량 경로는 hover-intent prefetch 또는 유지 여부를 측정으로 판단.
  2. 최근 세션·프로젝트 링크는 수가 많을 수 있으므로 **hover/focus 시 prefetch**(onMouseEnter에서 `router.prefetch`) 패턴 적용해 과도한 선요청 방지.
  3. 동적 `/app/workbench?session=` 링크는 prefetch 시 비용이 크면 제외하고, 대신 클릭 직후 낙관적 로딩 UI(`loading.tsx`) 제공.
  4. 각 라우트 세그먼트에 `loading.tsx`(스켈레톤) 추가 → 전환 즉시 골격 표시.
- **절차**: prefetch 정책 변경 → `loading.tsx` 추가 → 전환 TTFB/INP 재측정.
- **수용 기준**: 주요 전환의 체감 지연 제거(클릭 후 즉시 스켈레톤), 측정상 전환 시작 지연 감소. 기능/링크 동작 불변.
- **위험/롤백**: prefetch 과다로 서버 부하 증가 가능 → hover-intent로 완화, 환경/측정 보고 조정. 롤백=링크 prop 원복(1커밋).
- **예상 효과**: 페이지 전환 체감의 큰 폭 개선.

### Phase 2 — 데이터 로딩 RSC 통일 + 인증 캐시 (R2 + R3) ⭐최우선

- **목적**: list/detail 페이지의 client-fetch 워터폴 제거, 인증 중복조회 제거.
- **작업 항목**
  1. **인증 dedupe**: `lib/auth.ts`의 `getCurrentUser`를 React `cache()`로 래핑(서버 요청 단위 메모이즈). `requireUser`/`requireApiUser`가 이를 공유. → 한 요청 내 인증 1쿼리로 수렴.
  2. **list 페이지 RSC화**(기능 보존): `/app/sessions`, `/app/projects`, `/app/presets`의 `page.tsx`를 **async 서버 컴포넌트**로 바꿔 초기 데이터를 서버에서 조회해 클라이언트 컴포넌트에 `initialData` props로 전달. 클라이언트 컴포넌트는 `initialData`로 즉시 렌더하고, 변이/갱신만 기존 `/api/*`로 수행.
     - `SessionsClient`/`ProjectsClient`/`PresetsClient`의 `useEffect` 초기 fetch는 `initialData`가 있으면 skip하도록 가드(점진 전환, API는 유지 → 변이/재검증에 계속 사용).
  3. layout이 이미 조회한 projects/recentSessions와 중복되는 페이지 조회는 공유 가능한 범위에서 재사용(예: 사이드바와 동일 셀렉트).
  4. 서버 조회는 `Promise.all` 병렬, `select`로 필요한 필드만(기존 list API의 select 재사용).
- **절차**: `cache()` 적용 → 페이지별 RSC 데이터 주입 → 클라이언트 가드 → e2e 스모크 → 측정.
- **수용 기준**: 해당 페이지가 **데이터와 함께 1차 렌더**(빈 화면 후 fetch 사라짐), 인증 쿼리 수 감소(계측 확인), 화면/기능 동일.
- **위험/롤백**: 서버/클라 데이터 형태 불일치 가능 → 타입 공유 및 e2e로 가드. 롤백=페이지를 thin wrapper로 원복(페이지 단위 독립).
- **예상 효과**: 전환 후 데이터 표시까지의 추가 왕복(1회) 제거 + 요청당 인증 쿼리 절감.

### Phase 3 — 핫패스 정리: 런타임 DDL/stale 정리 제거 (R4)

- **목적**: 실행/폴링 핫패스에서 불필요한 직렬 쿼리 제거.
- **작업 항목**
  1. **마이그레이션 정합화**: `ensureWorkbenchRunSchema`가 보정하던 컬럼/인덱스가 정식 Prisma 마이그레이션에 모두 포함됨을 본 분석에서 **이미 확인**했다 — `ExecutionRun.stepControlJson`(`20260516160000_add_execution_run_step_control`), `Result.executionRunId`(`20260518093000_add_result_execution_run_id`), `Result.executionOrder`+unique(`20260519194000_add_result_execution_order`). 즉 런타임 보정은 **현재 중복**이며 안전하게 제거 가능. (작업 시 최신 main 기준 재확인만 수행.)
  2. **배포 게이트로 이전**: 스키마 보장은 `scripts/prebuild-migrate.mjs`(이미 build에서 실행) + `prisma migrate deploy`로만. 
  3. **핫패스에서 호출 제거**: `api/workbench/run`·`runs/[runId]`·`stream`의 `await ensureWorkbenchRunSchema()` 제거(또는 `PERF_TRACE`/`LEGACY_SCHEMA_GUARD` 플래그 뒤로). 반환값(`supportsRunExecutionOrder` 등)을 쓰는 분기는 항상 true로 단순화(마이그레이션 보장 후).
  4. **stale 정리 일원화**: `closeStaleWorkbenchRuns`를 요청 핫패스에서 빼고 QStash watchdog 주기 작업으로만 수행. (사용자 첫 진입 시 1회 필요한 resume 로직은 별도 가벼운 경로로.)
- **절차**: 마이그레이션 검증(스테이징에서 `migrate deploy`) → 호출 제거 → run/stream 지연 재측정.
- **수용 기준**: 실행/스트림 경로에서 `information_schema`/`closeStale` 쿼리 사라짐(계측), 콜드스타트 첫 실행 지연 감소, 실행 정상.
- **위험/롤백**: 구버전 배포가 잔존하는 환경에서 컬럼 미존재 위험 → 마이그레이션 선적용 확인 필수, 플래그로 즉시 복구 가능. 롤백=플래그 on.
- **예상 효과**: 실행 버튼 누른 직후 준비 구간 단축, 폴링당 부하 감소.

### Phase 4 — 사용량/크레딧 조회 최적화 (R7)

- **목적**: 실행 준비 구간의 직렬 쿼리·트랜잭션 비용 축소.
- **작업 항목**
  1. `usage-policy.ts`의 `getUsageStatus`/`requireUsageAccess` 내부 직렬 쿼리(profile/usage/pending/credit)를 가능한 범위에서 `Promise.all` 병렬화 + 단일 트랜잭션화.
  2. `getCreditUsageSnapshot`/`countPendingReservedRequests` 결과를 `requireUsageAccess`→`reserveUsage`로 **context 전달 재사용**(이미 일부 `context` 전달 경로 있음 → 누락 경로 보강해 중복 조회 제거).
  3. 서버측 usage 단기 캐시(요청 단위 `cache()` 또는 사용자별 15s 메모리 캐시) 도입 — 단, 예약/정산 정확성에 영향 없는 **읽기 표시용**에만 적용. 예약 트랜잭션은 항상 신선 조회.
  4. `/api/usage` 응답에 `Cache-Control: private, max-age=10` 등 단기 캐시 헤더 검토(클라 `local-cache` 15s와 정합).
- **절차**: 쿼리 병렬화 → context 재사용 보강 → 실행 준비 구간 측정.
- **수용 기준**: 실행 경로의 사용량 관련 쿼리 수/시간 감소, 크레딧 정산 수치 정확성 회귀 없음(기존 `credits.test.mjs`/`usage` 테스트 green).
- **위험/롤백**: 캐시로 인한 한도 표시 지연 → 표시용에만 한정, 정산은 트랜잭션 유지. 롤백=캐시 off.
- **예상 효과**: 실행 시작 지연 단축, 폴링/대시보드 부하 감소.

### Phase 5 — `WorkbenchClient` God Component 분해 (R5)

- **목적**: 워크벤치 번들·리렌더 비용 절감(체감 반응성). **동작 동결** 하 점진 분해.
- **작업 항목**(점진, 각 커밋이 독립적으로 동작)
  1. 도메인 단위 분리 추출: `useWorkbenchRun`(실행/스트림 상태), `useAttachments`, `useUsageCredits`, `usePresets`, `useWorkbenchDraft` 등 **커스텀 훅으로 상태 로직 이전**(파일 분리, 동작 동일).
  2. 표현 컴포넌트 분리: 입력 패널, 워크플로 스텝 편집, 결과보드, 진행 표시, 크레딧 바, 공유/프리셋 다이얼로그를 **별도 컴포넌트 파일**로. (이미 `ResultCard`/`WorkflowStepRow` 분리되어 있음 → 동일 패턴 확장.)
  3. 리렌더 격리: 진행률 등 고빈도 갱신 상태를 하위 컴포넌트로 내려 `memo`/상태 지역화 → 입력/결과 트리 불필요 리렌더 차단.
  4. **지연 로딩**: 공유 다이얼로그·프리셋 관리·첨부 미리보기 등 비초기 경로를 `next/dynamic`으로 코드 스플릿 → 초기 First Load JS 축소.
  5. 마운트 fetch 정리: 초기 필요한 것만, 가능한 병렬/지연(visible 시점) 로딩.
- **절차**: 훅 추출 → 컴포넌트 추출 → dynamic import → 번들 크기·INP 재측정. 각 단계마다 e2e 스모크.
- **수용 기준**: 워크벤치 First Load JS 의미있게 감소, 입력/진행 중 INP 개선, **모든 워크벤치 기능 동작 동일**.
- **위험/롤백**: 상태 추출 중 회귀 위험 큼 → 작은 커밋·e2e 가드 필수. 롤백=커밋 단위 revert.
- **예상 효과**: 워크벤치 진입·입력·실행 중 반응성 개선.

### Phase 6 — 러너 단일화 + 코드 구조 재배치 (S1, S2, S4, S8) — 중장기

- **목적**: 향후 기능 추가·수정 비용 구조적 절감(조건 2의 핵심).
- **작업 항목**
  1. **러너 결정**: 측정/운영 데이터로 V2(QStash)를 표준으로 승격(서버리스에 적합, 스텝 단위 재시도/watchdog 보유) 또는 V1 유지 중 **하나로 결정**. 결정 후 `RUNNER_V2_USER_COHORT_PERCENT=100`로 단계적 100% 전환 → 안정 확인 → 미사용 러너 코드 제거(`workflow.ts` 또는 V2 경로 중 하나)와 `withWorkflow` 의존 정리.
  2. **`src/lib` 경계 재배치**(점진, import 경로 변경 위주라 저위험): `lib/server/*`(usage-policy, subscription, execution-*, providers, auth), `lib/shared/*`(credits 가격표, validation, 순수 계산), `lib/client/*`(browser-*, local-cache, *-scroll/expansion 등 UI 보조). `"server-only"`/`"client-only"` 가드 부착으로 경계 강제.
  3. **대형 모듈 분할**: `execution-run-steps.ts`→ `plan/claim/finalize/cancel/watchdog` 파일로, `workflow.ts`→ `parallel/sequential/branch/persist/project-context` 파일로, `usage-policy.ts`→ `policy/reservation/credit-snapshot` 파일로. 공개 API는 배럴(`index.ts`)로 유지해 외부 import 불변.
  4. **테스트 정리**: `*.test.mjs`를 `tests/` 또는 `__tests__/`로 이동, `package.json`에 `test` 스크립트 정식화(현재 test runner 미정의).
- **절차**: 러너 100% 전환·검증 → 미사용 경로 제거 → lib 재배치(배럴로 import 보존) → 모듈 분할 → 테스트 이동.
- **수용 기준**: 러너 1벌만 존재, `src/lib` 경계 명확, 외부 import 깨짐 없음, 전체 테스트·e2e green, 기능 불변.
- **위험/롤백**: 러너 제거가 가장 고위험 → 100% 코호트로 충분 기간 운영 후 제거, 제거 전 태그/백업. 재배치는 배럴로 점진.
- **예상 효과**: 신규 기능 추가 시 단일 경로 수정, 변경 비용·버그 표면 축소.

---

## 7. 성능 개선 전용 트랙 요약 (조건 3 매핑)

| 근본 원인 | 해결 Phase | 핵심 조치 |
|-----------|-----------|-----------|
| R1 prefetch 비활성 | Phase 1 | 핵심 링크 prefetch 복구 + hover-intent + `loading.tsx` |
| R2 client-fetch 워터폴 | Phase 2 | list 페이지 RSC 1차 로딩 + initialData 주입 |
| R3 인증 중복 조회 | Phase 2 | `getCurrentUser`를 React `cache()` dedupe |
| R4 핫패스 런타임 DDL/stale 정리 | Phase 3 | 마이그레이션 정합화 후 핫패스에서 제거, watchdog 일원화 |
| R5 God Component 번들/리렌더 | Phase 5 | 훅/컴포넌트 분해 + dynamic import + 리렌더 격리 |
| R6 long-poll 폴링 | Phase 3(+선택 SSE) | 폴링당 부하 제거, 선택적 SSE 전환 |
| R7 사용량 N쿼리/풀 경합 | Phase 4(+인프라) | 쿼리 병렬화·context 재사용, 커넥션 풀러 점검 |

**인프라 점검(병행, 코드 외)**: 서버리스라면 PgBouncer/Prisma Accelerate 등 **트랜잭션 모드 풀러** 적용 + `directUrl`로 마이그레이션 분리. `connection_limit`은 풀러 도입 후 재산정. Vercel 리전과 DB 리전 동일화로 왕복 RTT 최소화.

---

## 8. 검증 및 측정 계획

- **회귀 가드**: Phase 0에서 만든 Playwright e2e 스모크를 **모든 PR에서 실행**. 기존 `*.test.mjs`(credits/usage/canonical-host/auth-handoff 등) 유지.
- **성능 게이트**: 각 Phase 전후 동일 측정(4장 측정 방법)으로 표 작성 — (a) 전환 TTFB/INP, (b) 워크벤치 First Load JS, (c) run/stream/usage API ms·쿼리수, (d) `pg_stat_statements` 상위 쿼리. 개선 없으면 머지 보류.
- **기능 동등성**: 화면 캡처 비교 + 핵심 시나리오 수동 점검(병렬/순차/분기/리뷰/프리셋 저장/프로젝트 컨텍스트/공유/크레딧 표시/관리자).

## 9. 리스크 및 롤백 전략

- 모든 Phase는 **독립 PR + 기능 플래그(가능 시)**. 각 Phase 종료 시 앱은 항상 정상.
- 최고위험은 **Phase 6 러너 제거**와 **Phase 5 상태 추출**. 전자는 100% 코호트 장기 운영 후 제거(태그 백업), 후자는 소단위 커밋 + e2e.
- DB 변경(Phase 3 마이그레이션 정합화)은 **expand-only**(컬럼 추가/인덱스), 파괴적 변경 없음. 배포 전 스테이징 `migrate deploy` 검증.
- 데이터/기능 보존이 최우선 — 어떤 단계도 사용자 데이터·설정·과금 정확성을 바꾸지 않는다.

## 10. 작업 순서 요약 체크리스트 (이대로 진행)

- [ ] **Phase 0**: 계측·baseline·e2e 스모크 (선행 필수)
- [ ] **Phase 1**: 내비 prefetch 복구 + `loading.tsx` (전환 지연 즉효)
- [ ] **Phase 2**: list 페이지 RSC화 + 인증 `cache()` (워터폴·중복조회 제거)
- [ ] **Phase 3**: 핫패스 런타임 DDL/stale 정리 제거 (실행 지연)
- [ ] **Phase 4**: 사용량/크레딧 조회 최적화
- [ ] **Phase 5**: `WorkbenchClient` 분해 + 코드 스플릿
- [ ] **Phase 6**: 러너 단일화 + `src/lib` 재배치 + 대형 모듈 분할 + 테스트 정리
- [ ] (병행) 인프라: DB 풀러·리전 점검

**기능 동결 원칙 하에**, Phase 1~4가 응답 지연의 대부분을 해소하고, Phase 5~6이 향후 기능 추가·수정의 구조적 비용을 낮춘다.

---

### 부록 A. 핵심 파일 빠른 참조

| 관심사 | 파일 |
|--------|------|
| 미들웨어/게이트 | `proxy.ts` |
| 보호 레이아웃(서버 조회) | `src/app/app/layout.tsx` |
| 앱 셸/내비(prefetch) | `src/components/AppShell.tsx` |
| 워크벤치 God Component | `src/components/workbench/WorkbenchClient.tsx` |
| 실행 진입 | `src/app/api/workbench/run/route.ts` |
| 진행 스트림(long-poll) | `src/app/api/workbench/runs/[runId]/stream/route.ts` |
| V1 러너 | `src/workflows/workbench-run.ts`, `src/lib/ai/workflow.ts` |
| V2 러너 | `src/lib/execution-run-steps.ts`, `src/lib/qstash.ts`, `src/app/api/internal/workbench/*` |
| 러너 코호트 | `src/lib/workbench-runner-version.ts` |
| 런타임 DDL 보정 | `src/lib/workbench-run-schema.ts` |
| 인증 | `src/lib/auth.ts`, `src/lib/api-auth.ts` |
| 사용량/크레딧 | `src/lib/usage-policy.ts`, `src/lib/credits.ts` |
| 구독/쿠폰 | `src/lib/subscription.ts` |
| Prisma 클라이언트/풀 | `src/lib/prisma.ts`, `src/lib/prisma-url.ts` |
| 데이터 모델 | `prisma/schema.prisma` |

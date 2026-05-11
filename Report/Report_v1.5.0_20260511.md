# 작업 보고서

## 기본 정보
- 버전: v1.5.0-20260511
- 작업 일시: 2026-05-11
- 이전 버전: v1.4.6-20260511
- 프로젝트명: Qkiki Workbench

## 작업 요약
- 사용자 기준 토큰 UI를 제거하고, 일일 사용 횟수와 Welcome Boost 기준으로 사용량 정책을 재설계했다.
- 기존 모델 호출 구조는 유지하면서 `run`, `branch`, `rerun` 경로 앞뒤에 요청 단위 usage guard와 usage log 기록을 추가했다.
- 관리자 화면은 토큰/비용을 계속 보이도록 유지하면서 요청 수, Boost 요청 수, 한도 초과 사용자 수 등 운영 지표를 확장했다.

## 변경 사항
### 추가한 기능
- 사용자별 일일 사용량 집계용 `UsageLimit`, 요청 단위 정책 로그용 `UsageLog`, 충전형 대비 `CreditWallet`, 상품 구조용 `PaymentPlan` 추가
- 신규 회원 Welcome Boost 7일 자동 부여
- `/api/usage` 사용량 상태 API 추가
- 사용자용 `UsageStatus`, `LimitReachedModal`, `/app/pricing` 준비 페이지 추가
- 관리자 대시보드 지표 확장

### 수정한 기능
- 무료 사용자 토큰 제한 방식을 요청 횟수 제한 방식으로 변경
- `run`, `branch`, `rerun` 요청 성공 후 1회 차감 및 내부 토큰/비용 로그 기록
- `ResultCard` 사용자 메타에서 토큰/비용 노출 제거
- 계정 화면과 워크벤치 화면에 남은 사용량 UI 추가

### 유지한 기능
- 기존 모델 호출 및 결과 저장 구조
- 내부 토큰/비용 저장 (`AiRequest`, `Result`, `UsageLog`)
- 관리자 대화 상세에서 토큰/비용 확인 기능

## 변경한 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| prisma/schema.prisma | 수정 | 플랜/Boost/usage/credit 관련 모델과 enum 추가 |
| prisma/migrations/20260511230000_add_usage_policy_v1/migration.sql | 추가 | Usage Policy V1용 DB 마이그레이션 |
| src/lib/usage-policy.ts | 추가 | Welcome Boost, 무료/유료 일일 한도, 입력 길이 제한, 로그 기록 공통 로직 |
| src/lib/api-auth.ts | 수정 | 기존 토큰 제한 제거, usage 에러 응답 형식 추가 |
| src/app/api/workbench/run/route.ts | 수정 | 초기 실행 usage guard 및 성공 후 1회 차감 |
| src/app/api/workbench/branch/route.ts | 수정 | 추가 질문/모델 재질문 usage guard 및 성공 후 1회 차감 |
| src/app/api/results/[id]/rerun/route.ts | 수정 | 재생성 usage guard 및 성공 후 1회 차감 |
| src/app/api/auth/sign-up/route.ts | 수정 | 가입 직후 Welcome Boost 자동 적용 |
| src/app/api/auth/google/callback/route.ts | 수정 | 신규 Google 가입자 Welcome Boost 적용 |
| src/app/api/usage/route.ts | 추가 | 사용자 사용량 상태 조회 API |
| src/components/workbench/WorkbenchClient.tsx | 수정 | 사용량 상태 로드, 한도 초과 모달, 요청 후 usage 갱신 |
| src/components/workbench/ResultCard.tsx | 수정 | 사용자용 토큰/비용 메타 제거 |
| src/components/account/AccountClient.tsx | 수정 | 사용량 상태 표시 및 업그레이드 CTA 추가 |
| src/components/billing/UsageStatus.tsx | 추가 | Free/Boost/유료 공통 사용량 UI |
| src/components/billing/LimitReachedModal.tsx | 추가 | 한도 초과 시 CTA 모달 |
| src/app/app/pricing/page.tsx | 추가 | 결제 연동 전 임시 전환 페이지 |
| src/lib/admin-dashboard.ts | 추가 | 관리자 지표 집계 공통 로직 |
| src/components/admin/AdminDashboardClient.tsx | 수정 | 관리자 usage/token/cost 지표 확장 |
| src/app/admin/(panel)/page.tsx | 수정 | 관리자 대시보드 데이터 소스 교체 |
| src/app/api/admin/dashboard/route.ts | 수정 | 관리자 대시보드 API 데이터 소스 교체 |
| VERSION | 수정 | 버전 업데이트 |
| src/lib/version.ts | 수정 | 앱 표시 버전 업데이트 |

## 사용량 정책 적용 위치
- `src/lib/usage-policy.ts`
  - 플랜/Boost 계산
  - 오늘 usage row 생성/갱신
  - 입력 길이 제한
  - 요청 성공 후 1회 차감
  - 요청 로그 저장
- `src/app/api/workbench/run/route.ts`
  - 새 비교 실행 차감
- `src/app/api/workbench/branch/route.ts`
  - 추가 질문, 특정 모델 재질문 차감
- `src/app/api/results/[id]/rerun/route.ts`
  - 전체 재생성 차감

## 토큰 UI 제거/변경 위치
- `src/components/workbench/ResultCard.tsx`
  - 사용자에게 보이던 `prompt/completion tokens`, 비용 메타 제거
- `src/components/workbench/WorkbenchClient.tsx`
  - 사용자용 사용량 상태 카드와 한도 초과 모달 추가
- `src/components/account/AccountClient.tsx`
  - 계정 화면에 사용량 상태 표시
- 관리자 영역은 유지
  - `src/components/admin/AdminDashboardClient.tsx`
  - `src/components/admin/AdminConversationDetailClient.tsx`

## Welcome Boost 적용 방식
- 이메일 회원가입: `src/app/api/auth/sign-up/route.ts`
- Google 신규 가입: `src/app/api/auth/google/callback/route.ts`
- 공통 적용 함수: `src/lib/usage-policy.ts > grantWelcomeBoostToUser`
- 저장 필드
  - `planType = FREE`
  - `billingType = NONE`
  - `trialStartedAt = now()`
  - `trialEndsAt = now() + 7 days`
  - `isTrialUsed = true`

## 한도 초과 처리 방식
- 서버
  - `requireUsageAccess`에서 현재 usage와 daily limit를 비교
  - 초과 시 `UsageLimitReachedError` 발생
  - API 응답은 `code: LIMIT_REACHED`, `usage` payload 포함
- 클라이언트
  - `WorkbenchClient`에서 `LIMIT_REACHED` 응답을 감지
  - `LimitReachedModal` 표시
  - CTA: 월구독, 연구독, 충전형, 내일 다시 사용하기

## 테스트 결과
- `npm run db:generate`: 성공
- `npm run lint`: 성공
- `npm run build`: 성공
- 브라우저 확인
  - `http://localhost:3000/sign-up` 페이지 기동 확인
  - 로컬 브라우저 자동화로 입력 기반 로그인 흐름까지 완전 검증하려 했으나, 현재 브라우저 자동화 런타임이 `type=email` 입력 제어에서 제한을 보여 인증 후 화면까지는 자동 검증하지 못함

## 남은 리스크
- 관리자 대시보드의 `free→paid conversion`은 현재 활성 유료/레거시 구독 사용자 수를 전체 사용자 수로 나눈 운영용 근사치다. 실제 마케팅 퍼널 기준 전환율과는 다를 수 있다.
- 기존 레거시 `UserSubscription` 사용자는 새 `planType`가 비어 있어도 정책 계산에서 `PRO` 수준으로 해석되도록 처리했다. 추후 결제 정식 연동 시 명시적 플랜 마이그레이션이 필요하다.
- 브라우저 자동화로 인증 후 `UsageStatus`, `LimitReachedModal` 화면까지 직접 클릭 검증하지 못했다. 수동 QA 1회가 권장된다.

## 추가 개선 제안
- `usage_logs` 기반 차트와 날짜 필터를 관리자 대시보드에 추가
- 저장/공유 한도도 이번과 같은 일별 usage 테이블 패턴으로 분리
- `advanced reasoning` 전용 카운터를 별도 컬럼 또는 별도 로그로 추가
- 유료 플랜/결제 연동 시 `planType`, `billingType`, `credit wallet` 동기화 서비스 추가
- Welcome Boost 종료 1일 전 사용자 안내 배너 또는 이메일 알림 추가

# 보고서 v1.28.0-20260618 — 크레딧 단일화 (사용 횟수 개념 제거)

## 목표
사용 횟수와 크레딧이 공존해 생기던 혼란을 없애고 **크레딧으로 일원화**한다.

## 적용한 결정 (사전 확인)
- 요금제: **균형형**. Free 일70/월350 · Starter **$7.3** 일150/월800 · Pro $19 일450/월2,200 · Team $59 일1,400/월7,000 · 비로그인 일30.
- 비로그인: **크레딧 미터링 전환**(5회 대화 제한 제거) + "로그인 시 일70" 공지.
- 무제한 쿠폰: **기간 내 진짜 무제한**(크레딧·일일 한도 무시).
- 부가 한도: **모든 횟수형 제한 제거**(크레딧·입력 길이만 유지).

## 변경 내역

### 1) 횟수 개념 제거
- `billing-plans.ts`: `PlanLimitPolicy`에서 `dailyLimit`(런 횟수)·`advancedReasoningDailyLimit`·`shareDailyLimit`·`resultSaveLimit` 제거. `anon` 플랜 추가. 신규 크레딧 수치 반영.
- `usage-policy.ts`: 런 횟수 게이팅(`isLimitReached`/`UsageLimitReachedError`) 제거. `UsageStatusSummary`/`UsageStatus`를 크레딧 전용으로 정리(`dailyLimit/dailyUsed/remaining/isLimitReached/isUnlimitedDaily` 삭제, `isAnonymous/isUnlimitedCredits/unlimitedCreditsEndsAt` 추가). 런 횟수 DB 컬럼(`dailyRequestLimit` 등)은 **삭제하지 않고 휴면값**으로 기록(프로덕션 안전).
- `api-auth.ts`: `consumeTrialConversation`(5회 게이트) 및 `LIMIT_REACHED` 응답 제거.
- 워크벤치/요금/사용량 UI: "남은 횟수/사용 횟수/Daily runs/고급추론 N회" 표기 제거 → 크레딧만 노출.

### 2) 일일 크레딧 70/30 + 비로그인 미터링
- `resolvePolicy`: 사용자 이메일(`@trial.local`)로 비로그인 판별 → `anon` 정책(일30). 로그인 무료=일70.
- 실행 경로(`workbench/run`, `branch`, `compare`, `rerun`): 비로그인 우회(`user.isTrial ? null`) 제거 → **비로그인도 크레딧 예약/정산**.
- `trial/start`: 5회 제한 제거(비로그인은 일일 크레딧으로만 제한).
- 워크벤치 체험 배너·사용량 카드: "비로그인 하루 30크레딧 / 로그인 시 하루 70크레딧" 공지.

### 3) 요금제 재편 (최저 $7.3)
- `QKIKI_PRICING_PLANS`: Starter $7.3·Pro $19·Team $59, 월/일 크레딧 재설정. 요금 페이지 카피/항목 갱신.
- 1크레딧 ≈ 원가 $0.0029(=월크레딧/343) 기준으로 풀사용 마진 ~65-70% 확보.

### 4) 쿠폰 크레딧화 + 기간별 무제한
- Prisma: `CouponType`에 `CREDIT_7D/CREDIT_30D/UNLIMITED_7D/UNLIMITED_30D` 추가(구 타입은 발행분 호환 위해 유지), `UserSubscription.couponUnlimitedUntil` 추가. 마이그레이션 `20260618120000_unify_credits_remove_counts`.
- `validation.ts`/관리자 쿠폰 폼·생성 라우트: **기간(7/30일) 선택 + 크레딧 수량 입력 + 무제한 체크박스**. 무제한 시 수량 비활성화.
- `subscription.ts`: 신규 타입 적립/무제한 부여 및 회수 로직. 무제한은 `couponUnlimitedUntil`로 기간 내 크레딧 한도 해제(`resolvePolicy`에서 한도를 무제한으로 승격).

## 검증
- `npx tsc --noEmit` 통과 · `npx eslint` 통과 · `node --test` **126/126 통과**(요금제 단가/일일 크레딧 회귀 테스트 갱신).

## 제안 / 의견 (검토 요청)
1. **마진 vs 무료 후함**: 현재는 마진 우선(균형형). 무료 가입 전환을 더 밀고 싶으면 Free 월350→월700·Starter 월800→월1,500 등으로 상향 가능(billing-plans.ts 한 곳만 수정).
2. **이미지 단가**: gemini-3-pro-image=46크레딧 등 고가 이미지는 비로그인(30)·무료(70) 일일 한도로는 1장도 빠듯. 무료에서 이미지 체험을 허용하려면 일일 한도 상향 또는 이미지 단가(`credits.ts`의 perImageUsd) 인하를 고려.
3. **휴면 DB 컬럼 정리**: 런 횟수 컬럼(`dailyRequestLimit/dailyRequestUsed/reservedRequestCount/requestCountCharged`)은 안전을 위해 남겨둠. 안정화 후 별도 마이그레이션으로 드롭 가능.
4. **관리자 대시보드 'limit reached users' 지표**: 런 횟수 기반이라 사실상 0이 됨 → 크레딧 소진 기준 지표로 교체 권장(후속 작업).
5. **구 쿠폰(무료/평생)**: 기존 발행분은 호환 유지(크레딧 무제한으로 동작). 신규 발행은 크레딧 쿠폰만 제공.

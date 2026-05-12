# Report v1.7.1 — 프로덕션 DB 마이그레이션 누락 수정

**버전:** v1.7.1-20260512
**날짜:** 2026-05-12
**유형:** 긴급 버그 수정 (Hotfix)

## 증상

프로덕션 환경(qkiki.wideget.net)에서 3가지 기능이 모두 작동하지 않음:

1. **시작하기 버튼** — "체험판을 시작할 수 없습니다" 에러
2. **이메일 계정 만들기** — "Sign-up failed due to server configuration. Check database connection." 에러
3. **구글 로그인/계정 만들기** — HTTP ERROR 500

## 근본 원인

최근 2개 Prisma 마이그레이션이 프로덕션 Supabase DB에 적용되지 않은 상태에서 새 코드가 배포됨:

- `20260511230000_add_usage_policy_v1`: User 테이블에 `planType`, `billingType`, `trialStartedAt`, `trialEndsAt`, `isTrialUsed` 컬럼 추가 및 UsageLimit, UsageLog, CreditWallet, PaymentPlan 테이블 생성
- `20260512090000_add_coupon_daily_limit_variants`: UserSubscription에 `couponDailyLimit`, `couponLimitEndsAt`, `couponLimitIsLifetime` 컬럼 추가

Prisma Client는 이 컬럼/테이블을 참조하는데 DB에 존재하지 않아 모든 쿼리가 `prisma:error Invalid prisma...`로 실패.

## 수정 내용

### 1. 프로덕션 DB 스키마 수동 적용

Supabase MCP를 통해 누락된 DDL을 직접 실행:

- User 테이블 컬럼 5개 추가
- PlanType, BillingType PostgreSQL enum 타입 생성
- TEXT → enum 타입 변환
- UsageLimit, UsageLog, CreditWallet, PaymentPlan 테이블 + 인덱스 + FK 생성
- UserSubscription 컬럼 3개 추가
- CouponType enum 값 2개 추가

### 2. 빌드 스크립트에 자동 마이그레이션 추가

`package.json`의 `build` 스크립트를 변경:

```
"build": "prisma generate && prisma migrate deploy && next build"
```

이제 Vercel 배포 시 자동으로 `prisma migrate deploy`가 실행되어 마이그레이션 누락을 방지.

## 검증

- `/api/trial/start` POST → 정상 응답 (5회 한도 초과 메시지)
- `/api/auth/sign-up` POST → `{"ok":true}` 정상 회원가입
- `/api/auth/health` GET → `{"ok":true, diagnostics: all true}`
- `/api/auth/google/start` GET → Google OAuth 페이지로 307 리다이렉트
- Vercel 에러 로그 → 수정 후 0건

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `package.json` | build 스크립트에 prisma migrate deploy 추가 |
| `VERSION` | v1.7.0 → v1.7.1 |
| `src/lib/version.ts` | APP_VERSION 업데이트 |

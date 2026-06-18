# 작업 보고서 v1.28.1-20260618

## 개요

관리자 쿠폰 시스템 기능 확장 및 계정 페이지 쿠폰 표시 개선

## 변경 사항

### 1. 평생(Lifetime) 쿠폰 추가
- `CREDIT_LIFETIME`, `UNLIMITED_LIFETIME` 쿠폰 타입을 Prisma 스키마에 추가
- DB 마이그레이션 `20260618170000_add_lifetime_credit_coupons` 적용
- `subscription.ts`에 `LIFETIME_MS` (~100년), `couponCreditDurationMs()`, `couponUnlimitedDurationMs()`, `couponDurationLabel()` 헬퍼 추가
- 쿠폰 코드 프리픽스 맵에 `CREDIT_LIFETIME` → `CL`, `UNLIMITED_LIFETIME` → `UL` 추가

### 2. 쿠폰 대량 생성 (Bulk Create)
- `validation.ts`: `quantity` 필드 추가 (1~100개, 기본값 1)
- `quantity > 1`일 때 사용자 지정 코드 입력 불가 (자동 생성만 가능)
- `api/admin/coupons/route.ts`: 루프로 여러 쿠폰 일괄 생성, `{ coupons: [...] }` 배열 반환

### 3. 쿠폰 다중 선택 복사
- `AdminCouponsClient.tsx`: 체크박스 기반 다중 선택 UI 추가
- 헤더 체크박스로 전체 선택/해제
- "선택 복사 (N)" 버튼으로 선택된 쿠폰 코드 줄바꿈 복사
- 대량 생성 결과를 텍스트 영역으로 표시 + "전체 복사" 버튼

### 4. 계정 페이지 쿠폰 상세 표시
- `subscription.ts`: `getUserSubscriptionState()` 리턴에 `activeCoupon` 객체 추가
  - `kind` (credit/unlimited), `type`, `creditAmount`, `appliedAt`, `expiresAt`, `isLifetime`
- `AccountClient.tsx`: "이용권 및 쿠폰" 섹션에 적용된 쿠폰 정보 표시
  - 쿠폰 종류, 남은 크레딧, 적용일, 만료일(평생이면 "무기한")

### 5. 워크벤치 무제한 크레딧 표시 개선
- `WorkbenchClient.tsx`: `isUnlimitedCredits`일 때 "보유 크레딧"과 "실행 후" 값을 `∞`로 표시

## 수정 파일

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | CREDIT_LIFETIME, UNLIMITED_LIFETIME enum 추가 |
| `prisma/migrations/20260618170000_*/` | 마이그레이션 SQL |
| `src/lib/subscription.ts` | 평생 쿠폰 로직, activeCoupon 반환 |
| `src/lib/validation.ts` | quantity, duration 스키마 변경 |
| `src/app/api/admin/coupons/route.ts` | 대량 생성 로직 |
| `src/components/admin/AdminCouponsClient.tsx` | UI 전면 개편 |
| `src/components/account/AccountClient.tsx` | 쿠폰 상세 표시 |
| `src/components/workbench/WorkbenchClient.tsx` | ∞ 표시 |
| `VERSION` | v1.28.1-20260618 |
| `src/lib/version.ts` | v1.28.1-20260618 |

## 검증

- TypeScript 컴파일: 0 에러
- ESLint: 0 에러
- 테스트: 126/126 통과

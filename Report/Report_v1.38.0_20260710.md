# 작업 보고서 — v1.38.0 (2026-07-10)

## 목적
런칭 전 사이트 전체 보안 취약점 점검 및 하드닝. 특히 `.env` 비밀값이 어떤 경로(저장소, 응답, 로그, URL)로도 유출되지 않도록 방어 구조를 설계·적용.

## 점검 범위
- 전체 API 라우트 66개, 인증/암호화/관리자 모듈, next.config, proxy, .gitignore, 커밋된 로그 파일, 클라이언트 번들 env 노출(`NEXT_PUBLIC_*`).

## 발견 및 조치

### 높음 (수정 완료)
1. **Google API 키가 URL 쿼리스트링으로 전송** (`providers.ts` 3곳) → `x-goog-api-key` 헤더로 이동. 프록시/액세스 로그/에러 메시지를 통한 키 유출 경로 제거.
2. **운영환경에서 개발용 폴백 암호화 키 허용** (`secret-crypto.ts`, `access-policy.ts`) → 운영에서 키 미설정 시 즉시 예외. 공개된 키로 암호화되는 상태 차단.
3. **미처리 500 응답이 내부 에러 메시지 원문 노출** (`api-auth.ts`, `admin-api-auth.ts`) → 일반 메시지로 교체, 원문은 서버 로그만.
4. **인증 엔드포인트 레이트리밋 부재** → `src/lib/rate-limit.ts` 신설, sign-in/sign-up/admin sign-in/coupon redeem/trial start 적용 (429 + Retry-After).
5. **관리자 MFA 코드 비교가 타이밍세이프 아님** → SHA-256 + `timingSafeEqual`.
6. **보안 헤더 전무** → CSP, HSTS, X-Frame-Options(DENY), nosniff, Referrer-Policy, Permissions-Policy, poweredByHeader:false.

### 중간 (수정 완료)
7. **`/api/auth/health`가 구성 상태를 항목별 노출** → `{ ok }` 불리언만 반환 + no-store.
8. **부팅 시 env 검증 부재** → `src/instrumentation.ts` + `src/lib/env-guard.ts`: 운영에서 자리표시자/약한 비밀값이면 기동 거부.
9. **개발 서버 로그 13개 파일이 git에 커밋됨** → 추적 해제, `.gitignore`에 `.codex-*`, `*.log`, `Report/*.log` 추가.

### 잔여 리스크 (문서화, docs/SECURITY.md §7)
- XFF 헤더 신뢰(신뢰 프록시 전제), 정적 관리자 MFA 코드(TOTP 전환 권장), 가입 이메일 열거, 인메모리 리미터의 서버리스 한계(Upstash Ratelimit 권장), 비밀 로테이션 절차, 의존성 감사 게이트.

## 신규/변경 파일
- 신규: `src/lib/rate-limit.ts`, `src/lib/env-guard.ts`, `src/instrumentation.ts`, `docs/SECURITY.md`
- 변경: `src/lib/ai/providers.ts`, `src/lib/secret-crypto.ts`, `src/lib/access-policy.ts`, `src/lib/api-auth.ts`, `src/lib/admin-api-auth.ts`, `src/app/api/auth/sign-in/route.ts`, `src/app/api/auth/sign-up/route.ts`, `src/app/api/admin/auth/sign-in/route.ts`, `src/app/api/coupons/redeem/route.ts`, `src/app/api/trial/start/route.ts`, `src/app/api/auth/health/route.ts`, `next.config.ts`, `.gitignore`
- 삭제(추적 해제): `.codex-*.log` 11개, `.codex-trial-start.html`, `Report/patch10-dev-server*.log`

## 검증
- `npm run lint`, `npx tsc --noEmit`, 프로덕션 빌드로 확인 (본문 하단 커밋 기준).

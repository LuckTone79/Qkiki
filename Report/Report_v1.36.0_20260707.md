# 작업 보고서

## 기본 정보
- **버전**: v1.36.0-20260707
- **작업 일시**: 2026-07-07
- **이전 버전**: v1.35.1-20260630
- **프로젝트명**: Yapp (QKIKI Workbench)

## 작업 요약
기존 커스텀 인증 시스템(Prisma `User`/`AuthAccount`/`AuthSession`, bcrypt, 커스텀 Google OAuth, 별도 Admin MFA 세션)을 Supabase Auth 기반으로 전면 교체했습니다. 이메일/비밀번호, Google/Kakao OAuth, 비밀번호 재설정, 이메일 인증, Cloudflare Turnstile 봇 방지를 구현했으며, 기존 사용자 데이터·쿠폰·구독·관리자 권한은 전부 그대로 유지되도록 `User.supabaseUserId` 브릿지 컬럼으로 연결했습니다. 실제 운영 DB(Supabase 프로젝트 `qkiki`)를 조사한 결과 이미 이 프로젝트의 Postgres를 쓰고 있었으므로 별도 데이터 이전 없이 마이그레이션만으로 통합했습니다.

## 변경 사항
### 추가된 기능
- Supabase Auth 기반 이메일/비밀번호 회원가입·로그인을 추가했습니다.
- Google, Kakao OAuth 로그인을 추가했습니다 (`/api/auth/oauth/[provider]` 동일 출처 진입점 경유, 인앱 브라우저 차단 시 "시스템 브라우저로 열기" 플로우 유지).
- `/forgot-password`, `/reset-password` 자체 서비스 비밀번호 재설정 플로우를 추가했습니다.
- 회원가입/로그인/비밀번호 재설정 폼에 Cloudflare Turnstile 봇 방지를 추가했습니다 (Supabase 네이티브 CAPTCHA 연동).
- 로그인 성공 시 `public.profiles` 테이블에 프로필을 자동 생성하는 Postgres 트리거를 추가했습니다 (user_id, email, display_name, role, created_at).
- 향후 Paddle/Stripe 연동을 위한 `billing_customers`, `subscriptions` 테이블(설계 전용, RLS 적용)을 추가했습니다.
- 기존 사용자를 Supabase Auth로 이전하는 운영 스크립트(`npm run auth:migrate-legacy-users`)를 추가했습니다.
- `docs/AUTH_SETUP.md`에 모든 인증 관련 환경변수, Supabase Dashboard 설정 항목, Rate Limit 가이드, 마이그레이션 절차를 정리했습니다.

### 수정된 사항
- `src/lib/auth.ts`/`src/lib/admin-auth.ts`를 Supabase 세션 기반으로 재작성하되, 익명 체험판 세션(`/api/trial/start`)은 기존 방식 그대로 유지했습니다.
- 관리자 로그인을 Supabase Auth로 통합하고 `User.role` 기반 권한 체크로 전환했습니다 (기존 Admin MFA 코드 방식 제거).
- 루트 `proxy.ts`(Next.js 16의 `middleware.ts` 후속 규칙)에 Supabase 세션 갱신 로직을 통합하면서 기존 admin 서브도메인 리라이트, canonical 도메인 리다이렉트, 크로스도메인 세션 handoff 로직은 그대로 보존했습니다.
- `next.config.ts`의 canonical 도메인 리다이렉트 쿠키 검사에 Supabase 세션 쿠키를 포함시켜, 프리뷰 도메인에서도 로그인 상태가 잘못 풀리지 않도록 수정했습니다.
- Prisma 스키마에 `User.supabaseUserId`(nullable, unique) 컬럼을 추가하고 `passwordHash`를 nullable로 변경했습니다.

### 삭제/제거된 사항
- 커스텀 Google OAuth 구현(`src/lib/google-oauth.ts`, `/api/auth/google/*`)을 제거했습니다.
- 기존 `/api/auth/sign-up`, `/api/auth/sign-in` API 라우트를 제거했습니다 (클라이언트에서 Supabase SDK 직접 호출로 대체).
- Admin MFA 코드 로그인 흐름을 제거했습니다 (`AdminSession` 테이블 자체는 데이터 보존을 위해 남겨두었으며 더 이상 쓰기만 하지 않음).

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| prisma/schema.prisma | 수정 | `User.supabaseUserId` 추가, `passwordHash` nullable화, `Profile`/`BillingCustomer`/`Subscription` 모델 추가 |
| prisma/migrations/20260707120000_supabase_auth/migration.sql | 추가 | 브릿지 컬럼, 신규 테이블, RLS 정책, `auth.users` 트리거 |
| src/lib/supabase/{env,client,server,admin,proxy}.ts | 추가 | Supabase 클라이언트 유틸리티 |
| src/lib/supabase/link-legacy-user.ts | 추가 | 레거시 `User` ↔ Supabase Auth 연결 브릿지 |
| src/lib/auth.ts | 수정 | Supabase 세션 + 체험판 쿠키 병행 처리로 재작성 |
| src/lib/admin-auth.ts | 수정 | `User.role` 기반 관리자 권한 체크로 재작성 |
| src/components/AuthForm.tsx | 수정 | Supabase SDK 직접 호출, Google/Kakao, Turnstile 통합 |
| src/components/{TurnstileWidget,ForgotPasswordForm,ResetPasswordForm}.tsx | 추가 | 신규 인증 UI 컴포넌트 |
| src/app/auth/callback/route.ts | 추가 | OAuth/이메일 링크 코드 교환 |
| src/app/api/auth/oauth/[provider]/route.ts | 추가 | Google/Kakao 진입점 |
| src/app/forgot-password/page.tsx, src/app/reset-password/page.tsx | 추가 | 자체 서비스 비밀번호 재설정 페이지 |
| proxy.ts | 수정 | Supabase 세션 갱신 통합 (기존 라우팅 로직 보존) |
| next.config.ts | 수정 | canonical 리다이렉트 쿠키 검사에 Supabase 쿠키 반영 |
| scripts/migrate-legacy-users-to-supabase.mjs | 추가 | 기존 사용자 Supabase Auth 이전 스크립트 |
| docs/AUTH_SETUP.md | 추가 | 인증 설정 가이드 |
| VERSION, src/lib/version.ts | 수정 | 앱 버전 갱신 |

## 알려진 이슈 / 추후 작업
- Google/Kakao OAuth, Turnstile은 Supabase Dashboard에서 실제 자격 증명을 등록해야 동작합니다 (`docs/AUTH_SETUP.md` §4, §5).
- 기존 59명 사용자는 `npm run auth:migrate-legacy-users -- --send`로 별도 이전 작업이 필요합니다 (실제 이메일 발송이 포함되어 있어 자동 실행하지 않았습니다).
- Supabase 기본 메일 발송 Rate Limit이 낮아(테스트 중 2회 만에 도달) 운영 전 커스텀 SMTP 설정을 권장합니다.
- 기존 36개 테이블의 RLS 비활성화는 이번 작업 범위에서 별도로 남겨두었습니다 — `docs/AUTH_SETUP.md` §8의 SQL을 검토 후 직접 적용해야 합니다.
- `scripts/reset-password.mjs`는 더 이상 실사용자의 실제 로그인 수단을 바꾸지 못하므로 폐기를 권장합니다 (삭제하지 않고 문서에만 명시).

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.36.0 | 2026-07-07 | Supabase Auth 전면 도입 (이메일/OAuth/비밀번호 재설정/Turnstile), 관리자 권한 통합 |
| v1.35.1 | 2026-06-30 | (이전 작업) |

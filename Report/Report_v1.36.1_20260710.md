# 작업 보고서

## 기본 정보
- **버전**: v1.36.1-20260710
- **작업 일시**: 2026-07-10
- **이전 버전**: v1.36.0-20260707
- **프로젝트명**: Yapp (qkiki-workbench)

## 작업 요약
중단되어 있던 Supabase Auth 전환 작업의 실제 적용 상태를 점검하고, 운영 Supabase DB에 누락된 인증 마이그레이션을 적용했습니다. 또한 새 Supabase Auth용 public 테이블의 RLS/권한을 보강하고, Supabase Dashboard의 URL Configuration 및 Email provider 보안 설정을 실제 운영값으로 조정했습니다.

## 변경 사항

### 추가된 기능
- `20260710120000_harden_supabase_auth_table_grants` 마이그레이션을 추가해 `profiles`, `billing_customers`, `subscriptions`에서 `anon`/`PUBLIC` 테이블 권한을 회수했습니다.
- `/api/auth/health` 진단에 `supabaseServiceRoleConfigured`, `turnstileConfigured` 상태를 추가했습니다.
- `docs/AUTH_SETUP.md`에 2026-07-10 기준 실제 운영 적용 현황과 남은 외부 설정 항목을 추가했습니다.

### 수정된 사항
- Supabase 원격 DB에 `20260707120000_supabase_auth` 및 `20260710120000_harden_supabase_auth_table_grants`를 적용하고 Prisma migration history에 반영했습니다.
- Supabase Dashboard URL Configuration을 운영 도메인 기준으로 설정했습니다.
  - Site URL: `https://yapp.wideget.net`
  - Redirect URLs: `https://yapp.wideget.net/auth/callback`, `http://localhost:3000/auth/callback`
- Supabase Email provider에서 leaked-password protection을 켜고 최소 비밀번호 길이를 8자로 맞췄습니다.
- Vercel Production에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 추가했습니다.
- 버전을 `v1.36.1-20260710`으로 갱신했습니다.

### 제거/정리된 사항
- 없음.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| prisma/migrations/20260707120000_supabase_auth/migration.sql | 수정 | RLS 정책과 function 권한 보강 |
| prisma/migrations/20260710120000_harden_supabase_auth_table_grants/migration.sql | 추가 | 새 Supabase Auth 테이블의 anon/PUBLIC 권한 회수 |
| src/lib/auth-config.ts | 수정 | auth health 진단 항목 확장 |
| docs/AUTH_SETUP.md | 수정 | 실제 운영 적용 상태와 남은 설정 항목 기록 |
| VERSION, src/lib/version.ts | 수정 | v1.36.1-20260710 반영 |

## 검증
- `npx tsc --noEmit` 통과
- `npx eslint` 통과
- `npm test` 통과: 190개 테스트
- `npm run build` 통과
- Supabase 원격 DB 확인:
  - `User.supabaseUserId` 존재
  - `User.passwordHash` nullable
  - `profiles`, `billing_customers`, `subscriptions` 존재
  - `on_auth_user_created` trigger 존재
  - 세 신규 테이블 RLS enabled
  - `authenticated` SELECT 가능, `anon` SELECT 불가

## 남은 이슈 / 후속 작업
- Google/Kakao OAuth provider는 외부 provider credentials가 없어 아직 Supabase Dashboard에서 활성화하지 못했습니다.
- Cloudflare 로그인이 필요해 Turnstile widget 생성 및 Supabase CAPTCHA 활성화는 아직 남아 있습니다.
- `SUPABASE_SERVICE_ROLE_KEY`가 비어 있어 기존 59명 사용자 Supabase Auth 이전 스크립트는 아직 실행하지 못했습니다.
- Custom SMTP가 아직 설정되지 않았고 현재 Supabase shared mailer email rate limit은 2 emails/hour입니다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.36.1 | 2026-07-10 | Supabase DB 실제 적용, URL/Email Dashboard 설정, RLS 권한 보강 |
| v1.36.0 | 2026-07-07 | Supabase Auth 전환 코드 도입 |

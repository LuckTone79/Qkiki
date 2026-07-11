# 작업 보고서 — v1.38.0 보안 하드닝 1차 (2026-07-10)

## 목적

런칭 전 사이트 전체 보안 취약점을 점검하고 `.env` 비밀값이 저장소, 응답, 로그, URL로 유출되는 경로를 우선 차단한다.

## 점검 범위

- API 라우트, 인증·암호화·관리자 모듈, `next.config.ts`, `proxy.ts`, `.gitignore`, 커밋된 로그, 클라이언트 번들의 `NEXT_PUBLIC_*` 노출.

## 당시 조치

1. Google API 키를 URL 쿼리스트링 대신 `x-goog-api-key` 헤더로 전송.
2. 운영환경에서 공개된 개발용 폴백 암호화 키 사용을 거부.
3. 미처리 500 응답의 내부 에러 원문을 일반 메시지로 교체.
4. sign-in, sign-up, admin sign-in, coupon redeem, trial start에 429 레이트리밋 추가.
5. 관리자 MFA 비교를 timing-safe 비교로 변경.
6. CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy 적용.
7. `/api/auth/health`를 `{ ok }` 하나로 축소하고 `no-store` 적용.
8. 운영 부팅 시 자리표시자·약한 비밀값을 검증하는 env guard 추가.
9. 개발 서버 로그의 Git 추적을 해제하고 ignore 규칙을 보강.

## 당시 잔여 리스크

- 정적 관리자 MFA, 인메모리 서버리스 레이트리밋, 가입 이메일 열거, 비밀 로테이션, 의존성 감사 게이트.
- 이 항목들은 2026-07-11 2차 감사에서 실제 공격 경로를 기준으로 재검토한다.

# Qkiki(Yapp) 보안 아키텍처 및 방어 설계

최종 갱신: v1.38.0 (2026-07-10) — 런칭 전 보안 점검 결과 반영.

## 1. 위협 모델 요약

| 자산 | 주요 위협 | 방어 계층 |
| --- | --- | --- |
| `.env` 비밀값 (DB URL, API 키, APP_SECRET 등) | 저장소 커밋 유출, 응답/로그 노출, 기본값 방치 | git 무시 규칙, env-guard 부팅 검증, 응답 메시지 새니타이즈 |
| 사용자/관리자 세션 | 탈취, 브루트포스, CSRF | httpOnly+Secure 쿠키, 토큰 해시 저장, SameSite=Lax, 레이트리밋 |
| AI 공급자 API 키 | DB 유출, URL/로그 유출 | AES-256-GCM 암호화 저장, 마스킹 응답, 헤더 전송(쿼리스트링 금지) |
| 내부 워커 엔드포인트 | 위조 호출 | QStash 서명 검증 + HMAC 폴백(타이밍세이프, 5분 유효) |
| 관리자 패널 | 권한 상승, MFA 브루트포스 | 역할 3단계(RBAC), 운영 MFA 코드(타이밍세이프 비교), 감사 로그 |

## 2. 환경변수(.env) 유출 방지 체계

**목표: env 파일의 정보가 어떤 경로로도 외부에 나가지 않게 한다.**

1. **저장소 유출 차단**
   - `.gitignore`가 `.env*` 전체를 무시하고 `.env.example`(자리표시자만 포함)만 허용.
   - 개발 서버 로그(`.codex-*`, `*.log`, `Report/*.log`)를 git 추적에서 제거하고 무시 목록에 추가 — 로그에는 요청 데이터·환경 정보가 섞일 수 있음.
2. **부팅 시 검증 (`src/instrumentation.ts` → `src/lib/env-guard.ts`)**
   - 운영(NODE_ENV=production)에서 `APP_SECRET` 미설정/16자 미만/`.env.example` 자리표시자 값이면 **서버 기동 자체를 거부**.
   - `DB_ENCRYPTION_KEY`, `ADMIN_MFA_CODE`가 자리표시자(`change-me` 등)면 기동 거부. 미설정이면 경고 로그.
3. **런타임 노출 차단**
   - 클라이언트 번들에 노출되는 `NEXT_PUBLIC_*` 비밀값 없음(검증 완료 — 서버 전용 `NEXT_PUBLIC_APP_URL` 폴백 1건뿐이며 비밀 아님).
   - 핵심 비밀 사용 모듈은 `import "server-only"`로 클라이언트 번들 유입을 컴파일 타임에 차단.
   - 미처리 500 응답은 항상 일반 메시지(`Request failed.`)만 반환. Prisma/드라이버 에러 메시지(연결 문자열 포함 가능)는 서버 로그에만 남김.
   - `/api/auth/health`는 `{ ok }` 불리언만 반환 — 어떤 env가 설정됐는지 외부에서 매핑 불가.
   - Google API 키를 URL 쿼리스트링(`?key=`) 대신 `x-goog-api-key` 헤더로 전송 — 프록시/액세스 로그/에러 메시지를 통한 키 유출 경로 제거.
4. **암호화 키 기본값 금지**
   - `secret-crypto.ts`·`access-policy.ts`의 개발용 폴백 키는 운영에서 사용 시도 시 즉시 예외 발생(공개된 키로 "암호화"되는 상태 방지).

## 3. 인증·세션 구조

- **세션 토큰**: 32바이트 랜덤 → SHA-256 해시만 DB 저장(DB 유출 시에도 토큰 재사용 불가). 쿠키는 `httpOnly`, `SameSite=Lax`, 운영에서 `Secure`.
- **관리자 세션**: 별도 쿠키·별도 테이블, 7일 만료, MFA 검증 시각 필수. `ADMIN_MFA_CODE` 미설정 시 관리자 로그인 전면 차단(503).
- **MFA 비교**: SHA-256 다이제스트 후 `crypto.timingSafeEqual` — 타이밍 부채널 제거.
- **비밀번호**: bcrypt cost 12.
- **도메인 핸드오프**: 60초 TTL의 HMAC 서명 토큰, 소비 시 원본 세션 삭제(1회용).
- **Google OAuth**: HMAC 서명 state 쿠키(10분 TTL), 타이밍세이프 검증, `next` 경로는 `/app` 내부로만 허용(오픈 리다이렉트 차단).

## 4. 레이트리밋 (v1.38.0 신규)

`src/lib/rate-limit.ts` — 고정 윈도우 인메모리 리미터.

| 엔드포인트 | 한도 | 키 |
| --- | --- | --- |
| `POST /api/auth/sign-in` | 10회/분 | IP |
| `POST /api/auth/sign-up` | 5회/10분 | IP |
| `POST /api/admin/auth/sign-in` | 5회/분 | IP |
| `POST /api/coupons/redeem` | 10회/분 | IP+사용자 |
| `POST /api/trial/start` | 10회/분 | IP |

한도 초과 시 `429` + `Retry-After`. 서버리스 환경에서는 인스턴스별 카운터라는 한계가 있으므로, 트래픽 증가 시 동일 인터페이스로 `@upstash/ratelimit`(Redis) 교체를 권장(이미 Upstash QStash 사용 중이라 도입 비용 낮음).

## 5. HTTP 보안 헤더 (v1.38.0 신규)

`next.config.ts`에서 전 경로에 적용:

- `Content-Security-Policy`: `default-src 'self'` 기반. 앱은 외부 스크립트/폰트 CDN을 쓰지 않으므로(next/font 셀프호스팅) 전 소스 1st-party. 이미지 원격 소스는 Unsplash만 허용. `frame-ancestors 'none'`(클릭재킹 차단), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. 정적 목업(`/design-concepts`)만 CSP 제외.
- `Strict-Transport-Security`(운영): 2년, includeSubDomains, preload.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`(카메라·마이크·위치·결제 차단), `poweredByHeader: false`.

## 6. 데이터 보호

- **공급자 API 키(관리자 등록분)**: AES-256-GCM(키: `DB_ENCRYPTION_KEY`, 폴백 `APP_SECRET`) 암호화 저장. 응답에는 마스킹 값(`sk-a****xyz`)만 포함, 원문 반환 API 없음.
- **첨부파일**: 허용 확장자·MIME 화이트리스트(TEXT/PDF/IMAGE), 텍스트 추출 길이 상한 40k. 피드백 첨부 원본은 작성자 본인 또는 관리자만 열람.
- **공유 링크**: 18바이트 랜덤 토큰(base64url), 충돌 시 재생성.
- **감사 로그**: 관리자 로그인 성공/실패, MFA 실패, 키 변경, 설정 변경을 IP·UA와 함께 기록.

## 7. 잔여 리스크 및 권장 후속 조치 (코드 외 운영 항목)

1. **`x-forwarded-for` 신뢰**: 체험판 IP 제한과 레이트리밋 키가 XFF 첫 값을 사용. Vercel 등 신뢰 가능한 프록시 뒤에서는 안전하지만, 다른 인프라로 이전 시 신뢰 프록시 설정을 재검토할 것.
2. **관리자 MFA가 정적 공유 코드**: 운영 코드를 주기적으로 로테이션하고, 장기적으로 TOTP(사용자별) 전환 권장.
3. **회원가입 이메일 열거**: "이미 존재하는 이메일" 응답으로 가입 여부 확인 가능. 이메일 인증 도입 시 응답 통일 권장.
4. **분산 레이트리밋**: §4 참조 — Redis 기반으로 승격 권장.
5. **비밀 로테이션 절차**: `DB_ENCRYPTION_KEY` 교체 시 기존 암호문은 `APP_SECRET` 폴백 복호화 후 자동 재암호화되는 구조가 이미 있으므로, 로테이션 시 두 값을 한 번에 바꾸지 말 것.
6. **의존성 감사**: 배포 파이프라인에 `npm audit --omit=dev` 게이트 추가 권장.

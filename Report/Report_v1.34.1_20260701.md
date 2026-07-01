# Report v1.34.1 (2026-07-01) — 정식 도메인 yapp.wideget.net 강제 / 레거시 qkiki 도메인 포워딩

## 증상
`yapp.wideget.net` 접속 시 브라우저 주소가 `https://qkiki.wideget.net` 으로 바뀌는 문제.

## 원인 분석
1. **Vercel 도메인 설정** — 프로젝트에 `yapp.wideget.net`, `qkiki.wideget.net`이 모두
   연결돼 있고, `qkiki.wideget.net`이 **기본(primary) 프로덕션 도메인**으로 지정돼 있어
   Vercel 플랫폼이 `yapp.wideget.net` 요청을 primary(qkiki)로 308 리다이렉트함.
   (익명 요청 시 `yapp.wideget.net`은 배포 보호로 403 → 앱 코드 리다이렉트가 아님을 확인)
2. **런타임 환경변수** — 프로덕션 `CANONICAL_APP_URL`/`APP_BASE_URL` 이 여전히
   `https://qkiki.wideget.net` 로 설정돼 있어, 앱의 정식 URL·리다이렉트·절대링크가
   qkiki 기준으로 동작.

## 코드 변경 (이번 커밋)
앱 레벨에서 Yapp 을 정식 호스트로 강제하도록 `src/lib/canonical-host.ts` 개선:
- **레거시 env 자동 업그레이드** — `CANONICAL_APP_URL` 이 `qkiki.wideget.net` 로
  남아 있어도 `resolveCanonicalAppUrl` 이 이를 `yapp.wideget.net` 으로 자동 치환.
  (Vercel env 변경 전에도 앱이 Yapp 을 정식 호스트로 인식)
- **레거시 도메인 포워딩** — `qkiki.wideget.net`(및 `www.`)을 리다이렉트 대상에 추가해
  구 도메인 접속 시 정식 도메인(`yapp.wideget.net`)으로 이동.
- `.env.example` 의 `APP_BASE_URL`/`CANONICAL_APP_URL` 기본값을 yapp 으로 갱신.
- 테스트 추가: 레거시 env 업그레이드, 구 도메인 → yapp 포워딩. (canonical-host 13/13 pass)

버전: `v1.34.0 → v1.34.1-20260701`

## 남은 조치 (Vercel 대시보드 — 코드로 불가)
브라우저 주소가 바뀌는 근본 원인은 Vercel 도메인 설정이므로 아래는 대시보드에서 변경 필요:
1. **Settings → Domains**: `yapp.wideget.net` 을 **Primary** 로 지정,
   `qkiki.wideget.net` 은 **Redirect → yapp.wideget.net** 으로 설정.
2. **Settings → Environment Variables (Production)**:
   `CANONICAL_APP_URL`, `APP_BASE_URL` → `https://yapp.wideget.net` 로 변경 후 재배포.
   (이번 코드로 env 미변경 시에도 앱은 Yapp 을 쓰지만, 값 자체도 맞추는 것이 명확함)

## 검증
- `canonical-host` 테스트 13/13 통과. 전체 스위트 137/138 (실패 1건은 docx(mammoth)
  파싱 테스트로 이번 변경과 무관한 샌드박스 환경 이슈).

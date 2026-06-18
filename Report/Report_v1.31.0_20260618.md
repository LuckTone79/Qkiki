# Report v1.31.0 (2026-06-18) — Qkiki → Yapp 리브랜딩 재적용

## 배경
코덱스에서 진행했던 `Qkiki → Yapp` 리브랜딩이 이후 다른 작업 과정에서 사용자 노출
텍스트가 다시 `Qkiki`로 원복된 상태였다. 브랜드 상수(`src/lib/brand.ts`)는 이미
`Yapp`으로 설정되어 있었으나, 다수의 UI 컴포넌트/페이지가 `"Qkiki"` 문자열을
하드코딩하고 있어 메인·가이드·관리자 사이트가 여전히 Qkiki로 표시되었다.

이번 작업에서 모든 **사용자 노출 브랜딩**을 다시 `Yapp`으로 변경하고, 정식 도메인을
`yapp.wideget.net`으로 일원화했다.

## 변경 원칙
- **사용자에게 보이는 텍스트(대문자 `Qkiki`)** → `Yapp` 으로 전부 변경
- **정식 도메인** → `https://yapp.wideget.net` (가비아 등록 완료된 도메인)
- **내부 식별자**(세션 쿠키, 스토리지 버킷, 워커 인증 헤더, DB 스텝키, localStorage 키,
  env 변수, 레거시 마이그레이션 상수)는 **시스템 안정성을 위해 유지** — 변경 시
  기존 로그인 세션/저장 파일/진행 중 작업/사용자 로컬 데이터가 깨질 수 있어 그대로 둠.

## 변경 내역

### 정식 도메인 (canonical)
- `next.config.ts` — 레거시 `qkiki.vercel.app` → 정식 도메인 리다이렉트 목적지를
  `https://qkiki.wideget.net` → `https://yapp.wideget.net` 으로 변경
- `src/lib/canonical-host.ts` — `DEFAULT_CANONICAL_APP_URL` 을 `yapp.wideget.net` 으로 변경
  (레거시 `qkiki.vercel.app` 별칭 → 새 정식 도메인 리다이렉트 처리는 유지)
- `src/lib/canonical-host.test.mjs` — 기대 정식 도메인을 yapp 으로 업데이트

### 사용자 노출 텍스트 (총 66개 문자열, 28개 파일)
메인/가이드/관리자/결제/피드백/인증 전반의 `Qkiki` → `Yapp`:
- `src/app/layout.tsx` (메타 title/description)
- `src/app/page.tsx`, `src/app/guide/page.tsx`, `src/app/guide/global-monetization/page.tsx`
- `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/app/pricing/page.tsx`
- `src/app/admin/(panel)/about/page.tsx`, 관리자 피드백 페이지
- 피드백/인증 API 라우트의 표시명(`authorName`, 안내 메시지)
- `src/components/AppShell.tsx`(상단 브랜드), `AdminShell.tsx`, `AdminSignInCard.tsx`
- `UsageStatus.tsx`, `LimitReachedModal.tsx`, 피드백/계정 컴포넌트
- `src/components/i18n/LanguageProvider.tsx` (랜딩 한/영 카피)
- `src/lib/ai/prompt.ts` ("Yapp Orchestration Workbench") 및 관련 테스트
- `src/components/workbench/ResultCard.tsx` — 이미지 다운로드 파일명 `yapp-image-*.png`

### 버전
- `VERSION`, `src/lib/version.ts` → `v1.31.0-20260618`
  (관리자 About 페이지에 노출)

## 유지(미변경) 내역 및 사유
| 항목 | 위치 | 사유 |
|------|------|------|
| 세션/관리자/트라이얼 쿠키 `qkiki_*` | `auth-constants.ts` | 변경 시 전체 로그인 세션 무효화 |
| OAuth state 쿠키 `qkiki_google_oauth_state` | `google-oauth.ts` | 진행 중 OAuth 흐름 깨짐 |
| 스토리지 버킷 `qkiki-storage` | `feedback.ts`, `attachments.ts` | 기존 업로드 파일 접근 불가 위험 |
| 워커 인증 헤더 `X-Qkiki-*` | `qstash.ts`, `internal-worker-auth.ts` | 송수신 쌍, 진행 중 메시지 인증 실패 위험 |
| DB 스텝키 `qkiki:run:*` | `execution-run-steps.ts`, rerun 라우트 | 진행 중/저장된 실행 단계 참조 무결성 |
| localStorage 키 `qkiki-*` | `local-cache.ts`, `LanguageProvider`, `AppShell` | 사용자 초안/설정 캐시 유실 방지 |
| env 변수 `QKIKI_WEB_SEARCH_ENABLED` | `provider-web-search.ts` | 배포 환경변수 재설정 필요 |
| 내부 export 식별자 `QKIKI_*` | `billing-plans.ts` 등 | 비노출 코드 식별자, 변경 이득 없음 |
| 레거시 상수 `LEGACY_APP_*` | `brand.ts` | 구→신 마이그레이션 정의값으로 의도적 유지 |

## 외부 시스템 (Vercel / GitHub / Supabase)
프로젝트/리포지토리/Supabase 프로젝트 명칭 변경은 배포 별칭·원격·연결에 영향을 주어
오류 위험이 있으므로 **기존 그대로 유지**한다(요청의 "안정적이면 그대로" 지침에 부합).
정식 도메인 `yapp.wideget.net` 의 실제 DNS/Vercel 도메인 연결은 대시보드에서 사용자가
연결하면 코드가 이를 정식 호스트로 인식하도록 이미 반영됨.

## 검증
- 변경 파일 단위 테스트 통과: `canonical-host`, `prompt`, `workbench-run-payload`,
  `billing-plans` — **34/34 pass**
- `src/` 잔여 `qkiki` 참조는 위 표의 의도적 내부 식별자만 남음(전수 확인 완료)

---

## 추가: 글자수 제한 제거

글자수(입력 문자 수) 제한 게이트를 완전히 제거했습니다.

입력 비용은 크레딧 시스템이 정확하게 과금하고 있어 글자수 하드 차단은 불필요한 중복 제어로 판단, 완전 제거함.

| 파일 | 변경 내용 |
|---|---|
| `src/lib/billing-plans.ts` | `PlanLimitPolicy`에서 `inputCharLimit` 필드 제거, 전 플랜 설정에서 해당 값 제거 |
| `src/lib/usage-policy.ts` | `UsageInputLimitError` 클래스 삭제, `UsageStatusSummary`/`ResolvedUsagePolicy`에서 `inputCharLimit` 필드 제거, `requireUsageAccess()`의 글자수 차단 체크 제거 |
| `src/lib/api-auth.ts` | `UsageInputLimitError` import 제거, `INPUT_TOO_LONG` 에러 응답 핸들러 제거 |
| `src/lib/usage-types.ts` | `UsageStatus`에서 `inputCharLimit` 필드 제거, `UsageErrorPayload`에서 `"INPUT_TOO_LONG"` 코드 제거 |
| `src/app/app/pricing/page.tsx` | "Input limit" 표시 항목 제거 |

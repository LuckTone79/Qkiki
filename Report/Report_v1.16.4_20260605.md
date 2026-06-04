# 작업 보고서
## 기본 정보
- 버전: `v1.16.4-20260605`
- 작업 일시: `2026-06-05`
- 이전 버전: `v1.16.3-20260605`
- 프로젝트: `Qkiki / Multi AI Workbench`

## 작업 목적
`v1.16.3` 재배포 후에도 `https://qkiki.vercel.app/` 및 `https://qkiki.vercel.app/sign-in`이 여전히 `200 OK`로 열리면서 canonical host redirect가 정적 페이지에서 빠지는 현상이 남아 있었습니다.

이번 수정의 목적은 production alias인 `qkiki.vercel.app`에서 들어오는 브라우저 요청이, proxy runtime의 환경 변수 노출 여부와 상관없이 안정적으로 canonical host 처리되도록 보강하는 것입니다.

## 원인 분석
`proxy.ts`는 이미 `Host` 헤더 기준 hostname 계산으로 한 번 보정된 상태였지만, 실제 canonical 판정 함수 `getCanonicalHostRedirectUrl()`은 여전히 `resolveCanonicalAppUrl(env)`가 `null`이면 바로 종료하고 있었습니다.

production route handler에서는 `VERCEL_ENV=production`이 살아 있어 canonical 판단이 됐지만, proxy runtime에서는 같은 환경 값이 비어 있는 경우가 있어 다음 현상이 발생했습니다.

- `/api/auth/sign-in` POST: route handler 레벨에서 409 + redirectUrl 동작
- `/`, `/sign-in`: proxy canonical 분기 미작동, 그대로 200 응답

즉 핵심 문제는 **proxy runtime에서 env가 비어도 production alias를 판정할 fallback이 없었다는 점**이었습니다.

## 적용한 수정
- `src/lib/canonical-host.ts`에서 `resolveCanonicalAppUrl(env)`가 `null`이어도, 요청 host가 정확히 `qkiki.vercel.app`이면 기본 canonical URL `https://qkiki.wideget.net`을 사용하도록 fallback을 추가했습니다.
- 이를 검증하는 테스트를 `src/lib/canonical-host.test.mjs`에 추가했습니다.

## 변경 파일
- `src/lib/canonical-host.ts`
- `src/lib/canonical-host.test.mjs`
- `VERSION`
- `src/lib/version.ts`
- `Report/Report_v1.16.4_20260605.md`

## 검증
- `node --test src/lib/auth-handoff.test.mjs src/lib/canonical-host.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

## 기대 효과
- `qkiki.vercel.app`로 직접 열린 랜딩/로그인 페이지도 production에서 `qkiki.wideget.net` canonical 흐름으로 정리됩니다.
- 기존에 추가한 session handoff와 함께, 예전 alias 세션에서 canonical host로 넘어갈 때 로그인 유지 가능성이 실제 브라우저 흐름에서 더 높아집니다.

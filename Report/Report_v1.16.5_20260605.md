# 작업 보고서
## 기본 정보
- 버전: `v1.16.5-20260605`
- 작업 일시: `2026-06-05`
- 이전 버전: `v1.16.4-20260605`
- 프로젝트: `Qkiki / Multi AI Workbench`

## 작업 목적
proxy와 route handler 보강 후에도 `qkiki.vercel.app`의 정적 랜딩/로그인 페이지는 prerender 응답이 먼저 나가면서 canonical redirect가 충분히 강제되지 않았습니다.

이번 수정의 목적은 사용자가 같은 브라우저에서 새 창을 열거나 `qkiki.vercel.app`로 잘못 진입하더라도, **그 호스트에 세션 쿠키가 없을 때는 브라우저 페이지 요청을 곧바로 `qkiki.wideget.net`으로 보내도록** 만드는 것입니다.

## 핵심 아이디어
- `next.config.ts`의 `redirects()`는 filesystem보다 먼저 적용됩니다.
- host 조건과 cookie missing 조건을 함께 걸 수 있습니다.
- 따라서 `qkiki.vercel.app`에 `qkiki_session` 쿠키가 없는 경우에만:
  - `/`
  - `/sign-in`
  - `/sign-up`
  - `/app/*`
  - `/guide`
  같은 브라우저 페이지 요청을 `https://qkiki.wideget.net`으로 넘길 수 있습니다.

이 방식의 장점은 다음과 같습니다.
- `wideget`에서 로그인한 사용자가 `vercel.app`로 잘못 열어도 다시 로그인하라는 화면 대신 canonical host로 이동
- 이미 `vercel.app` 세션 쿠키가 남아 있는 오래된 세션은 강제로 끊지 않음
- `/api/*`, `/_next/*`, `/.well-known/*` 같은 내부 경로는 건드리지 않음

## 적용한 수정
- `next.config.ts`
  - host=`qkiki.vercel.app`
  - missing cookie=`qkiki_session`
  - destination=`https://qkiki.wideget.net...`
  조건의 브라우저 페이지 redirect 2개 추가
- `VERSION`
- `src/lib/version.ts`
- `Report/Report_v1.16.5_20260605.md`

## 검증
- `node --test src/lib/auth-handoff.test.mjs src/lib/canonical-host.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

## 기대 효과
- 같은 브라우저에서 새 창을 열었을 때 `qkiki.vercel.app`로 들어가도, 해당 호스트에 세션이 없으면 자동으로 `qkiki.wideget.net`으로 이동합니다.
- `wideget`에서 로그인한 사용자는 canonical host 안에서 같은 세션을 그대로 이어서 쓰게 됩니다.
- 기존 `vercel.app` 쿠키를 가진 오래된 세션은 즉시 깨지지 않고, 점진적으로 canonical host로 정리됩니다.

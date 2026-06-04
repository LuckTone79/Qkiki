# 작업 보고서
## 기본 정보
- 버전: `v1.16.3-20260605`
- 작업 일시: `2026-06-05`
- 이전 버전: `v1.16.2-20260605`
- 프로젝트: `Qkiki / Multi AI Workbench`

## 작업 목적
`v1.16.2` 배포 후 production 실응답을 확인하는 과정에서 `https://qkiki.vercel.app/sign-in`이 여전히 `200 OK`로 열리고, canonical host인 `https://qkiki.wideget.net/sign-in`으로 강제 이동하지 않는 문제가 확인되었습니다.

이번 추가 수정의 목표는 production alias에서 정적 페이지까지 포함해 canonical host redirect가 실제로 적용되도록 마무리하는 것입니다.

## 원인 분석
`proxy.ts`의 canonical host 판정은 `request.nextUrl.hostname`을 사용하고 있었습니다.

하지만 Vercel production alias 환경에서는 정적 페이지 요청에서 이 값이 실제 브라우저의 `Host` 헤더와 다르게 보일 수 있습니다. 그 결과:

- `/api/auth/sign-in` 같은 동적 route는 route handler 레벨 보정으로 정상 동작
- `/sign-in`, `/`, `/guide` 같은 정적/프리렌더 페이지는 proxy 단계에서 canonical redirect가 누락

즉, host 통일 로직 자체는 있었지만 **판정 기준이 실제 요청 host가 아니어서 일부 페이지에서 빠지는 문제**였습니다.

## 적용한 수정
- `proxy.ts`에서 canonical host 판정용 hostname을 `request.headers.get("host")` 기준으로 계산하도록 변경했습니다.
- 포트가 붙는 경우를 대비해 `host.split(":")[0]`로 정규화했습니다.
- `Host` 헤더가 없을 때만 기존 `request.nextUrl.hostname`으로 fallback하도록 유지했습니다.

## 변경 파일
- `proxy.ts`
- `VERSION`
- `src/lib/version.ts`
- `Report/Report_v1.16.3_20260605.md`

## 검증
- `node --test src/lib/auth-handoff.test.mjs src/lib/canonical-host.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

## 기대 효과
- `qkiki.vercel.app`로 직접 들어온 브라우저 GET/HEAD 요청도 production에서 안정적으로 `qkiki.wideget.net`으로 이동합니다.
- 같은 브라우저에서 새 탭/새 창을 열 때 호스트가 섞여도 canonical host 기준으로 세션 흐름이 정리됩니다.
- 기존에 추가한 session handoff와 함께, 예전 `vercel.app` 세션에서 `wideget.net`으로 넘어가는 로그인 유지 경로가 더 안정적으로 동작합니다.

# 작업 보고서
## 기본 정보
- 버전: `v1.16.2-20260605`
- 작업 일시: `2026-06-05`
- 이전 버전: `v1.16.1-20260604`
- 프로젝트: `Qkiki / Multi AI Workbench`

## 작업 목적
같은 브라우저에서 이미 로그인한 뒤에도, 접속 호스트가 `qkiki.vercel.app`과 `qkiki.wideget.net` 사이에서 섞이면 다시 로그인을 요구하는 문제가 있었습니다.
이번 작업의 목표는 다음 두 흐름에서 로그인 상태가 유지되도록 구조적으로 고치는 것이었습니다.

- 같은 브라우저 탭에서 랜딩 페이지 `https://qkiki.wideget.net`로 이동하는 경우
- 같은 브라우저에서 새 창을 추가로 열어 다시 진입하는 경우

핵심 원인은 세션 쿠키 자체보다 **production에서 사용자 브라우저가 서로 다른 호스트를 오가며 접속하는 구조**에 있었습니다.

## 원인 분석
현재 세션 쿠키 `qkiki_session`은 정상적인 persistent cookie로 저장되고 있었습니다.
하지만 아래 조건이 겹치면 로그인 상태가 끊긴 것처럼 보일 수 있습니다.

- 사용자가 `qkiki.vercel.app`에서 로그인함
- 이후 `qkiki.wideget.net`로 이동함
- 또는 반대로 `qkiki.wideget.net`에서 쓰다가 `qkiki.vercel.app` 쪽으로 다시 진입함

이 두 도메인은 서로 다른 사이트이므로, 브라우저 쿠키를 자동으로 공유하지 않습니다.
즉 “같은 브라우저인데도 다시 로그인해야 하는 것”은 세션 저장 실패가 아니라 **호스트가 일관되지 않은 것**이 본질적인 문제였습니다.

## 적용한 해결 방식
### 1. canonical host 강제
- production 환경에서는 사용자 브라우저 진입을 `https://qkiki.wideget.net` 하나로 통일하도록 구성했습니다.
- `qkiki.vercel.app` 또는 다른 `*.vercel.app` production 호스트로 들어오면, 사용자 브라우저 요청을 canonical host로 `308` 리다이렉트합니다.

### 2. 내부 런타임 경로 제외
- QStash/internal worker와 workflow manifest/webhook은 host 강제 리다이렉트 대상에서 제외했습니다.
- 제외 경로:
  - `/api/internal/*`
  - `/.well-known/workflow/*`
  - 정적 자산 경로

### 3. POST 인증 요청은 건드리지 않음
- 로그인/회원가입 POST 요청 자체는 리다이렉트하지 않도록 했습니다.
- 사용자는 먼저 canonical host로 들어오고, 그 후 같은 호스트에서 인증을 진행하게 됩니다.

### 4. 환경변수 예시 정리
- `.env.example`의 기본 `APP_BASE_URL`을 `https://qkiki.wideget.net` 기준으로 바꿨습니다.
- 추후 도메인 변경이 가능하도록 `CANONICAL_APP_URL` 예시도 추가했습니다.

## 추가/변경 파일
- `proxy.ts`
- `src/lib/canonical-host.ts`
- `src/lib/canonical-host.test.mjs`
- `.env.example`
- `VERSION`
- `src/lib/version.ts`

## 테스트
### TDD
canonical host 로직은 테스트를 먼저 작성하고, 실패를 확인한 뒤 구현했습니다.

추가한 테스트:
- production에서 canonical host 기본값이 `qkiki.wideget.net`인지 확인
- `qkiki.vercel.app`에서 브라우저 페이지 요청 시 redirect 대상이 되는지 확인
- canonical host에서는 redirect하지 않는지 확인
- `/api/internal/*` 같은 내부 worker 경로는 redirect하지 않는지 확인
- `POST /api/auth/sign-in` 같은 비멱등 요청은 redirect하지 않는지 확인
- canonicalization 시 path와 query를 그대로 유지하는지 확인

## 검증 결과
- `node --test src/lib/canonical-host.test.mjs` 통과

이번 턴에서는 우선 canonical host 로직을 고정하고, 이후 전체 lint/build 검증과 production 배포 검증으로 이어갈 수 있는 상태까지 만들었습니다.

## 상위 모델 재검토
- 사용자 요청에 따라 이 변경은 바로 확정하지 않고, 별도의 상위 모델 리뷰를 병렬로 요청한 뒤 반영 여부를 최종 결정하는 흐름으로 진행했습니다.
- 리뷰 대상:
  - `proxy.ts`
  - `src/lib/canonical-host.ts`
  - `src/lib/canonical-host.test.mjs`
  - `.env.example`
  - 인증 관련 파일

## 기대 효과
- 사용자가 같은 브라우저 안에서 이동할 때 production 호스트가 하나로 고정됩니다.
- 따라서 이미 로그인한 상태에서 랜딩으로 다시 가거나 새 창을 열어도, 같은 canonical host 안에서는 추가 로그인을 요구하지 않게 됩니다.

## 남은 확인 항목
- production에서 `qkiki.vercel.app -> qkiki.wideget.net` 리다이렉트 실응답 확인
- 실제 로그인 세션을 가진 브라우저 컨텍스트에서 새 창 재진입 확인
- 상위 모델 리뷰 결과에 따른 보정이 필요한지 최종 점검

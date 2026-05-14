# 작업 보고서
## 기본 정보
- **버전**: v1.11.1-20260514
- **작업 일시**: 2026-05-14
- **이전 버전**: v1.11.0-20260514
- **프로젝트명**: qkiki-workbench

## 작업 요약
일부 휴대폰에서 Google 로그인 시 `Error 403: disallowed_useragent`가 뜨는 문제를 조사했고, 원인이 카카오톡 같은 인앱 브라우저/임베디드 웹뷰에서 Google OAuth를 여는 동작이라는 점을 확인했습니다. 이에 따라 인앱 브라우저 감지와 외부 브라우저 유도 화면을 추가해 Google의 secure browser 정책에 맞는 흐름으로 보완했습니다.

## 변경 사항
### 추가된 기능
- `src/lib/browser-detection.ts` 추가
  - 인앱 브라우저/임베디드 웹뷰 user-agent 감지
  - 외부 브라우저 유도 경로 생성
  - Android Chrome intent URL 생성
- `src/app/open-in-browser/page.tsx` 추가
  - Google 로그인이 차단되는 환경에서 외부 브라우저로 다시 열 수 있는 안내 페이지

### 수정된 사항
- `src/app/api/auth/google/start/route.ts`
  - Google OAuth 시작 전에 user-agent를 검사
  - 인앱 브라우저면 바로 Google로 보내지 않고 `open-in-browser` 안내 페이지로 우회
- `src/components/AuthForm.tsx`
  - 클라이언트에서도 인앱 브라우저를 미리 감지
  - Google 버튼 클릭 시 외부 브라우저 안내 페이지로 먼저 보내도록 개선
  - `google_secure_browser_required` 에러 메시지 추가

## 원인 분석
- 문제는 OAuth 코드 교환이나 callback 로직이 아니라, **로그인 시작 요청이 일부 휴대폰의 인앱 브라우저에서 열리는 것**이었습니다.
- Google 공식 정책은 OAuth 요청을 개발자가 제어하는 embedded user-agent/webview로 보내면 안 된다고 명시합니다.
- 따라서 같은 휴대폰이라도 Chrome/Safari에서는 되고, 카카오톡/인스타/페이스북 인앱 브라우저에서는 막힐 수 있습니다.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| src/lib/browser-detection.ts | 추가 | 인앱 브라우저 감지 및 외부 브라우저 유도 helper |
| src/app/api/auth/google/start/route.ts | 수정 | embedded browser 차단 및 안내 페이지 우회 |
| src/components/AuthForm.tsx | 수정 | Google 버튼 클릭 시 클라이언트 선감지 처리 |
| src/app/open-in-browser/page.tsx | 추가 | Chrome/Safari로 다시 열기 안내 UI |
| VERSION | 수정 | 버전 갱신 |
| src/lib/version.ts | 수정 | UI 버전 표기 갱신 |

## 검증
- `npm run lint` 통과
- `npm run build` 통과
- Google OAuth 시작 라우트와 새 안내 페이지가 빌드 산출물에 포함되는 것 확인

## 남은 이슈 / 추후 작업
- iOS 인앱 브라우저는 시스템 제약상 강제 Safari 전환이 제한적이므로, 현재는 안내/복사/새 창 열기 중심으로 대응
- 필요하면 로그인 화면에 “카카오톡에서는 우측 메뉴 > 브라우저로 열기” 같은 앱별 안내를 더 추가 가능

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.11.1-20260514 | 2026-05-14 | Google OAuth 인앱 브라우저 차단 대응 |
| v1.11.0-20260514 | 2026-05-14 | execution ledger, active run limit, provider concurrency, usage reserve/settle |

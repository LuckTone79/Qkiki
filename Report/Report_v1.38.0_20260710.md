# Report v1.38.0-20260710 — 브랜드 아이콘(모노 노드) 적용 + Qkiki→Yapp 전면 리브랜딩

## 요청
1. 아이콘을 "모노 노드"(브랜드 아이콘 시안 V1)로, 사이트에 쓰이는 모든 아이콘에 적용.
2. 프로그램 이름을 Qkiki→Yapp으로 리브랜딩. 사이트의 모든 이름을 Yapp으로, 프로그램 내
   모든 Qkiki 흔적을 Yapp으로 변경. 앞으로도 지속 적용.

## 1. 브랜드 아이콘 → 모노 노드 마크
- `src/components/ui/icons.tsx`: `SparkMarkIcon`(스파크 ✦)을 **`BrandMark`**(노드 네트워크
  마크 — 중앙 노드에서 세 갈래 분기, "하나의 질문 → 여러 AI 모델"의 도식)로 교체.
  `SparkMarkIcon`은 하위호환 별칭으로 유지. currentColor 기반이라 어떤 타일에서도 반전 렌더.
- 적용 위치(브랜드 로고가 나오는 모든 곳): 앱 사이드바(AppShell), 로그인/회원가입 페이지,
  관리자 콘솔(AdminShell, 기존 ⬡ 제거).
- 파비콘/앱 아이콘: `src/app/icon.svg` + `apple-icon.svg` 신규(검정 타일+화이트 노드 마크),
  기존 스파크 `favicon.ico` 삭제 → 모든 파비콘이 노드 마크로 통일.

## 2. Qkiki → Yapp 전면 리브랜딩
`brand.ts`에 `APP_NAME="Yapp"`가 이미 있었으나 화면·키에 하드코딩 Qkiki가 남아 있던 것을 정리.

### 화면 노출 이름
- AppShell·sign-in·sign-up의 하드코딩 `Qkiki` → `APP_NAME`(=Yapp) 상수 참조. (AdminShell·
  layout 메타데이터는 이미 Yapp)

### 코드 심볼
- `QKIKI_PLAN_LIMITS/QKIKI_PRICING_PLANS/QKIKI_CREDIT_PACK` → `YAPP_*`
  (billing-plans/usage-policy/pricing/테스트).
- 인페이지 이벤트 `qkiki:new-workbench-request` → `yapp:...`, `package.json` name → `yapp-workbench`.
- 환경변수 `QKIKI_WEB_SEARCH_ENABLED` → `YAPP_WEB_SEARCH_ENABLED`(레거시 env 폴백 유지).

### 런타임 식별자 (레거시 폴백으로 무중단 전환 — 로그아웃/데이터 유실 없음)
- 세션·관리자·트라이얼·OAuth 쿠키: `qkiki_*` → `yapp_*`. 읽기 경로는 레거시 쿠키를 폴백으로
  읽고, 로그아웃 시 양쪽 모두 삭제(`auth-constants`/`auth`/`admin-auth`/`handoff`/`google-oauth`).
- localStorage 키(사이드바·언어·초안·세션·사용량 캐시): `qkiki-*` → `yapp-*`, 레거시 키 폴백 읽기
  (`AppShell`/`LanguageProvider`/`local-cache`).
- 워커 인증 헤더 `X-Qkiki-*` → `X-Yapp-*`(검증기는 레거시 헤더 폴백, in-flight 안전).
- 실행 스텝 idempotency 키 프리픽스 `qkiki:run:` → `yapp:run:`(runId 포함 자체 저장값이라
  신규 run에만 영향, 기존 run 안전).
- 첨부 임시 저장 디렉터리 `qkiki-storage` → `yapp-storage`(서버리스 /tmp 휘발성이라 안전).

### 의도적으로 유지한 레거시(기능 보존)
- `brand.ts`의 `LEGACY_APP_NAMES/LEGACY_*` 정의, `canonical-host`의 옛 `qkiki.wideget.net`·
  `qkiki.vercel.app` → Yapp 리다이렉트, 각 파일의 레거시 폴백 값. (이들은 Qkiki 브랜딩이 아니라
  구 사용자 무중단 이관용 장치)

## 3. 지속 적용 규칙 명문화
- `AGENTS.md` 최상단에 "이 제품 이름은 Yapp" 브랜딩 규칙 추가 — 향후 모든 세션에서 새 문자열에
  Qkiki 금지, BrandMark/icon.svg 사용, 런타임 키 변경 시 레거시 폴백 동반을 강제.

## 검증
- `next build` 통과(`/icon.svg` 정적 라우트 인식), 변경 파일 eslint 경고 0, billing-plans 테스트 통과.
- 로컬 PostgreSQL 구동 후 로그인→앱 셸 스크린샷으로 노드 마크 + "Yapp" 표기 확인.

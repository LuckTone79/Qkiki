# v1.16.0 — Tesla 랜딩 + Notion 세부페이지 디자인 적용

- 일자: 2026-06-04
- 브랜치: `claude/qkiki-ui-design-concepts-m1CR7`
- 기준 버전: v1.15.7-20260604 → **v1.16.0-20260604**
- 적용 범위: 사용자 노출 모든 화면 (랜딩·인증·앱·관리자·공유)

## 목표
- 랜딩페이지(`/`) → Tesla 시네마틱 스타일
- 그 외 모든 세부페이지 → Notion 스타일
- **기능/구조는 일절 변경하지 않고 디자인(색·타이포·테두리·여백)만 변경**

레퍼런스 시안:
- Tesla 랜딩: `design-concepts/11-tesla/landing.html`
- Notion 워크벤치: `design-concepts/15-notion/workbench.html`

## 접근 방식 (단일 진실의 원천)
62개 페이지·컴포넌트를 개별 수정하는 대신, **Tailwind v4 `@theme` 토큰 재매핑**으로
한 곳에서 전체 외관을 바꿉니다.

### `src/app/globals.css`
- `--background`: `#f7f8f3`(크림) → `#ffffff`(노션 페이퍼)
- `--foreground`: `#20231f` → `#37352f`(노션 잉크)
- `::selection`: 틸 → 노션 라인색
- **stone 팔레트 11단계 전체 재매핑** (코드베이스에서 가장 많이 쓰이는 중성색): 노션 웜그레이로
- **slate 팔레트 11단계** 동일 매핑 (관리자 페이지에서 쓰임)
- **teal 팔레트 11단계 재매핑**: 액션 강조색이었던 틸을 노션의 잉크/소프트로 흡수
  → `text-teal-700` 등이 자연스럽게 노션 ink 색이 됨, `bg-teal-50`은 노션 soft bg
- Lora 세리프 폰트 토큰(`--font-serif`) 도입

### `src/app/layout.tsx`
- `next/font/google` 에서 Lora 추가 로드, `--font-lora` 노출

### 인라인 hex 색상 일괄 치환 (`sed`)
13개 파일에서:
- `#f7f8f3` (크림 배경) → `#ffffff`
- `#fbfcf8` (아이보리 패널) → `#f7f6f3` (노션 soft)
- `#e9f7ef` (틸 호버) → `#f1f0ee` (노션 softer)

대상: WorkbenchClient, ResultCard, ProviderSelectorRow, AppShell, ProjectsClient,
SharedSessionView, UsageStatus, sign-in/up, pricing, guide, page (랜딩), shared.

### `LanguageSelector` 미니멀 조정
- 그림자 제거, 보더 컬러 일관화, 포커스 색을 잉크로

## 랜딩페이지 (`src/app/page.tsx`) — Tesla 재작성
시네마틱 풀스크린 4섹션 구조 (각 `min-h-[100svh]`):

1. **HERO** — Unsplash networked-earth 풀블리드 + 다크 그라데이션 오버레이
   - 얇은 트래킹의 eyebrow + 큰 semibold 타이포
   - 하단에 듀얼 CTA (white/95 메인, black/45 backdrop-blur 고스트)
   - 가이드북 링크는 텍스트 언더라인
2. **PARALLEL COMPARE** — `#f4f4f4` 배경, 화이트 카드 3개 (features 배열)
3. **CHAIN** — `#171a20` 다크 섹션, 4단계 카드 (routeExample, 마지막 단계 강조)
4. **QUICK STARTS + CTA** — 화이트 배경, quickStarts 2개 + 트리플 CTA

**보존된 기능 (모두 그대로):**
- `useLanguage`, `t()` 모든 키
- `handleTrialStart` (`/api/trial/start` 호출, `redirectUrl`/`error` 분기)
- `isLoading`, `trialError` 상태와 표시
- `Link` 라우팅: `/sign-in`, `/guide`
- `features`, `routeExample`, `quickStarts` 배열 콘텐츠

## 자동 적용 (코드 0줄 수정으로)
색 팔레트 재매핑만으로 다음이 모두 노션 외관을 입음:
- `/app/workbench` (WorkbenchClient 5132줄)
- `/app/projects`, `/app/projects/[id]`
- `/app/sessions`, `/app/presets`, `/app/account`, `/app/pricing`
- `/sign-in`, `/sign-up`
- `/guide`
- `/shared/[token]`
- `/admin/**` 전체 (Dashboard, Users, Conversations, AuditLogs, Coupons, Providers)
- `AppShell` 사이드바, `ResultCard`, `WorkflowStepRow`, `ProviderSelectorRow`,
  `StatusBadge`, `EmptyState`, `SectionHeader`, `AuthForm` 등 모든 공유 컴포넌트

## 검증
- `npm run build` ✅ 통과 (모든 라우트 컴파일 성공)
- `npm run lint` ✅ 경고 없음
- 기능 변경 0건: API 라우트, 인증, DB, AI 호출, i18n 사전 — 모두 무수정

## 버전 표시
- `VERSION`: `v1.16.0-20260604`
- `src/lib/version.ts`: `APP_VERSION = "v1.16.0-20260604"`
- 사용자 노출 위치(AppShell 푸터·About 페이지) 자동 갱신

## 디자인 시안 보존
참고용 시안 `design-concepts/` 폴더는 그대로 유지(15+30 변형 + 갤러리),
실제 적용본과 별개 자료로 향후 비교/롤백 참고 가능.

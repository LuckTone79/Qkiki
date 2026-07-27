# 작업 보고서 — v1.33.0-20260629

## 요청 사항
- 사용자 언어 선택에 **일본어(ja)** 와 **스페인어(es)** 추가
- 모든 메뉴(가이드북 포함)에서 해당 언어가 실제로 적용되는지 확인
- 커밋 및 배포까지 진행

## 변경 개요
기존에는 영어(en)/한국어(ko) 2개 언어만 지원했고, UI 문구는 두 가지 방식으로 구현되어 있었다.
1. 중앙 사전(`LanguageProvider`의 `dictionaries`, 가이드북의 `guide`)
2. 컴포넌트 곳곳의 인라인 `language === "ko" ? KO : EN` 삼항식(약 358곳)

일본어/스페인어가 "모든 메뉴"에 실제로 노출되려면 위 세 경로를 모두 4개 언어로 확장해야 했다.

## 핵심 인프라
`src/components/i18n/LanguageProvider.tsx`
- `AppLanguage` 타입을 `"en" | "ko" | "ja" | "es"` 로 확장
- `SUPPORTED_LANGUAGES`, `isAppLanguage()` 추가 (저장값 검증/언어 선택기)
- `localize(language, { en, ko, ja, es })` 헬퍼 추가 — 인라인 문구를 4개 언어로 정리
- `INTL_LOCALES` / `intlLocale()` — 날짜·숫자 포매팅 로케일 (`en-US`/`ko-KR`/`ja-JP`/`es-ES`)
- `adminTextKey()` — 영/한만 번역된 관리자 패널을 위한 안전한 키 축소(ja/es는 영어로 폴백)
- `en`/`ko` 사전에 `japanese`/`spanish` 라벨 추가, **일본어/스페인어 전체 사전(각 229개 키)** 신규 작성
- 로컬 저장값 로딩을 `isAppLanguage` 기반으로 변경

`src/components/i18n/LanguageSelector.tsx`
- 선택기에 일본어/스페인어 옵션 추가

## 가이드북
`src/app/guide/page.tsx`
- `guide` 사전에 **일본어/스페인어 전체 번역(각 21개 최상위 키, 단계/튜토리얼/FAQ 포함)** 추가
- 목업 화면의 인라인 삼항식을 `localize`로 4개 언어 처리
- 기능표의 "언어" 항목을 "영어, 한국어, 일본어 & 스페인어"로 갱신

## 인라인 삼항식 → 4개 언어 변환 (전체 메뉴)
다음 사용자 화면의 모든 문구를 일본어/스페인어까지 적용:
- 랜딩(`src/app/page.tsx`), 워크벤치(`WorkbenchClient.tsx` 약 125곳), 결과 카드(`ResultCard.tsx`),
  세션(`SessionsClient.tsx`), 프로젝트(`ProjectsClient.tsx`/`ProjectDetailClient.tsx`/`AddToProjectButton.tsx`),
  프리셋(`PresetsClient.tsx`), 계정(`AccountClient.tsx`), 결제(`UsageStatus.tsx`/`LimitReachedModal.tsx`),
  공유 보기(`SharedSessionView.tsx`), 인증(`AuthForm.tsx`), 좌측/하단 내비게이션(`AppShell.tsx`),
  상태 배지(`StatusBadge.tsx`), 피드백(`FeedbackBoardClient.tsx`/`FeedbackThreadClient.tsx`), 워크플로우 단계(`WorkflowStepRow.tsx`/`ProviderSelectorRow.tsx`)
- 공용 라이브러리: `lib/ai/action-display.ts`, `lib/session-input-copy.ts`, `lib/workbench-model-guidance.ts`, `components/feedback/labels.ts`
- 날짜/로케일 포매팅은 `intlLocale()`로 통일

## 관리자 패널 처리 방침
관리자(스태프 전용) 패널은 영어/한국어 사전만 존재한다. 타입 확장으로 깨지지 않도록
`text[adminTextKey(language)]` / `intlLocale(language)`로 변경하여 **ja/es 사용자는 영어로 폴백**하도록 했다.
(엔드유저 메뉴가 아니므로 전체 번역 대상에서 제외, 컴파일·런타임 안전성만 확보)

## 검증
- 의존성 미설치(네트워크 제약)로 컨테이너 내 `next build`는 수행 불가 → CI/배포 빌드에서 검증
- 정적 검증 수행:
  - `dictionaries` 4개 언어 키 일치 확인: en/ko/ja/es 각 **229개로 동일**
  - `guide` 4개 언어 최상위 키 일치 확인: 각 **21개로 동일**
  - 잔존 `language === "ko"` 6건은 모두 의도된 항목(`adminTextKey` 정의, 출력언어 매핑, 공백 처리, 관리자 피드백 폴백)

## 버전
- `VERSION`, `src/lib/version.ts` → **v1.33.0-20260629** (좌측 사이드바/상단/가이드 푸터에 표시)

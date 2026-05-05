# Patch 08 작업 레포트 - 모바일 웹 최적화

작성일: 2026-04-14

## 작업 기준

`task/작업.txt`의 순서를 따라 진행했습니다.

1. 기능 적용 설계
2. 설계 부족점 검토 1회
3. 검토 내용을 바탕으로 디벨롭 1회
4. 코딩

## 현재 구조 파악 요약

- 앱은 Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 기반입니다.
- 브랜드와 주요 UI 문구는 Qkiki로 정리되어 있습니다.
- 보호 앱 영역은 `AppShell`을 통해 워크벤치, 프로젝트, 세션, 프리셋, 계정 화면을 제공합니다.
- 워크벤치는 `WorkbenchClient` 중심으로 모델 선택, 입력, 워크플로우 빌더, 결과 보드를 한 화면에 구성합니다.
- 결과는 `ResultCard`에서 후속 질문, 다른 모델 검토, 재실행, 복사, 최종 표시, 분기 삭제 액션을 제공합니다.
- 프로젝트 기능은 사용자별 프로젝트 폴더, 공유 프로젝트 메모리, 프로젝트 연결 세션 구조로 이미 반영되어 있습니다.

## 설계

- 데스크톱의 기존 3열 워크벤치 구조는 유지합니다.
- 모바일에서는 모델, 입력, 워크플로우, 결과 영역을 탭처럼 전환해 긴 세로 스크롤과 과밀한 조작을 줄입니다.
- 보호 앱 전체에는 모바일 하단 내비게이션을 제공해 엄지손가락으로 주요 화면에 접근할 수 있게 합니다.
- 언어 선택 도구는 모바일에서 하단 내비게이션 위로 이동시켜 상단 헤더와 겹치지 않게 합니다.
- 결과 카드와 워크플로우 행은 모바일 터치 대상 크기를 키우고 버튼을 안정적인 2열 배치로 변경합니다.

## 검토

- 워크벤치의 기능 정체성은 그대로 유지되어야 하므로 입력, 모델 선택, 워크플로우, 결과를 단순 챗 화면으로 합치지 않았습니다.
- 모바일 탭 전환은 화면 표시 방식만 바꾸며, 기존 실행 API와 세션/결과 저장 흐름은 변경하지 않았습니다.
- 데스크톱에서는 `xl` 이상에서 기존 3열 구성을 유지하도록 숨김 클래스를 조합했습니다.
- 실행 완료 후 모바일 사용자가 결과를 찾기 어렵지 않도록 결과 패널로 자동 이동하는 처리가 필요하다고 판단했습니다.

## 디벨롭

- 모바일 탭 라벨을 영어/한국어 번역 키로 추가했습니다.
- 실행, 분기, 재실행 성공 후 모바일 결과 패널을 자동 활성화하도록 개선했습니다.
- 앱 셸 하단 내비게이션은 모바일 전용으로 추가하고, 데스크톱 사이드바는 유지했습니다.
- 결과 카드 액션은 모바일 2열 그리드, 데스크톱 플렉스 배치로 구성했습니다.
- 폼 컨트롤과 버튼에는 최소 높이와 전체 폭 모바일 배치를 적용했습니다.

## 구현 파일

- `src/components/AppShell.tsx`
- `src/components/i18n/LanguageProvider.tsx`
- `src/components/i18n/LanguageSelector.tsx`
- `src/components/workbench/WorkbenchClient.tsx`
- `src/components/workbench/ProviderSelectorRow.tsx`
- `src/components/workbench/ResultCard.tsx`
- `src/components/workbench/WorkflowStepRow.tsx`
- `src/app/globals.css`
- `src/app/admin/(panel)/users/page.tsx`
- `src/components/admin/AdminUsersClient.tsx`
- `CHANGELOG.md`
- `Report/Patch-08-mobile-web-optimization.md`

## 검증 결과

- 통과: ESLint
  - 기존 `AdminProvidersClient`의 hook dependency 경고 1개는 남아 있으나 에러는 없습니다.
- 통과: Prisma schema validate
- 통과: Next.js production build
- 통과: dev 서버 `/app/workbench` HTTP 200 응답 확인
- 미실행: Playwright 스크린샷 검증
  - 현재 프로젝트에 Playwright 패키지가 설치되어 있지 않아 브라우저 스크린샷 검증은 수행하지 않았습니다.

## 남은 리스크

- 실제 휴대폰 브라우저에서의 시각 검증은 별도 브라우저 확인이 필요합니다.
- 관리자 화면은 기존 반응형 테이블/그리드 구조를 유지했으며, 이번 패치의 주 대상은 사용자 앱 영역입니다.

# Report v1.21.3-20260611

## 문제

Microsoft Edge 환경에서 일부 사용자에게 워크벤치 화면이 열리지 않고 에러 화면으로 떨어질 수 있었습니다.

또한 순차 검토 체인의 반복 구간에서는 브레인스토밍 단계가 이전 결과를 이어받지 못하고, 매 반복마다 원본 입력 기준으로 다시 생성되는 흐름이 섞일 수 있었습니다.

## 원인

### 1. 브라우저 저장소 접근 예외

클라이언트 컴포넌트가 `window.localStorage`에 직접 접근하고 있었고, Edge의 일부 보안 설정 또는 저장소 차단 상태에서는 이 접근이 `SecurityError: Access is denied for this document.` 예외를 발생시켰습니다.

이 예외가 초기 렌더 구간의 `useEffect` 안에서 처리되지 않아 워크벤치 진입 흐름이 깨졌습니다.

### 2. 반복 구간 브레인스토밍 입력 전달 문제

큐 기반 순차 실행기에서 이전 결과를 별도 프롬프트 블록으로 주입하는 경로와 브레인스토밍 지시문 활성화 조건이 어긋나 있었습니다. 그 결과 반복 구간에서 이전 아이디어를 확장해야 하는 단계가 실제 실행에서는 원본 입력 중심으로 되돌아갈 수 있었습니다.

## 변경 사항

- `src/lib/browser-storage.ts`
  - 브라우저 저장소 접근을 안전하게 감싸는 `readBrowserStorageValue`, `writeBrowserStorageValue` 헬퍼를 추가했습니다.
- `src/lib/browser-storage.test.mjs`
  - Edge 스타일 `SecurityError`가 발생해도 예외를 밖으로 던지지 않는 회귀 테스트를 추가했습니다.
- `src/components/AppShell.tsx`
  - 사이드바 접힘 상태 저장/복원 로직을 안전한 저장소 헬퍼로 교체했습니다.
- `src/components/i18n/LanguageProvider.tsx`
  - 언어 저장/복원 로직을 안전한 저장소 헬퍼로 교체했습니다.
- `src/components/workbench/WorkbenchClient.tsx`
  - 결과 레이아웃 저장/복원 로직을 안전한 저장소 헬퍼로 교체했습니다.
  - 반복 구간 안에서 원본 입력을 다시 생성하는 단계에 대해 자동 보정 안내를 연결했습니다.
- `src/lib/ai/prompt.ts`
  - 브레인스토밍 단계가 이전 아이디어를 실제로 이어받는지 판별하는 힌트를 보강했습니다.
- `src/lib/execution-run-steps.ts`
  - 큐 실행기에서도 이전 결과 기반 브레인스토밍 지시가 유지되도록 프롬프트 구성 경로를 정리했습니다.
- `src/lib/ai/prompt.test.mjs`
  - 관련 회귀 테스트를 보강했습니다.

## 검증

- `node --test src/lib/browser-storage.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- 실제 Microsoft Edge 실행 + `localStorage` 접근 차단 주입 시나리오에서
  - 워크벤치 진입 성공
  - 에러 폴백 미노출
  - `pageerror` 없음 확인

## 배포 메모

이번 수정은 저장소 접근 실패를 무해하게 처리하는 방어 패치와, 반복 구간 브레인스토밍 품질 보정이 함께 포함된 체크포인트입니다. 저장소 사용이 가능한 브라우저에서는 기존 동작을 유지하고, 저장소가 막힌 브라우저에서는 해당 개인화 설정만 저장하지 않고 화면은 정상 동작하도록 유지합니다.

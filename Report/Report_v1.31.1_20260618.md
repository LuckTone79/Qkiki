# Report v1.31.1 - 2026-06-18

## 변경 요약

라우트 저장 버튼에 저장 중/완료 피드백 추가, 중복 저장 방지.

## 배경

"라우트 저장" 버튼을 눌러도 아무 반응이 없어 저장이 됐는지 알 수 없었음. 사용자가 연달아 눌러 동일 프리셋이 중복 저장되는 문제가 있었음.

## 변경 내용

### `src/components/workbench/WorkbenchClient.tsx`

- `savingPreset` state 추가 — 저장 진행 중 여부
- `presetSavedAt` state 추가 — 완료 후 2초간 체크 표시 유지
- `savePreset()` 함수 개선:
  - 이중 클릭 방지: 함수 진입 시 `savingPreset` 가드 추가
  - try/finally로 에러 시에도 `savingPreset` 해제 보장
  - 저장 성공 후 2초 뒤 `presetSavedAt` 초기화
- 버튼 상태 3단계:
  1. **저장 중**: 스피너 + "저장 중…" 텍스트, disabled
  2. **저장 완료** (2초): 체크 아이콘 + "저장됨" 텍스트, 밝은 teal 배경
  3. **기본**: 기존 "라우트 저장" 텍스트

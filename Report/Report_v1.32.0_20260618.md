# Report v1.32.0 - 2026-06-18

## 변경 요약

비동기 작업이 있는 버튼 전체에 로딩·완료·비활성 피드백 추가.

## 배경

라우트 저장 버튼 외에 코드베이스 전체를 탐색한 결과, 15개 버튼에 시각적 피드백이 없음을 확인. 모든 버튼에 일관된 UX를 적용.

## 변경 파일 및 내용

| 파일 | 버튼 | 처리 |
|---|---|---|
| `WorkbenchClient.tsx` | 질문 복사 | 복사 후 1.5초 "복사됨" 표시 (teal 배경) |
| `SessionsClient.tsx` | 질문 복사 | 복사 후 1.5초 "복사됨" + disabled 처리 |
| `SessionsClient.tsx` | 복제 | "복제 중…" + disabled |
| `SessionsClient.tsx` | 삭제 | "삭제 중…" + disabled |
| `ProjectDetailClient.tsx` | 프로젝트 저장 | "저장 중…" → 2초 "저장됨 ✓" + disabled |
| `ProjectDetailClient.tsx` | 폴더 삭제 | "삭제 중…" + disabled |
| `ProjectsClient.tsx` | 프로젝트 생성 (2개) | "생성 중…" + disabled (중복 제출 방지) |
| `PresetsClient.tsx` | 이름 변경 | "저장 중…" → 1.5초 "저장됨 ✓" + disabled |
| `PresetsClient.tsx` | 프리셋 삭제 | "삭제 중…" + disabled |
| `AccountClient.tsx` | 계정 저장 | "저장 중…" → 2초 "저장됨 ✓" + disabled |
| `AccountClient.tsx` | 쿠폰 등록 | "등록 중…" + disabled |
| `AdminCouponsClient.tsx` | 코드 복사 | 1.5초 "복사됨 ✓" (teal 배경) |
| `AdminCouponsClient.tsx` | 쿠폰 비활성화 | "비활성화 중…" + disabled |
| `AdminCouponsClient.tsx` | 쿠폰 삭제 | "삭제 중…" + disabled |

## 패턴

- **로딩 중**: disabled + 텍스트 변경 ("저장 중…" 등)
- **완료 후 N초**: teal 색상 + "저장됨 ✓" / "복사됨" → 원래 상태 복귀
- **삭제류**: disabled만 적용 (삭제 후엔 항목 자체가 사라짐)
- 모든 async 함수에 중복 실행 방지 가드 추가

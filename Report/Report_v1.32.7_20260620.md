# 작업 보고서

## 기본 정보
- **버전**: v1.32.7-20260620
- **작업 일시**: 2026-06-20
- **이전 버전**: v1.32.6-20260620
- **프로젝트명**: Yapp 오케스트레이션 워크벤치

## 작업 요약
모바일 화면에서 카드, 버튼, 헤더, 결과 영역이 가로로 밀리거나 긴 텍스트 때문에 화면 밖으로 벗어나는 문제를 줄였습니다. 단순 축소가 아니라 줄바꿈, 생략, full-width 모바일 버튼, desktop 복원 breakpoint를 적용했습니다.

## 변경 사항
### 추가된 기능
- 모바일 하단 내비게이션과 shell 영역의 safe-area 여유를 보강했습니다.
- 결과 카드 메타 정보와 실행 옵션 컨트롤이 작은 화면에서 줄바꿈되도록 했습니다.

### 수정된 사항
- 프로젝트/세션/프리셋/계정/피드백 카드의 버튼 그룹을 모바일에서 grid 또는 full-width로 배치했습니다.
- 공통 섹션 헤더와 빈 상태 action 영역이 모바일에서 컨테이너 폭을 넘지 않도록 수정했습니다.
- 언어 선택 컨트롤이 shell route 모바일 화면에서 하단 내비게이션과 겹치지 않도록 조정했습니다.
- 크레딧 제한 모달이 모바일에서 하단 정렬과 스크롤 가능한 레이아웃을 사용하도록 수정했습니다.

### 삭제/제거된 사항
- 없음

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| `src/components/AppShell.tsx` | 수정 | 모바일 shell 여백, 언어 선택, 하단 내비게이션 밀도 조정 |
| `src/components/SectionHeader.tsx` | 수정 | 긴 제목 줄바꿈 및 action full-width 처리 |
| `src/components/EmptyState.tsx` | 수정 | action 버튼 모바일 full-width 처리 |
| `src/components/projects/ProjectDetailClient.tsx` | 수정 | 프로젝트 상세 카드 버튼/텍스트 overflow 개선 |
| `src/components/sessions/SessionsClient.tsx` | 수정 | 세션 목록 카드 버튼 그룹 모바일 배치 개선 |
| `src/components/presets/PresetsClient.tsx` | 수정 | 프리셋 카드 입력/버튼 모바일 폭 정리 |
| `src/components/account/AccountClient.tsx` | 수정 | 계정/결제 CTA 버튼 모바일 full-width 처리 |
| `src/components/feedback/*` | 수정 | 피드백 목록/상세 액션 버튼 모바일 배치 개선 |
| `src/components/workbench/*` | 수정 | 워크벤치 컨트롤과 결과 카드 메타 영역 줄바꿈 처리 |
| `src/components/billing/LimitReachedModal.tsx` | 수정 | 모바일 모달 정렬/스크롤 및 한글 문구 복구 |

## 알려진 이슈 / 추후 작업
- 가격/크레딧 정책 변경(C 계열)은 이번 커밋 범위에서 제외했습니다.
- 실제 모바일 브라우저 검증은 최종 배포 전 전체 검증 단계에서 수행합니다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.32.7 | 2026-06-20 | 모바일 UI overflow, 줄바꿈, 버튼 배치 최적화 |
| v1.32.6 | 2026-06-20 | 브랜딩/도메인/세션·스토리지 키 전환 정리 |

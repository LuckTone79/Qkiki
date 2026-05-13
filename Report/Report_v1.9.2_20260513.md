# 작업 보고서
## 기본 정보
- **버전**: v1.9.2-20260513
- **작업 일시**: 2026-05-13
- **이전 버전**: v1.9.1-20260513
- **프로젝트명**: Qkiki Workbench

## 작업 요약
워크벤치 실행 UX를 개선해 실행 즉시 AI 진행 상태로 이동하고, 모델별 진행 카드에 두 줄의 작업 상태를 실시간으로 표시하도록 개선했다. 실행 API는 기존 JSON 응답을 유지하면서 NDJSON 스트리밍 경로를 추가해, 병렬 모델 결과가 완료되는 순서대로 화면에 반영될 수 있게 했다.

## 변경 사항
### 추가된 기능
- 실행 시작 시 데스크탑/모바일 모두 AI 진행 상태 영역으로 자동 이동.
- AI 진행 카드별 두 줄 작업 상태 표시.
- 기본 출력 언어 선택 옵션 추가: English, 한국어, 日本語, 中文, हिन्दी.
- 저장된 워크벤치 세션의 기본 출력 언어 보존.
- 순차검토체인 라우트 저장 영역 옆 실행 버튼 추가.
- 워크벤치 실행 API의 NDJSON 스트리밍 응답 경로 추가.

### 수정된 사항
- 출력 스타일 선택 UI를 실행 버튼 옆 컨트롤 그룹으로 이동.
- 프롬프트 생성 시 선택한 기본 출력 언어를 모델 지시문에 포함.
- 후속 브랜치/재검토 실행에도 현재 기본 출력 언어를 전달.
- 병렬 실행 결과를 전체 완료까지 기다리지 않고 모델 완료 이벤트마다 화면에 반영.
- 앱 레벨 AI 실행 라우트의 고정 maxDuration 설정 제거.
- 생성된 `.claude` 작업트리 산출물이 lint 대상에 포함되지 않도록 제외.

### 삭제/제거된 사항
- `/api/workbench/run`, `/api/workbench/branch`, `/api/workbench/compare`, `/api/results/[id]/rerun`의 `maxDuration = 300` 고정 설정 제거.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| src/app/api/workbench/run/route.ts | 수정 | NDJSON 스트리밍 실행 경로 추가 및 고정 timeout 제거 |
| src/app/api/workbench/branch/route.ts | 수정 | 브랜치 실행 출력 언어 전달 및 고정 timeout 제거 |
| src/app/api/workbench/compare/route.ts | 수정 | 고정 timeout 제거 |
| src/app/api/results/[id]/rerun/route.ts | 수정 | 고정 timeout 제거 |
| src/lib/ai/workflow.ts | 수정 | 병렬/순차 실행 증분 콜백 및 출력 언어 보존 |
| src/components/workbench/WorkbenchClient.tsx | 수정 | 자동 진행 이동, 실시간 진행 두 줄, 출력 언어, 실행 버튼, 스트림 수신 구현 |
| src/lib/ai/prompt.ts | 수정 | 기본 출력 언어 프롬프트 지시 추가 |
| src/lib/validation.ts | 수정 | 출력 언어 입력 검증 추가 |
| src/lib/local-cache.ts | 수정 | 출력 언어 draft 저장 지원 |
| prisma/schema.prisma | 수정 | 워크벤치 세션 출력 언어 컬럼 추가 |
| prisma/migrations/20260513150000_add_workbench_output_language/migration.sql | 추가 | 출력 언어 컬럼 마이그레이션 |
| eslint.config.mjs | 수정 | 생성된 작업트리 산출물 lint 제외 |
| VERSION | 수정 | v1.9.2-20260513 반영 |
| src/lib/version.ts | 수정 | 앱 표시 버전 반영 |

## 알려진 이슈 / 추후 작업
- 실제 외부 AI 제공자 속도는 공급자 상태와 모델 부하에 좌우되지만, UI는 완료된 모델 결과부터 즉시 표시하도록 개선했다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.9.2 | 2026-05-13 | AI 진행 UX, 출력 언어, 증분 결과 스트리밍 |
| v1.9.1 | 2026-05-13 | AI 실행 timeout 정책 조정 |

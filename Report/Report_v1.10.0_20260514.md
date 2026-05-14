# 작업 보고서
## 기본 정보
- **버전**: v1.10.0-20260514
- **작업 일시**: 2026-05-14
- **이전 버전**: v1.9.4-20260514
- **프로젝트명**: qkiki-workbench

## 작업 요약
기존 `POST /api/workbench/run` 요청이 AI 실행 전체를 직접 붙잡고 있던 구조를 `Vercel Workflow` 기반의 durable run 구조로 전환했습니다. 실행 시작, 상태 조회, 스트림 재연결을 분리해 장수명 AI 실행이 요청-응답 수명에 묶이지 않도록 바꿨습니다.

## 변경 사항
### 추가된 기능
- `workflow` 패키지와 Next.js Workflow 플러그인 연동
- `src/workflows/workbench-run.ts` durable 실행 워크플로우 추가
- `GET /api/workbench/runs/[runId]` 상태 조회 API 추가
- `GET /api/workbench/runs/[runId]/stream` 재연결 가능한 NDJSON 스트림 API 추가
- HMAC 서명 기반 `runId` 토큰 발급 및 검증 로직 추가

### 수정된 사항
- 기존 `/api/workbench/run`을 enqueue 중심 API로 변경
- 워크벤치 클라이언트를 `runId` 기반 스트림 구독 구조로 전환
- 스트림이 끊겨도 `startIndex` 기준으로 다시 이어받도록 재연결 로직 추가
- 워크플로우 실행 중에도 기존 진행상태/결과 카드 UI를 유지하도록 연결

### 구조적 판단
- 원래 설계했던 DB 기반 `ExecutionRun` 테이블 방식은 현재 운영 환경에 노출된 DB 접속 문자열이 `prisma://` 계열이라 로컬 Prisma 마이그레이션을 안정적으로 실행할 수 없어 이번 배포에는 반영하지 않았습니다.
- 대신 현재 배포 환경에서 즉시 작동 가능한 `signed run token + workflow status/stream` 구조로 1차 반영했습니다.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| next.config.ts | 수정 | Workflow 플러그인 활성화 |
| tsconfig.json | 수정 | Workflow TypeScript 플러그인 추가 |
| package.json | 수정 | `workflow` 의존성 반영 |
| src/app/api/workbench/run/route.ts | 수정 | 실행 요청을 durable workflow 시작 API로 전환 |
| src/app/api/workbench/runs/[runId]/route.ts | 추가 | durable run 상태 조회 |
| src/app/api/workbench/runs/[runId]/stream/route.ts | 추가 | durable run 스트림 재연결 |
| src/workflows/workbench-run.ts | 추가 | 실제 durable AI 실행 워크플로우 |
| src/lib/execution-runs.ts | 추가 | run 토큰 서명/검증 및 usage context 직렬화 |
| src/components/workbench/WorkbenchClient.tsx | 수정 | `runId` 기반 스트림 소비 및 재연결 처리 |
| src/lib/ai/workflow.ts | 수정 | 워크플로우 재사용을 위한 helper export |
| src/lib/validation.ts | 수정 | 런타임/워크플로우 입력 타입 export |
| VERSION | 수정 | 버전 갱신 |
| src/lib/version.ts | 수정 | UI 버전 표시 갱신 |

## 검증
- `npx prisma generate` 통과
- `npm run lint` 통과
- `npm run build` 통과
- 빌드 결과에서 Workflow 엔드포인트와 `workbench/runs/[runId]` 라우트 생성 확인

## 남은 이슈 / 추후 작업
- DB 직접 연결 문자열이 확보되면 `ExecutionRun` 테이블 기반 상태 영속화로 한 단계 더 확장 가능
- provider별 글로벌 동시성 budget, 사용자별 active run limit, usage reserve/settle 구조는 다음 단계에서 추가 권장
- rerun/branch 실행도 같은 durable workflow 체계로 통합하면 구조 일관성이 더 좋아짐

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.10.0-20260514 | 2026-05-14 | Workflow 기반 durable run, runId 상태/스트림 분리 |
| v1.9.4-20260514 | 2026-05-14 | 첨부 안정화, 순차검토체인 UX/오류 처리 개선 |

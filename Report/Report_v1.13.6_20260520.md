# 작업 보고서

## 기본 정보
- **버전**: v1.13.6-20260520
- **작업 일시**: 2026-05-20
- **이전 버전**: v1.13.5-20260519
- **프로젝트명**: Qkiki 오케스트레이션 워크벤치

## 작업 요약
순차검토체인 반복 실행 중 Step 4가 실행 중인데 Step 1 또는 Step 2가 다시 실행 중으로 표시되는 문제를 구조적으로 추적했다. 반복 확장 자체는 `1,2,3,2,3,2,3`으로 맞았지만, durable workflow 재시도와 스트림 재생, 세션 재로드가 실행 상태를 되감거나 실행 단계를 템플릿 단계처럼 다시 불러오는 설계 문제가 있었다.

## 변경 사항

### 핵심 수정
- 같은 `executionRunId + executionOrder`에 이미 결과가 있으면 새 provider 호출을 만들지 않고 기존 결과를 재사용하도록 idempotency fence를 추가했다.
- 기존 결과가 아직 `running`이면 같은 단계를 중복 호출하지 않고 DB에서 상태 변경을 기다리도록 했다.
- 동시 재시도 레이스에서 중복 결과 생성에 실패한 실행 단계 레코드는 정리해 `WorkflowStep` 오염을 줄였다.
- 스트림 재연결 또는 재생으로 오래된 `running` 이벤트가 `completed/failed/canceled/skipped` 결과를 덮어쓰지 못하게 결과 병합을 단방향 상태 전이로 바꿨다.
- 순차 진행 패널은 새 active step이 시작될 때 다른 active 표시를 내리도록 해 한 run 안에서 여러 단계가 동시에 실행 중처럼 보이지 않게 했다.
- 세션에 사용자가 편집한 원본 workflow template steps를 별도 JSON 컬럼으로 저장하고, 세션 로드 시 실행 중 펼쳐진 `WorkflowStep` 대신 이 템플릿을 우선 사용하도록 했다.
- provider 호출 시작 시 `ExecutionRun.updatedAt`을 갱신해 watchdog이 긴 모델 호출을 더 안전하게 live run으로 인식하도록 했다.
- 새 세션으로 시작한 durable workflow가 재시도될 때 `ExecutionRun.sessionId`에서 이미 생성된 세션을 복구해 다른 세션을 새로 만들지 않도록 했다.
- 실행 API에서 durable workflow를 시작하기 전에 세션을 먼저 확정하고, `ExecutionRun`과 workflow payload 모두 같은 `sessionId`를 사용하도록 했다.
- `executionOrder` 컬럼 존재만 확인하지 않고 `Result_executionRunId_executionOrder_key` 고유 인덱스 존재까지 검증하도록 런타임 스키마 보정을 강화했다.
- `completeExecutionRun()`은 해당 run에 아직 `running` 결과가 남아 있으면 terminal 상태로 바꾸지 않도록 보호했다.
- 중복/재개 워커가 이미 실행 중인 같은 `executionOrder`를 발견한 경우 completed/canceled/failed로 닫지 않고 heartbeat만 남긴 뒤 durable retry로 넘기도록 했다.

### 데이터베이스
- `WorkbenchSession.workflowTemplateStepsJson` 컬럼 추가.
- `Result.executionOrder` 컬럼 및 `Result(executionRunId, executionOrder)` 고유 인덱스 추가.
- migration 추가: `prisma/migrations/20260519193000_add_workflow_template_steps/migration.sql`
- migration 추가: `prisma/migrations/20260519194000_add_result_execution_order/migration.sql`
- 런타임 자동 컬럼 보정도 함께 추가해 기존 배포 DB에서도 안전하게 적용되도록 했다.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| `src/lib/ai/workflow.ts` | 수정 | 순차 실행 단계별 idempotency, template step 저장 |
| `src/components/workbench/WorkbenchClient.tsx` | 수정 | stale running 이벤트 차단, 순차 진행 패널 단일 active 보장 |
| `src/app/api/sessions/[id]/route.ts` | 수정 | 세션 로드 시 template steps 우선 반환 |
| `src/app/api/sessions/[id]/duplicate/route.ts` | 수정 | 세션 복제 시 template steps 보존 |
| `src/app/api/workbench/runs/[runId]/route.ts` | 수정 | 실행 run 조회 시 run-scoped 결과 반환 |
| `src/app/api/workbench/run/route.ts` | 수정 | workflow 시작 전 세션 확정 및 payload sessionId 고정 |
| `src/lib/execution-runs.ts` | 수정 | sessionId 복구 helper, running result가 있는 run 완료 방지 |
| `src/lib/workbench-session-schema.ts` | 수정 | template steps 컬럼 자동 보정 |
| `src/lib/workbench-run-schema.ts` | 수정 | execution order 컬럼/인덱스 자동 보정 |
| `src/workflows/workbench-run.ts` | 수정 | step 시작 시 실행 run heartbeat 갱신 |
| `prisma/schema.prisma` | 수정 | template steps, execution order 모델 반영 |

## AI 검토 반영
- **Explorer 1**: repeat expansion은 맞지만 durable step 전체 재시도가 체인 전체를 다시 시작할 수 있다고 지적했다. 실행 순서별 idempotency fence로 반영했다.
- **Explorer 2**: 실행으로 펼쳐진 `WorkflowStep`이 세션 로드 시 템플릿으로 재사용되는 설계 오염을 지적했다. template steps JSON 저장/로드로 분리했다.
- **Explorer 3**: template steps JSON이 없는 parallel 저장 경로에서 기존 sequential template metadata가 `null`로 덮일 수 있다고 지적했다. 명시적으로 workflow template steps를 받은 경우에만 해당 컬럼을 갱신하도록 수정했다.
- **재검토 반영**: 고유 인덱스 미검증, 새 세션 재시도 시 세션 재생성, 중복 워커의 조기 완료 처리 위험을 추가로 수정했다.

## 알려진 이슈 / 추후 작업
- 장기적으로는 `WorkflowStep`을 템플릿 테이블과 실행 인스턴스 테이블로 완전히 분리하는 정규화가 바람직하다. 이번 수정은 현재 스키마에서 중복 실행과 상태 되감기를 막는 안정화 계층이다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.13.6 | 2026-05-20 | 순차 반복 실행 중복 호출/상태 되감기 방지 |
| v1.13.5 | 2026-05-19 | 순차검토체인 timeout/retry/recovery 안정화 |

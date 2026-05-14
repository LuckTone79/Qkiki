# 작업 보고서
## 기본 정보
- **버전**: v1.11.0-20260514
- **작업 일시**: 2026-05-14
- **이전 버전**: v1.10.0-20260514
- **프로젝트명**: qkiki-workbench

## 작업 요약
1000명 동시 접속 안정화를 위한 2차 구조 작업으로, durable workbench run에 DB 기반 실행 ledger를 추가하고 사용자별 활성 run 제한, provider 전역 동시성 제어, usage reserve/settle 흐름을 실제 코드와 운영 DB에 반영했습니다. 기존 signed run token 방식은 유지하되, 이제는 토큰이 DB-backed execution run을 가리키도록 확장했습니다.

## 변경 사항
### 추가된 기능
- `ExecutionRun` 테이블 추가로 durable run 상태를 DB에 영속 저장
- `UsageReservation` 테이블 추가로 요청 시작 시 quota 예약, 완료 시 정산
- `ProviderLease` 테이블 추가로 공급자별 전역 동시성 슬롯 제어
- `/api/workbench/runs/[runId]`, `/stream` 에서 execution run 기반 상태 조회 지원

### 수정된 사항
- `POST /api/workbench/run` 이 실행 전 `usage reserve + active run limit + execution ledger`를 생성하도록 변경
- durable workflow 완료 시 `usage settle` 및 `ExecutionRun` 완료/부분실패/실패 상태를 기록하도록 변경
- branch / rerun 도 기존 check-then-charge 방식에서 reservation 기반으로 통일
- `callProvider()` 에 provider lease acquire/release를 추가해 parallel / sequential / rerun / compare가 같은 전역 한도를 공유하도록 변경
- usage summary가 현재 날짜의 pending reservation까지 반영하도록 조정

### 운영 반영
- 운영 Postgres에 `ExecutionRun`, `UsageReservation`, `ProviderLease` 테이블 및 인덱스를 실제 생성 완료

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| prisma/schema.prisma | 수정 | execution run / usage reservation / provider lease 모델 추가 |
| prisma/migrations/20260514193000_add_execution_runs/migration.sql | 추가 | 운영용 테이블 생성 SQL 추가 |
| src/lib/execution-runs.ts | 수정 | signed token 확장, active run 제한, execution ledger 헬퍼 추가 |
| src/lib/usage-policy.ts | 수정 | reserve / settle / release 흐름 추가 |
| src/lib/provider-concurrency.ts | 추가 | provider lease acquire/release 로직 추가 |
| src/lib/ai/providers.ts | 수정 | callProvider 전역 동시성 제한 반영 |
| src/workflows/workbench-run.ts | 수정 | durable run ledger/usage settlement 반영 |
| src/app/api/workbench/run/route.ts | 수정 | reservation + execution run 생성 후 workflow 시작 |
| src/app/api/workbench/runs/[runId]/route.ts | 수정 | DB-backed execution run 상태 조회 |
| src/app/api/workbench/runs/[runId]/stream/route.ts | 수정 | execution run 기준 workflow stream 연결 |
| src/app/api/workbench/branch/route.ts | 수정 | reservation 기반 정산으로 변경 |
| src/app/api/results/[id]/rerun/route.ts | 수정 | reservation 기반 정산으로 변경 |
| VERSION | 수정 | 버전 갱신 |
| src/lib/version.ts | 수정 | UI 버전 표기 갱신 |

## 검증
- `npx prisma generate` 통과
- `npm run lint` 통과
- `npm run build` 통과
- 운영 DB에 신규 테이블 생성 확인

## 남은 이슈 / 추후 작업
- provider 전역 한도는 현재 환경변수 또는 코드 기본값으로 제어되므로, 추후 관리자 화면에서 조절 가능하게 확장 가능
- branch / rerun 도 durable workflow 체계로 옮기면 취소/복구/감사 추적이 더 일관돼짐
- stale reservation / stale provider lease 자동 정리 작업을 cron 또는 workflow로 분리하면 운영성이 더 좋아짐

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.11.0-20260514 | 2026-05-14 | execution ledger, active run limit, provider concurrency, usage reserve/settle |
| v1.10.0-20260514 | 2026-05-14 | workflow 기반 durable run, runId 상태/스트림 분리 |

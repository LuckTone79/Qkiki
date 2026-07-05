# 작업 보고서

## 기본 정보

- **버전**: `v1.36.0-20260706`
- **작업 일시**: 2026-07-06
- **이전 버전**: `v1.35.1-20260630`
- **프로젝트명**: Yapp Multi AI

## 작업 요약

외부 구조 피드백을 실제 코드와 대조해 과장된 부분은 보정하고, 사용자 요청 경로의 런타임 DDL·중복 사용량 조회·무거운 스트림 폴링을 개선했다. 기존 UI와 병렬/순차 실행 의미는 유지하면서 서버/클라이언트 경계를 작게 도입하고, 배포 전 스키마 검증과 관측성을 강화했다.

## 변경 사항

### 추가된 기능

- `PERF_TRACE=1`에서만 응답하는 `Server-Timing` 계측
- 프로덕션 마이그레이션 이후 필수 workbench 컬럼·테이블·인덱스 assertion
- V1/V2 공통 형식의 runner kickoff metric
- V2 stream 변경 cursor와 무변경 poll backoff
- 독립적인 stream AbortController 수명 관리와 NDJSON reader

### 수정된 사항

- 정상 요청은 DB 스키마가 마이그레이션됐다고 가정하고 런타임 DDL을 실행하지 않음
- 레거시 V1 run 복구는 이미 조회한 run이 stale일 때만 대상 run 하나에 한정
- usage access 사전검사의 pending reservation aggregate를 2회에서 1회로 통합
- `package.json`, `package-lock.json`, `VERSION`, UI 버전 상수를 동일 릴리스로 정합화
- 생성형 Codex 로그와 스크린샷 폴더를 저장소 ignore 규칙에 추가

### 삭제/제거된 사항

- workbench 실행 시작 시 모든 사용자를 대상으로 수행하던 stale run 정리
- 정상 run/status/stream 경로의 무조건적 스키마 탐색 및 조건부 DDL
- 클라이언트 컴포넌트 내부의 직접 AbortController 보관과 NDJSON chunk 조립 코드

## 변경된 주요 파일

| 파일 경로 | 변경 유형 | 설명 |
| --- | --- | --- |
| `scripts/assert-workbench-run-schema.mjs` | 추가 | 배포 스키마 assertion |
| `scripts/prebuild-migrate.mjs` | 수정 | migration 이후 assertion 실행 |
| `src/server/workbench/schema-compat.ts` | 추가 | 비상 플래그 기반 레거시 보정 경계 |
| `src/lib/usage-policy.ts` | 수정 | pending usage aggregate 통합 |
| `src/app/api/workbench/runs/[runId]/stream/route.ts` | 수정 | cursor 기반 경량 폴링 |
| `src/client/workbench/hooks/useRunStream.ts` | 추가 | stream 수명 경계 |
| `src/components/workbench/WorkbenchClient.tsx` | 수정 | stream transport 책임 축소 |
| `VERSION`, `src/lib/version.ts`, `package.json` | 수정 | 버전 정합화 |

## 검증 결과

- 신규 집중 테스트 15개 통과
- 전체 Node 테스트 205개 통과, 실패 0
- `npx tsc -p tsconfig.json --noEmit` 통과
- `npm run lint` 통과
- 로컬 `npm run build` 통과
- Vercel production 환경의 `prisma migrate deploy`: pending migration 없음
- Vercel production DB 필수 workbench schema assertion 통과
- production 환경을 주입한 `npm run build` 통과

## 알려진 이슈 / 추후 작업

- 결제 PG는 사업자·통화·세금 정책과 자격증명 결정 후 별도 프로젝트로 연동해야 한다.
- 첨부 오브젝트 스토리지는 공급자, dual-write, backfill, 보존/삭제 정책을 먼저 확정해야 한다.
- V2는 현재 순차 실행 전용이다. 프로덕션 지표와 parity 검증 없이 병렬 경로 또는 전체 cohort로 강제하지 않는다.
- Workbench 패널 추가 분리는 실제 bundle/INP 측정 결과에 따라 작은 커밋으로 이어간다.

## 버전 히스토리 요약

| 버전 | 날짜 | 주요 변경 |
| --- | --- | --- |
| v1.36.0 | 2026-07-06 | workbench hot path, stream, schema, 경계 개선 |
| v1.35.1 | 2026-06-30 | 만료 인증의 프로젝트 생성 복구 |

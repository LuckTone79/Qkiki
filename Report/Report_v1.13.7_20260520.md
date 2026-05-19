# 작업 보고서

## 기본 정보
- **버전**: v1.13.7-20260520
- **작업 일시**: 2026-05-20
- **이전 버전**: v1.13.6-20260520
- **프로젝트명**: Qkiki 오케스트레이션 워크벤치

## 작업 요약
이전 작업 세션을 불러올 때 `/app/workbench?session=...` 경로가 실패하는 문제를 추적했다. 근본 원인은 새 코드가 `Result.executionOrder` 같은 신규 컬럼이 이미 배포 DB에 존재한다고 가정한 반면, 일부 읽기 API는 런타임 스키마 보정을 수행하지 않고 Prisma의 암묵적 전체 컬럼 선택에 의존해 스키마 드리프트가 곧바로 `P2022`로 터지는 구조였기 때문이다.

## 변경 사항

### 핵심 수정
- `src/lib/workbench-result-read.ts`를 추가해 `Result` 읽기 전에 공통으로 `ensureWorkbenchRunSchema()`를 거치게 만들었다.
- `Result` 조회 시 Prisma `include`로 전체 스칼라 컬럼을 암묵 선택하지 않고, 필요한 필드만 명시적으로 선택하는 `buildWorkbenchResultSelect()`를 도입했다.
- 세션 불러오기 API, 세션 복제 API, 실행 상태 조회 API, 결과 삭제 API, 관리자 대화 상세/원문 조회 및 관리자 대화 상세 페이지를 모두 공통 읽기 경로로 정리했다.
- 이 구조로 인해 앞으로 `Result`에 새 컬럼이 추가되더라도, 읽기 경로가 스키마 보정 없이 전체 컬럼을 당겨오다 깨지는 위험을 크게 줄였다.

### 근본 원인 정리
- **직접 원인**: 배포 DB에 `Result.executionOrder`가 아직 없는데, 세션 로드 API가 `results: { include: { workflowStep: ... } }` 형태로 `Result` 전체 스칼라 컬럼을 읽으면서 `P2022`가 발생했다.
- **설계 원인**: 쓰기 경로에서만 신규 컬럼 auto-heal을 기대했고, 읽기 경로는 Prisma의 기본 선택 동작에 기대어 있었다.
- **반복 재발 원인**: “새 컬럼 추가 → 일부 API만 ensure 추가 → 다른 읽기 경로에서 동일 폭발” 패턴을 막는 공통 읽기 계약이 없었다.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| `src/lib/workbench-result-read.ts` | 추가 | Result 읽기 공통 스키마 보정/선택자 |
| `src/app/api/sessions/[id]/route.ts` | 수정 | 세션 로드 시 안전한 Result 선택 사용 |
| `src/app/api/sessions/[id]/duplicate/route.ts` | 수정 | 세션 복제 시 안전한 Result 선택 사용 |
| `src/app/api/workbench/runs/[runId]/route.ts` | 수정 | 실행 상태 조회 시 안전한 Result 선택 사용 |
| `src/app/api/results/[id]/route.ts` | 수정 | 결과 삭제 전 스키마 보정 보장 |
| `src/app/api/admin/conversations/[id]/route.ts` | 수정 | 관리자 대화 상세 조회 보강 |
| `src/app/api/admin/conversations/[id]/raw/route.ts` | 수정 | 관리자 원문 조회 보강 |
| `src/app/admin/(panel)/conversations/[id]/page.tsx` | 수정 | 관리자 상세 페이지 조회 보강 |

## 검증
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- production DB에서 문제 세션 ID 조회 재검증

## 알려진 이슈 / 추후 작업
- 장기적으로는 세션 JSON 템플릿(`workflowTemplateStepsJson`)도 단순 배열 여부가 아니라 구조 검증을 거친 뒤 fallback 하도록 더 엄격하게 만들 여지가 있다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.13.7 | 2026-05-20 | 이전 세션 불러오기 실패 구조 수정, Result 읽기 공통 계약 도입 |
| v1.13.6 | 2026-05-20 | 순차 반복 실행 중복 호출/상태 되감기 방지 |

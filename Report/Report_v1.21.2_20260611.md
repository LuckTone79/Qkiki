# 작업 보고서

## 기본 정보
- **버전**: v1.21.2-20260611
- **작업 일시**: 2026-06-11
- **이전 버전**: v1.21.1-20260610
- **프로젝트명**: qkiki-workbench

## 작업 요약
PC에서 병렬모드 실행 중 페이지가 멈추고 브라우저가 "이 페이지가 로드되지 않았습니다"(연결 실패)를 띄우는 현상의 근본 원인을 조사했다. 이는 특정 AI 모델 오류가 아니라 **병렬 실행이 DB 커넥션 풀과 트랜잭션 계층을 점유해 서버 전체(페이지 렌더 포함)가 응답하지 못한** 구조적 문제였다. 재발 방지를 위해 lease 획득 방식, 커넥션 풀 기본값, 취소 폴러 수, 스트림 재연결 백오프를 개선했다.

## 원인 분석
스크린샷은 모델 단위 에러 화면이 아니라 브라우저의 페이지 로드 실패 화면이다. 운영 DB(`ExecutionRun`/`Result`) 확인 결과 최근 병렬 실행 자체는 `completed`로 끝났고(예: 4개 모델 모두 완료), 모델 응답이 원인이 아니었다. 근본 원인은 다음 4가지가 겹쳐 **단일 DB 커넥션을 장시간 점유**한 것이다.

1. **lease 획득이 serializable 인터랙티브 트랜잭션**이었다(`provider-concurrency.ts`). 병렬로 여러 건이 동시에 count+insert 왕복 동안 풀링된 커넥션을 붙잡아, `connection_limit=1` 환경에서 다른 모든 쿼리(페이지 인증 조회 포함)가 뒤에 줄 서고 "Unable to start a transaction in the given time"으로 표면화됐다.
2. **`DATABASE_URL`의 권장 패턴이 `connection_limit=1`**이었다(`.env.example`). 런타임 인스턴스당 커넥션이 1개뿐이라 병렬 실행의 동시 쿼리(리스, 취소 폴링, 결과 기록, 상태 폴링)가 모두 한 커넥션을 통과 → 페이지 렌더가 멈춤.
3. **취소 폴러가 타깃 수만큼 생성**됐다(`workflow.ts`). `shouldStop`은 run 단위인데 모델 개수만큼 750ms 폴링이 중복돼 같은 DB 쿼리를 N배로 늘렸다.
4. **스트림 재연결이 고정 350ms 루프**였다(`WorkbenchClient.tsx`). 스트림이 끊기면 실행 내내 상태 엔드포인트(→DB)를 350ms마다 두드려 부하를 가중했다.

## 변경 사항
### 수정된 사항
- `src/lib/provider-concurrency.ts`: lease 획득을 serializable 인터랙티브 트랜잭션 → **단일 원자적 `INSERT ... SELECT WHERE count < limit`** 문으로 변경. 커넥션을 한 문장 동안만 점유한다. 만료 lease 정리는 매 호출이 아니라 5% 확률의 hygiene 작업으로 분리.
- `src/lib/prisma-url.ts`(신규) + `src/lib/prisma.ts`: `connection_limit`이 1 이하/미설정이면 서버리스 안전 기본값(5)으로 상향. `PRISMA_CONNECTION_LIMIT`로 override 가능.
- `src/lib/ai/workflow.ts`: 병렬 실행에서 취소 폴러를 **타깃별 → run당 1개**로 통합.
- `src/lib/run-stream-backoff.ts`(신규) + `WorkbenchClient.tsx`: 스트림 재연결을 고정 350ms → **지수 백오프(350ms~2s)**, 새 이벤트 수신 시 리셋.

### 추가된 사항
- `src/lib/prisma-url.test.mjs`, `src/lib/run-stream-backoff.test.mjs`: 회귀 테스트.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|----------|------|
| `src/lib/provider-concurrency.ts` | 수정 | lease 획득을 단일 원자적 쿼리로 |
| `src/lib/prisma-url.ts` | 추가 | 커넥션 풀 기본값 상향 헬퍼 |
| `src/lib/prisma.ts` | 수정 | 풀 기본값 적용 |
| `src/lib/ai/workflow.ts` | 수정 | 병렬 취소 폴러 통합 |
| `src/lib/run-stream-backoff.ts` | 추가 | 스트림 재연결 백오프 |
| `src/components/workbench/WorkbenchClient.tsx` | 수정 | 백오프 적용 |
| `src/lib/*.test.mjs` | 추가 | 회귀 테스트 |
| `VERSION` / `src/lib/version.ts` | 수정 | 버전 갱신 |

## 검증
- `node --test src/lib/prisma-url.test.mjs src/lib/run-stream-backoff.test.mjs src/lib/provider-concurrency.test.mjs` → 10 pass / 0 fail
- `tsc`/`lint`/`build`는 컨테이너에 `node_modules` 미설치로 실행 불가(전부 의존성 미설치 에러).

## 알려진 이슈 / 추후 작업
- 운영 `DATABASE_URL`에 직접 `connection_limit=1`이 박혀 있다면 코드 기본값이 5로 올리지만, 가능하면 운영 환경변수도 명시적으로 상향 권장(`PRISMA_CONNECTION_LIMIT`).
- `provider-concurrency.test.mjs`는 일시 오류 분류만 검증한다. lease의 단일 쿼리 동작은 통합 테스트(실DB) 영역으로 남겨둔다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.21.2 | 2026-06-11 | 병렬모드 DB 커넥션/트랜잭션 점유로 인한 페이지 로드 실패 구조 개선 |
| v1.16.13 | 2026-06-06 | 병렬모드 Gemini 일시적 오류(429/503) 재시도·백오프 |
| v1.16.12 | 2026-06-06 | 병렬모드 provider lease transaction start timeout 완화 |

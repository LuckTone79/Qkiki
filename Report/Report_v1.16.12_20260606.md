# 작업 보고서

## 기본 정보
- **버전**: v1.16.12-20260606
- **작업 일시**: 2026-06-06
- **이전 버전**: v1.16.11-20260605
- **프로젝트명**: qkiki-workbench

## 작업 요약
병렬모드에서 일부 AI 모델은 성공하고 일부 모델은 실패하는 원인을 운영 DB의 최근 `AiRequest` 기록으로 확인했다. 대부분의 실패는 모델 API 자체가 아니라 provider lease 획득 중 Prisma transaction 시작 대기 시간이 초과되어 발생했다.

## 원인 분석
- 최근 병렬 실행 실패의 주요 오류는 `Transaction API error: Unable to start a transaction in the given time.`였다.
- 이 오류는 `src/lib/provider-concurrency.ts`의 provider lease 획득 트랜잭션이 병렬 호출 상황에서 2초 기본 대기 시간 안에 시작되지 못하며 발생했다.
- Google `gemini-3-pro-preview` 한 건은 별도 원인으로 `prepayment credits are depleted` 과금/크레딧 부족 오류였다. 이 오류는 provider 계정 상태 문제이므로 코드에서 성공 처리하면 안 된다.

## 변경 사항
### 수정된 사항
- provider lease 트랜잭션의 기본 `maxWait`와 `timeout`을 10초로 확장했다.
- 만료 lease 정리 범위를 모든 provider가 아니라 현재 provider로 제한해 병렬 실행 시 불필요한 DB 경합을 줄였다.
- lease 획득 중 Prisma transaction 시작 오류가 발생하면 사용자 결과를 실패로 저장하지 않고, 경고 로그를 남긴 뒤 provider 호출을 계속 진행하도록 했다.
- 실제 provider 과금/인증/모델 오류는 그대로 실패 결과로 유지한다.

### 추가된 사항
- provider lease 일시 오류 분류 헬퍼를 추가했다.
- 운영에서 확인된 transaction start timeout 메시지를 회귀 테스트로 고정했다.

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|----------|------|
| `src/lib/provider-lease-errors.ts` | 추가 | provider lease 일시 오류 분류 헬퍼 |
| `src/lib/provider-concurrency.ts` | 수정 | lease transaction 대기 시간 확장 및 provider별 cleanup 제한 |
| `src/lib/ai/providers.ts` | 수정 | lease 일시 오류 시 provider 호출 계속 진행 |
| `src/lib/provider-concurrency.test.mjs` | 추가 | 운영 오류 메시지 회귀 테스트 |
| `VERSION` | 수정 | 현재 버전 갱신 |
| `src/lib/version.ts` | 수정 | 앱 표시 버전 갱신 |

## 검증 예정
- `node --test src/lib/provider-concurrency.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

## 알려진 이슈 / 추후 작업
- Google `prepayment credits are depleted` 오류는 Google AI Studio 결제/크레딧 설정 문제이므로 별도 운영 조치가 필요하다.
- provider lease를 우회하는 경로는 DB transaction start timeout 같은 일시적 lease 계층 오류에만 제한된다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.16.12 | 2026-06-06 | 병렬모드 provider lease transaction start timeout 완화 |
| v1.16.11 | 2026-06-05 | 워크벤치 모드 버튼 및 입력 패널 정리 |

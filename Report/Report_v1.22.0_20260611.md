# Report v1.22.0-20260611

## 작업 요약

유료 구독 런칭을 위한 크레딧 기반 과금 구조를 프로그램에 반영했습니다. 기존 일일 실행 횟수 제한은 유지하면서, 실제 AI 호출 원가를 크레딧으로 환산하고 병렬 검토, 순차 체인 검토, 반복 블록, 비교 요약, 재실행/분기 실행까지 예약 및 정산 흐름에 연결했습니다.

## 핵심 변경

- 크레딧 산식 모듈 추가
  - `src/lib/credits.ts`
  - API 원가, 환율, 운영 리스크 배수를 반영해 원가의 2배 이상을 보호하는 크레딧 환산 규칙 추가
  - 병렬 실행, 순차 실행, 반복 블록, 비교 요약, 모델 팬아웃 실행 예상치 계산

- 사용량 정책 확장
  - `src/lib/usage-policy.ts`
  - 월/일 크레딧 한도, 사용 크레딧, 쿠폰 크레딧, 지갑 크레딧, 총 가용 크레딧을 응답에 포함
  - 실행 예약 시 예상 크레딧과 견적 JSON 저장
  - 정산 시 실제 사용량을 기록하되, 사용자가 시작 전에 승인한 예상 크레딧을 초과하지 않도록 상한 적용

- 쿠폰 구조 확장
  - 기존 횟수/구독 쿠폰 유지
  - `WEEKLY_CREDIT` 쿠폰 추가
  - 관리자가 쿠폰 발행 시 7일 크레딧 수량 입력 가능
  - 쿠폰 적용 시 사용자 구독 상태에 만료형 크레딧 잔액 반영

- UI 반영
  - 워크벤치 상단에 자동 예상 크레딧 표시
  - 사용량 카드에 남은 크레딧, 오늘 크레딧, 쿠폰 크레딧, 지갑 크레딧, 남은 실행 횟수 동시 표시
  - 관리자 쿠폰 화면에 주간 크레딧 쿠폰 발행/표시 추가
  - 가격 페이지를 Starter/Pro/Team/충전 크레딧 구조로 개편

- DB 스키마 및 마이그레이션
  - `prisma/schema.prisma`
  - `prisma/migrations/20260611120000_add_credit_billing_v1/migration.sql`
  - 쿠폰 크레딧 수량, 쿠폰 만료 크레딧 잔액, 예약 견적/정산 크레딧 필드 추가

## 검증

- `node --test src/lib/credits.test.mjs src/lib/workbench-run-payload.test.mjs src/lib/repeat-count-input.test.mjs src/lib/ai/provider-catalog.test.mjs src/lib/workbench-model-guidance.test.mjs`
- `npx prisma format`
- `npx prisma generate`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- 로컬 개발 서버 `http://127.0.0.1:3000` 실행 확인
- 브라우저 확인: `/sign-in` 렌더링, `/guide`의 `v1.22.0-20260611` 버전 표시 확인

## 버전

- 이전: `v1.21.3-20260611`
- 현재: `v1.22.0-20260611`

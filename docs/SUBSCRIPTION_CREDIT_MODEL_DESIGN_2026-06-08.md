# Qkiki 구독 및 크레딧 모델 설계서

- 날짜: 2026-06-08
- 범위: Multi AI workbench의 구독, 크레딧, 사용량 정책
- 대상: 운영자, 제품 책임자, 과금 구현자, 관리자 검토자
- 목표: 사용자에게는 비용이 투명하고, 운영자에게는 마진이 안정적인 과금 구조를 만든다

## 1. 결론

이 제품을 `"하루 N회"`나 `"무제한 AI 사용"`으로 팔면 안 된다.
이 워크벤치는 사용자가 보이는 단일 실행 1회가 실제로는 훨씬 큰 비용 변동을 만들 수 있기 때문이다.

- 병렬 모드는 한 번의 실행에서 최대 8개 모델을 호출할 수 있다.
- 순차 모드는 반복 블록 확장으로 최대 50개의 모델 실행까지 늘어날 수 있다.
- 브랜치와 재실행은 추가 provider 호출을 더 만든다.
- 병렬 결과 차이 요약은 별도의 요약 모델 호출이 붙는다.
- 긴 입력, 프로젝트 컨텍스트, 첨부파일, 이전 결과, `all_results` 소스 모드는 입력 토큰을 크게 키운다.
- 출력 토큰은 보통 입력 토큰보다 비싸서, 응답이 길어질수록 비용 편차가 더 커진다.

안정적인 사업 구조는 다음이 맞다.

1. 월 구독은 월간 크레딧을 제공한다.
2. 모든 AI 실행은 예상 또는 실제 보호원가 기준으로 크레딧을 소모한다.
3. 일일 실행 제한은 남용 방지용 보조 장치로 두고, 핵심 경제 단위로 쓰지 않는다.
4. 비싼 모델과 큰 순차 체인은 실행 전에 명시적 확인이 필요하다.
5. 초과분은 추가 크레딧 팩으로 처리하고, 사용자를 바로 상위 플랜으로 강제하지 않는다.
6. 매우 높은 사용량이나 사실상 무제한 사용은 Enterprise/BYOK에서만 허용한다.

## 2. 현재 시스템 근거

### 기존 사용량 정책

`src/lib/usage-policy.ts`는 현재 플랜을 일일 요청 한도로 해석한다.

| 정책 | 일일 요청 한도 | 입력 글자 한도 | 고급 추론 일일 한도 |
|---|---:|---:|---:|
| Free | 10 | 3,000 | 1 |
| Boost | 30 | 5,000 | 3 |
| Starter | 40 | 12,000 | 4 |
| Pro | 120 | 60,000 | 25 |
| Team | 250 | 100,000 | 100 |

`reserveUsage(...)`는 실행 전에 `reservedRequestCount: 1`을 예약하고,
`settleUsageReservation(...)`는 그 수만큼 `dailyRequestUsed`를 늘린다.
토큰과 비용 정보는 `UsageLog`에 기록되지만, 호출자가 `creditsUsed`를 명시하지 않으면 기본값은 `0`이다.

즉, 현재 시스템은 실행 후 토큰/비용 데이터는 저장하지만, 실제 차감의 중심은 여전히 `"실행 1회 = 요청 1회"`다.

### 기존 크레딧 스키마

Prisma 스키마에는 이미 과금용 명사가 들어 있다.

- `UsageLog.inputTokenCount`
- `UsageLog.outputTokenCount`
- `UsageLog.estimatedCostUsd`
- `UsageLog.creditsUsed`
- `CreditWallet.paidCredits`
- `CreditWallet.bonusCredits`
- `CreditWallet.totalUsedCredits`
- `PaymentPlan.monthlyCreditLimit`

즉, DB 방향은 크레딧 과금과 잘 맞지만, 경제 정책은 아직 예약/정산 흐름에 완전히 묶이지 않았다.

### 실행 배수 경로

메인 워크벤치 실행 API는 `plannedTotal`을 계산하고, durable `ExecutionRun`을 만든 뒤, 실행 1개에 사용량 예약 1개를 연결한다.
이 예약은 확장된 provider 호출 수에 비례하지 않는다.

순차 반복 확장은 다음 상한을 가진다.

- `MAX_TOTAL_SEQUENTIAL_STEPS = 50`
- `MAX_REPEAT_BLOCKS = 10`

병렬 모드 검증은 다음을 허용한다.

- 메인 실행은 `targets.max(8)`
- 브랜치/재실행은 최대 4개 타깃
- 병렬 비교 요약은 `src/app/api/workbench/compare/route.ts`의 별도 경로로 처리되며, OpenAI 준비 상태를 확인한 뒤 `generateParallelComparisonSummary(...)`를 호출한다

`src/lib/ai/summary-model.ts`는 현재 병렬 비교 요약 모델로 `openai/gpt-5.5`를 사용한다.
이건 고비용 요약 기본값이므로, 별도 크레딧 과금 대상으로 봐야 한다.

## 3. 공식 가격 기준

가격은 주기적으로 갱신해야 한다. 공급자 가격과 모델명이 계속 바뀌기 때문이다.
이 설계는 공식 문서 기준으로 아래를 사용한다.

- OpenAI API 가격: GPT-5.5는 입력 $5.00 / 출력 $30.00 per 1M tokens, GPT-5.4는 $2.50 / $15.00, GPT-5.4 mini는 $0.75 / $4.50.
  출처: https://openai.com/ko-KR/api/pricing/
- Anthropic API 가격: Claude Opus 4.8은 $5 / $25, Claude Sonnet 4.6은 $3 / $15, Claude Haiku 4.5는 $1 / $5 per 1M tokens.
  출처: https://platform.claude.com/docs/en/about-claude/pricing
- Google Gemini API 가격: Gemini 3 Flash Preview는 $0.50 / $3.00, Gemini 2.5 Flash는 $0.30 / $2.50, Gemini 2.5 Flash-Lite는 $0.10 / $0.40, Gemini 2.5 Pro는 장문 입력에서 더 높은 계층 가격을 가진다.
  출처: https://ai.google.dev/gemini-api/docs/pricing
- xAI 가격: Grok 4.3과 Grok 4.20 계열은 $1.25 / $2.50 per 1M tokens.
  출처: https://docs.x.ai/developers/pricing
- USD/KRW 작업 환율: 설계 기준으로 1 USD = 1,560 KRW를 사용한다. 2026-06-08 라이브 검색에서는 약 1,559 KRW 수준이 확인되었다.

중요한 점은 `src/lib/ai/pricing.ts`가 비즈니스의 유일한 진실이 되면 안 된다는 것이다.
공급자 공식 가격, 빌링 할인, 지역 차이, 캐시 효과, 모델 대체는 계속 변동할 수 있다.

## 4. 비용 산식

### 원가

각 provider 호출의 원가는 다음과 같이 계산한다.

```text
raw_cost_usd =
  (input_tokens / 1,000,000 * model_input_price_usd_per_mtok)
  +
  (output_tokens / 1,000,000 * model_output_price_usd_per_mtok)
```

사용자에게 보이는 한 번의 실행 비용은 다음이다.

```text
action_raw_cost_usd =
  sum(raw_cost_usd for every provider call created by that action)
```

여기에는 다음이 포함된다.

- 병렬 타깃 각각
- 순차 실행된 각 스텝
- 브랜치와 재실행의 각 타깃
- 병렬 비교 요약
- fallback provider 호출
- provider retry가 실제로 청구되는 경우의 재시도

### 보호원가

운영자 마진을 지키기 위해 원가에 보호계수를 곱한다.

```text
protected_cost_krw =
  raw_cost_usd
  * fx_rate_krw_per_usd
  * provider_drift_factor
  * retry_failure_factor
  * support_margin_factor
```

권장 초기값은 다음이다.

```text
fx_rate_krw_per_usd = 1,560
combined_risk_factor = 2.2
protected_cost_krw = raw_cost_usd * 1,560 * 2.2
```

이 2.2는 다음을 같이 포함한다.

- 공급자 가격 변동
- 환율 변동
- 결제 수수료와 카드 수수료
- retry, 실패, 부분 성공
- 고객 지원 비용
- 비싼 워크플로를 자주 쓰는 사용자
- 목표 마진

### 사용자 크레딧 변환

사용자에게는 토큰 수를 기본 개념으로 보여주지 말고 크레딧을 보여준다.

권장 초기 변환식은 다음이다.

```text
1 credit = 10 KRW의 보호원가
credits = ceil(protected_cost_krw / 10)
```

동치로 쓰면 다음과 같다.

```text
credits = ceil(raw_cost_usd * 343.2)
```

왜냐하면 `1,560 * 2.2 / 10 = 343.2`이기 때문이다.

이 값은 의도적으로 보수적이다. 실제 텔레메트리로 마진이 너무 높거나 낮다는 것이 증명되면, 제품 전체 구조를 바꾸지 말고 이 변환계수만 조정한다.

## 5. 실행 예시

아래 예시는 위의 보호원가 공식을 썼을 때의 감각을 보여준다.
정확한 청구서가 아니라 플랜 설계용 intuition이다.

| 시나리오 | 호출 수 | 예시 토큰/호출 | 예시 모델 | 원가 | 크레딧 |
|---|---:|---:|---|---:|---:|
| 작은 단일 저가 작업 | 1 | 2k in / 1k out | Gemini Flash-Lite | 약 $0.0006 | 1 |
| 일반 GPT mini 작업 | 1 | 8k in / 3k out | GPT-5.4 mini | 약 $0.0195 | 7 |
| 4모델 병렬 비교 | 4 | 각 8k in / 3k out | 혼합 중간급 모델 | 약 $0.08-$0.25 | 28-86 |
| 4모델 병렬 + GPT-5.5 요약 | 5 | 요약 20k in / 2k out | GPT-5.5 summary | 약 $0.16 추가 | 55 추가 |
| 10스텝 순차 검토 | 10 | 각 10k in / 4k out | Sonnet/GPT 계열 | 약 $0.63-$0.90 | 217-309 |
| 30스텝 고급 체인 | 30 | 각 15k in / 5k out | Sonnet/GPT-5.4 | 약 $3.15-$4.50 | 1,081-1,545 |
| 50스텝 프리미엄 체인 | 50 | 각 20k in / 6k out | GPT-5.5/Opus | 약 $13-$14 | 4,462-4,805 |

핵심은 하나다. 눈에 보이는 `"run"` 하나가 거의 공짜부터 수천 크레딧까지 갈 수 있으므로, 요청 횟수 기반 구독으로는 안전하게 가격을 못 매긴다.

## 6. 권장 플랜

### Free

- 가격: 무료
- 월 포함 크레딧: 100
- 일일 크레딧 상한: 25
- 일일 요청 상한: 5
- 병렬 타깃: 2
- 순차 planned steps: 5
- 브랜치/재실행 타깃: 1
- 병렬 비교 요약: 비활성 또는 저가 요약 모델로 하루 1회
- 프리미엄 모델: 비활성
- 첨부파일: 작은 텍스트 또는 1개 파일

목적은 제품을 이해하게 해 주는 것이고, 운영자에게 비싼 체인을 허용하는 것이 아니다.

### Starter

- 가격: $11.30/월
- 월 포함 크레딧: 700
- 일일 크레딧 상한: 120
- 일일 요청 상한: 40
- 병렬 타깃: 3
- 순차 planned steps: 12
- 브랜치/재실행 타깃: 2
- 병렬 비교 요약: 활성, 크레딧 차감
- 프리미엄 모델 월 풀: 100 크레딧
- 추천 사용자: "짧은 비교와 가벼운 작업"

이 플랜은 일반 사용자에게는 충분하고, 무거운 순차 자동화에는 일부러 부족해야 한다.

### Pro

- 가격: $29/월
- 월 포함 크레딧: 2,400
- 일일 크레딧 상한: 400
- 일일 요청 상한: 120
- 병렬 타깃: 5
- 순차 planned steps: 30
- 브랜치/재실행 타깃: 3
- 병렬 비교 요약: 활성, 크레딧 차감
- 프리미엄 모델 월 풀: 400 크레딧
- 추천 사용자: "진지한 개인 작업과 반복 검토"

이 플랜이 주력 유료 플랜이어야 한다.
Pro가 GPT-5.5, Opus, 50스텝 체인을 사실상 무제한처럼 느끼게 만들면 안 된다.

### Team

- 가격: $89/월
- 월 포함 크레딧: 7,500 공유 크레딧
- 일일 크레딧 상한: 1,300 공유 크레딧
- 일일 요청 상한: 250 공유 요청
- 포함 좌석: 3개, 추가 좌석 별도 과금
- 병렬 타깃: 8
- 순차 planned steps: 50
- 브랜치/재실행 타깃: 4
- 프리미엄 모델 월 풀: 1,500 크레딧
- 관리자 사용량 대시보드: 필수
- 추천 사용자: "팀 검토와 긴 체인 작업"

이 플랜은 제품의 전체 형태를 허용하지만, 그래도 크레딧 상한은 유지해야 한다.

### Enterprise / BYOK

- 가격: 별도 계약
- 사용 모델: 고객 API 키 또는 후불 계약
- 제한: 협의
- 프리미엄 모델: 계약으로 허용
- 필수: 비용 대시보드, 경고 임계치, 인보이스 감사 내보내기

이 티어만 high volume이나 custom limit 같은 문구를 써도 된다.

## 7. 크레딧 팩

사용자는 합법적인 큰 작업에서 반드시 초과분을 만나게 되므로, 크레딧 팩을 둬야 한다.

| 팩 | 가격 | 크레딧 | 비고 |
|---|---:|---:|---|
| Small | $9 | 500 | 긴급 충전 |
| Medium | $19 | 1,200 | Starter 초과분용 |
| Large | $39 | 2,500 | Pro의 무거운 달용 |
| Team refill | $89 | 7,500 | 관리자 전용 |

유료 크레딧은 대상 국가의 법률이 허용하면 12개월 만료를 권장한다.
보너스 크레딧은 더 짧게, 예를 들어 30~90일 만료를 둘 수 있다.

## 8. 사용자 불만 방지 정책

사용자는 비용이 놀랍거나 불공정하거나 일관되지 않게 느껴질 때 불만을 가진다.
이를 막기 위한 규칙은 다음과 같다.

1. 실행 전에 항상 예상 크레딧을 보여준다.
2. 왜 그 비용이 나오는지 보여준다.
3. 실행 전에 예상치를 예약한다.
4. 실제 보호 크레딧과 사용자가 승인한 예상 크레딧 중 더 낮은 쪽을 기본 차감으로 하되, 초과분은 별도 승인 없이는 받지 않는다.
5. 런이 실제 모델 호출 전에 실패하면 예약을 해제하거나 환급한다.
6. 부분 성공은 사용 가능한 결과만 차감한다.
7. 플랫폼 오류, 큐 오류, provider 키 설정 오류는 사용자에게 청구하지 않는다.
8. 사용자 취소는 이미 완료된 결과와 이미 청구된 provider 호출분만 과금한다.
9. 실행 기록에는 `"estimated"`와 `"final"` 크레딧을 둘 다 보여준다.
10. 프리미엄 모델, `all_results` 소스 모드, 큰 첨부파일, 20스텝 이상 순차 실행 전에는 경고한다.

권장 사전 안내 문구:

```text
예상 비용: 286 크레딧
이 실행은 12개의 AI 호출을 수행합니다. 3개 기본 스텝을 4번 반복합니다.
큰 출력이나 재시도로 최종 비용이 달라질 수 있지만, 별도 확인 없이 예상치를 초과해 청구하지는 않습니다.
```

## 9. 남용 및 마진 제어

### 플랜별 하드캡

크레딧 캡과 구조 캡을 같이 써야 한다.

| 플랜 | 최대 병렬 타깃 | 최대 순차 스텝 | 최대 입력 글자 | 프리미엄 접근 |
|---|---:|---:|---:|---|
| Free | 2 | 5 | 3,000 | 없음 |
| Starter | 3 | 12 | 12,000 | 소량 풀 |
| Pro | 5 | 30 | 60,000 | 중간 풀 |
| Team | 8 | 50 | 100,000 | 큰 풀 |

### 고가 모델 분류

다음은 프리미엄으로 취급한다.

- OpenAI GPT-5.5
- OpenAI GPT-5.4
- Claude Opus
- Claude Sonnet
- Gemini Pro
- 출력 가격이 1M tokens당 $10 이상인 모델
- 실제 관측 p95 비용이 플랜 예산을 넘는 모델

### 런타임 중단 규칙

다음 상황이면 실행을 멈추거나 확인을 요구한다.

- 예상 실행 비용이 남은 월 크레딧을 넘을 때
- 예상 실행 비용이 일일 크레딧 상한을 넘을 때
- planned steps가 플랜 상한을 넘을 때
- 한 번의 실행이 월 허용량의 25%를 넘을 때
- 선택 모델의 가격을 알 수 없을 때
- provider 응답에 사용량 메타데이터가 없을 때

알 수 없는 가격을 공짜처럼 취급하면 안 된다.
보수적인 대체 요율을 써라. 예를 들어 저가 모델은 알 수 없는 provider 호출 1회당 50 크레딧, 프리미엄은 300 크레딧 같은 식이다.

## 10. 구현 설계

### 새 과금 개념

`reserveUsage(...)` 앞에 크레딧 견적 계층을 둬야 한다.

권장 내부 타입 예시:

```ts
type CreditQuote = {
  quoteId: string;
  userId: string;
  mode: "parallel" | "sequential" | "branch" | "rerun" | "comparison_summary";
  plannedCallCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedRawCostUsd: number;
  estimatedProtectedCostKrw: number;
  estimatedCredits: number;
  maxApprovedCredits: number;
  pricingVersion: string;
  expiresAt: Date;
};
```

### 예약 변경

`UsageReservation`에는 다음 필드가 필요하다.

- `reservedCreditCount`
- `settledCreditCount`
- `estimatedRawCostUsd`
- `pricingVersion`
- `quoteJson`

한 번에 큰 마이그레이션이 부담되면 `CreditReservation`을 새 테이블로 두고
`ExecutionRun`과 `UsageReservation`에 연결해도 된다.

### 정산 변경

정산 시에는 다음 순서를 지킨다.

1. `Result`와 `ExecutionRunStep`에서 실제 provider 사용량을 합산한다.
2. 견적 시점에 활성화된 pricing version으로 실제 raw cost를 다시 계산한다.
3. 이를 보호 크레딧으로 변환한다.
4. 명시적 초과 승인 없이는 `maxApprovedCredits`를 넘기지 않는다.
5. `UsageLog.creditsUsed`를 기록한다.
6. 월 구독 크레딧을 먼저, 그다음 보너스 크레딧, 그다음 paid wallet 순서로 차감한다.

### 반드시 크레딧화할 경로

다음 라우트는 모두 credit-aware가 되어야 한다.

- `POST /api/workbench/run`
- branch run route
- result rerun route
- v2 step branch-rerun route
- `POST /api/workbench/compare`

특히 `/api/workbench/compare`는 현재 normal reservation path 밖에서 GPT-5.5 호출을 수행하므로, 꼭 별도 과금 대상이어야 한다.

### UI 변경

워크벤치는 다음을 보여줘야 한다.

- 실행 전 예상 크레딧
- planned model calls
- 남은 월 크레딧
- 남은 일일 안전 한도
- 프리미엄 풀 잔량
- 완료 후 최종 청구 크레딧
- 각 결과의 provider/model/cost 상세 정보

사용자 UI에서는 `"tokens"`를 기본 단위로 말하지 말고,

- 과금은 `"credits"`
- 실행 규모는 `"AI calls"`
- 고급 상세에서는 `"tokens"`

순서로 보여주는 게 맞다.

## 11. 관리자 대시보드

관리자 화면에서는 다음이 보여야 한다.

- 플랜별 매출
- provider/model별 원가
- 보호원가
- 지급된 크레딧
- 소모된 크레딧
- 총마진
- 원가가 높은 사용자
- 크레딧 소모가 높은 사용자
- raw cost가 charged credits보다 큰 실행
- 가격을 알 수 없는 호출
- provider telemetry 누락률
- action type별 p50/p90/p95/p99 크레딧

중요 경보 임계치는 다음이다.

- 한 사용자가 하루 허용량의 30% 이상을 쓸 때
- 한 실행의 raw cost가 1,000 KRW를 넘을 때
- 한 실행의 보호 크레딧이 월 플랜의 25%를 넘을 때
- 일일 provider 지출이 예상 예산을 넘을 때
- 운영 중 unknown model pricing이 나타날 때
- comparison summary endpoint 사용량이 급증할 때

## 12. 최종 가격 고정 전 필요한 텔레메트리

공개 가격을 고정하기 전에 최소 7~14일의 텔레메트리를 모아야 한다.

- provider/model/action type별 토큰
- input/output 토큰 비율
- planned steps 대비 실제 실행 steps
- repeat count 분포
- 병렬 타깃 개수 분포
- comparison summary 사용 비율
- branch/rerun 빈도
- 활성 사용자당 일일 비용
- 플랜 후보별 p95/p99 비용

출시를 텔레메트리보다 먼저 해야 한다면, 보수적인 크레딧을 쓰고 `"launch limits"`라고 명시해 둬야 한다.

## 13. 롤아웃 순서

### 1단계: 안전한 견적 노출

- 결제 방식은 바꾸지 말고 견적 계산만 추가한다.
- UI에 예상 크레딧을 보여준다.
- 견적 스냅샷을 저장한다.
- 현재 일일 요청 제한은 fallback으로 유지한다.

### 2단계: 크레딧 예약

- 월간 크레딧 지급 로직을 추가한다.
- 실행 전에 예상 크레딧을 예약한다.
- 쓰지 않은 크레딧은 해제한다.
- 실제 크레딧은 `UsageLog.creditsUsed`에 정산한다.

### 3단계: 플랜 강제

- 병렬 타깃 수, 순차 스텝, 프리미엄 풀, 일일 크레딧, 월 크레딧을 플랜별로 강제한다.
- comparison summary도 계량한다.
- 관리자 마진 대시보드를 넣는다.

### 4단계: 공개 과금

- Starter, Pro, Team, credit pack을 공개한다.
- 고사용량 고객에게는 Enterprise/BYOK를 남겨 둔다.
- 가격과 크레딧 변환을 월 단위로 검토한다.

## 14. 최종 추천

공개 구조는 아래가 적절하다.

| 플랜 | 가격 | 월 크레딧 | 일일 상한 | 적합 대상 |
|---|---:|---:|---:|---|
| Free | 0 KRW | 100 | 25 | 제품 체험 |
| Starter | $11.30 | 700 | 120 | 가격 민감 사용자의 가벼운 비교 작업 |
| Pro | $29 | 2,400 | 400 | 진지한 개인 작업 |
| Team | $89 | 7,500 공유 | 1,300 공유 | 팀 검토 체인 |
| Enterprise/BYOK | 별도 | 별도 | 별도 | 고사용량 자동화 |

이 설계는 높은 비용의 워크플로가 더 많은 크레딧을 소모하게 만들어 운영자 마진을 보호하고, 일반 사용자는 예측 가능한 포함량을 받게 해 준다.
또한 실행 전에 예상 비용을 보여주기 때문에, 사용자 입장에서는 숨은 토큰 과금처럼 느껴지지 않고 초과분은 충전으로 해결할 수 있다.

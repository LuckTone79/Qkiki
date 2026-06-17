# 보고서 v1.27.1-20260617 — "크레딧 충분한데 생성 안 됨" 원인 분석 및 개선

## 증상
이미지 생성 시 **보유 크레딧(50)이 예상 크레딧(40)보다 많은데도** "Not enough credits are available for this request."로 실패. 결과 보드에는 결과 0개(전체 0/완료 0/실패 0), 진행 카드만 실패로 표시.

## 정확한 원인
크레딧 예약(`reserveUsage` / `requireUsageAccess`, `src/lib/usage-policy.ts`)은 예상 크레딧을 **두 축 모두**와 비교해, 하나라도 초과하면 거절한다:

```
estimatedCredits > totalCreditsAvailable      // 총(월) 잔여
|| estimatedCredits > totalDailyCreditsAvailable  // 오늘 남은
```

`src/lib/billing-plans.ts`의 **FREE 플랜 한도**:
- `monthlyCreditLimit: 50` → UI의 "보유 크레딧 50"
- `dailyCreditLimit: 25` → **UI에 표시되지 않음**

따라서 이미지 모델 3개 선택(약 40크레딧: 예 gpt-image-2 19 + gemini-2.5-flash-image 14 + grok 7)은:
- 총 잔여 50 기준으로는 통과처럼 보이지만,
- **일일 잔여 25를 초과** → 예약 거절 → "Not enough credits".

UI(`WorkbenchClient.tsx`)는 "보유 크레딧"으로 `totalCreditsAvailable`(월 기준)만, "실행 후"도 그 값만으로 계산해 일일 한도라는 실제 제약을 전혀 노출하지 않았다. (화면의 "다음 초기화: 6/18 자정"이 일일 리셋과 일치.) **버그라기보다 의도된 일일 한도가 UI에 가려져 생긴 불일치.**

## 개선 (스코프: 투명성 + 사전 차단, 정책/가격 변경 없음)
1. `WorkbenchClient.tsx`
   - 실제 가능 한도 = `min(총 잔여, 일일 잔여)`로 "실행 후" 계산을 변경.
   - 일일 잔여가 더 작을 때 예상 크레딧 패널에 "오늘 남은 N" 표시.
   - 일일/총 중 무엇이 제약인지 구분해, 초과 시 구체적 경고 배너 + **실행 전 사전 차단**(모델 수 줄이기/자정 KST 초기화 후 재시도 안내).
2. `usage-policy.ts` — `UsageCreditLimitReachedError` 메시지가 일일 한도가 원인일 때 "오늘 X/일일한도 Y만 남음, 자정(KST) 초기화" 형태로 명시.
3. 버전 v1.27.1-20260617, CHANGELOG Patch 25.

## 사용자 영향
- FREE(일일 25) 기준, **단일 저가 이미지 모델**(gpt-image-2 19, grok 7 등)은 정상 생성된다. 여러 모델 동시 선택이 일일 25를 넘으면 이제 **이유와 해법이 즉시 안내**되어, 모델 수를 줄이거나 초기화 후 재시도하면 된다.
- 가격/한도 자체는 제품 정책이라 변경하지 않음(필요 시 별도 결정).

## 검증
- `npx tsc --noEmit` 통과
- `npx eslint` 통과
- `node --test` 124/124 통과

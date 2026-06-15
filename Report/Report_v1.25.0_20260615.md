# 작업 보고서

## 기본 정보
- **버전**: v1.25.0-20260615
- **작업 일시**: 2026-06-15
- **이전 버전**: v1.24.0-20260612
- **프로젝트명**: Qkiki Multi AI Workbench

## 작업 요약
이미지 생성 모델의 API 원가가 텍스트 응답 토큰 산식과 다르게 움직이는 문제를 반영해, 크레딧 계산에 이미지 생성 전용 과금 단위를 추가했습니다. 실행 전 예약 견적과 실행 후 정산 경로가 같은 이미지 단가표를 사용하도록 정리했습니다.

## 변경 사항
### 추가된 기능
- 이미지 생성 단가표 `IMAGE_GENERATION_PRICING` 추가
- 이미지 생성 비용 계산 함수 `estimateImageGenerationCostUsd(...)` 추가
- 크레딧 견적 라인에 `billingKind`, `unitCount`, `unitLabel` 추가
- Provider 카탈로그에 `imageModels`, `getImageModels(...)`, `isImageModel(...)` 추가

### 수정된 사항
- 크레딧 가격 버전을 `credit-v2-image-20260615`로 갱신
- 이미지 생성 모델은 텍스트 출력 토큰이 아니라 이미지 1장 단가로 크레딧 계산
- `src/lib/ai/pricing.ts`의 실제 provider 비용 추정도 이미지 단가표를 참조
- `/api/providers` 응답에 provider별 이미지 생성 모델 목록 포함
- 구독 크레딧 설계서와 글로벌 수익화 가이드에 이미지 생성 차감 기준 추가
- 앱 버전을 `v1.25.0-20260615`로 업데이트

### 삭제/제거된 사항
- 없음

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| `src/lib/credits.ts` | 수정 | 이미지 생성 단가표와 이미지 단위 크레딧 산식 추가 |
| `src/lib/ai/pricing.ts` | 수정 | 실제 실행 비용 추정에서 이미지 모델 비용 반영 |
| `src/lib/ai/provider-catalog.ts` | 수정 | provider별 이미지 생성 모델 목록 추가 |
| `src/app/api/providers/route.ts` | 수정 | 이미지 모델 목록 API 응답 포함 |
| `src/lib/credits.test.mjs` | 수정 | 이미지 생성 크레딧 계산 테스트 추가 |
| `src/lib/ai/provider-catalog.test.mjs` | 수정 | 이미지 모델 카탈로그 테스트 추가 |
| `docs/SUBSCRIPTION_CREDIT_MODEL_DESIGN_2026-06-08.md` | 수정 | 이미지 생성 크레딧 산식 문서화 |
| `docs/GLOBAL_MONETIZATION_GUIDE_2026-06-12.md` | 수정 | 글로벌 수익화 관점의 이미지 생성 과금 정책 추가 |
| `VERSION` | 수정 | 현재 버전 업데이트 |
| `src/lib/version.ts` | 수정 | 앱 내 표시 버전 업데이트 |

## 알려진 이슈 / 추후 작업
- 이미지 품질, 해상도, 이미지 개수 옵션이 UI에 추가되면 `unitCount`와 모델별 high/2K/4K 단가를 실행 요청 파라미터와 연결해야 합니다.
- 이미지 편집은 입력 이미지 과금이 붙을 수 있으므로 이미지 생성과 별도 단가표로 분리하는 것이 안전합니다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.25.0 | 2026-06-15 | 이미지 생성 모델 전용 크레딧 차감 산식 추가 |
| v1.24.0 | 2026-06-12 | 최저 $11.30 구독 플랜 및 전체 크레딧 제공량 재조정 |
| v1.23.0 | 2026-06-12 | 글로벌 수익화 가이드북 모바일 공개 페이지 추가 |

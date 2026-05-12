# 작업 보고서

## 기본 정보
- 버전: v1.8.2-20260512
- 작업 일시: 2026-05-12
- 이전 버전: v1.8.1-20260512
- 프로젝트명: Qkiki Workbench

## 작업 요약
Claude 공식 제공 모델과 현재 프로그램의 Anthropic 모델 구성이 일치하는지 확인했다. 확인 결과 앱 내부에는 구형 Claude API 모델 ID가 남아 있었고, 이를 Claude 공식 표기 및 최신 API ID 기준으로 정리했다.

## 변경 사항
### 추가한 항목
- Claude 모델 표시명을 공용으로 관리하는 helper 추가
- Anthropic 구형 모델 ID를 최신 공식 모델 ID로 정규화하는 호환 레이어 추가

### 수정한 항목
- Anthropic 기본 모델과 선택 가능 모델을 `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`로 교체
- 관리자 공급자 설정 API와 사용자 공급자 API가 기존 저장값도 최신 Claude 모델로 자동 정규화하도록 수정
- 워크벤치, 결과 카드, 관리자 화면에서 Claude 모델명이 공식 표기인 `Opus 4.7`, `Sonnet 4.6`, `Haiku 4.5`로 보이도록 수정
- 앱 표시 버전과 `VERSION` 파일을 v1.8.2-20260512로 갱신

### 제거/정리한 항목
- Anthropic 모델에 대한 구형 별도 alias 상수를 제거하고 공용 정규화 함수로 통합

## 변경한 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| `src/lib/ai/provider-catalog.ts` | 수정 | Claude 공식 모델 목록 및 정규화 함수 반영 |
| `src/lib/ai/model-display.ts` | 추가 | 모델 표시명 공용 helper 추가 |
| `src/lib/ai/providers.ts` | 수정 | Anthropic 호출 시 최신 공식 모델 ID 사용 |
| `src/app/api/providers/route.ts` | 수정 | 사용자용 공급자 모델 정규화 |
| `src/app/api/admin/providers/route.ts` | 수정 | 관리자 설정 저장/조회 시 모델 정규화 |
| `src/components/workbench/*.tsx` | 수정 | 워크벤치/결과 카드의 Claude 모델 표시 개선 |
| `src/components/admin/*.tsx` | 수정 | 관리자 화면의 Claude 모델 표시 개선 |
| `src/lib/version.ts` | 수정 | 앱 표시 버전 갱신 |
| `VERSION` | 수정 | 현재 버전 갱신 |

## 검증 결과
- `npm run build`: 성공
- `npx eslint <변경 파일들>`: 성공
- `npm run lint`: 저장소 기존 이슈로 실패
  - 원인: `.claude/worktrees/.../.next` 산출물까지 ESLint가 검사 대상에 포함됨
- `http://127.0.0.1:3000` 브라우저 자동화 확인: 성공

## 사실 확인 메모
- 2026-05-12 기준 Claude 공식 페이지와 Anthropic 공식 문서에서 확인한 현재 주요 Claude 모델:
  - Opus 4.7
  - Sonnet 4.6
  - Haiku 4.5

## 알려진 이슈 / 추후 작업
- 인증이 필요한 실제 워크벤치 내부 드롭다운은 로컬 로그인 세션 없이 직접 시각 검증하지 못했다.
- 전체 `npm run lint`는 `.next`/`.claude` 산출물 제외 설정을 추가하면 안정적으로 개선 가능하다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.8.2 | 2026-05-12 | Claude 공식 모델명/모델 ID 동기화, 표시 개선 |
| v1.8.1 | 2026-05-12 | 이전 작업 |

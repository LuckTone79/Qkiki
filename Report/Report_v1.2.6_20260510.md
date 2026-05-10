# 작업 보고서

## 기본 정보
- 버전: v1.2.6-20260510
- 작업 일시: 2026-05-10
- 이전 버전: v1.2.5-20260510
- 프로젝트명: qkiki

## 작업 요약
Gemini만 결과를 내고 OpenAI 및 xAI가 실패하던 문제를 수정했습니다.
원인은 두 공급자에 `chat/completions` 엔드포인트 대신 다른 형식의 content block 타입을 보내고 있었기 때문이었습니다.

## 변경 사항
### 수정된 사항
- OpenAI와 xAI 요청 본문의 content block 타입을 `chat/completions` 호환 형식으로 수정
- 텍스트 블록을 `input_text`에서 `text`로 변경
- 이미지 블록을 `input_image`에서 `image_url` 형식으로 변경
- OpenAI와 xAI가 동일한 채팅-completions 입력 빌더를 재사용하도록 정리
- 애플리케이션 버전을 `v1.2.6-20260510`으로 갱신

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| src/lib/ai/providers.ts | 수정 | OpenAI/xAI 메시지 포맷 호환성 수정 |
| VERSION | 수정 | 현재 버전 갱신 |
| src/lib/version.ts | 수정 | UI 표시용 버전 갱신 |

## 테스트 및 검증
- `npm run lint` 통과 예정
- `npm run build` 통과 예정
- 프로덕션 재배포 후 3단계 체인 스모크 테스트 예정

## 알려진 이슈 / 추후 작업
- 없음

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.2.6 | 2026-05-10 | OpenAI/xAI content block 포맷 수정 |
| v1.2.5 | 2026-05-10 | 공급자 자동 활성 복구 및 오류 표시 개선 |

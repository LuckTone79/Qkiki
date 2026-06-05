# 작업 보고서
## 기본 정보
- **버전**: v1.16.9-20260605
- **작업 일시**: 2026-06-05
- **이전 버전**: v1.16.8-20260605
- **프로젝트명**: qkiki-workbench

## 작업 요약
문서 첨부 시 서버가 내용을 읽지 못해 실패하던 문제를 수정했다. `.docx` 업로드를 허용하고 서버에서 Word 본문을 추출해 기존 첨부 컨텍스트 흐름에 포함되도록 연결했다.

## 변경 사항
### 추가된 기능
- `.docx` Word 문서 업로드 및 서버 측 본문 추출 지원
- 첨부 포맷 판별과 본문 추출을 분리한 `attachment-files` 모듈 추가
- `.docx` 회귀 테스트와 샘플 fixture 추가

### 수정된 사항
- 업로드 허용 확장자 목록에 `.docx` 추가
- 첨부 관련 UI/가이드 문구를 Word 지원 기준으로 갱신
- 읽을 수 없는 Word 문서는 400 응답으로 명확한 에러 메시지를 반환하도록 조정

### 제거/정리된 사항
- `attachments.ts` 내부에 섞여 있던 포맷 판별/본문 추출 로직을 분리해 저장 로직과 책임을 정리

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| src/lib/attachment-files.ts | 추가 | 첨부 포맷 판별과 텍스트 추출 로직 분리 |
| src/lib/attachments.ts | 수정 | 새 포맷 모듈 사용 및 Word 지원 메시지 반영 |
| src/lib/attachments.test.mjs | 추가 | `.docx` 허용/추출 회귀 테스트 추가 |
| src/lib/fixtures/sample.docx | 추가 | Word 본문 추출 검증 fixture |
| src/app/api/attachments/route.ts | 수정 | 읽을 수 없는 문서 에러를 400으로 처리 |
| src/components/workbench/WorkbenchClient.tsx | 수정 | 파일 입력 accept 목록에 `.docx` 추가 |
| src/components/i18n/LanguageProvider.tsx | 수정 | 첨부 설명 문구에 Word 지원 반영 |
| src/app/guide/page.tsx | 수정 | 가이드와 FAQ의 지원 파일 형식 갱신 |
| src/lib/version.ts | 수정 | 앱 표시 버전 업데이트 |
| VERSION | 수정 | 현재 버전 업데이트 |

## 남은 이슈 / 추후 작업
- `.doc` 구형 Word 바이너리 포맷은 아직 지원하지 않음
- `node --test` 실행 시 `MODULE_TYPELESS_PACKAGE_JSON` 경고가 남아 있음

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.16.9 | 2026-06-05 | Word(.docx) 첨부 읽기 지원 및 업로드 오류 개선 |
| v1.16.8 | 2026-06-05 | 이전 작업 기준 버전 |

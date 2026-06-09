# Report v1.19.0-20260609 — 사용자 피드백 게시판

## 목표
프로그램에 사용자 불편사항을 피드백할 수 있는 메뉴를 추가한다.

- 계정 항목에서 피드백 게시판에 글을 작성할 수 있어야 한다.
- 작성한 글은 작성자 본인과 관리자만 볼 수 있어야 한다.
- 본문에 캡처 이미지를 붙여넣을 수 있고, 이미지 파일 첨부 기능도 있어야 한다.
- 관리자는 관리자 페이지(`/admin`)에서 전체 글을 볼 수 있어야 한다.
- 그 외 필요한 기능은 자율적으로 판단하여 추가한다.

## 구현 요약

### 데이터 모델 (`prisma/schema.prisma`)
- `FeedbackPost` (제목, 본문, 분류, 상태, 관리자/사용자 미확인 플래그)
- `FeedbackComment` (작성자/관리자 양방향 답변)
- `FeedbackAttachment` (이미지 첨부, 디스크 + DB base64 이중 저장)
- 열거형 `FeedbackCategory`(BUG/FEATURE/IMPROVEMENT/QUESTION/OTHER), `FeedbackStatus`(OPEN/IN_PROGRESS/RESOLVED/CLOSED)
- `AdminAuditAction`에 `FEEDBACK_VIEW`, `FEEDBACK_STATUS_CHANGE`, `FEEDBACK_REPLY` 추가
- 마이그레이션: `prisma/migrations/20260609120000_add_feedback_board/migration.sql` (수기 작성, 운영 빌드 시 `prisma migrate deploy`로 적용)

### 서버 로직 (`src/lib/feedback.ts`)
- 이미지 업로드/검증(타입·용량·개수), 저장, 본문 내 첨부 참조 추출, 게시글에 첨부 연결(claim) 헬퍼

### 사용자 API
- `GET/POST /api/feedback` — 내 글 목록 / 새 글 작성
- `GET/DELETE /api/feedback/[id]` — 내 글 상세(조회 시 새 답변 배지 해제) / 삭제
- `POST /api/feedback/[id]/comments` — 추가 메시지
- `POST /api/feedback/attachments` — 이미지 업로드
- `GET /api/feedback/attachments/[id]/raw` — 이미지 제공 (작성자 또는 관리자만 접근)

### 관리자 API
- `GET /api/admin/feedback` — 전체 글 목록(검색·상태 필터, 미확인 우선 정렬)
- `GET /api/admin/feedback/[id]` — 상세(열람 감사 로그) 
- `PATCH /api/admin/feedback/[id]` — 상태 변경(감사 로그)
- `POST /api/admin/feedback/[id]/comments` — 답변(감사 로그)

### 화면
- 계정 페이지에 "피드백 게시판" 카드/링크 추가
- `/app/account/feedback` — 목록 + 작성 폼(이미지 붙여넣기/파일 첨부)
- `/app/account/feedback/[id]` — 글 상세 + 대화 스레드
- 관리자 콘솔 좌측 내비에 "피드백" 추가
- `/admin/feedback`, `/admin/feedback/[id]` — 전체 목록 / 상세·상태변경·답변
- 본문 렌더러는 자체 첨부 URL의 이미지만 렌더링(원격 이미지·HTML 주입 차단)

## 스스로 추가한 기능
- 글 분류(카테고리)와 처리 상태 관리
- 관리자 ↔ 사용자 양방향 답변(스레드)
- 새 답변/미확인 글 배지(사용자·관리자 양쪽)
- 상태 변경·열람·답변에 대한 관리자 감사 로그
- 검색 및 상태별 필터, 본인 글 삭제

## 보안 고려
- 사용자 엔드포인트는 모두 `userId` 기준으로 스코프 → 타인 글 접근 불가
- 이미지 원본은 작성자 세션 또는 관리자 세션일 때만 제공
- 본문 렌더링은 우리 첨부 경로 이미지로 제한, 원시 HTML 미주입
- 업로드 타입/용량/개수 제한

## 검증
- `prisma generate` 정상
- `tsc --noEmit` 오류 없음
- `eslint` 경고/오류 없음
- `next build` 성공(피드백 관련 12개 라우트 정상 생성)

## 버전
- VERSION: `v1.19.0-20260609`
- `src/lib/version.ts` APP_VERSION 동기화 (앱/관리자 화면 하단에 노출)

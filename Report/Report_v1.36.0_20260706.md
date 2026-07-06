# 작업 보고서

## 기본 정보

- **버전**: v1.36.0-20260706
- **작업 일시**: 2026-07-06
- **이전 버전**: v1.35.0-20260702
- **프로젝트명**: Yapp (Qkiki Workbench)

## 작업 요약

프로젝트 상세 화면의 각 대화 카드에 모바일 대응 삭제 버튼을 추가했습니다. 사용자는 원본을 보존한 채 프로젝트에서만 대화를 제거하거나, 별도 위험 안내와 2차 확인을 거쳐 원본 대화까지 영구 삭제할 수 있습니다.

## 변경 사항

### 추가된 기능

- 모바일 대화 카드의 `열기` / `삭제` 2열 버튼 배치
- `프로젝트에서만 제거`, `원본까지 영구 삭제`, `취소` 선택 모달
- 영구 삭제 전 별도 2차 확인 화면
- 한국어, 영어, 일본어, 스페인어 삭제 안내
- Escape 키, 초기 포커스, 대화 제목 표시를 포함한 접근성 처리

### 수정된 사항

- 프로젝트 연결 해제 시 `WorkbenchSession.projectId`를 비우고 같은 프로젝트의 관련 `ProjectItem`을 트랜잭션에서 제거
- 처리 성공 시 프로젝트 대화 목록, 수집 항목, 연결 대화 개수를 즉시 갱신
- 앱 표시 버전을 `v1.36.0-20260706`으로 증가
- `npm test` 실행 스크립트 추가

### 삭제/제거된 사항

- 없음

## 변경된 주요 파일

| 파일 경로 | 변경 유형 | 설명 |
|---|---|---|
| `src/components/projects/ProjectDetailClient.tsx` | 수정 | 모바일 삭제 버튼, 선택 모달, 영구 삭제 재확인 및 상태 갱신 |
| `src/app/api/projects/[id]/sessions/[sessionId]/route.ts` | 추가 | 프로젝트 전용 대화 연결 해제 API |
| `src/lib/project-session-removal.ts` | 추가 | 소유권 조건 및 트랜잭션 연결 해제 서비스 |
| `src/lib/project-detail-state.ts` | 추가 | 성공 후 프로젝트 화면 상태 갱신 도우미 |
| `src/lib/project-session-removal.test.mjs` | 추가 | 연결 해제와 소유권 조건 회귀 테스트 |
| `src/lib/project-detail-state.test.mjs` | 추가 | 목록·개수·수집 항목 갱신 회귀 테스트 |
| `VERSION`, `src/lib/version.ts`, `CHANGELOG.md` | 수정 | 버전 표시 및 변경 기록 |

## 검증 결과

- `npm test`: 147개 통과, 실패 0개
- `npx tsc -p tsconfig.json --noEmit`: 통과
- `npm run lint`: 오류 0개, 기존 `WorkbenchClient.tsx` 미사용 매개변수 경고 1개
- `npm run build`: Next.js 16.2.3 프로덕션 빌드 및 57개 정적 페이지 생성 통과
- 모바일 런타임: 390×844 뷰포트에서 로컬 앱 접근과 반응형 렌더링 확인
- 인증 프로젝트 화면: 운영 DB에 임의 테스트 계정이나 세션을 생성하지 않기 위해 삭제 동작의 실데이터 실행은 생략

## 배포 결과

- **Vercel 배포 ID**: `dpl_EXQQRtoQHz2UcXjXr96a5EAab6KT`
- **배포 URL**: `https://qkiki-8fonalo6z-lucktone79s-projects.vercel.app`
- **상태**: Ready
- **공개 도메인**: `https://yapp.wideget.net` — HTTP 200
- **호환 도메인**: `https://qkiki.vercel.app` — Yapp으로 HTTP 307 리디렉션
- **공개 버전 확인**: `/guide`에서 `v1.36.0-20260706` 확인

## 알려진 이슈 / 추후 작업

- 이번 변경과 무관한 `src/components/workbench/WorkbenchClient.tsx`의 ESLint 미사용 매개변수 경고 1건이 남아 있습니다.

## 버전 히스토리 요약

| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.36.0-20260706 | 2026-07-06 | 프로젝트 대화 개별 제거 및 영구 삭제 선택 |
| v1.35.0-20260702 | 2026-07-02 | 결과 카드 모델 배지 개선 |

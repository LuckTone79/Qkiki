# Patch 10

- What was implemented
  - 워크벤치 시작점에 파일 첨부 UI를 추가했다.
  - 첨부파일 업로드/삭제 API를 추가했다.
  - 세션 소유 첨부파일과 결과-첨부 연결을 위한 Prisma 모델을 추가했다.
  - 텍스트/JSON/CSV/Markdown/PDF는 서버에서 읽어 프롬프트 컨텍스트로 주입하도록 만들었다.
  - 이미지 파일은 provider 호출 시 멀티모달 입력으로 전달하도록 확장했다.
  - 세션 재열기, 로컬 draft 복원, branch 실행, rerun 실행에서 첨부파일이 이어지도록 연결했다.

- What changed in architecture
  - 실행 요청 본문에 파일 바이트를 직접 실지 않고, 먼저 `/api/attachments`로 업로드한 뒤 `attachmentIds`만 실행 API로 넘기는 2단계 구조로 바꿨다.
  - 결과별 `ResultAttachment` 링크를 추가해서 rerun 시 같은 파일 세트를 다시 사용할 수 있게 했다.
  - branch는 별도 업로드 UI를 늘리지 않고, 현재 세션에 저장된 첨부파일을 자동 재사용하도록 설계했다.

- What assumptions were made
  - 1차 MVP 범위에서는 워크벤치 시작점 업로드를 우선 구현하고, result-card 내부에서 새 파일을 추가하는 UI는 다음 패치로 넘겼다.
  - PDF는 서버에서 텍스트 추출을 기본으로 사용한다. 이미지처럼 시각적 PDF 분석 전체를 provider native document API에 맞춰 개별 구현하지는 않았다.
  - 이미지 멀티모달은 현재 등록된 최신 모델 카탈로그 기준으로 동작한다고 가정했다.

- What remains
  - branch composer 내부의 추가 업로드 UI
  - 첨부파일 미리보기/다운로드
  - 저장된 파일의 장기 보관 정책 또는 orphan cleanup

- Risks / known issues
  - PDF는 텍스트 추출 중심이라 차트/도표 중심 문서의 시각 정보는 제한적으로 반영될 수 있다.
  - 세션 삭제 시 서버 파일 정리 정책은 아직 없다. 현재는 DB ownership과 실행 재사용 안정성을 우선했다.

- How to test
  1. `http://localhost:3000/app/workbench` 접속
  2. 로그인 후 워크벤치의 `Attachments` / `첨부 파일` 영역에서 `.txt`, `.pdf`, `.png` 등 업로드
  3. 프롬프트 입력 후 Run 실행
  4. 세션을 다시 열어 첨부파일 칩이 유지되는지 확인
  5. 결과 카드에서 Rerun 또는 Follow Up 실행 후 기존 첨부 맥락이 유지되는지 확인

- Verification
  - `npx prisma format`
  - `npx prisma generate`
  - `npx prisma db push`
  - `npx prisma validate`
  - `npm run lint`
  - `npm run build`
  - 인증 세션 기반 `/api/attachments` 업로드 스모크 테스트 성공
  - Playwright로 `/app/workbench` 첨부 UI 스크린샷 생성 성공

- Artifacts
  - `Report/patch10-workbench-attachments.png`
  - `Report/patch10-dev-server.log`

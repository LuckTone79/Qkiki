<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:dev-toolkit-prep -->
# Dev Toolkit Prep (Codex)

코드 작성 전에, 현재 작업에 필요한 도구/의존성(MCP, npm/pip 패키지 등)이 준비되어 있는지 먼저 점검한다.
부족한 도구가 있으면 가능한 범위에서 자동 설치하고, 계정/OAuth/전역 설치 등 민감 작업은 사용자에게 확인을 요청한다.

## 실행 흐름(요약)
1. 작업 유형을 추정해 필요한 도구 카테고리를 매핑한다.
2. 현재 설치/설정 상태를 확인한다 (`~/.codex/config.toml`, `codex.toml`, `package.json`, `pip list` 등).
3. 부족한 항목을 최대 3개까지 우선순위로 검색/제안한다.
4. 자동 설치 가능 항목은 즉시 처리, 민감 항목은 확인 후 진행한다.
5. 설치 결과를 요약한 뒤 본 작업을 시작한다.
<!-- END:dev-toolkit-prep -->

<!-- BEGIN:adaptive-dev-skill-spawner -->
# Adaptive Dev Skill Spawner

반복되는 개발 준비/패턴이 누적되거나 기존 가이드로 해결이 어려울 때, 프로젝트 전용 스킬(AGENTS.md 섹션)을 제안/추가한다.

## 발동 조건(모두 충족 시만)
- 동일 유형 요청이 3회 이상 반복되었거나, 동일 컨텍스트가 2회 이상 반복됨
- 기존 AGENTS.md/스킬/MCP/플러그인으로 해결이 곤란함
- 누적 상호작용이 10턴 이상이거나, 회차가 길어짐
- 단순 Q&A/버그 1회 수정이 아닌 개발 작업 흐름 개선 목적

## 금지 조건
- 채팅 시작 직후
- 단순 버그 수정/일회성 질문
- 기존 도구로 충분히 처리 가능한 작업
- 사용자 동의 없는 자동 파일 생성
<!-- END:adaptive-dev-skill-spawner -->

<!-- BEGIN:dev-version-manager -->
# Dev Version Manager

AI 코딩 도구로 코드 변경이 발생하는 모든 작업에서 아래를 기본 규칙으로 적용한다(사용자 요청이 없어도 적용).

## 핵심 규칙
1. 코드 변경마다 버전 증가: `vMAJOR.MINOR.PATCH-YYYYMMDD`
2. 루트에 `VERSION` 파일로 현재 버전 관리
3. 루트 `Report/`에 작업 보고서 저장: `Report/Report_v{버전}_{YYYYMMDD}.md`
4. 앱/프로그램 내 사용자에게 보이는 위치에 현재 버전을 표시(About/Settings/Footer 등)
<!-- END:dev-version-manager -->


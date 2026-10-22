# Yapp 웹앱 출시 보고서

- 버전: `v1.38.4-20261018`
- 작성일: 2026-10-18 (한국 시간)
- 공개 주소: https://yapp.wideget.net
- Vercel 프로젝트: 기존 `qkiki`, `prj_1of5xQAi3nbHOiZjR4D7FSOJuJ3n`
- 출시 브랜치: `codex/web-release-20261018`

## 출시 범위

원격 main `2c592d4`의 Yapp 브랜드, UI, 보안·다국어 개선에 운영 로그인 통합 `40adb70`을 결합했다. 원래 작업 폴더의 미커밋 모델 카탈로그, 가격 문서, 관리자 변경과 로그·캡처는 보존하고 이번 출시에서 제외했다.

- Supabase UUID와 기존 Prisma 사용자 ID 연결 및 충돌 차단을 보존했다.
- 이메일 로그인과 가입 직후 세션이 발급되는 경우 모두 `/api/auth/resolve` 성공 후 워크벤치로 이동한다.
- 대문자 인증 오류 코드도 구체적인 4개 언어 안내로 표시한다.
- 공개 대문, Google/Kakao 제공자 목록, 이메일 확인 대기, 기존 UI와 다국어를 함께 보존했다.
- 신규 스키마/DB 마이그레이션은 추가하지 않았다.

## 검증

- 전체 Node 테스트: **205 통과**, 실패 0. 실제 폼 제출 핸들러를 실행하는 인증 회귀 6개 포함.
- ESLint: 통과.
- TypeScript `--noEmit --incremental false`: 통과.
- Next.js 16.2.3 프로덕션 빌드: 통과.
- 운영 Prisma migration status: 27개 마이그레이션, **미적용 없음**.
- 운영 Supabase 공개 설정: 이메일/Google/Kakao 활성, 가입 활성, 이메일 확인 필요.
- 기존 운영 HTTP: 대문/로그인/가입 200, 비로그인 워크벤치는 로그인으로 307.
- Gitleaks 8.30.1: 신규 staged 변경 0건. 기존 이력 156개 커밋에서 탐지된 3건은 빈 API 키 설정 사이의 다중행 오탐 2건과 이전 공개 공유 결과 식별자 1건으로 검토했다. 새로운 제공자 키나 DB 비밀번호 노출은 탐지되지 않았다. 기존 이력은 재작성하지 않았다.
- 최종 배포/라이브 결과는 아래에 실행 후 추가한다.

빌드 시 Node `--env-file` 인자가 Next.js worker로 전달되어 실패한 첫 시도는 제외했다. 무시된 `.env.local`에 기존 운영 설정을 준비한 뒤 직접 `next build`를 실행하여 빌드와 타입검사를 완료했다. 배포는 기존 `npm run build` 및 운영 마이그레이션 점검 경로를 사용한다.

## GitHub 우선 조사 및 도구 판단

- 검토일/요구: 2026-10-18, Windows/Next.js 16 웹앱의 기존 Vercel 프로덕션 출시.
- 검색어: `site:github.com vercel deploy production SKILL.md`, `site:github.com/vercel/vercel packages cli deploy`.
- 스킬: https://github.com/vercel/vercel/blob/main/skills/vercel-cli/SKILL.md 및 기존 설치된 `qkiki-vercel-prod-deploy`, `finish-release-to-live`, `deployments-cicd`를 참고·적용했다. 중복 스킬 설치는 생략했다.
- 구현/프로그램: https://github.com/vercel/vercel/tree/main/packages/cli — 기존 Vercel CLI 50.25.4 직접 사용. 프로젝트/조직/별칭을 먼저 확인했다. 새로운 배포 시스템이나 WideGet 키트 교체는 필요하지 않았다.
- 보안 검사: https://github.com/gitleaks/gitleaks — MIT, 공식 Windows x64 v8.30.1 임시 실행본. 공식 체크섬과 대조한 ZIP SHA-256: `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`. 결과는 비밀값을 가려 보관한다.
- Next.js 설치본의 배포/프로덕션 지침 및 Supabase 2026-10-18 변경 기록을 확인했다. 외부 기능이나 새로운 SDK를 도입하지 않았다.

## 프로덕션 출시 결과

- 소스: `3a52d9bf127803707c9269d91609e82fc5b43d5b`.
- Vercel: `dpl_37HR471hrnDb6YXgvEFSK6oSDuxy`, Ready, 기존 도메인에 승격 완료.
- 공개 가이드에서 `v1.38.4-20261018` 확인. 대문/로그인/가입/가이드 200, 인증 없는 세션 API 401, 워크벤치 307.
- 원격 빌드와 Prisma 마이그레이션 경로 통과, 해당 배포의 오류 로그 조회 결과 없음.
- 브라우저 체험 점검에서 IP 기반 계정 재연결 경로를 확인해 후속 `v1.38.5-20261018`에서 보완했다. 최종 결과는 해당 버전 보고서를 참조한다.

## 검증 경계

실제 개인 계정 OAuth 동의·콜백, 이메일 수신, 결제 및 모든 AI 모델별 유료 실행은 별도 증거가 필요하다. 제공자 활성 설정이나 빌드 성공으로 이러한 E2E를 완료했다고 판단하지 않는다.

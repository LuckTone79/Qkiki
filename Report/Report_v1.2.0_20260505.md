# 작업 보고서
## 기본 정보
- **버전**: v1.2.0-20260505
- **작업 일시**: 2026-05-05
- **이전 버전**: v1.1.0-20260505
- **프로젝트명**: 멀티AI (Qkiki)

## 작업 요약
비로그인 체험판을 다시 DB 기반 사용자 세션으로 연결해 실제 워크벤치를 5회까지 정상 사용하도록 조정했습니다.
동일 IP 재진입 차단, 6번째 생성 요청부터 로그인 강제, 로그인한 무료 계정의 일일 토큰 한도 적용까지 함께 반영했습니다.

## 변경 사항
### 추가된 기능
- `TrialAccess` 모델 추가: IP 해시, 체험 사용자, 사용 횟수, 한도 도달 시각 추적
- 비로그인 체험판 5회 제한 및 동일 IP 재시작 차단
- 무료 계정 일일 토큰 한도(`FREE_USER_DAILY_TOKEN_LIMIT`, 기본 50000) 체크
- 체험판 만료/재진입 시 로그인 화면으로 보내는 리다이렉트 메시지

### 수정된 사항
- 체험판 시작 API를 stateless 쿠키 방식에서 DB 사용자 + 세션 쿠키 방식으로 변경
- 생성 API(`/api/workbench/run`, `/api/workbench/branch`, `/api/results/[id]/rerun`)에 공통 접근 제어 적용
- trial 사용자도 일반 사용자와 동일하게 프로젝트/프리셋/세션 API를 사용할 수 있도록 인증 흐름 정리
- 랜딩 페이지와 로그인 폼에 체험판 제한/로그인 전환 UX 반영

### 삭제/제거된 사항
- DB 없이 trial 쿠키만 검증하던 기존 stateless trial 인증 흐름 제거

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| prisma/schema.prisma | 수정 | `TrialAccess` 모델 추가 |
| prisma/migrations/20260505152000_add_trial_access/migration.sql | 추가 | 체험판 접근 추적 테이블 마이그레이션 |
| src/lib/api-auth.ts | 수정 | trial/free-user 생성 접근 제어 추가 |
| src/app/api/trial/start/route.ts | 수정 | DB 기반 trial 사용자/세션 생성으로 변경 |
| src/app/api/workbench/run/route.ts | 수정 | trial 사용 횟수 소비 처리 |
| src/app/api/workbench/branch/route.ts | 수정 | trial 사용 횟수 소비 처리 |
| src/app/api/results/[id]/rerun/route.ts | 수정 | trial 사용 횟수 소비 처리 |
| src/components/workbench/WorkbenchClient.tsx | 수정 | 401 리다이렉트 처리 및 trial 안내 문구 갱신 |
| src/components/AuthForm.tsx | 수정 | trial 제한 안내 문구 추가 |
| src/app/page.tsx | 수정 | trial 시작 실패/로그인 리다이렉트 처리 |
| src/lib/access-policy.ts | 추가 | IP 해시, trial/free-user 정책 상수 및 헬퍼 |
| VERSION | 수정 | 버전 갱신 |
| src/lib/version.ts | 수정 | 앱 버전 표시 갱신 |

## 알려진 이슈 / 추후 작업
- 새 `TrialAccess` 테이블은 배포 DB에 마이그레이션 또는 `db push`가 필요함
- 무료 계정 토큰 한도는 현재 환경 변수 기본값 기반이며, 관리자 UI에서 조절하는 기능은 아직 없음

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.2.0 | 2026-05-05 | trial 5회 제한, 동일 IP 재진입 차단, 무료 계정 토큰 한도 적용 |
| v1.1.0 | 2026-05-05 | 버전 관리 체계 및 관리자 About 화면 추가 |

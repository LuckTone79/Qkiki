# 작업 보고서

## 기본 정보
- **버전**: v1.32.6-20260620
- **작업 일시**: 2026-06-20
- **이전 버전**: v1.32.5-20260620
- **프로젝트명**: Yapp 오케스트레이션 워크벤치

## 작업 요약
브랜딩, canonical 도메인, 세션 쿠키, 로컬 스토리지 키 전환 작업을 정리했습니다. 새 Yapp 키를 기본값으로 사용하면서 기존 Qkiki 키를 fallback으로 읽어 기존 사용자 세션과 저장 데이터를 최대한 유지하도록 했습니다.

## 변경 사항
### 추가된 기능
- Yapp 브랜드 상수와 legacy Qkiki 호환성 테스트를 추가했습니다.
- 새 스토리지 키 우선 읽기와 기존 키 fallback 검증을 추가했습니다.
- canonical 도메인 리다이렉트 테스트를 Yapp/Qkiki 양쪽 별칭 기준으로 보강했습니다.

### 수정된 사항
- 예시 환경변수의 기본 앱 URL을 `https://yapp.wideget.net`으로 갱신했습니다.
- Vercel 별칭 리다이렉트가 새/기존 세션 쿠키를 모두 고려하도록 수정했습니다.
- OAuth state 쿠키와 인증 handoff에서 새 쿠키명과 legacy 쿠키명을 함께 처리하도록 수정했습니다.
- localStorage draft/session/usage cache가 새 Yapp 키를 사용하고 기존 Qkiki 키를 fallback으로 읽도록 수정했습니다.

### 삭제/제거된 사항
- 없음

## 변경된 주요 파일
| 파일 경로 | 변경 유형 | 설명 |
|----------|---------|------|
| `.env.example` | 수정 | canonical 앱 URL 예시를 Yapp 도메인으로 갱신 |
| `next.config.ts` | 수정 | Vercel 별칭 리다이렉트와 세션 쿠키 조건 정리 |
| `proxy.ts` | 수정 | 사용자/관리자 세션 쿠키 후보 기반 인증 판정 |
| `src/lib/canonical-host.ts` | 수정 | 브랜드 상수 기반 canonical host 판정 |
| `src/lib/local-cache.ts` | 수정 | Yapp 스토리지 키와 Qkiki fallback 지원 |
| `src/lib/google-oauth.ts` | 수정 | OAuth state 쿠키 전환 및 legacy 후보 추가 |
| `src/lib/brand.test.mjs` | 추가 | 브랜드/스토리지 상수 회귀 테스트 |
| `src/lib/canonical-host.test.mjs` | 수정 | canonical/legacy 도메인 회귀 테스트 보강 |
| `src/lib/browser-storage.test.mjs` | 수정 | 스토리지 fallback 및 blocked storage 회귀 테스트 보강 |

## 알려진 이슈 / 추후 작업
- C 계열 가격/크레딧 문서 변경은 이번 커밋 범위에서 제외했습니다.
- 디자인 콘셉트 HTML 변경은 별도 E 커밋으로 분리 예정입니다.

## 버전 히스토리 요약
| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.32.6 | 2026-06-20 | 브랜딩/도메인/세션·스토리지 키 전환 정리 |
| v1.32.5 | 2026-06-20 | 모바일 프로젝트 카드 overflow 및 텍스트 줄바꿈 개선 |

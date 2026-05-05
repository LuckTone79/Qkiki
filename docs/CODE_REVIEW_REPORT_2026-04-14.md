# Multi AI 프로젝트 — 코드 검토 레포트

- 검토일: 2026-04-14
- 검토 기준: `task/multi_ai_workbench_master_spec_2026-04-12.md` (이하 **Spec-EN**), `task/multi_ai_program_master_spec_2026-04-14.md` (이하 **Spec-KR**)
- 검토 범위: 프로젝트 전체 (DB 스키마, API, UI, 보안, 비즈니스 로직)
- 상태: **수정 전 검토 전용** — 이 문서는 현황 분석만을 목적으로 하며, 어떠한 코드 수정도 포함하지 않음

---

## 0. 두 스펙 문서 간 핵심 차이점 (먼저 인지해야 할 사항)

두 스펙 문서는 **동일 제품을 설명하지만, 구조적으로 충돌하는 부분이 존재**한다.
현재 코드는 두 문서를 혼합 적용한 상태이며, 이로 인한 구조적 모순이 일부 발생해 있다.

| 항목 | Spec-EN (04-12) | Spec-KR (04-14) | 현재 코드 |
|------|-----------------|-----------------|-----------|
| API Key 관리 | 사용자가 직접 입력 (`/app/providers`) | **사용자 입력 폐기**, 관리자만 관리 (섹션 4-1) | **양쪽 모두 존재** (충돌) |
| 관리자 시스템 | 없음 | 포괄적 관리자 시스템 필수 | 구현됨 |
| 쿠폰/이용권 | 없음 | 월 무료/평생 무료 쿠폰 시스템 필수 | 구현됨 |
| 데이터 모델 | Session → WorkflowStep → Result | conversations → messages + ai_requests | **Spec-EN 모델 사용** |
| 도메인 구조 | 단일 앱 | 사용자앱/관리자앱/API 서브도메인 분리 | proxy.ts로 서브도메인 분리 |
| 라우트 구조 | `/app/providers` 존재 | 사용자에게 providers 페이지 없음 | `/app/providers` 존재 (account로 리다이렉트) |

> **판단**: Spec-KR이 날짜상 더 최신(04-14)이며, Spec-EN의 기능을 확장한 문서로 보인다. 따라서 **충돌 시 Spec-KR을 우선 기준**으로 삼아 검토한다.

---

## 1. 전체 평가 요약

### 1-1. 잘 구현된 영역 (Strong Points)

| 영역 | 평가 | 상세 |
|------|------|------|
| 기술 스택 | **적합** | Next.js App Router + TypeScript + Tailwind + Prisma + Zod — 양쪽 스펙 권장 스택 완전 일치 |
| 워크벤치 핵심 기능 | **우수** | 병렬 비교, 순차 체인, 브랜치(후속질문/검토) 모두 작동 |
| 프로바이더 추상화 | **우수** | 4개 공급자 통합 인터페이스, 정규화된 응답 형식, 개별 에러 처리 |
| 프롬프트 구성 엔진 | **우수** | 8가지 액션 타입별 시스템 프롬프트, 컨텍스트 합성 |
| 암호화 | **우수** | AES-256-GCM으로 사용자 입력, 결과 출력, API Key 모두 암호화 |
| 인증/세션 보안 | **양호** | SHA-256 토큰 해싱, httpOnly 쿠키, SameSite, 30일/7일 만료 |
| RBAC | **양호** | USER/SUPPORT_VIEWER/ADMIN/SUPER_ADMIN 4단계 |
| 관리자 감사로그 | **양호** | 15개 액션 유형, IP/UA 기록 |
| 쿠폰/이용권 | **양호** | 월 무료 누적, 평생 무료, Serializable 트랜잭션으로 race condition 방지 |
| 다국어(i18n) | **부가 기능** | 스펙에 없지만 유용한 en/ko 지원 |
| 비용 추정 | **양호** | 모델별 토큰 단가 기반 추정, `costIsEstimated` 플래그 |

### 1-2. 문제가 있는 영역 (Issues)

| 심각도 | 항목 | 요약 |
|--------|------|------|
| **CRITICAL** | API Key 관리 구조 충돌 | Spec-KR 절대 원칙 위반: 사용자 API Key 입력 UI 잔존 |
| **HIGH** | ai_requests 로깅 테이블 미구현 | Spec-KR 12-5 요구 누락 |
| **HIGH** | 관리자 비용/사용량 대시보드 미흡 | Spec-KR 7-7 요구 수준 미달 |
| **HIGH** | MFA 미구현 | 스키마에 필드 존재하나 실제 로직 없음 |
| **MEDIUM** | 데이터 모델 불일치 | conversations/messages 대신 sessions/results 사용 |
| **MEDIUM** | 사용자 화면 IA 불일치 | Spec-KR 8-1의 IA와 현재 라우트 구조 차이 |
| **MEDIUM** | CSV 다운로드 미구현 | Spec-KR 7-4 쿠폰 CSV 내보내기 없음 |
| **MEDIUM** | Health Check 미구현 | 공급자 상태 점검 로직 없음 |
| **LOW** | 결과 트리뷰/비교뷰 미구현 | Spec-EN 14.4 선택사항 |
| **LOW** | 관리자 메모/플래그 UI 미구현 | 스키마 존재, UI 없음 |
| **LOW** | 워크플로우 스텝 재정렬 미구현 | Spec-EN 14.3 선택사항 |

---

## 2. CRITICAL 이슈 상세 분석

### 2-1. API Key 관리 구조 — Spec-KR 절대 원칙 위반

**Spec-KR 섹션 4-1 원문:**
> "이 프로그램에서 사용하는 각 AI의 API Key는 **사용자가 직접 넣는 구조가 아니다.**
> 반드시 운영자(관리자)의 API Key를 서버에서 관리하고,
> 사용자는 그 위에서 서비스 형태로 이용해야 한다.
> 즉, 기존 사용자 페이지에 있던 공급자/API Key 입력 화면은 **제거한다.**"

**현재 코드 상태:**

| 파일 | 상태 | 내용 |
|------|------|------|
| `prisma/schema.prisma` → `ProviderConfig` | 존재 | userId별 API Key 저장 모델 잔존 |
| `src/components/account/AccountClient.tsx` | 존재 | 사용자 계정 페이지에 공급자 설정 섹션 포함 |
| `src/components/providers/ProvidersClient.tsx` | 존재 | 사용자용 공급자 설정 클라이언트 컴포넌트 |
| `src/app/app/providers/page.tsx` | 존재 | `/app/providers` 라우트 (account로 리다이렉트) |
| `src/app/api/providers/route.ts` | 존재 | 사용자용 공급자 API 엔드포인트 |
| `src/lib/ai/providers.ts` → `callProvider()` | 존재 | env → AdminProviderConfig → **ProviderConfig(사용자)** 순 fallback 로직 |

**문제점:**
1. Spec-KR에서 **"절대 원칙"**으로 정의한 사항을 위반
2. 사용자가 자신의 API Key를 입력할 수 있는 UI와 API가 모두 존재
3. `callProvider()`에서 사용자 ProviderConfig를 fallback으로 조회하는 로직 잔존
4. 이 구조는 Spec-KR의 "서비스 형태 이용" 철학과 직접 충돌

**영향 범위:**
- DB 스키마 (`ProviderConfig` 모델)
- API 라우트 (`/api/providers`)
- UI 컴포넌트 (`ProvidersClient`, `AccountClient`)
- 핵심 로직 (`callProvider()` 내 fallback 체인)
- 라우트 구조 (`/app/providers`)

---

## 3. HIGH 이슈 상세 분석

### 3-1. ai_requests 로깅 테이블 미구현

**Spec-KR 섹션 12-5 정의:**
```
ai_requests 테이블:
- id, user_id, conversation_id, message_id
- provider, model, request_type, status
- input_tokens, output_tokens, estimated_cost_usd
- latency_ms, error_code, error_message
- created_at
```

**현재 코드:** 이 테이블이 **존재하지 않는다.**

AI 호출 결과는 `Result` 모델에 저장되지만, 이것은 "워크플로우 결과"이지 "API 요청 로그"가 아니다.

**차이점:**
- `Result`는 사용자에게 보여주는 결과 카드 단위
- `ai_requests`는 운영자가 모든 API 호출을 추적하는 로그 단위
- 하나의 워크플로우 실행에서 실패 후 재시도가 발생하면, `ai_requests`에는 2건이 기록되어야 하지만 `Result`에는 1건만 남음

**영향:**
- 관리자 비용/사용량 대시보드 구현 불가 (정확한 API 호출 수, 비용 합산 등)
- 공급자별 에러율 분석 불가
- 사용자별 실제 API 사용량 추적 불가

### 3-2. 관리자 비용/사용량 대시보드 미흡

**Spec-KR 섹션 7-7 요구:**
- 일별 요청 수
- 일별 비용
- 공급자별 비용
- 모델별 사용량
- 상위 사용자 비용 순위

**현재 코드:** `GET /api/admin/dashboard`는 기본 카운트만 반환:
- totalUsers, activeUsers, totalConversations, totalCoupons 등

일별/공급자별/모델별 집계와 비용 분석이 전혀 없다. `ai_requests` 테이블이 없기 때문에 이 데이터를 정확히 집계할 기반 자체가 부족하다.

### 3-3. MFA 미구현

**Spec-KR 섹션 17-2:**
> "관리자 MFA 필수"

**현재 코드:**
- `AdminSession` 스키마에 `mfaVerifiedAt` 필드 존재
- `.env.example`에 `ADMIN_MFA_CODE` 환경변수 존재
- 그러나 **실제 MFA 검증 로직이 구현되어 있지 않음**
- 관리자 로그인 시 비밀번호만 검증하고 세션 발급

MFA 없이 관리자 패널이 비밀번호 하나로만 보호되는 것은 보안 위험이다.

---

## 4. MEDIUM 이슈 상세 분석

### 4-1. 데이터 모델 불일치

| Spec-KR 정의 | 현재 코드 | 비고 |
|-------------|-----------|------|
| `conversations` | `WorkbenchSession` | 이름과 용도가 다름 |
| `messages` (role/provider/content_encrypted) | `Result` (provider/outputText 암호화) | 구조가 상이함 |
| `ai_requests` | 없음 | 누락 |
| `content_preview` (300자) | 없음 | 미리보기 필드 없음 |

현재 코드의 데이터 모델은 Spec-EN의 "워크벤치 세션" 중심 구조를 따르고 있다.
Spec-KR의 "대화(conversation) → 메시지(message)" 구조와는 근본적으로 다르다.

**판단:** 현재 모델이 워크벤치 제품의 성격에는 더 적합할 수 있다. 그러나 Spec-KR의 관리자 모니터링 요구사항(대화 원문 열람, 메시지 단위 열람)을 완벽히 충족하려면 보완이 필요하다.

### 4-2. 사용자 화면 IA(Information Architecture) 불일치

**Spec-KR 섹션 8-1 사용자 앱 IA:**
```
- Dashboard / Home
- New Query
- Multi Result Workspace
- Follow-up / Selected Models
- Chain Review Builder
- Conversation History
- Coupon Redeem
- My Plan Status
- Account Settings
```

**현재 코드 라우트:**
```
/app             → Dashboard (간단한 환영 페이지)
/app/workbench   → 워크벤치 (입력 + 워크플로우 + 결과 통합)
/app/projects    → 프로젝트 관리 (스펙에 없음)
/app/sessions    → 세션 히스토리
/app/presets     → 프리셋 관리
/app/providers   → 공급자 설정 (account로 리다이렉트)
/app/account     → 계정 + 공급자 + 쿠폰 + 이용권 통합
```

**차이점:**
1. "Coupon Redeem"이 별도 페이지가 아닌 Account에 통합됨
2. "My Plan Status"가 별도 페이지가 아닌 Account에 통합됨
3. "Projects" 기능이 스펙에 없지만 코드에 존재
4. "Providers" 페이지가 Spec-KR에 의해 사용자에게 불필요하지만 잔존
5. "New Query"와 "Multi Result Workspace"가 하나의 워크벤치로 통합됨 (이것은 합리적)

### 4-3. CSV 다운로드 미구현

Spec-KR 섹션 7-4 쿠폰 관리 요구사항:
> "CSV 다운로드"

현재 관리자 쿠폰 페이지에 CSV 내보내기 기능이 없다.

### 4-4. Health Check 미구현

Spec-KR 섹션 7-6:
> "Health check 결과 보기"

`AdminProviderConfig` 스키마에 관련 필드가 없고, `provider_availability.ts`는 설정값 확인만 하며 실제 API 호출로 건강 상태를 점검하지 않는다. Spec-KR의 `provider_settings` 테이블에 정의된 `health_status`, `last_health_checked_at` 필드가 코드에 없다.

---

## 5. 코드 품질 분석

### 5-1. 아키텍처 구조 — 양호

```
src/lib/ai/
├── types.ts            → 타입 정의
├── provider-catalog.ts → 모델 카탈로그
├── providers.ts        → 공급자 어댑터 (호출 + 정규화)
├── workflow.ts         → 워크플로우 엔진 (병렬/순차/브랜치)
├── prompt.ts           → 프롬프트 구성
└── pricing.ts          → 비용 추정
```

관심사 분리가 잘 되어 있다. 공급자 추가 시 `provider-catalog.ts`와 `providers.ts`만 수정하면 되는 구조.

### 5-2. 보안 — 양호 (MFA 제외)

| 항목 | 상태 | 상세 |
|------|------|------|
| API Key 서버사이드 전용 | **준수** | 브라우저에 Key 노출 없음 |
| 소유권 서버사이드 검증 | **준수** | 모든 API에서 세션 기반 userId 사용 |
| 암호화 저장 | **준수** | AES-256-GCM, IV/Tag 분리 저장 |
| 세션 토큰 해싱 | **준수** | SHA-256 단방향 해싱 |
| CSRF 방어 | **기본** | SameSite=Lax 설정 |
| MFA | **미구현** | 스키마만 존재, 로직 없음 |
| Rate Limiting | **미구현** | `per_user_daily_limit` 필드 없음, 요청 제한 없음 |

### 5-3. 에러 처리 — 양호

- 공급자별 개별 에러 처리 (한 공급자 실패가 전체를 crash하지 않음) ✓
- Zod 유효성 검사로 입력 검증 ✓
- API 에러 응답 표준화 (401/403/500) ✓
- 프로바이더 에러 메시지 추출 로직 구현 ✓

### 5-4. WorkbenchClient 크기 — 주의 필요

`WorkbenchClient.tsx`가 **909줄**로 단일 컴포넌트 치고는 크다.
현재는 동작하지만, 기능 추가 시 유지보수가 어려워질 수 있다.

상태 관리가 모두 useState로 로컬에 있으며, 복잡한 워크플로우 상태를 다루기에는 향후 상태 관리 라이브러리(zustand 등) 도입이 필요할 수 있다.

---

## 6. 스펙 대비 기능 완성도 매트릭스

### Spec-EN (Acceptance Criteria, 섹션 31) 대비:

| # | 조건 | 상태 | 비고 |
|---|------|------|------|
| 1 | 회원가입/로그인 가능 | ✅ 완료 | |
| 2 | 보호된 라우트가 실제로 보호됨 | ✅ 완료 | requireUser() 적용 |
| 3 | 각 사용자는 자신의 데이터만 볼 수 있음 | ✅ 완료 | userId 스코핑 |
| 4 | 하나의 태스크로 여러 모델 실행 | ✅ 완료 | 병렬 비교 모드 |
| 5 | 각 모델 응답이 별도 결과 카드로 표시 | ✅ 완료 | ResultCard 컴포넌트 |
| 6 | 하나의 결과를 다른 모델에게 검토 요청 | ✅ 완료 | Review with Model 기능 |
| 7 | 스텝 기반 워크플로우 구축 및 실행 | ✅ 완료 | WorkflowStepRow + 순차 실행 |
| 8 | 어떤 결과에서든 후속 브랜치 생성 | ✅ 완료 | Follow Up + Branch 기능 |
| 9 | 세션 저장 및 재오픈 | ✅ 완료 | Sessions 페이지 |
| 10 | 프리셋 저장 및 로드 | ✅ 완료 | Presets 페이지 |
| 11 | 공급자 Key가 클라이언트에 노출 안 됨 | ✅ 완료 | 서버사이드 전용 |
| 12 | 한 공급자 실패가 전체를 죽이지 않음 | ✅ 완료 | 개별 에러 처리 |
| 13 | 결과 관계가 이해 가능 | ⚠️ 부분 | 들여쓰기로 표현, 트리뷰 미구현 |
| 14 | 공급자 설정이 이해 가능 | ✅ 완료 | |
| 15 | 앱이 멀티AI 오케스트레이션 워크벤치처럼 느껴짐 | ✅ 완료 | 채팅앱이 아닌 워크벤치 구조 |

**Spec-EN 달성률: 14/15 (93%)**

### Spec-KR (완료 조건, 섹션 20) 대비:

| # | 조건 | 상태 | 비고 |
|---|------|------|------|
| 1 | 여러 AI 결과를 한 화면에서 볼 수 있다 | ✅ 완료 | |
| 2 | 특정 모델만 선택해 추가질문 | ✅ 완료 | |
| 3 | 대화가 저장되고 히스토리 열람 | ✅ 완료 | |
| 4 | 관리자 페이지가 `admin.도메인`에서 분리 운영 | ✅ 완료 | proxy.ts |
| 5 | 관리자 로그인 및 권한 체크 | ✅ 완료 | |
| 6 | 관리자가 사용자 목록/상세/대화 열람 | ✅ 완료 | |
| 7 | 원문 열람 가능 + 로그 기록 | ⚠️ 부분 | 열람 가능하나 reason code 선택 UI 미확인 |
| 8 | 월 무료/평생 무료 쿠폰 생성 | ✅ 완료 | |
| 9 | 쿠폰 사용 시 30일 누적 또는 평생 반영 | ✅ 완료 | Serializable 트랜잭션 |
| 10 | 공급자 API Key 설정이 관리자 페이지에서만 가능 | ❌ 미달 | **사용자 페이지에도 존재** |
| 11 | 사용자 페이지의 공급자 Key 입력 UI 제거 | ❌ 미달 | **아직 존재** |
| 12 | 주요 관리자 행동이 감사로그에 남음 | ✅ 완료 | 15개 액션 유형 |

**Spec-KR 달성률: 10/12 (83%) — 미달 항목 2건이 절대 원칙 위반**

---

## 7. 스펙에 없지만 코드에 존재하는 기능

| 기능 | 위치 | 평가 |
|------|------|------|
| **Projects** (프로젝트/폴더 시스템) | `/app/projects`, `Project` 모델 | 유용하지만 스펙 범위 밖. 세션을 주제별로 묶고 공유 컨텍스트를 주입하는 기능. 스펙의 "워크플로우 프리셋"과는 다른 차원의 조직화. |
| **다국어(i18n)** | `src/components/i18n/` | 부가 가치. en/ko 200+ 키 번역. |
| **Output Style** | WorkbenchClient | detailed/short/bullet/table/executive 스타일 선택. 스펙에 없지만 실용적. |
| **Session Duplication** | `/api/sessions/[id]/duplicate` | 편의 기능. |
| **Per-user ProviderConfig** | 스키마 + UI + API | **Spec-KR과 충돌**. 제거 대상. |

---

## 8. 스펙에 있지만 코드에 없는 기능

### Spec-KR 기준 미구현 목록:

| 섹션 | 기능 | 우선순위 | 비고 |
|------|------|----------|------|
| 4-1 | 사용자 API Key 입력 제거 | **CRITICAL** | 절대 원칙 |
| 12-5 | `ai_requests` 로깅 테이블 | **HIGH** | 비용/사용량 대시보드 기반 |
| 7-7 | 상세 비용/사용량 대시보드 | **HIGH** | 일별/공급자별/모델별 집계 |
| 17-2 | 관리자 MFA | **HIGH** | 보안 필수 |
| 7-4 | 쿠폰 CSV 다운로드 | **MEDIUM** | |
| 7-6 | 공급자 Health Check | **MEDIUM** | |
| 7-6 | Fallback 공급자 자동 전환 | **MEDIUM** | 스키마에 fallback 필드 없음 |
| 7-6 | 사용자당 요청 제한 | **MEDIUM** | rate limiting |
| 7-6 | 타임아웃 설정 | **MEDIUM** | 현재 하드코딩 추정 |
| 7-2 | 관리자 메모 UI | **LOW** | 스키마 존재, UI 없음 |
| 12-14 | 사용자 플래그 UI | **LOW** | 스키마 존재, UI 없음 |
| 8-1 | 쿠폰/이용권 별도 페이지 | **LOW** | 현재 account에 통합 |

### Spec-EN 기준 미구현 선택사항:

| 섹션 | 기능 | 비고 |
|------|------|------|
| 14.4 | 결과 트리/그룹 뷰 모드 | 현재 카드뷰만 |
| 14.4 | 선택 결과 비교 뷰 | |
| 14.3 | 워크플로우 스텝 재정렬(드래그) | |
| 14.3 | 워크플로우 스텝 복제 | |
| 16 | 첫 사용 가이드 + 예제 워크플로우 로드 | EmptyState는 있으나 예제 로드 없음 |

---

## 9. 데이터베이스 스키마 vs Spec-KR 비교

### 일치하는 엔티티:

| Spec-KR 테이블 | 현재 모델 | 일치도 |
|---------------|-----------|--------|
| users | User | ✅ 높음 (role/status 포함) |
| admin_users | AdminSession + User role | ⚠️ 다른 접근 (별도 admin_users 테이블 대신 User.role 사용) |
| coupons | Coupon | ⚠️ 구조 다름 (1 coupon = 1 code, Spec-KR은 max_redemptions 지원) |
| coupon_redemptions | CouponRedemption | ✅ 유사 |
| subscription_grants | SubscriptionLedger | ✅ 유사 (이름 다름) |
| user_plan_snapshot | UserSubscription | ✅ 유사 |
| admin_audit_logs | AdminAuditLog | ✅ 높음 |
| admin_content_access_logs | AdminContentAccessLog | ✅ 높음 |
| admin_notes | AdminNote | ✅ 스키마 존재 (UI 없음) |
| provider_settings (관리자용) | AdminProviderConfig | ⚠️ 부분 (health_status, fallback, rate_limit 등 누락) |

### 불일치/누락:

| Spec-KR 테이블 | 현재 상태 | 문제 |
|---------------|-----------|------|
| conversations | WorkbenchSession | 이름/구조 다름 |
| messages | Result | 근본적으로 다른 모델 |
| ai_requests | **없음** | 누락 |
| user_flags | UserFlag (스키마 있음) | UI/API 없음 |
| admin_users (별도 테이블) | User.role로 통합 | 다른 접근법이지만 기능적으로는 유사 |

### 쿠폰 모델 차이:

**Spec-KR:** `max_redemptions`으로 다수 사용자가 같은 코드 사용 가능
**현재 코드:** 1 coupon = 1 code = 1 redemption (단일 사용)

Spec-KR 섹션 4-4에서 "쿠폰 코드는 1회 사용 후 재사용 불가"라고 명시하므로 현재 구현이 맞다. 그러나 Spec-KR 스키마의 `max_redemptions` 필드와는 불일치. **스키마 정의와 비즈니스 규칙이 스펙 내에서 상충**하는 부분이다.

---

## 10. 관리자 API 엔드포인트 대비

| Spec-KR 엔드포인트 | 현재 코드 | 상태 |
|-------------------|-----------|------|
| POST /api/admin/auth/login | POST /api/admin/auth/sign-in | ✅ (이름 다름) |
| POST /api/admin/auth/mfa/verify | 없음 | ❌ MFA 미구현 |
| POST /api/admin/auth/logout | POST /api/admin/auth/sign-out | ✅ |
| GET /api/admin/me | 없음 (세션에서 추출) | ⚠️ 별도 엔드포인트 없음 |
| GET /api/admin/dashboard/summary | GET /api/admin/dashboard | ✅ (기본 수준) |
| GET /api/admin/users | GET /api/admin/users | ✅ |
| GET /api/admin/users/:id | GET /api/admin/users/[id] | ✅ |
| POST /api/admin/users/:id/suspend | PATCH /api/admin/users/[id] | ✅ (통합) |
| POST /api/admin/users/:id/notes | 없음 | ❌ |
| GET /api/admin/conversations | GET /api/admin/conversations | ✅ |
| GET /api/admin/conversations/:id | GET /api/admin/conversations/[id] | ✅ |
| POST .../log-view | GET .../raw (자동 로그) | ⚠️ 방식 다름 |
| GET /api/admin/coupons | GET /api/admin/coupons | ✅ |
| POST /api/admin/coupons/generate | POST /api/admin/coupons | ✅ |
| POST /api/user/coupons/redeem | POST /api/coupons/redeem | ✅ |
| GET /api/admin/subscriptions | 없음 (users에서 조회) | ⚠️ |
| POST .../manual-grant | POST /api/admin/users/[id]/grants | ✅ |
| GET /api/admin/providers | GET /api/admin/providers | ✅ |
| POST .../update | POST /api/admin/providers | ✅ |
| POST .../rotate-key | POST /api/admin/providers | ✅ (통합) |
| POST .../health-check | 없음 | ❌ |
| GET /api/admin/audit-logs | GET /api/admin/audit-logs | ✅ |
| GET /api/admin/content-access-logs | 없음 (audit-logs에 통합) | ⚠️ |

---

## 11. 종합 판정

### 전체 평가: 양호하나 핵심 원칙 위반 1건 해결 필요

현재 코드는 **Spec-EN의 워크벤치 핵심 기능을 높은 수준으로 구현**하고 있으며, **Spec-KR의 관리자/쿠폰/이용권 시스템도 대부분 구현**되어 있다.

그러나 **Spec-KR의 절대 원칙(섹션 4-1: 사용자 API Key 입력 폐기)**이 지켜지지 않아, 제품의 운영 철학과 코드 구조가 충돌하는 상태이다.

### 우선 해결 순서 권장:

1. **CRITICAL**: 사용자 API Key 입력 구조 정리 (Spec-KR 4-1 준수)
2. **HIGH**: ai_requests 로깅 테이블 추가 + 비용/사용량 대시보드 강화
3. **HIGH**: 관리자 MFA 구현
4. **MEDIUM**: AdminProviderConfig에 health_status, fallback, rate_limit 필드 추가
5. **MEDIUM**: 쿠폰 CSV 다운로드
6. **LOW**: 관리자 메모/플래그 UI, 결과 트리뷰 등

---

## 부록 A: 파일 목록 요약

```
src/
├── app/
│   ├── api/auth/         → 사용자 인증 API (sign-up, sign-in, sign-out)
│   ├── api/admin/        → 관리자 API (users, coupons, providers, audit-logs, dashboard, conversations, system)
│   ├── api/workbench/    → 워크벤치 실행 API (run, branch)
│   ├── api/sessions/     → 세션 CRUD + duplicate
│   ├── api/results/      → 결과 CRUD + rerun + mark-final
│   ├── api/projects/     → 프로젝트 CRUD
│   ├── api/presets/      → 프리셋 CRUD
│   ├── api/providers/    → 사용자 공급자 설정 (★ Spec-KR 위반)
│   ├── api/coupons/      → 쿠폰 사용
│   ├── api/subscription/ → 이용권 상태 조회
│   ├── api/account/      → 계정 정보
│   ├── app/              → 보호된 사용자 페이지
│   ├── admin/            → 관리자 페이지
│   ├── sign-in/          → 사용자 로그인
│   └── sign-up/          → 사용자 회원가입
├── components/
│   ├── workbench/        → 워크벤치 UI (WorkbenchClient, ResultCard, WorkflowStepRow, ProviderSelectorRow)
│   ├── admin/            → 관리자 UI (AdminShell, AdminCouponsClient, AdminProvidersClient 등)
│   ├── i18n/             → 다국어 지원
│   ├── sessions/         → 세션 목록
│   ├── presets/          → 프리셋 목록
│   ├── providers/        → 사용자 공급자 설정 (★ Spec-KR 위반)
│   ├── projects/         → 프로젝트 관리
│   └── account/          → 계정 설정
├── lib/
│   ├── ai/               → AI 통합 레이어 (providers, workflow, prompt, pricing, types, provider-catalog)
│   ├── auth.ts           → 사용자 인증
│   ├── admin-auth.ts     → 관리자 인증
│   ├── admin-audit.ts    → 감사로그
│   ├── secret-crypto.ts  → AES-256-GCM 암호화
│   ├── subscription.ts   → 쿠폰/이용권 로직
│   └── validation.ts     → Zod 스키마
└── prisma/
    └── schema.prisma     → 16개 모델, enum 정의
```

---

*이 레포트는 현재 코드의 상태를 분석한 것이며, 어떠한 수정도 포함하지 않습니다.
수정 작업은 사용자의 명시적 지시가 있을 때만 진행합니다.*

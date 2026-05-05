# 멀티 AI 프로그램 마스터 기획·구현 지침서

- 문서 버전: V1.0
- 패치 기준일: 2026-04-14
- 문서 성격: 이 대화방에서 합의된 요구사항, 기획 의도, 운영 구조, 관리자 기능, 데이터 구조, 구현 규칙을 하나의 **Source of Truth** 로 정리한 마스터 MD 문서
- 대상 독자: Codex, Claude Code, Google AI Studio, Antigravity, 개발자, PM, QA, 운영자
- 목적: 이 문서만 보고도 **동일한 구조와 의도를 가진 멀티 AI 프로그램**을 최대한 일관되게 구현할 수 있도록 한다

---

## 0. 이 문서의 역할

이 문서는 단순 아이디어 정리가 아니다.
이 문서는 아래를 모두 포함하는 **프로그램 제작 기준서**다.

1. 프로그램의 목적과 철학
2. 사용자 기능과 관리자 기능
3. 화면 구조와 사용자 흐름
4. 권한 체계
5. DB 스키마와 핵심 엔티티
6. API 설계 방향
7. 쿠폰 / 이용권 / 평생 무료 로직
8. AI 공급자(API Key) 관리 방식
9. 관리자 모니터링 구조
10. 구현 우선순위와 완료 조건
11. 보안 / 운영 / 리스크 가이드

즉, 이후 어떤 AI에게 구현을 맡기더라도,
**"이 문서가 가장 우선되는 기준"** 으로 삼아야 한다.

---

# 1. 프로그램 한 줄 정의

사용자가 하나의 질문, 주제, 아이디어, 문서를 입력하면,
여러 AI 모델(GPT, Claude, Gemini, Grok 등)의 답변을 동시에 비교하고,
각 답변에 대해 다시 선택적으로 추가질문을 하거나,
여러 AI가 순차적으로 서로의 결과를 검토하는 워크플로우까지 수행할 수 있는 **멀티 AI 비교·검토 플랫폼**이다.

---

# 2. 프로그램의 핵심 목적

## 2-1. 1차 목적

하나의 입력에 대해 여러 AI의 답변을 한 화면에서 비교할 수 있게 한다.

예:
- GPT 답변
- Claude 답변
- Gemini 답변
- Grok 답변

사용자는 이 결과를 보고 더 좋은 모델을 판단하거나,
각 모델의 관점 차이를 빠르게 파악할 수 있어야 한다.

## 2-2. 2차 목적

초기 답변 이후,
특정 모델 또는 여러 모델에게만 다시 추가질문을 할 수 있어야 한다.

예:
- GPT 답변만 더 깊게 파고들기
- Claude와 Gemini에게만 반론 요청하기
- GPT의 첫 답변을 Grok이 검토하게 만들기

## 2-3. 3차 목적

단순 병렬 비교를 넘어서,
**AI 간 순차 검토(chain review / cross-review)** 구조를 지원해야 한다.

예:
1. 첫 출력: GPT
2. GPT의 결과를 Grok이 비판/보완
3. 두 번째 결과를 Gemini가 다시 검토
4. 마지막에 Claude가 종합 정리

즉,
이 프로그램은 단순 채팅앱이 아니라
**AI 오케스트레이션 / AI 협업 워크스페이스** 에 가깝다.

---

# 3. 제품 철학

## 3-1. 사용자 철학

이 프로그램은 “AI를 하나씩 따로 써보는 불편함”을 없애야 한다.

사용자는:
- 여러 탭을 왔다갔다 하지 않고,
- 여러 AI 웹사이트를 따로 열지 않고,
- 하나의 워크스페이스 안에서,
- 여러 AI를 비교 / 선택 / 재질문 / 검토시켜야 한다.

## 3-2. 운영 철학

사용자에게는 최대한 단순하게 보여야 하지만,
운영자는 뒤에서 아래를 강하게 통제할 수 있어야 한다.

- 어떤 AI 공급자를 쓸지
- 어떤 모델을 활성화할지
- API Key를 어떻게 운용할지
- 사용자 사용량과 비용을 어떻게 볼지
- 쿠폰과 평생 무료 이용권을 어떻게 뿌릴지
- 초기에 어떤 사용자가 무엇을 입력하는지 모니터링할지

즉,
겉은 단순한 사용자 앱,
속은 강력한 관리자 관제 시스템 구조로 설계한다.

---

# 4. 반드시 지켜야 하는 절대 원칙

## 4-1. 사용자 입력 API Key 방식 폐기

이 프로그램에서 사용하는 각 AI의 API Key는
**사용자가 직접 넣는 구조가 아니다.**

반드시 운영자(관리자)의 API Key를 서버에서 관리하고,
사용자는 그 위에서 서비스 형태로 이용해야 한다.

즉,
기존 사용자 페이지에 있던 공급자/API Key 입력 화면은 제거한다.

그 기능은 전부 관리자 페이지의 **AI Providers 설정 화면** 으로 이동한다.

## 4-2. 관리자 기능은 프론트 숨김이 아니라 서버 권한으로 보호

관리자 버튼만 숨긴다고 보안이 되는 것이 아니다.

반드시:
- 관리자 페이지는 별도 서브도메인
- 관리자 API는 별도 권한 체크
- 서버에서 ADMIN / SUPER_ADMIN 권한 검증

으로 보호한다.

## 4-3. 관리자 페이지는 서브도메인 분리

관리자 페이지는 사용자 페이지와 섞지 않는다.

권장 구조:
- 사용자 앱: `app.도메인`
- 관리자 앱: `admin.도메인`
- API 서버: `api.도메인` 또는 공용 백엔드 내 `/api/*`

이번 프로젝트에서는 **`admin.도메인` 분리** 를 확정한다.

## 4-4. 쿠폰은 1회용, 계정은 다회 사용 가능

- 쿠폰 코드는 1회 사용 후 재사용 불가
- 한 사용자 계정은 여러 쿠폰 사용 가능
- 월 무료 쿠폰은 30일씩 누적 가능
- 평생 무료 쿠폰도 별도 존재

## 4-5. 관리자 원문 열람 가능

초기 개발/운영 모니터링을 위해
관리자는 사용자 입력과 대화 원문 열람이 가능하다.

단,
반드시 아래 기록을 남겨야 한다.

- 누가 봤는지
- 언제 봤는지
- 누구의 대화를 봤는지
- 어떤 사유였는지

즉,
**열람은 가능하되 흔적 없는 열람은 금지**

## 4-6. 공급자 API Key는 절대 브라우저에 직접 노출 금지

모든 AI 호출은 반드시:

사용자 브라우저 → 우리 서버 → AI 공급자 API

구조를 따른다.

사용자 브라우저에서 공급자 Key를 직접 알 수 있으면 안 된다.

---

# 5. 사용자 페이지와 관리자 페이지의 역할 분리

## 5-1. 사용자용 페이지

사용자를 위한 실제 서비스 화면이다.

핵심 역할:
- 질문 입력
- 사용할 AI 모델 선택
- 여러 AI 결과 비교
- 특정 결과에 대해 추가질문
- 여러 모델 간 순차 검토 설정
- 대화 히스토리 보기
- 쿠폰 등록
- 현재 이용권 상태 확인

## 5-2. 관리자용 페이지

운영자 전용 관리 화면이다.

핵심 역할:
- 사용자 목록/상세 관리
- 사용자 입력/대화 모니터링
- 월 무료 / 평생 무료 쿠폰 생성
- 쿠폰 사용 이력 조회
- 이용권 수동 부여/관리
- AI 공급자 API Key 등록/교체/활성화
- 모델 기본값/제한치 관리
- 비용/토큰/사용량 관제
- 관리자 감사로그 조회

---

# 6. 주요 사용자 기능 정의

## 6-1. 멀티 AI 병렬 응답

사용자가 질문을 입력하면,
선택한 여러 모델로 동시에 요청을 보내고,
각 모델의 답변을 각각의 카드/패널로 출력한다.

예시 모델:
- GPT
- Claude
- Gemini
- Grok

### 필수 조건
- 어떤 모델을 켤지 사용자가 선택 가능
- 각 모델 응답이 구분되어 보여야 함
- 응답 실패 모델은 실패 상태도 보여야 함
- 각 결과마다 모델명/공급자명 표시

## 6-2. 결과별 추가질문

첫 답변 이후,
사용자는 특정 결과를 기준으로 추가질문을 던질 수 있어야 한다.

예:
- GPT 결과만 이어서 질문
- GPT와 Claude에만 재질문
- Gemini만 더 자세히 설명 요청

### 필수 조건
- 추가질문을 적용할 모델을 체크박스나 토글로 선택
- 선택한 모델만 이어서 응답
- 이전 맥락을 이어받아야 함

## 6-3. AI 순차 검토 워크플로우

사용자는 단순 병렬 응답 외에,
“AI가 AI를 검토하는 흐름”을 설계할 수 있어야 한다.

예:
1. GPT 초안 작성
2. Grok이 GPT 초안의 약점 지적
3. Gemini가 보완 제안
4. Claude가 최종 정리

### 필수 조건
- 사용자에게 워크플로우 구조를 설정할 수 있는 UI 제공
- 각 단계별 입력/출력을 다음 단계가 참조 가능
- 단계 실패 시 어느 단계에서 실패했는지 표시

## 6-4. 대화 히스토리

사용자는 자신의 이전 멀티 AI 대화를 다시 볼 수 있어야 한다.

필수:
- 대화 제목
- 생성일
- 사용 모델
- 최근 입력 미리보기
- 대화 상세 열람

## 6-5. 쿠폰 등록

사용자는 쿠폰 코드 입력 후,
월 무료 30일 또는 평생 무료 이용권을 적용받을 수 있어야 한다.

### 필수 규칙
- 한 코드는 1회만 사용 가능
- 한 계정은 여러 코드 사용 가능
- 월 무료 쿠폰은 30일씩 누적
- 평생 무료 쿠폰 적용 시 lifetime 상태가 된다

## 6-6. 내 이용권 상태 보기

사용자는 자신의 현재 상태를 볼 수 있어야 한다.

예:
- 무료
- 30일 무료 기간 진행 중
- 평생 무료
- 만료일
- 남은 기간

---

# 7. 관리자 기능 정의

## 7-1. 관리자 대시보드

운영 상황을 한눈에 본다.

필수 KPI:
- 총 사용자 수
- 오늘 활성 사용자 수
- 오늘 질문 수
- 오늘 AI 요청 수
- 오늘 예상 비용
- 오늘 에러 수
- 오늘 쿠폰 사용 수

추가 추천:
- 최근 가입 사용자
- 최근 많이 쓰인 모델
- 최근 에러
- 최근 원문 열람 기록

## 7-2. 사용자 관리

모든 사용자 계정을 검색, 필터링, 상세 열람할 수 있어야 한다.

기본 정보:
- 이메일
- 가입일
- 마지막 활동
- 총 대화 수
- 총 AI 요청 수
- 현재 이용권 상태
- 평생 여부

액션:
- 상세 보기
- 관리자 메모
- 정지/해제
- 이용권 수동 부여

## 7-3. 사용자 대화 원문 모니터링

관리자는 사용자 대화 목록을 보고,
대화 상세에서 원문을 열람할 수 있다.

필수:
- 사용자 이메일로 검색
- 날짜 범위 필터
- 모델/공급자 필터
- 실패/성공 필터
- 대화 원문 보기
- 열람 로그 자동 기록

## 7-4. 쿠폰 관리

관리자는 다음 쿠폰을 생성할 수 있다.

- 한 달 무료 쿠폰
- 평생 무료 쿠폰

필수:
- 생성 수량
- 코드 길이
- 만료일
- 캠페인명
- 내부 메모
- 사용 여부 조회
- 사용한 계정 조회
- 발급 관리자 추적
- CSV 다운로드

## 7-5. 이용권 관리

관리자는 사용자에게 수동으로 이용권을 부여하거나,
현재 상태를 확인할 수 있다.

예:
- 평생 무료 수동 부여
- 30일 무료 수동 부여
- 상태 확인

## 7-6. AI Providers 설정

사용자 페이지에 있던 공급자/API Key 입력 기능은 삭제하고,
이 관리자 화면으로 이동한다.

필수 기능:
- OpenAI API Key 등록/교체
- Anthropic API Key 등록/교체
- Gemini API Key 등록/교체
- xAI(Grok) API Key 등록/교체
- 공급자 활성/비활성
- 기본 모델 선택
- 사용자당 요청 제한
- 타임아웃 설정
- Fallback 공급자 설정
- Health check 결과 보기

## 7-7. 비용/사용량 관리

운영자는 공급자별 비용과 사용량을 봐야 한다.

필수:
- 일별 요청 수
- 일별 비용
- 공급자별 비용
- 모델별 사용량
- 상위 사용자 비용 순위

## 7-8. 관리자 감사로그

관리자의 민감 행동은 모두 기록한다.

필수 로그 대상:
- 관리자 로그인/로그아웃
- MFA 성공/실패
- 사용자 상세 조회
- 원문 열람
- 쿠폰 생성
- 쿠폰 비활성화
- 이용권 수동 부여
- 공급자 Key 교체
- 공급자 모델 변경
- 사용자 정지/해제
- 시스템 설정 변경

---

# 8. 정보 구조(IA)

## 8-1. 사용자 앱 IA

- Dashboard / Home
- New Query
- Multi Result Workspace
- Follow-up / Selected Models
- Chain Review Builder
- Conversation History
- Coupon Redeem
- My Plan Status
- Account Settings

## 8-2. 관리자 앱 IA

- Dashboard
- Users
- User Detail
- Conversations
- Conversation Detail
- Coupons
- Create Coupons
- Subscriptions
- AI Providers
- Usage & Cost
- Admin Audit Logs
- System Settings

---

# 9. 화면 설계 요약

## 9-1. 사용자 화면 핵심

### Home / New Query
- 질문 입력 textarea
- 파일/문서 첨부(향후 확장 가능)
- 사용할 모델 선택 체크박스
- 병렬 응답 실행 버튼
- 순차 검토 모드 진입 버튼

### Multi Result Workspace
- 모델별 결과 카드
- 각 카드에 다음 액션
  - 추가질문
  - 복사
  - 다시 생성
  - 다른 모델에게 검토 요청

### Follow-up Panel
- 후속 질문 입력창
- 적용 모델 선택
- 이전 맥락 유지 여부

### Chain Review Builder
- Step 1 모델 선택
- Step 2 검토 모델 선택
- Step 3 정리 모델 선택
- 각 단계 입력/출력 매핑

### Coupon Redeem
- 쿠폰 입력창
- 적용 버튼
- 성공/실패 메시지

### My Plan Status
- 현재 상태
- 만료일
- lifetime 여부
- 최근 쿠폰 사용 내역

## 9-2. 관리자 화면 핵심

### Login
- 이메일
- 비밀번호
- MFA

### Dashboard
- KPI 카드
- 최근 사용자
- 최근 모델 사용
- 최근 에러
- 최근 쿠폰 사용
- 최근 원문 열람

### Users
- 검색/필터
- 사용자 테이블

### User Detail
- Overview
- Conversations
- Coupons
- Usage
- Subscription
- Notes
- AccessLogs

### Conversations
- 사용자/날짜/모델 기준 검색
- 목록에서 대화 상세 진입

### Conversation Detail
- 원문 타임라인
- 모델/토큰/비용 정보
- 열람 로그

### Coupons
- 쿠폰 목록
- 필터
- 사용 여부
- 사용한 계정

### Create Coupons
- 쿠폰 종류
- 수량
- 코드 길이
- 만료일
- 캠페인명
- 메모
- 생성 결과/CSV 다운로드

### AI Providers
- 공급자 카드
- Key 마스킹 표시
- 기본 모델
- fallback
- 활성 상태
- rate limit

### Audit Logs
- 관리자 행동 기록 검색/필터

---

# 10. 권한 체계(RBAC)

## 10-1. 사용자 권한
- USER

## 10-2. 관리자 권한
초기 권장:
- ADMIN
- SUPER_ADMIN

확장 여지:
- SUPPORT_VIEWER

## 10-3. 권한 원칙

- USER는 `/admin/*` 접근 불가
- ADMIN은 대부분의 관리자 기능 접근 가능
- SUPER_ADMIN은 공급자 Key 수정, 시스템 설정, 최고 권한 작업 가능

권장 분리 예:
- ADMIN: 사용자 조회, 원문 조회, 쿠폰 발급, 이용권 조정
- SUPER_ADMIN: 공급자 Key 수정, 관리자 권한 변경, 시스템 설정

---

# 11. 도메인 / 시스템 구조

## 11-1. 권장 구조

- 사용자 앱: `app.domain.com`
- 관리자 앱: `admin.domain.com`
- API 서버: `api.domain.com`

## 11-2. 요청 흐름

### 사용자 요청
1. 사용자가 사용자 앱에서 질문 입력
2. 사용자 앱이 우리 API 서버에 요청
3. API 서버가 관리자 설정에 저장된 공급자 Key를 읽음
4. API 서버가 각 공급자(OpenAI, Anthropic, Google, xAI)에 요청
5. API 결과를 가공해 사용자 앱에 반환
6. 대화/메시지/요청 로그 저장

### 관리자 요청
1. 관리자가 admin 앱 로그인
2. 서버에서 관리자 권한 확인
3. 사용자/대화/쿠폰/공급자 정보를 조회
4. 민감 작업 시 감사로그 저장

---

# 12. DB 스키마 상세 명세

아래는 PostgreSQL 기준 권장 엔티티다.

## 12-1. users

- `id` uuid pk
- `email` varchar(320) unique not null
- `password_hash` text null
- `display_name` varchar(100) null
- `role` varchar(20) not null default 'user'
- `status` varchar(20) not null default 'active'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `last_login_at` timestamptz null
- `last_active_at` timestamptz null

## 12-2. admin_users

- `id` uuid pk
- `user_id` uuid unique not null references users(id)
- `admin_role` varchar(20) not null
- `mfa_enabled` boolean not null default true
- `is_active` boolean not null default true
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

## 12-3. conversations

- `id` uuid pk
- `user_id` uuid not null references users(id)
- `title` varchar(255) null
- `status` varchar(20) not null default 'active'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

## 12-4. messages

- `id` uuid pk
- `conversation_id` uuid not null references conversations(id)
- `user_id` uuid not null references users(id)
- `role` varchar(20) not null
- `provider` varchar(50) null
- `model` varchar(100) null
- `content_encrypted` text not null
- `content_preview` varchar(300) null
- `token_input` integer null
- `token_output` integer null
- `estimated_cost_usd` numeric(12,6) null
- `latency_ms` integer null
- `created_at` timestamptz not null default now()

## 12-5. ai_requests

- `id` uuid pk
- `user_id` uuid not null references users(id)
- `conversation_id` uuid null references conversations(id)
- `message_id` uuid null references messages(id)
- `provider` varchar(50) not null
- `model` varchar(100) not null
- `request_type` varchar(50) not null
- `status` varchar(20) not null
- `input_tokens` integer null
- `output_tokens` integer null
- `estimated_cost_usd` numeric(12,6) null
- `latency_ms` integer null
- `error_code` varchar(100) null
- `error_message` text null
- `created_at` timestamptz not null default now()

## 12-6. provider_settings

- `id` uuid pk
- `provider_name` varchar(50) unique not null
- `encrypted_api_key` text not null
- `api_key_masked` varchar(50) not null
- `is_active` boolean not null default true
- `default_model` varchar(100) not null
- `fallback_provider` varchar(50) null
- `per_user_daily_limit` integer not null default 100
- `timeout_seconds` integer not null default 60
- `health_status` varchar(20) not null default 'unknown'
- `last_health_checked_at` timestamptz null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `updated_by_admin_id` uuid null references admin_users(id)

## 12-7. coupons

- `id` uuid pk
- `code` varchar(64) unique not null
- `coupon_type` varchar(30) not null
- `duration_days` integer null
- `is_lifetime` boolean not null default false
- `max_redemptions` integer not null default 1
- `redeemed_count` integer not null default 0
- `is_active` boolean not null default true
- `campaign_name` varchar(100) null
- `internal_note` text null
- `expires_at` timestamptz null
- `created_at` timestamptz not null default now()
- `created_by_admin_id` uuid not null references admin_users(id)

## 12-8. coupon_redemptions

- `id` uuid pk
- `coupon_id` uuid not null references coupons(id)
- `user_id` uuid not null references users(id)
- `redeemed_at` timestamptz not null default now()
- `result_type` varchar(30) not null
- `result_note` text null

## 12-9. subscription_grants

- `id` uuid pk
- `user_id` uuid not null references users(id)
- `grant_type` varchar(30) not null
- `source_coupon_id` uuid null references coupons(id)
- `starts_at` timestamptz not null
- `ends_at` timestamptz null
- `is_lifetime` boolean not null default false
- `status` varchar(20) not null default 'active'
- `created_at` timestamptz not null default now()
- `created_by_admin_id` uuid null references admin_users(id)

## 12-10. user_plan_snapshot

빠른 조회용 캐시 테이블.

- `user_id` uuid pk references users(id)
- `current_plan_type` varchar(30) not null
- `active_from` timestamptz null
- `active_until` timestamptz null
- `is_lifetime` boolean not null default false
- `updated_at` timestamptz not null default now()

## 12-11. admin_audit_logs

- `id` uuid pk
- `admin_user_id` uuid not null references admin_users(id)
- `action_type` varchar(50) not null
- `target_type` varchar(50) null
- `target_id` varchar(100) null
- `detail_json` jsonb null
- `ip_address` inet null
- `user_agent` text null
- `created_at` timestamptz not null default now()

## 12-12. admin_content_access_logs

원문 열람 전용 로그 테이블.

- `id` uuid pk
- `admin_user_id` uuid not null references admin_users(id)
- `viewed_user_id` uuid not null references users(id)
- `conversation_id` uuid null references conversations(id)
- `message_id` uuid null references messages(id)
- `access_reason_code` varchar(50) not null
- `access_note` text null
- `created_at` timestamptz not null default now()

## 12-13. admin_notes

- `id` uuid pk
- `user_id` uuid not null references users(id)
- `admin_user_id` uuid not null references admin_users(id)
- `note_text` text not null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

## 12-14. user_flags

- `id` uuid pk
- `user_id` uuid not null references users(id)
- `flag_type` varchar(30) not null
- `is_active` boolean not null default true
- `created_by_admin_id` uuid not null references admin_users(id)
- `created_at` timestamptz not null default now()

---

# 13. 핵심 비즈니스 로직

## 13-1. 쿠폰 로직

### 월 무료 쿠폰
- 코드 1개 = 30일
- 사용 즉시 소모
- 한 사용자 계정은 여러 개 사용 가능
- 남은 활성 기간이 있으면 끝나는 날짜 뒤에 30일 추가

### 평생 무료 쿠폰
- 코드 1개 = lifetime
- 사용 즉시 소모
- 이미 lifetime인 유저가 또 사용하면 효과는 추가되지 않지만 redemption 이력은 남긴다

### 사용 불가 조건
- 만료된 쿠폰
- 비활성 쿠폰
- 이미 사용된 쿠폰
- max_redemptions 초과 쿠폰

## 13-2. 이용권 계산 원칙

### monthly_free_30d 적용
- 유저 active plan이 있고 종료일이 미래면:
  - start = active_end
  - end = active_end + 30 days
- 유저 active plan이 없거나 종료되었으면:
  - start = now
  - end = now + 30 days

### lifetime_free 적용
- 이미 lifetime가 아니면 lifetime grant 생성
- 이미 lifetime면 이력만 저장

## 13-3. 원문 열람 로직

관리자가 대화 원문을 열람할 때는 반드시 로그를 남긴다.

권장 reason code:
- bug_debug
- support_issue
- abuse_review
- quality_monitoring
- other

## 13-4. 공급자 Key 처리 로직

- 관리자만 등록/교체 가능
- DB에는 암호화해서 저장
- UI에는 마스킹 문자열만 표시
- 평문 재노출 금지
- 교체 시 감사로그 저장

---

# 14. API 엔드포인트 설계 방향

## 14-1. 관리자 인증
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/mfa/verify`
- `POST /api/admin/auth/logout`
- `GET /api/admin/me`

## 14-2. 대시보드
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/dashboard/recent-users`
- `GET /api/admin/dashboard/recent-errors`

## 14-3. 사용자 관리
- `GET /api/admin/users`
- `GET /api/admin/users/:userId`
- `GET /api/admin/users/:userId/conversations`
- `GET /api/admin/users/:userId/usage`
- `POST /api/admin/users/:userId/suspend`
- `POST /api/admin/users/:userId/unsuspend`
- `POST /api/admin/users/:userId/notes`

## 14-4. 대화 / 원문 보기
- `GET /api/admin/conversations`
- `GET /api/admin/conversations/:conversationId`
- `POST /api/admin/conversations/:conversationId/log-view`

## 14-5. 쿠폰
- `GET /api/admin/coupons`
- `POST /api/admin/coupons/generate`
- `GET /api/admin/coupons/:couponId`
- `POST /api/user/coupons/redeem`

## 14-6. 이용권
- `GET /api/admin/subscriptions`
- `GET /api/admin/users/:userId/subscription`
- `POST /api/admin/users/:userId/subscription/manual-grant`

## 14-7. 공급자 설정
- `GET /api/admin/providers`
- `POST /api/admin/providers/:providerName/update`
- `POST /api/admin/providers/:providerName/rotate-key`
- `POST /api/admin/providers/:providerName/health-check`

## 14-8. 감사로그
- `GET /api/admin/audit-logs`
- `GET /api/admin/content-access-logs`

---

# 15. 구현 우선순위

## Phase 1 — 관리자 골격 + 사용자 멀티 AI 기본

1. 사용자 질문 입력 화면
2. 모델 선택 UI
3. 병렬 응답 결과 화면
4. 사용자 대화 저장
5. 관리자 로그인/권한
6. 관리자 레이아웃/사이드바
7. 사용자 목록/상세
8. 대화 목록/상세
9. 원문 열람 로그

## Phase 2 — 운영 기능

10. 쿠폰 생성/조회/사용
11. 이용권 계산 로직
12. AI Providers 설정
13. 비용/사용량 대시보드
14. 관리자 감사로그

## Phase 3 — 고도화

15. AI 순차 검토 워크플로우 UI
16. fallback/provider health check 고도화
17. 관리자 메모/플래그
18. CSV Export
19. 사용량 제한 정책
20. 에러 대시보드 개선

---

# 16. 기술 스택 권장안

이 문서는 기술 스택을 강제하지는 않지만,
현재 의도에 가장 맞는 실용적 권장안은 아래와 같다.

## 프론트엔드
- Next.js (App Router)
- TypeScript
- Tailwind CSS

## 백엔드
- Next.js API Routes 또는 별도 Node 서버
- TypeScript
- Server-side provider orchestration

## DB
- PostgreSQL
- Prisma 또는 Drizzle ORM 권장

## 인증
- NextAuth 또는 자체 세션
- 관리자 MFA 지원

## 배포
- 사용자 앱 / 관리자 앱 / API 서버 분리 가능 구조
- Vercel + 별도 API 서버 또는 단일 서버 구조 중 선택 가능

---

# 17. 보안 요구사항

## 17-1. 필수 보안
- 관리자 라우트 서버 권한 체크
- 관리자 API 서버 권한 체크
- provider key 암호화 저장
- 민감 로그 저장
- 세션 보호
- CSRF/XSS 기본 방어

## 17-2. 권장 보안
- 관리자 MFA 필수
- 관리자 세션 짧은 만료
- 공급자 Key 수정 시 SUPER_ADMIN 제한
- 원문 열람은 role 제한 + 로그 기록

## 17-3. 절대 금지
- 프론트엔드에 실제 공급자 API Key 노출
- 관리자 기능을 단순 hidden 버튼으로만 보호
- 원문 열람 로그 없이 민감 데이터 열람 허용

---

# 18. 운영 정책 초안 포인트

이 문서는 법률 자문 문서가 아니며,
실제 약관/개인정보처리방침은 별도 검토가 필요하다.

다만 최소한 아래 내용은 운영 정책에 반영해야 한다.

- 서비스 운영 및 품질 개선 목적의 이용기록 처리
- 오류 대응/오남용 방지 목적의 기록 처리 가능성
- 관리자 권한 범위 내에서 기록 열람 가능성
- 보유기간 및 보호조치
- 이용권/쿠폰 처리 기준

---

# 19. QA 체크리스트

## 사용자 기능 QA
- 여러 모델 동시 요청이 정상 동작하는가
- 일부 모델 실패 시 다른 결과는 정상 표시되는가
- 추가질문 시 선택한 모델만 이어지는가
- 대화 히스토리가 정상 저장되는가
- 쿠폰 사용 시 상태가 즉시 반영되는가

## 관리자 기능 QA
- 관리자 외 `/admin` 접근이 차단되는가
- 사용자 목록 필터가 정상 동작하는가
- 대화 원문 열람 시 로그가 남는가
- 쿠폰 생성 후 1회만 사용 가능한가
- 월 무료 쿠폰이 누적 적용되는가
- 평생 쿠폰이 정상 반영되는가
- provider key가 평문으로 다시 노출되지 않는가
- 감사로그가 민감 작업마다 남는가

## 보안 QA
- 일반 사용자 토큰으로 관리자 API 호출이 막히는가
- 쿠폰 중복 사용 race condition이 막히는가
- provider key가 브라우저 네트워크 응답에 실리지 않는가

---

# 20. 완료 조건 (Definition of Done)

아래 조건이 만족되면 1차 MVP 완료로 본다.

1. 사용자가 질문 입력 후 여러 AI 결과를 한 화면에서 볼 수 있다
2. 특정 결과에 대해 특정 모델만 선택해 추가질문할 수 있다
3. 사용자 대화가 저장되고 히스토리를 볼 수 있다
4. 관리자 페이지가 `admin.도메인` 에서 분리 운영된다
5. 관리자 로그인 및 권한 체크가 동작한다
6. 관리자가 사용자 목록/상세/대화를 볼 수 있다
7. 관리자가 사용자 원문을 열람할 수 있고 로그가 남는다
8. 관리자가 월 무료 / 평생 무료 쿠폰을 생성할 수 있다
9. 사용자가 쿠폰을 입력하면 30일 누적 또는 평생 무료가 반영된다
10. 공급자 API Key 설정이 관리자 페이지에서만 가능하다
11. 사용자 페이지의 공급자 Key 입력 UI가 제거된다
12. 주요 관리자 행동이 감사로그에 남는다

---

# 21. Codex / 다른 AI에게 전달할 핵심 명령 요약

아래는 이후 구현 AI에게 전달할 때 가장 중요한 요약이다.

## 핵심 요약

이 프로젝트는 여러 AI 모델의 응답을 동시에 비교하고,
특정 모델들만 골라 후속 질문을 하거나,
AI가 다른 AI의 결과를 순차적으로 검토하는 워크플로우를 지원하는 **멀티 AI 플랫폼**이다.

관리자 기능은 사용자 기능과 완전히 분리된 `admin.도메인` 에 존재해야 하며,
운영자는 사용자 계정/대화/쿠폰/이용권/API 공급자 설정/비용/감사로그를 관리할 수 있어야 한다.

사용자별 API Key 입력 방식은 폐기한다.
모든 AI 공급자 API Key는 관리자 설정에서만 관리하며,
실제 요청은 반드시 서버를 통해 중계된다.

쿠폰 정책은 다음과 같다.
- 월 무료 쿠폰: 30일, 누적 가능
- 평생 무료 쿠폰: lifetime
- 각 쿠폰 코드는 1회용
- 한 사용자 계정은 여러 쿠폰 사용 가능

관리자는 사용자 대화 원문 열람이 가능하되,
반드시 열람 로그가 남아야 한다.

이 문서를 Source of Truth로 삼아,
구현 시 구조를 임의로 단순화하거나 바꾸지 말 것.

---

# 22. 향후 확장 아이디어 (이번 문서 기준 비필수)

아래는 현재 확정 필수 범위는 아니지만,
나중에 자연스럽게 확장 가능한 방향이다.

- 팀 협업 기능
- 사용자별 사용량 제한 정책 고도화
- 과금/유료 플랜 결제 연동
- 프롬프트 템플릿 저장
- 문서 업로드 기반 멀티 AI 분석
- 모델 성능 비교 리포트
- 워크플로우 템플릿 저장
- 관리자 알림 시스템
- Abuse 탐지 자동화

---

# 23. 최종 메모

이 문서는 현재 대화방에서 합의된 프로그램의 목적과 구조를 체계적으로 정리한 **마스터 제작 지침서**다.

이후 세부 구현에서는 다음 문서들이 추가되면 더 강력해진다.

1. 화면별 상세 UI 명세서
2. API request/response 샘플 문서
3. DB migration SQL 문서
4. QA 케이스 100개 문서
5. 관리자 정책/운영 정책 문서
6. 배포 구조 문서

하지만 현재 시점에서는,
이 MD 파일만으로도 AI가 프로그램의 핵심 의도와 구조를 거의 동일하게 재현할 수 있도록 설계되어 있다.


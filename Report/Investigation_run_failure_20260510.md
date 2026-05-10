# 실행 실패 원인 조사 보고서

## 1. 조사 목적
- 사용자 제보: 워크벤치에서 `실행` 버튼을 누르면 결과 생성 대신 `실행에 실패했습니다.`만 표시됨
- 목표: 현재 운영 환경에서 실패 지점을 0부터 100까지 구조적으로 확인하고, 직접 원인과 구조적 원인을 분리해 보고

## 2. 결론 요약
이번 실패의 직접 원인은 **AI 공급자(OpenAI, Anthropic, Google, xAI)가 운영 설정상 모두 비활성화(`disabled`) 상태**이기 때문입니다.

즉, API 키가 Vercel에 존재하더라도, 서버는 `adminProviderConfig.isEnabled !== true`이면 실행을 시작하기 전에 요청을 차단합니다.

추가로, 한국어 UI에서는 백엔드가 돌려준 상세 오류 문구를 보여주지 않고 무조건 `실행에 실패했습니다.`로 덮어써서, 실제 원인 파악이 매우 어렵게 되어 있습니다.

## 3. 조사 범위
다음 항목을 순서대로 조사했습니다.

1. 런타임 로그
2. 배포 상태
3. 운영 환경변수 상태
4. 워크벤치 실행 API의 차단 조건
5. 공급자 상태 조회 API의 판정 방식
6. 프런트엔드 에러 표시 방식
7. 관리자 공급자 설정 생성/헬스체크 로직

## 4. 확보한 증거

### 4-1. 런타임 로그 증거
Vercel 로그 기준으로 실제 사용 흐름은 아래처럼 확인되었습니다.

- `11:58:50` `POST /api/trial/start`
- `11:58:53` `GET /api/providers`
- `11:59:09` `POST /api/workbench/run`

의미:
- 체험 세션 생성은 정상 동작
- 워크벤치 화면 진입도 정상
- 공급자 목록 호출도 정상
- 실패는 `실행` 클릭 후 `POST /api/workbench/run` 시점에서 발생

즉, 이번 문제는 로그인/체험 진입 실패가 아니라 **실행 API 단계의 거절**입니다.

### 4-2. 배포 상태 증거
운영 배포는 조사 시점에 `Ready` 상태였습니다.

- 대상: `qkiki`
- 최신 프로덕션 배포: `qkiki-95qa8y5s3-lucktone79s-projects.vercel.app`
- 별칭 연결 확인:
  - `https://qkiki.vercel.app`
  - `https://qkiki.wideget.net`

즉, 빌드 실패나 배포 미반영이 직접 원인은 아닙니다.

### 4-3. 환경변수 증거
Vercel 프로젝트 `qkiki`에는 아래 키들이 존재하는 것이 확인되었습니다.

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `DB_ENCRYPTION_KEY`
- `APP_SECRET`

즉, 이번 실패는 **“AI API 키가 아예 없어서”** 발생한 것이 아닙니다.

### 4-4. 사용자 화면 증거
사용자 첨부 화면에서 각 공급자 카드에 아래 문구가 직접 노출되어 있었습니다.

- `Disabled by administrator`

이 문구는 코드상 [src/components/workbench/ProviderSelectorRow.tsx](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/ProviderSelectorRow.tsx:35)에서 `provider.status === "disabled"`일 때 표시됩니다.

즉, 프런트가 이미 서버에서 받은 공급자 상태를 **비활성화로 해석해 렌더링**하고 있었다는 뜻입니다.

## 5. 직접 원인 분석

### 5-1. 실행 API는 비활성화 공급자를 무조건 차단함
[src/lib/provider-availability.ts](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/lib/provider-availability.ts:31)~[32](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/lib/provider-availability.ts:32):

- `if (!config?.isEnabled) {`
- ``return `${providerName} is disabled by administrator.`;``

의미:
- 공급자별 API 키 존재 여부를 보기 전에
- `adminProviderConfig.isEnabled`가 참인지 먼저 검사
- 거짓이면 즉시 실행 중단

따라서 현재 상태에서 `실행` 버튼을 누르면, 실제 모델 호출까지 가지도 못하고 서버가 초기에 거절합니다.

### 5-2. 공급자 목록 API도 기본값을 `disabled`로 판단함
[src/app/api/providers/route.ts](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/app/api/providers/route.ts:20), [32](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/app/api/providers/route.ts:32), [41](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/app/api/providers/route.ts:41):

- `const hasEnvKey = Boolean(process.env[provider.envKey]?.trim());`
- `isEnabled: config?.isEnabled ?? false,`
- `status: !config?.isEnabled ? "disabled" : ...`

의미:
- 환경변수에 키가 있어도
- `config?.isEnabled`가 없거나 `false`이면
- UI용 상태는 `disabled`

즉, **운영 키가 들어가 있는 것과 공급자가 활성화되는 것은 별개**입니다.

## 6. 구조적 원인 분석

### 6-1. 운영 구조가 “키 존재”와 “사용 허용”을 분리하고 있음
이 앱은 공급자 사용 가능 여부를 아래 2단계로 나눕니다.

1. Vercel 환경변수 또는 저장된 암호화 키가 있는가
2. 관리자 설정 `adminProviderConfig.isEnabled`가 켜져 있는가

현재는 1번은 충족됐지만 2번이 충족되지 않아 실행이 차단된 상태입니다.

### 6-2. 관리자 설정이 없으면 기본값이 `false`
[src/app/api/providers/route.ts](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/app/api/providers/route.ts:32)에서 `config?.isEnabled ?? false`를 사용합니다.

즉:
- 관리자 설정 레코드가 아예 없더라도
- 시스템은 안전 기본값으로 `disabled` 처리

이 설계 자체는 보안상 이해 가능하지만, 운영자가 “키를 넣었으니 바로 된다”고 기대하면 실제 동작과 어긋납니다.

### 6-3. 헬스체크가 누락 레코드를 `disabled`로 생성하는 구조
[src/app/api/admin/providers/[providerName]/health-check/route.ts](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/app/api/admin/providers/[providerName]/health-check/route.ts:39)~[42](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/app/api/admin/providers/[providerName]/health-check/route.ts:42):

- `create: {`
- `providerName,`
- `defaultModel: ...`
- `isEnabled: false,`

의미:
- 어떤 공급자 설정이 비어 있는 상태에서 헬스체크를 먼저 돌리면
- 레코드가 새로 만들어지되 `isEnabled: false`로 고정 생성

즉, 관리자가 “상태 확인”만 했더라도 결과적으로는 비활성 레코드가 굳어질 수 있는 구조입니다.

## 7. 진단을 어렵게 만든 보조 원인

### 7-1. 한국어 UI가 실제 백엔드 오류를 숨김
[src/components/workbench/WorkbenchClient.tsx](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/WorkbenchClient.tsx:998)에서:

- `setError(language === "ko" ? t("runFailed") : data.error || t("runFailed"));`

동일 패턴이 [540](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/WorkbenchClient.tsx:540), [628](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/WorkbenchClient.tsx:628), [1165](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/WorkbenchClient.tsx:1165)에도 있습니다.

의미:
- 한국어일 때는 `data.error`를 보여주지 않음
- 서버가 `openai is disabled by administrator.` 같은 정확한 원인을 반환해도
- 사용자에게는 무조건 `실행에 실패했습니다.`만 표시

이 때문에 사용자는 키 문제인지, 로그인 문제인지, 배포 문제인지 구분할 수 없습니다.

### 7-2. 비활성 공급자도 체크박스를 켤 수 있음
[src/components/workbench/ProviderSelectorRow.tsx](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/ProviderSelectorRow.tsx:43)~[45](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/ProviderSelectorRow.tsx:45):

- `type="checkbox"`
- `checked={enabled}`
- `onChange={(event) => onEnabledChange(event.target.checked)}`

여기에는 `disabled={provider.status !== "ready"}` 같은 방어가 없습니다.

또한 [src/components/workbench/WorkbenchClient.tsx](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/src/components/workbench/WorkbenchClient.tsx:747)에서는 단순히 사용자가 체크한 공급자를 실행 대상으로 수집합니다.

의미:
- 화면상으로는 체크 가능
- 하지만 서버는 disabled 판정으로 거절
- 사용자는 “선택했는데 왜 안 되지?” 상태가 됨

### 7-3. 문서와 실제 운영 구조가 어긋남
[README.md](C:/Users/LUCK2/OneDrive/문서/개발/프로그램/멀티AI/README.md:50) 부근은 환경변수 또는 저장된 키 개념을 설명하지만, 실제 운영 제어는 `adminProviderConfig`와 관리자 라우트가 잡고 있습니다.

이 차이 때문에 운영자는 “Vercel에 키만 넣으면 실행된다”고 오해하기 쉽습니다.

## 8. 이번에 원인이 아닌 것

아래 항목들은 이번 조사에서 직접 원인으로 보지 않았습니다.

- Trial 복원 자체 실패
  - 이미 `POST /api/trial/start` 후 `/app/workbench?trial=true` 진입까지 성공
- 최신 배포 실패
  - 최신 프로덕션 배포는 `Ready`
- AI API 키 부재
  - Vercel에 4개 공급자 키 모두 존재 확인
- 워크벤치 화면 렌더링 실패
  - 화면은 정상 렌더링되고 공급자 상태까지 표시됨

## 9. 최종 원인 판정

### 직접 원인
- 운영 DB의 공급자 활성화 설정(`adminProviderConfig.isEnabled`)이 꺼져 있거나, 설정 레코드가 없어 기본값 `false`로 처리됨

### 구조적 원인
- 환경변수 키 존재와 공급자 사용 허용이 분리된 설계
- 설정이 없을 때 기본값을 모두 `disabled`로 처리하는 정책

### 보조 원인
- 한국어 UI가 서버 오류 상세를 숨김
- 비활성 공급자도 체크 가능
- 헬스체크가 신규 레코드를 `isEnabled: false`로 생성
- 문서/운영 흐름 설명이 실제와 어긋나 있음

## 10. 즉시 조치안

### 운영 복구
1. 관리자 계정으로 `/admin/providers` 진입
2. OpenAI, Anthropic, Google, xAI 각각 `Enable provider` 활성화
3. 각 공급자 `Save`
4. 필요 시 `Run health check`
5. 다시 워크벤치에서 실행 테스트

### 코드 개선 권장
1. 한국어 UI에서도 `data.error`를 그대로 보여주도록 수정
2. `provider.status !== "ready"`인 경우 체크박스와 실행 선택을 비활성화
3. 환경변수 키가 존재하고 명시적 차단 의도가 없다면 최초 부트스트랩 시 관리자 설정 자동 생성 여부 검토
4. README와 실제 운영 경로(`/admin/providers`) 정합성 수정

## 11. 신뢰도
- 직접 원인 판정 신뢰도: 매우 높음
- 근거:
  - 사용자 화면에 `Disabled by administrator` 직접 노출
  - 서버 실행 차단 코드 존재
  - 런타임 로그상 실패 시점이 `POST /api/workbench/run`
  - 환경변수는 존재하지만, 코드상 환경변수만으로는 실행 허용되지 않음


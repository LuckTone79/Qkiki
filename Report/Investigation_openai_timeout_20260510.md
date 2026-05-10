# OpenAI 타임아웃 조사 보고서

## 조사 목적
사용자 화면에서 OpenAI 결과 카드만 반복적으로 실패하고, 오류가 `The operation was aborted due to timeout` 및 `60002 ms` 형태로 표시되는 원인을 최소 단위까지 추적한다.

## 관찰된 증상
- 다른 공급자(Claude, Gemini, Grok)는 같은 세션에서 완료됨
- OpenAI만 실패 카드로 남음
- 실패 카드의 지연 시간이 정확히 `60002 ms` 근처로 표시됨

## 조사 경로
### 1. UI 관찰
- 실패 카드 지연 시간이 `60002 ms`로 보이는 것은 네트워크 오류나 임의 실패보다, 애플리케이션 내부에 **정확히 60초 기준으로 끊는 정책**이 있음을 시사한다.

### 2. 서버 호출 경로 확인
- 실제 공급자 호출 진입점은 `src/lib/ai/providers.ts`
- 런타임 타임아웃은 `AbortSignal.timeout(runtime.timeoutSeconds * 1000)`로 고정 적용됨

### 3. 최소 단위 원인 확인
- 기존 코드의 기본 타임아웃은 공급자 구분 없이 `60초`
- 관리자 설정 API와 공급자 상태 API도 기본 타임아웃을 `60초`로 노출
- 따라서 OpenAI용 `adminProviderConfig`가 생성되었거나 기본값을 그대로 쓰는 환경에서는, 복잡한 GPT-5 응답이 60초를 넘는 순간 우리 서버가 직접 요청을 중단하게 됨

### 4. 외부 문서 대조
- OpenAI 공식 문서는 reasoning 모델이 많은 reasoning token을 사용하며 더 오래 걸릴 수 있음을 설명함
- OpenAI 공식 문서는 장시간 작업에 대해 background mode도 별도로 안내함
- Chat Completions API 레퍼런스는 `reasoning_effort` 파라미터를 지원하며, 낮추면 더 빠른 응답과 적은 reasoning token을 기대할 수 있다고 안내함

참고 문서:
- https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- https://platform.openai.com/docs/guides/Reasoning
- https://platform.openai.com/docs/guides/background

## 구조적 원인 정리
### 직접 원인
- OpenAI 요청이 모델 오답 때문에 실패한 것이 아니라, 앱 서버가 60초에 먼저 요청을 중단함

### 간접 원인
- 공급자별 특성을 고려하지 않은 공통 기본 타임아웃 사용
- GPT-5 계열 reasoning 모델에 대한 추가 지연 여유가 없음
- OpenAI 요청에 `reasoning_effort`를 주지 않아 기본 추론 강도가 그대로 적용됨
- 타임아웃 오류 메시지가 사용자에게 너무 일반적으로 보여 실제 원인 파악이 어려움

## 수정 방향
1. 공급자별 기본 타임아웃 도입
2. OpenAI의 legacy 60초 기본값을 안전한 기본값으로 자동 승격
3. GPT-5 계열 Chat Completions 호출에 `reasoning_effort: "low"` 적용
4. 타임아웃 발생 시 오류 문구를 공급자/시간 기반으로 명확화

## 결론
이번 문제의 핵심은 OpenAI API 장애가 아니라, 우리 애플리케이션의 **OpenAI에 비해 너무 짧은 60초 공통 타임아웃 정책**이었다.

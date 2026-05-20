# Report v1.14.1

이번 보정 작업은 sequential runtime V2 점검에서 확인된 실제 구조 결함을 후속 수정한 내용이다.

## 수정 내용

- `ExecutionRunStep` 1회 claim이 실제 provider 1회 호출과 일치하도록 `callProvider()`의 내부 timeout 재시도를 V2 step 경로에서 비활성화했다.
- V2 step 실행 중에는 step/run 상태를 주기적으로 확인하는 abort monitor를 붙여서, 전체 run cancel 또는 lock 상실 시 in-flight provider 호출이 계속 남지 않도록 했다.
- completed / failed / canceled 전이는 step 소유권을 먼저 원자적으로 확정한 뒤 result를 연결하도록 바꿔서, watchdog cleanup과 늦게 도착한 provider 응답이 충돌해 중복 result를 만들 수 있던 문제를 줄였다.
- branch rerun의 `all_results` source 해석에서 parent run의 이전 completed 결과들을 함께 포함하도록 보강했다.
- V2 결과 카드의 rerun은 이제 legacy 단건 rerun 대신 새 sequential branch run을 만들고 그 run stream을 그대로 이어받을 수 있게 했다.
- Workbench UI는 `run_plan` / `runSteps`를 소비해서 실제 `ExecutionRunStep` 계획 기준으로 진행 상태를 다시 그리도록 보강했다.
- active run resume 시 stream 재연결 전에 run status snapshot을 먼저 가져오도록 바꿨다.
- V2 running step은 서버가 즉시 강제 중단을 지원하지 않는 동안 per-step stop 버튼을 노출하지 않도록 조정했다.
- QStash publish 요청에 내부 HMAC 헤더를 함께 실어 worker endpoint가 Upstash 서명 키 없이도 `INTERNAL_WORKER_SECRET` 기준으로 검증할 수 있게 했다.
- V2 run 시작, branch rerun, result rerun은 이제 sequential runner readiness를 먼저 확인하고, 첫 step enqueue 실패 시 run을 `failed`로 정리해 queued 고착을 남기지 않도록 했다.

## 검증

- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

모두 통과했다.

## 남은 주의점

- production Vercel 배포는 여전히 환경변수 정렬이 필요하다. 현재 build는 production에서 `DATABASE_URL`, `DIRECT_URL`을 강제하고 있고, QStash 관련 키도 실제 배포 환경에 맞게 채워져야 한다.
- production Vercel에는 `DATABASE_URL`, `DIRECT_URL`, `APP_BASE_URL`, `INTERNAL_WORKER_SECRET`를 반영했고, Prisma migration baseline도 production DB에 맞춰 resolve 처리했다.
- 다만 실제 QStash publish를 위한 `QSTASH_TOKEN`과 Upstash 콘솔 연동 자체는 외부 자격증명이므로 아직 사용자 계정 기준 설정이 필요하다.
- Prisma migration history drift 자체는 이번 보정만으로 해결되지 않았다. runtime 구조는 정리됐지만 production schema baseline 정리는 별도 후속 작업이 필요하다.

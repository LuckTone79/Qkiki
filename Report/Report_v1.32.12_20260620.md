# Report v1.32.12-20260620

- **작업일**: 2026-06-20
- **버전**: v1.32.12-20260620
- **범위**: 랜딩 페이지 히어로 배경 이미지 최적화 적용

## 요약

첨부된 랜딩 배경 GIF를 그대로 배포하지 않고, 페이지 첫 로딩에 적합한 로컬 최적화 리소스로 변환해 적용했다.
원본 GIF는 약 93MB로 확인되어, 데스크탑용 애니메이션 WebP와 모바일 전용 세로 크롭 WebP를 별도로 생성했다.

## 변경 사항

- 랜딩 페이지 히어로 배경을 외부 Unsplash 이미지에서 제공된 네트워크 애니메이션으로 변경했다.
- 원본 GIF 대신 최적화된 로컬 정적 리소스를 사용하도록 변경했다.
- 모바일 폭에서는 `landing-network-bg-mobile.webp`를 우선 사용하도록 `picture`/`source`를 적용했다.
- WebP 미지원 환경을 위한 JPEG 포스터 이미지를 함께 추가했다.
- 앱 표시 버전을 `v1.32.12-20260620`으로 업데이트했다.

## 생성 리소스

| 파일 경로 | 용도 | 용량 |
| --- | --- | ---: |
| `public/media/landing-network-bg.webp` | 데스크탑 히어로 애니메이션 배경 | 약 3.2MB |
| `public/media/landing-network-bg-mobile.webp` | 모바일 히어로 애니메이션 배경 | 약 1.8MB |
| `public/media/landing-network-poster.jpg` | 데스크탑 정적 포스터 fallback | 약 145KB |
| `public/media/landing-network-poster-mobile.jpg` | 모바일 정적 포스터 후보 | 약 100KB |

## 변경된 주요 파일

| 파일 경로 | 변경 유형 | 설명 |
| --- | --- | --- |
| `src/app/page.tsx` | 수정 | 랜딩 히어로 배경을 responsive local media로 변경 |
| `public/media/*` | 추가 | 최적화된 데스크탑/모바일 배경 리소스 추가 |
| `VERSION` | 수정 | 버전 v1.32.12-20260620 반영 |
| `src/lib/version.ts` | 수정 | 앱 표시 버전 갱신 |
| `CHANGELOG.md` | 수정 | Patch 33 변경 내역 추가 |
| `Report/Report_v1.32.12_20260620.md` | 추가 | 작업 보고서 작성 |

## 검증

- 완료: `npm run lint`
- 완료: `npx tsc -p tsconfig.json --noEmit`
- 완료: `npm run build`
- 완료: Edge/Playwright 브라우저 검증
  - 데스크탑 `1440x1000`: `/media/landing-network-bg.webp` 선택, 자연 크기 `1280x720`
  - 모바일 `390x844`: `/media/landing-network-bg-mobile.webp` 선택, 자연 크기 `720x1080`
- 완료: Vercel production 배포
  - 배포 URL: `https://qkiki-86wj0mkrx-lucktone79s-projects.vercel.app`
  - `vercel inspect`: `Ready`
  - `https://qkiki.vercel.app`: `307` -> `https://yapp.wideget.net/`
  - `https://yapp.wideget.net`: `200 OK`
  - 운영 도메인 데스크탑: `https://yapp.wideget.net/media/landing-network-bg.webp` 선택
  - 운영 도메인 모바일: `https://yapp.wideget.net/media/landing-network-bg-mobile.webp` 선택

## 버전 기록

| 버전 | 날짜 | 주요 변경 |
| --- | --- | --- |
| v1.32.12 | 2026-06-20 | 랜딩 페이지 최적화 GIF 배경 적용 |

# 작업 보고서 — UI 디자인 컨셉 5종 (예시 시안)

- 날짜: 2026-06-04
- 브랜치: `claude/qkiki-ui-design-concepts-m1CR7`
- 기준 제품 버전: v1.15.7-20260604 (VERSION 변경 없음 — 제품 코드 미적용)

## 목적
현재 Qkiki(멀티-AI 오케스트레이션 워크벤치)의 **기능/구성은 그대로 유지**하고
**UI(디자인) 측면만** 개선한 5가지 방향을 예시 목업으로 작성한다.
사용자 지시가 있기 전까지는 실제 제품에 적용하지 않는다.

## 산출물
`design-concepts/` 폴더에 의존성 없는 단일 HTML 시안 작성 (Tailwind Play CDN).

| 파일 | 내용 |
|------|------|
| `design-concepts/index.html` | 5종 시안 갤러리(비교·이동 허브) |
| `design-concepts/README.md` | 컨셉 설명 문서 |
| `01-aurora/{landing,workbench}.html` | **Apple 홈페이지 스타일** |
| `02-studio/{landing,workbench}.html` | 에디토리얼 미니멀(현 색감 계승) |
| `03-console/{landing,workbench}.html` | 개발자 다크모드(Linear 풍) |
| `04-canvas/{landing,workbench}.html` | 글래스/그라데이션 모던 SaaS |
| `05-blueprint/{landing,workbench}.html` | 엔터프라이즈 B2B(파이프라인 다이어그램) |

각 컨셉은 **랜딩페이지 + 세부페이지(워크벤치)** 2종을 모두 포함.

## 디자인 반영 사항 (공통)
- 제품 정체성 유지: 병렬 비교 · 순차 검토 체인 · 결과 분기 · 프로젝트 · 프리셋 · 파일첨부
- 워크벤치 3패널: 모델 선택 / 입력·결과 카드 / 검토 체인·실행 통계
- 결과 카드 1급 객체: 분기·비판·개선·요약·최종 선택 액션
- 모델 색상 코딩(GPT·Claude·Gemini·Grok), 토큰·지연·예상 비용 메타, 스트리밍 스켈레톤
- 한국어 우선(다국어 제품 성격 반영)

## 적용 가이드(향후, 지시 시)
정적 시안을 기준으로 `src/app/page.tsx`, `src/components/workbench/*`,
`src/app/globals.css`의 디자인 토큰/클래스를 점진 교체.
기능 로직(`use client` 핸들러, API 호출, i18n 키)은 유지.

## 비고
- VERSION 미증가: 실행 제품 코드 변경이 없는 디자인 탐색 산출물이므로 의도적으로 유지.
- 실제 적용 단계에서 버전 증가 및 사용자 노출 위치(About/Footer) 버전 표기 규칙 적용 예정.

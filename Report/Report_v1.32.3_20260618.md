# Report v1.32.3 - 2026-06-18

## 변경 요약

랜딩 페이지 히어로 "가이드북" 버튼을 불투명 솔리드 버튼으로 강화.

## 배경

v1.32.2에서 반투명 알약형 버튼(`bg-white/15`, `border-white/60`)으로 변경했으나, 어두운 히어로 배경 위에서 여전히 가시성 부족. 사용자가 재차 "아직도 잘 안 보인다"고 피드백.

## 변경 내용

### `src/app/page.tsx` (히어로 섹션, line 107)

- 반투명 알약형(`rounded-full`, `bg-white/15`, `border-white/60`) → 솔리드 버튼형으로 변경
- `bg-white/90` 불투명 흰 배경 + `text-[#171a20]` 어두운 글자로 강한 대비 확보
- 하단 CTA 버튼(시작하기/로그인)과 동일한 시각적 무게감: `px-6 py-3`, `tracking-wide`
- `rounded`(직사각 라운드)로 CTA 버튼과 통일
- 테두리·ring 제거, `shadow-lg` + `backdrop-blur` 유지
- hover 시 `bg-white`로 완전 불투명 전환
- 책 아이콘(SVG) 유지

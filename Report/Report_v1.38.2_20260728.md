# Report v1.38.2-20260728

## Summary

Applied official-style Grok and Claude provider icons to the Yapp model icon surface.

## Changes

- Updated `src/components/ui/icons.tsx`.
- Replaced the xAI glyph with the Grok app icon mark for `xai` provider tiles.
- Replaced the Anthropic "A" glyph with the Claude symbol for `anthropic` provider tiles.
- Set the Claude symbol color to Claude orange on a light cream tile.
- Bumped visible version from `v1.38.1-20260728` to `v1.38.2-20260728`.

## Verification

- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Built chunk inspection confirmed the new Claude orange tile class, the Claude symbol path, the Grok mark path, and `v1.38.2-20260728`.
- Playwright browser smoke confirmed Claude renders as `rgb(217, 119, 87)` on a light cream tile and Grok renders white on black, with non-empty SVG paths.

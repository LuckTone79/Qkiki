# Japanese and Spanish Localization Design

## Goal

Add Japanese (`ja`) and Spanish (`es`) to Yapp's user language selector and ensure the selected language is reflected across public navigation, authentication, the signed-in app menu, workbench controls, account/project/session/preset/feedback screens, shared results, and the guidebook.

## Constraints

- Preserve the existing routes and browser-storage key.
- Continue accepting the existing `en` and `ko` stored values.
- Invalid or obsolete stored values fall back to English.
- Do not change AI output-language behavior; this work concerns the application UI language.
- Preserve user-generated content, provider/model names, and technical terms that should not be translated.

## Architecture

Define the supported locale list, locale normalization, labels, and localized-string selection in a framework-neutral `src/lib/i18n.ts` module. `LanguageProvider` owns persistence and exposes a locale-aware `t` function. Screen-specific copy remains close to each screen but must provide all four locale variants through the shared localization helper instead of binary Korean/English branches.

The guidebook keeps its structured content object but adds complete Japanese and Spanish entries. A static localization audit test verifies that selectors expose all supported languages, guidebook dictionaries contain all locales, and source files no longer use binary `language === "ko"` UI branches.

## Verification

- Unit tests cover supported locales, stored-value normalization, localized selection, and translation-key parity.
- Static tests cover selector/menu locale options, guidebook locale coverage, and binary-branch removal.
- Typecheck, lint, full tests, and production build run before release.
- Browser checks switch among Japanese and Spanish on the landing page, app navigation, and guidebook.
- Production checks confirm the deployed version and localized text on `https://yapp.wideget.net`.


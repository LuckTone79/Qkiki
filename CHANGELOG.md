# Changelog

## Patch 01

- Inspected the workspace and confirmed it was a new empty project with no Git repository.
- Scaffolded a Next.js App Router project with TypeScript and Tailwind.
- Added Prisma, Zod, and bcrypt dependencies.
- Designed the core database schema around user-owned provider configs, sessions, workflow steps, results, and presets.
- Added local environment templates.

## Patch 02

- Implemented email/password sign-up and sign-in.
- Added secure HttpOnly session cookies backed by hashed session tokens in the database.
- Added protected app route handling and user-scoped API auth helpers.
- Implemented provider settings APIs with encrypted per-user keys.
- Implemented provider abstraction for OpenAI, Anthropic, Google Gemini, and xAI.
- Added prompt composition and workflow execution helpers for parallel runs, sequential chains, and result branches.
- Added session, result, preset, and account API routes with ownership checks.

## Patch 03

- Built the landing page, sign-in page, sign-up page, and authenticated app shell.
- Built the main workbench screen with provider selection, input composer, workflow builder, and result board.
- Added result cards with follow-up, review with other model, rerun, copy, mark final, and delete branch actions.
- Added provider settings, sessions, presets, and account settings screens.
- Added workflow preset save/load behavior and session reopen behavior.

## Patch 04

- Switched from Prisma 7 to Prisma 6 for stable local SQLite migrations in this Windows workspace.
- Applied the initial Prisma migration.
- Verified Prisma schema validation.
- Verified ESLint.
- Verified production build.
- Added README, architecture summary, implementation plan, and this changelog.

## Patch 05

- Added a `Project` model for user-owned topic folders.
- Linked `WorkbenchSession` records to optional projects through `projectId`.
- Added `/app/projects` and `/app/projects/[id]` screens.
- Added project folders to the authenticated sidebar.
- Added user-scoped project API routes for create, list, update, fetch, and delete.
- Made the workbench project-aware through `?project=...` and session reopen flows.
- Injected shared project notes and recent project result snippets into provider prompts for project-linked runs.
- Updated session history to show project badges.
- Added and applied the `add_projects` Prisma migration.

## Patch 06

- Added a fixed top-right language selector with English and Korean choices.
- Added a small persisted language context and translated the app shell navigation labels.
- Updated provider model catalogs from official provider documentation.
- Changed OpenAI execution from Chat Completions to the Responses API for current GPT-5.4-class models.
- Updated default workflow route models to GPT-5.4, Grok 4.20, Gemini 3.1 Pro Preview, and Claude Sonnet 4.6.
- Normalized stale saved provider default models to the latest catalog default in provider settings responses.
- Improved the Projects page so a project can be created and the first conversation window can be started directly from the project menu.

## Patch 07

- Expanded the English/Korean language system from navigation-only labels to the main product surfaces.
- Translated workbench headings, empty states, model settings copy, workflow labels, result-card actions, branch/review controls, status badges, and default workflow instructions.
- Translated Projects, Project Detail, Sessions, Presets, Providers, Account, Landing, Sign In, and Sign Up screens.
- Localized date formatting to `en-US` or `ko-KR` based on the selected language.
- Ensured Korean mode uses Korean fallback errors for client-visible failures instead of leaking generic English API messages.
- Verified ESLint, Prisma schema validation, and the production build after the localization pass.

## Patch 08

- Reviewed the current Qkiki app structure and followed the design, review, develop, and coding sequence from `task/작업.txt`.
- Added a mobile bottom navigation shell for protected app routes while preserving the desktop sidebar.
- Repositioned the language selector on mobile so it does not crowd the app header or bottom navigation.
- Added mobile workbench section switching for Models, Input, Workflow, and Results while keeping the desktop three-column workbench.
- Improved mobile touch targets for provider rows, workflow rows, result-card actions, and branch/review controls.
- Added mobile result-panel handoff after run, branch, and rerun actions.
- Added global mobile text-size and minimum viewport safeguards.
- Cleared an existing React purity lint error in the admin user list so project-wide verification can pass.
- Added a Patch 08 work report under the `Report` folder.

## Patch 09

- Reviewed the admin route/component structure and followed the design, review, develop, and coding sequence from `task/작업.txt`.
- Added a mobile admin bottom navigation shell while preserving the desktop admin sidebar.
- Optimized admin dashboard usage tables and recent activity for mobile card display.
- Optimized users, coupons, audit logs, provider settings, conversation lists, and detail/action areas for mobile readability and touch targets.
- Installed Playwright as a development dependency and installed the Chromium browser runtime.
- Ran Playwright mobile screenshot verification for the admin sign-in page and authenticated admin screens.
- Saved Playwright screenshots and verification JSON under the `Report` folder.
- Verified ESLint, Prisma schema validation, and the production build after the admin mobile pass.

## Patch 10

- Reviewed the current workbench structure and followed the design, review, develop, and coding sequence from `task/?묒뾽.txt`.
- Added persistent session attachments for text, JSON, CSV, Markdown, PDF, and common image files.
- Added server-side attachment upload and delete APIs with authenticated ownership checks.
- Added Prisma models for session attachments and result-to-attachment links so reruns and branches can reuse saved files.
- Added PDF text extraction through `pdf-parse` and image multimodal forwarding in the provider abstraction layer.
- Added attachment upload UI to the workbench start-point composer with English/Korean copy.
- Included attachments in session restore flows, local draft restore, reruns, and branch executions.
- Updated README with attachment behavior and local storage notes.
- Verified Prisma schema sync, ESLint, production build, authenticated attachment upload API smoke test, and a Playwright workbench screenshot.

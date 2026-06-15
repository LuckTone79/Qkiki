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

## Patch 11 (v1.18.0-20260610)

- Added a new "Brainstorm" (브레인스토밍) action type to the sequential review chain's action selector and to the per-result "review with model" composer.
- Designed dedicated divergent-thinking logic in the prompt composer: brainstorm steps push for unconventional, model-distinct ideas and produce multiple diverse directions instead of converging on the obvious answer.
- When a brainstorm step consumes prior results, it reframes them as an ongoing multi-model discussion — applying "yes, and", remixing ideas, and adding net-new angles rather than summarizing.
- Wired the action type through types, Zod validation (chain + branch), action display labels, presets preview, and the guide reference list (EN/KO).
- Added `src/lib/ai/prompt.test.mjs` covering brainstorm label, directive injection, prior-idea discussion mode, and isolation from other actions.
- Verified with TypeScript typecheck, ESLint, the new prompt unit tests, and three review passes (correctness, prompt/UX quality, edge-cases/security).

## Patch 12 (v1.19.0-20260609)

- Added a user feedback board reachable from the Account page so users can report problems and suggestions.
- Feedback posts are private: only the author and admins can read them. The author endpoints are scoped by `userId`, and image serving is authorized for the author (user session) or any admin (admin session).
- Added rich-body support: users can paste captured screenshots directly into the body (Ctrl/⌘+V) or attach image files (PNG/JPEG/WebP/GIF, up to 10MB each, 10 per post). Pasted images are uploaded and embedded as inline references.
- Added a safe body renderer that only renders images pointing at our own attachment endpoint and never injects raw HTML.
- Added a two-way conversation thread: users and the Qkiki team can reply back and forth, with unread badges for new replies (author side) and a new-submission queue badge (admin side).
- Added an admin Feedback console at `/admin/feedback` (and `/admin/feedback/[id]`) to view all submissions, search/filter by status, change status (Open / In progress / Resolved / Closed), and reply to users.
- Added admin audit logging for feedback views, status changes, and replies (`FEEDBACK_VIEW`, `FEEDBACK_STATUS_CHANGE`, `FEEDBACK_REPLY`).
- Added Prisma models `FeedbackPost`, `FeedbackComment`, `FeedbackAttachment` with enums `FeedbackCategory` and `FeedbackStatus`, plus a hand-written migration.
- Verified with `prisma generate`, TypeScript typecheck, ESLint, and a clean production build.

## Patch 13 (v1.19.1-20260609)

- Surfaced the feedback board as a top-level navigation item ("피드백"/"Feedback", 💬) in both the desktop sidebar and the mobile bottom navigation, so it is reachable in one tap from anywhere in the app (previously only via a card inside the Account page).
- Added the `feedback` i18n key (EN/KO) used by the navigation label.
- Kept the existing entry point on the Account page.
- Verified with TypeScript typecheck, ESLint, and a clean production build.

## Patch 14 (v1.19.2-20260609)

- Fixed feedback image attachments showing as raw markdown text in the composer. Pasted/attached images are no longer injected into the body textarea as `![](...)` code; instead they appear as a thumbnail preview gallery below the editor, each with a remove (×) button.
- Added a DELETE endpoint for pending (not-yet-posted) feedback images so removing a thumbnail also cleans it up server-side.
- The feedback post detail (author view) now renders attached images as an inline image gallery, matching the admin view.
- Verified with TypeScript typecheck, ESLint, and a clean production build.

## Patch 15 (v1.19.3-20260609)

- Added a "가이드"/"Guide" (📘) navigation item between Presets and Account, linking to the existing `/guide` page, in both the desktop sidebar and the mobile bottom navigation.
- Added the `guide` i18n key (EN/KO).

## Patch 16 (v1.19.4-20260609)

- Made the mobile bottom navigation fit all items on one screen without horizontal scrolling. With 7 entries (workbench, projects, sessions, presets, guide, account, feedback) the bar previously overflowed and required scrolling to reach Account/Feedback.
- Removed the per-item minimum width and max-width cap, tightened spacing/padding, reduced label size, and let items share the full width evenly (with truncation as a safety net on very narrow devices).

## Patch 17 (v1.20.0-20260610)

- Cached the parallel comparison ("AI 결과 차이 비교") so it is generated once and reused. Previously the comparison model re-ran every time the workbench/panel was opened; now the summary is saved per session keyed by the exact set of compared results, and re-opening loads the stored summary instead of re-comparing (no extra model cost/latency).
- Added a `ParallelComparison` Prisma model (unique per session + result-set signature) with a hand-written migration.
- The compare API now returns the saved comparison without invoking the model when one exists, and supports `refresh: true` to force a regeneration. When the set of results changes, a new comparison is generated and saved automatically.
- Verified with `prisma generate`, TypeScript typecheck, ESLint, and a clean production build.

## Patch 18 (v1.21.0-20260610)

- Added the ability to collect conversations and individual results into a project without moving them out of their session.
  - From the Sessions list, a whole conversation can be added to a project ("프로젝트에 추가").
  - In the workbench, each result card can add just that single dialogue/step (e.g. one step of a sequential review chain) to a project; the whole chain can still be added via the Sessions list.
  - Items are registered additionally — the original conversation/result stays in the session unchanged.
- Project detail now shows a "추가된 대화/결과" (Collected items) section listing added conversations and single results (with a snippet and source session), each openable or removable. Removing an item only unregisters it from the project; the source is untouched.
- Added a `ProjectItem` model (SESSION/RESULT) with a hand-written migration, project item APIs (add/remove), and a reusable "Add to project" picker. Duplicate additions are prevented.
- Verified with `prisma generate`, TypeScript typecheck, ESLint, and a clean production build.

## Patch 19 (v1.21.1-20260610)

- Reworked the "Add to project" picker into a centered modal so it is no longer clipped by the session card / bottom nav on mobile.
- Added a "새 프로젝트로 추가" (Add to a new project) option in the picker, pre-filling the new project name with the conversation/result title being added. It creates the project and registers the item in one step.
- Optimized the project detail page for mobile: collected items no longer overflow/clip (titles and source labels wrap), action buttons stretch to full width on small screens, and on mobile the collected items/sessions appear before the settings form.

## Patch 20 (v1.22.0-20260615)

- Added a new "Code review" (코드 리뷰) action type for the sequential review chain. It lets a later model review the code produced by an earlier model, find concrete issues (bugs, edge cases, security, performance, readability, missing tests), and return an improved version of the full code.
- Built the review prompt so it does NOT force changes: when the code is already high quality and has nothing worth changing, the model returns it unchanged with a `NO_CHANGES:` note instead of inventing cosmetic edits. This matches a chain where the first step codes and later review steps only edit when there is a genuine improvement.
- Exposed the action everywhere it is selectable: sequential workflow step builder, "review with another model" composer on result cards, preset previews, validation schemas, and the in-app guide.

## Patch 21 (v1.23.0-20260615)

- Added image generation. Each provider that offers an image model is now supported: OpenAI (`gpt-image-1`, `gpt-image-2`), Google (`imagen-4.0-generate-001`), and xAI (`grok-2-image-1212`). Claude/Anthropic has no image model and is excluded.
- Added a dedicated "Image generation" (이미지 생성) toggle in the workbench. When on, the model picker shows only image-capable models and a run generates an image from your description. It reuses the parallel run path, so you can compare several image models side by side.
- Image-capable models are routed to each provider's image endpoint inside the provider layer; the generated image is stored as a base64 data URL and rendered inline in the result card (workbench and shared views). Image data is kept out of text contexts (sequential source text, parallel comparison) so it never pollutes downstream prompts.
- Added flat per-image cost estimates and display names for the new image models.

## Patch 22 (v1.23.1-20260615)

- Fixed the output style options for image generation mode. Previously the style dropdown only offered text-oriented presets (detailed/short/bullet/table/executive) that are meaningless for images. Image mode now shows image styles (Photorealistic, Digital illustration, 3D render, Anime, Watercolor, Oil painting, Minimalist vector, Pixel art), and the selected style is fed into the image prompt.
- Hid the "Default output language" selector in image generation mode since it does not apply to images. Switching between text and image modes now resets the style to a sensible default for that mode.

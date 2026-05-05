# Implementation Plan

## Phase 0

- Inspect the repository.
- Confirm this is a new project with no legacy stack.
- Use Next.js App Router, TypeScript, Tailwind, Prisma, and a local SQLite MVP database.

## Phase 1

- Scaffold the project.
- Add Prisma schema and migrations.
- Establish auth/session ownership.
- Build the authenticated app shell.

## Phase 2

- Add provider settings.
- Store provider keys server-side only.
- Implement the provider abstraction layer.

## Phase 3

- Implement parallel compare execution.
- Persist sessions, steps, and results.
- Render result cards with status, metadata, and actions.

## Phase 4

- Implement workflow builder.
- Execute sequential review chains.
- Support follow-up and review branches from result cards.

## Phase 5

- Add workflow preset save/load/manage flows.
- Add session history management.
- Improve visible status states and error handling.

## Phase 6

- Run lint, Prisma validation, migration, and production build.
- Document setup, architecture, environment variables, and known production next steps.

## Patch 05 Extension

- Add project folders as a first-class organizing layer above sessions.
- Let each project hold shared context notes.
- Let multiple workbench sessions live under one project.
- Include project shared context and recent sibling-session outputs in provider prompts.
- Keep all project reads and writes user-scoped.

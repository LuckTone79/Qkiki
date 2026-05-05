# Architecture Summary

## Product Identity

Multi AI is a result-centric orchestration workbench. The app is organized around sessions, workflow steps, and result graph branches rather than a chat transcript.

Core flow:

1. A user enters one task.
2. The system runs selected models in parallel or through a sequential workflow route.
3. Each provider output becomes a persisted result card.
4. A result can become the parent source for follow-up, critique, improvement, summarization, rerun, or final selection.
5. Related sessions can be grouped into a project folder with shared context.
6. Workflow routes can be saved as presets and reused.

## App Structure

- `src/app`: Next.js App Router pages and route handlers.
- `src/components`: UI components for app shell, auth, workbench, providers, sessions, presets, and account.
- `src/lib/auth.ts`: password hashing, session cookies, current user lookup, protected page helper.
- `src/lib/api-auth.ts`: API-specific auth helper returning JSON errors instead of page redirects.
- `src/lib/ai`: provider catalog, prompt composer, normalized provider calls, pricing estimates, and workflow execution.
- `prisma/schema.prisma`: relational data model with user-scoped ownership.

## Auth

The MVP uses email/password auth with:

- bcrypt password hashing
- random session tokens
- SHA-256 token hashes stored in `AuthSession`
- HttpOnly, same-site cookies
- protected `/app/*` layout backed by database session validation
- middleware redirect for unauthenticated app route access

The schema includes `AuthAccount` so social login can be added later without changing user ownership.

## Data Model

Primary models:

- `User`: account owner.
- `AuthAccount`: future social-login linkage.
- `AuthSession`: secure browser session.
- `ProviderConfig`: per-user provider status, default model, encrypted key fields, and env-backed flag.
- `Project`: per-user topic folder with description and shared context for linked sessions.
- `WorkbenchSession`: original task, instruction, mode, output style, and final result pointer.
- `WorkflowStep`: ordered route step with action type, target provider/model, source mode, and instruction template.
- `Result`: persisted output with parent-child relationship, prompt snapshot, status, usage, cost, latency, and provider metadata.
- `Preset`: reusable workflow JSON owned by a user.

## Provider Abstraction

Provider calls are implemented server-side in `src/lib/ai/providers.ts`.

Supported provider adapters:

- OpenAI chat completions
- Anthropic messages
- Google Gemini generateContent
- xAI chat completions

All adapters normalize their response into:

- provider
- model
- output text
- raw response
- token usage
- latency
- estimated cost
- status
- error message

## Prompt Composition

`src/lib/ai/prompt.ts` creates prompts for:

- generate
- critique
- fact-check style review
- improve
- summarize
- simplify
- consistency review
- follow-up

It combines original input, optional user instruction, output style, source result text, and step-specific instruction.

When a workbench session belongs to a project, prompt composition also includes the project's shared notes and a compact digest of recent completed project results from sibling sessions. This makes multiple conversation windows inside one project feel linked without turning the product into a flat chat history.

## Workflow Engine

`src/lib/ai/workflow.ts` supports:

- parallel compare execution with partial failure tolerance
- sequential review-chain execution with previous/selected/all-results sources
- follow-up and review branches from any result
- rerun support through persisted prompt snapshots
- project-aware context injection for sessions launched from `/app/projects/[id]`

Results are persisted as a tree/graph through `Result.parentResultId`.

## Security Decisions

- Provider keys never go to the browser.
- Stored provider keys are encrypted with AES-256-GCM using `APP_SECRET`.
- API routes derive ownership from the authenticated session.
- Route guessing is blocked by user-scoped queries.
- Project membership is validated server-side before linking a session to a project.
- Provider errors become failed result cards instead of crashing a whole session.

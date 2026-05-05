# Multi-AI Orchestration Workbench — Master Product Spec & Build Instruction

- Version: V1.0 Source of Truth
- Date: 2026-04-12
- Status: Planning / Build Directive
- Purpose: This document consolidates the full planning, product intent, UI structure, architecture, data model, workflow rules, implementation priorities, and build instructions discussed in this conversation so that another AI or engineer can build the same program with minimal ambiguity.

---

## 1. Document Purpose

This document is the **single source of truth** for building the target program.
It is intended for AI coding agents such as Codex, Claude Code, or other implementation assistants.

The goal is not to describe a vague concept.
The goal is to define the program clearly enough that an AI can reproduce the intended product with high fidelity.

This product is **not** a generic chatbot.
This product is a **Multi-AI Orchestration Workbench**: a SaaS-style web application where a user can enter one task, run multiple AI models, compare outputs, send one model’s result to another model for critique or improvement, branch follow-up questions from any result, save sessions, and reuse workflow presets.

---

## 2. Product Identity

### 2.1 One-line Definition
A structured web application that lets users orchestrate multiple LLMs as a team by comparing outputs, chaining reviews, creating follow-up branches, and reusing custom workflows.

### 2.2 What This Product Is
- A multi-model AI workbench
- A result-centric orchestration tool
- A workflow-driven review chain builder
- A session-based SaaS product with account-scoped data

### 2.3 What This Product Is Not
- Not a simple side-by-side chatbot clone
- Not a single-provider chat interface
- Not only a prompt playground
- Not just a wrapper that sends one prompt to many APIs and stops there

### 2.4 Core Product Promise
The user can get better outcomes by making multiple AI models behave like specialized teammates.

Example:
1. GPT drafts
2. Grok critiques GPT’s output
3. Gemini improves the critique result
4. Claude creates the final polished answer

---

## 3. Business / Product Goal

The application should help users:
- compare multiple model outputs quickly
- reduce trust in a single model answer
- build repeatable review chains for recurring work
- branch deeper analysis from any intermediate result
- save and reuse successful AI workflows

The long-term product value is not only “many models in one place.”
The long-term value is **structured orchestration and reusable workflow intelligence**.

---

## 4. Target Product Type

- Product Type: SaaS web application
- Project State: completely new project
- Account System: required from the beginning
- Primary Usage: authenticated personal workspace
- Collaboration: not in MVP, but architecture should not block future expansion

---

## 5. Core User Story

> “I want to input one task, run several AI models, compare their answers, ask one model to review another model’s answer, ask follow-up questions from any result, and save the route I built so I can reuse it later.”

---

## 6. Core Feature Pillars

### 6.1 Single Task Input
The user enters a main prompt / topic / instruction.
Optional additional instruction can refine the request.

### 6.2 Multi-Model Selection
The user chooses which providers/models participate.
Initially supported providers:
- OpenAI / GPT
- Anthropic / Claude
- Google / Gemini
- xAI / Grok

### 6.3 Parallel Compare
The same task can be run across multiple selected models simultaneously.
Each result must appear separately.

### 6.4 Sequential Review Chain
The user can define a route where one result becomes the next step’s input.
Examples:
- Generate -> Critique -> Improve -> Summarize
- Draft -> Risk Review -> Simplify -> Final

### 6.5 Follow-up Branching
Any result card can become a new starting point.
The user can ask a follow-up question and select one or more target models.
The resulting outputs become child results linked to the parent card.

### 6.6 Sessions
The entire work context must be saved as a session.
A session includes original input, selected models, workflow steps, outputs, and result relationships.

### 6.7 Presets
A user can save a workflow route and reuse it later.
Presets are reusable orchestration templates.

---

## 7. MVP Scope

The MVP must include:

1. Account system
2. Main workbench screen
3. Provider settings screen
4. Sessions/history screen
5. Preset management screen
6. Parallel compare mode
7. Sequential review-chain mode
8. Follow-up branching on result cards
9. Persistent storage for sessions/results/workflows/presets
10. Real server-side provider integration abstraction
11. Error handling per provider
12. Result cards with actionable controls

---

## 8. Explicitly Out of Scope for MVP

Do not include unless already trivial and safe:
- Team collaboration
- Role-based enterprise permissions
- Billing/subscriptions
- File upload parsing pipeline
- Web search / browser search integration
- RAG / vector DB
- Node-graph canvas workflow editor
- Mobile packaging
- Social sharing
- Advanced analytics dashboards
- Browser automation

The MVP must stay focused.

---

## 9. Account / Auth Requirements

### 9.1 Auth is Mandatory
This is not a local-only tool.
It must include authentication from the start.

### 9.2 Minimum Auth Features
- Sign up
- Sign in
- Sign out
- Protected app routes
- Basic account settings
- User-scoped data isolation

### 9.3 User Data Ownership
Each user must only see their own:
- provider configs
- sessions
- workflow presets
- results

### 9.4 Public Routes
- /
- /sign-in
- /sign-up

### 9.5 Protected Routes
- /app
- /app/workbench
- /app/sessions
- /app/presets
- /app/providers
- /app/account

### 9.6 Security Rule
Do not trust client-supplied user IDs.
Ownership must be enforced server-side.

---

## 10. Core Product Modes

### 10.1 Mode A — Parallel Compare
Input 1 -> multiple models -> multiple result cards

Example:
- same prompt to GPT, Claude, Gemini, Grok
- show 4 separate result cards

### 10.2 Mode B — Sequential Review Chain
User defines steps.
Each step can use:
- original input
- previous step output
- selected earlier result

Example:
- Step 1: Generate with GPT
- Step 2: Critique Step 1 with Grok
- Step 3: Improve Step 2 with Gemini
- Step 4: Summarize all with Claude

### 10.3 Mode C — Follow-up Branch
User clicks a result card.
Asks a new instruction based on that result.
Chooses target model(s).
New child results are attached to that parent.

---

## 11. UX Philosophy

### 11.1 Core Principle
The UI must be **result-centric** and **workflow-visible**.

### 11.2 Do Not Build a Generic Chat Layout
Avoid a standard layout like:
- left chat history
- right chat thread

That would misrepresent the product.

### 11.3 User Must Visually Understand Four Things
1. What task is being asked
2. Which models are active
3. What route/workflow will run
4. What results came back and what can happen next

---

## 12. Screen Architecture

### 12.1 Route Map

#### Public
- /
- /sign-in
- /sign-up

#### Protected
- /app/workbench
- /app/sessions
- /app/presets
- /app/providers
- /app/account

---

## 13. Screen Spec

### 13.1 Landing Page
Purpose:
- explain product value
- route user into sign-up/sign-in

Must include:
- product title
- one-sentence explanation
- primary CTA: sign up / get started
- secondary CTA: sign in
- short feature bullets:
  - compare multiple AIs
  - route one AI output into another
  - save reusable workflows

Must not:
- become a giant marketing page
- consume MVP time with fancy animation

---

### 13.2 Sign Up Page
Must include:
- email
- password
- confirm password if needed
- submit button
- sign-in link
- basic validation

---

### 13.3 Sign In Page
Must include:
- email
- password
- sign in button
- sign-up link

---

### 13.4 Authenticated App Shell
Must include:
- product identity
- navigation
- current user info
- logout/account access
- stable route frame

Recommended nav items:
- Workbench
- Sessions
- Presets
- Providers
- Account

---

### 13.5 Main Workbench Screen
This is the heart of the product.
It must clearly separate:
- model/execution settings
- task input
- workflow builder
- result board

#### Recommended Layout
Desktop-preferred layout:
1. Left panel: model/execution settings
2. Center top: input composer
3. Center lower: workflow builder
4. Right/main panel: result board

The result board must not be tiny.
Results are central.

---

## 14. Main Workbench Detailed Structure

### 14.1 Left Panel — Model / Execution Settings
Must include per provider:
- enable toggle or checkbox
- model dropdown
- provider status indicator

Providers:
- GPT / OpenAI
- Claude / Anthropic
- Gemini / Google
- Grok / xAI

Optional helpful controls:
- output style preset
- output length
- advanced settings collapsed

This panel must not feel like a developer console.

---

### 14.2 Center Top — Main Input Composer
Must include:
- main prompt/task textarea
- optional additional instruction textarea
- execution mode selector:
  - parallel compare
  - sequential review chain
  - mixed/custom route if supported
- primary Run button

Optional:
- output format selector
- clear/reset
- placeholder examples

The input area must feel like the start of the process.

---

### 14.3 Center Lower — Workflow Builder
MVP must use **step-list builder**, not node-graph editor.

Each step row should include:
- step number
- action type dropdown
  - generate
  - critique
  - improve
  - summarize
  - simplify
- target provider/model
- source selector
  - original input
  - previous step
  - selected result
- instruction template field
- delete step button
- add step button

Helpful optional controls:
- save preset
- load preset
- duplicate step
- reorder step

The workflow must be understandable at a glance.

---

### 14.4 Result Board
Results must appear as **result cards**.
Each result card is an actionable work object.

Every result card should show:
- step label or follow-up label
- provider badge
- model badge
- status
- source / parent relationship
- output text
- timestamp
- usage / latency / estimated cost if available

Required actions:
- Follow Up
- Review with Other Model
- Rerun
- Copy
- Mark Final

Recommended optional actions:
- compare select
- expand/collapse
- delete branch/result
- pin/highlight

Relationship visibility:
- if a result is derived from another result, this must be visually visible through indentation, label, branch grouping, or tree-aware display mode.

View modes:
- Card view
- Tree/grouped view
Optional:
- compare view for selected cards

---

## 15. Result Interaction Flows

### 15.1 Follow Up Flow
User clicks “Follow Up” on a result card.
A compact panel/modal/composer opens with:
- follow-up instruction field
- target model selector(s)
- optional review type
- submit

Result:
- child results created under selected parent result

This must feel lightweight.
It should not force user into a totally separate page.

### 15.2 Review with Other Model Flow
User clicks “Review with Other Model” on a result card.
Open compact panel/modal with:
- target model(s)
- review type:
  - critique
  - improve
  - summarize
  - simplify
  - consistency review
- optional custom instruction
- submit

Result:
- linked review results attached to the reviewed result

---

## 16. Empty / First-Use State

When the user has no results yet, the workbench should show:
- brief explanation
- example workflow
- encouragement to enter first task
- optional “load example preset”

The user must not stare at a confusing empty workspace.

---

## 17. Sessions Page

Purpose:
- reopen and continue prior work

Must include:
- session list
- title
- timestamps
- short preview
- open session
- duplicate session
- delete session

Optional:
- search
- filters
- continue recent session shortcut

This should feel like work history, not casual chat history.

---

## 18. Presets Page

Purpose:
- manage reusable workflow templates

Must include:
- preset list
- preset name
- description
- preview of step sequence
- load preset
- rename
- delete

Optional:
- favorite preset
- create from scratch

Presets are strategically important.
They are reusable AI work recipes.

---

## 19. Provider Settings Page

Purpose:
- configure provider connection safely

Must include for each provider:
- provider name
- enable/disable status
- API key/config management UI
- connection/config status
- default model

Security guidance:
- do not expose raw secrets unsafely
- mask stored key display if shown
- do not fake connection success

Helpful copy:
- provider keys are used server-side
- a provider cannot be used unless config is valid

---

## 20. Account Settings Page

Purpose:
- basic account management

Must include:
- name
- email
- sign out
- any minimal auth-related account action if implemented

Do not overbuild profile customization.

---

## 21. Data Model Requirements

At minimum, the data model must include:

### 21.1 User
Fields depend on auth implementation, but must support:
- id
- email
- name
- createdAt
- updatedAt

### 21.2 ProviderConfig
- id
- userId
- providerName
- apiKeyEncrypted or secure reference
- defaultModel
- isEnabled
- createdAt
- updatedAt

### 21.3 Session
- id
- userId
- title
- originalInput
- additionalInstruction
- mode
- createdAt
- updatedAt

### 21.4 WorkflowStep
- id
- sessionId
- orderIndex
- actionType
- targetProvider
- targetModel
- sourceMode
- sourceResultId (nullable)
- instructionTemplate
- createdAt
- updatedAt

### 21.5 Result
- id
- sessionId
- workflowStepId (nullable for ad hoc follow-up)
- parentResultId (nullable)
- branchKey or branchGroup
- provider
- model
- promptSnapshot
- outputText
- status
- errorMessage
- tokenUsagePrompt
- tokenUsageCompletion
- estimatedCost
- latencyMs
- createdAt
- updatedAt

### 21.6 Preset
- id
- userId
- name
- description
- workflowJson
- createdAt
- updatedAt

### 21.7 Auth Tables
Depending on auth library, supporting account/session/token tables may be needed.

---

## 22. Architecture Requirements

### 22.1 Recommended Stack
Preferred unless strong reason otherwise:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Auth.js / NextAuth-compatible auth architecture
- Zod validation

### 22.2 Provider Abstraction Layer
All providers must be normalized behind a common interface.

The abstraction should handle:
- provider registration
- model configuration
- request normalization
- response normalization
- usage metadata normalization
- retry and error wrapping

Suggested normalized response shape:
- provider
- model
- outputText
- rawResponse
- usage
- latencyMs
- estimatedCost
- status
- errorMessage

### 22.3 Prompt Composition Engine
Must be able to compose prompts for:
- initial generation
- critique
- improvement
- summarization
- simplification
- follow-up

It must safely combine:
- original input
- additional user instruction
- prior result content when needed
- action template

### 22.4 Workflow Engine
Must support:
- parallel execution
- sequential execution
- follow-up branches
- rerun
- dependency tracking

### 22.5 Result Graph Manager
Results are not flat.
They form a graph/tree.
Parent-child relationships must be persisted.

### 22.6 Persistence Layer
Must persist sessions, workflow steps, results, presets, provider configs.

### 22.7 Error Handling
One provider failure must not crash the whole run.
Provider-specific failure must appear clearly.

---

## 23. Security Requirements

1. Provider API keys must never be exposed client-side.
2. Provider calls must be server-side only.
3. Ownership must be validated on every protected action.
4. If secrets are stored, they must be encrypted or securely handled.
5. Do not trust client-generated ownership fields.
6. Mask sensitive secrets in UI.

---

## 24. Cost / Usage Visibility

If provider APIs return usage metadata:
- show prompt tokens
- show completion tokens
- show latency
- show estimated cost if practical

If exact cost cannot be guaranteed:
- clearly mark it as estimated

The user must not unknowingly trigger expensive loops.

---

## 25. Loop / Repetition Safety

The product concept may tempt users into repeated review chains.
The system should be designed so future safeguards are easy to add, such as:
- max workflow step count
- max branch depth
- max run cost
- manual rerun only for MVP unless explicit automation is added later

MVP does not need full budget enforcement, but architecture should not block it.

---

## 26. Implementation Order

The recommended build sequence is:

### Phase 0 — Foundation Planning
- create project scaffold
- set up stack
- auth foundation
- DB schema
- app shell

### Phase 1 — Base Product Structure
- protected routes
- workbench skeleton
- provider settings page
- sessions page shell
- presets page shell

### Phase 2 — Provider Integration Layer
- unified provider interface
- first provider integration end-to-end
- extend same abstraction to remaining providers

### Phase 3 — Core Workbench Logic
- parallel compare mode
- result cards
- session persistence

### Phase 4 — Workflow Logic
- workflow builder
- sequential review-chain execution
- follow-up branching
- parent-child result persistence

### Phase 5 — Management Features
- preset save/load
- session reopen/continue
- provider config UX polish

### Phase 6 — Stabilization
- loading/empty/error states
- result tree clarity
- QA pass
- changelog + README

Do not start with polish animation.
Core logic first.

---

## 27. Required Reusable Components

Suggested reusable component set:
- AppShell
- NavSidebar or TopNav
- ProviderSelectorRow
- ModelSelect
- PromptComposer
- WorkflowStepRow
- WorkflowBuilder
- ResultCard
- FollowUpComposer
- ReviewActionModal
- EmptyState
- StatusBadge
- SessionListItem
- PresetListItem
- ProviderConfigCard

Components should be modular and maintainable.

---

## 28. Visual Style Guidance

Style goals:
- modern
- clean
- professional
- productivity-oriented
- quiet and readable

Avoid:
- neon gimmicks
- excessive animation
- gaming-style dashboard
- cluttered enterprise-admin ugliness

The layout should guide the eye through:
1. input
2. selected models
3. execution route
4. results
5. next actions

---

## 29. Responsive Guidance

Desktop is primary.
Tablet should remain usable.
Mobile should not be broken, but does not need full power-user perfection in MVP.

On smaller screens:
- stack sections gracefully
- keep result actions usable
- avoid catastrophic horizontal overflow

---

## 30. No-Go Failures

The product is considered off-track if any of these happen:

1. It turns into a generic chatbot UI.
2. Workflow configuration becomes hidden or confusing.
3. Result cards have no obvious next actions.
4. Provider selection feels like a developer-only settings console.
5. The result board is too cramped to be useful.
6. Parent-child relationships are visually unclear.
7. Auth pages or profile pages consume more care than the workbench.
8. Provider API keys are handled client-side.
9. A failure in one provider crashes the full execution.
10. Sessions are saved, but reopening them does not restore meaningful structure.

---

## 31. Acceptance Criteria

The MVP is complete only if all are true:

1. User can sign up and sign in.
2. Protected routes are actually protected.
3. Each user only sees their own data.
4. User can enter one task and run multiple selected models.
5. Each model response appears as a separate result card.
6. User can send one result to another model for critique/improvement/summary.
7. User can build a step-based workflow route and execute it.
8. User can create follow-up branches from any result card.
9. Sessions can be saved and reopened.
10. Presets can be saved and loaded.
11. Provider keys are never exposed in the client.
12. One provider failure does not kill the whole run.
13. Result relationships are understandable.
14. Provider settings are understandable.
15. The app still clearly feels like a multi-AI orchestration workbench rather than a generic chat app.

---

## 32. AI Coding Agent Directive

If another AI builds this product, it must follow these rules:

1. Do not reinterpret the product into a simpler chatbot.
2. Preserve the core identity: compare + review chain + follow-up branch + session + preset.
3. Make reasonable assumptions and continue instead of stalling on small ambiguity.
4. Prefer clear and maintainable implementation over showy complexity.
5. Do not overbuild out-of-scope features.
6. Keep all meaningful modification batches versioned with Patch numbering.

Progress update format recommendation:

### Patch XX
- What was implemented
- What architecture changed
- Assumptions made
- What remains
- Known risks/issues
- How to test

---

## 33. Final Summary

This product should be built as a **new authenticated SaaS web app** whose main value is **orchestrating multiple AI models through visible workflows and result-driven branching**.

Its heart is the **Workbench**.
The workbench is not a chat room.
It is a structured workspace where:
- one input can go to many models,
- one result can be reviewed by another model,
- any result can spawn follow-up branches,
- successful routes can be saved as presets,
- all work is stored as sessions tied to the user account.

If an AI can read this document and build a product that preserves those behaviors, the build direction is correct.

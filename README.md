# Multi AI

Multi AI is a SaaS-style Multi-AI Orchestration Workbench MVP. It is built for comparing several model outputs, routing one model's result into another model for review, and saving reusable workflow routes.

This is not a generic chatbot UI. The core object is a result card that can become the source for follow-up branches, critique, improvement, summarization, reruns, and final selection.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local MVP development
- Postgres-ready relational schema shape
- Custom email/password + Google OAuth auth with secure HttpOnly session cookies
- Server-side provider abstraction for OpenAI, Anthropic, Google Gemini, and xAI
- English/Korean language selector with persisted browser preference
- Server-side file attachment ingestion for text, image, JSON/CSV/Markdown, and PDF inputs

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment variables:

```bash
cp .env.example .env
```

3. Set long random values for both `APP_SECRET` and `DB_ENCRYPTION_KEY` in `.env`.

4. Apply the database schema:

```bash
npm run db:migrate
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```bash
DATABASE_URL="file:./dev.db"
APP_SECRET="replace-with-a-long-random-secret"
DB_ENCRYPTION_KEY="replace-with-a-different-long-random-secret"

OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GOOGLE_API_KEY=""
XAI_API_KEY=""

GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI=""
```

Provider keys can be configured in two ways:

- Server environment variables. These are never exposed to the browser.
- Per-user encrypted provider settings saved through `/app/providers`.

Environment keys take priority over stored user keys.
`DB_ENCRYPTION_KEY` should be different from `APP_SECRET`. It is used for database-encrypted secrets and encrypted stored content, while `APP_SECRET` remains the auth and session secret.

For Google sign-in, set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` from Google Cloud Console.  
`GOOGLE_OAUTH_REDIRECT_URI` is optional; when omitted, it defaults to `{your-origin}/api/auth/google/callback`.

## Auth And Data Ownership

Public routes:

- `/`
- `/sign-in`
- `/sign-up`

Protected routes:

- `/app`
- `/app/workbench`
- `/app/projects`
- `/app/projects/[id]`
- `/app/sessions`
- `/app/presets`
- `/app/providers`
- `/app/account`

Every major persisted entity is tied to user ownership:

- `ProviderConfig.userId`
- `Project.userId`
- `WorkbenchSession.userId`
- `WorkbenchSession.projectId`
- `WorkflowStep` through `WorkbenchSession`
- `Result` through `WorkbenchSession`
- `Preset.userId`

API routes never trust client-provided user IDs. They derive the user from the secure session cookie and validate ownership before reading or mutating data.

## Provider Calls

All AI provider requests are server-side only.

The provider abstraction normalizes:

- provider and model
- output text
- raw response snapshot
- usage tokens when available
- latency
- estimated cost when pricing is known
- provider-specific failure messages

If one provider fails during a parallel run, the failed provider becomes a failed result card. The session and other successful results remain intact.

## File Attachments

The workbench supports server-side attachments for:

- text files: `.txt`, `.md`, `.csv`
- structured text: `.json`
- documents: `.pdf`
- images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

How attachments work in this MVP:

- Files are uploaded from the workbench and stored server-side only.
- Attachment metadata is saved per user and per session.
- Text-like files and PDFs are extracted server-side and injected into model prompts as file context.
- Images are sent as multimodal inputs to the provider request layer.
- Follow-up branches and reruns reuse the session's saved attachments automatically.

Local uploaded files are stored under `storage/attachments/` and are ignored by Git.

## Workflow Routes

The MVP supports:

- Parallel Compare: one input goes to multiple selected providers.
- Sequential Review Chain: a step list where each step targets a provider/model and consumes original input, previous output, a selected result, or all current results.
- Follow-up Branch: any result card can spawn child results from selected models.
- Review with Other Model: any result can be critiqued, improved, summarized, simplified, fact-check-style reviewed, or consistency-reviewed by another provider.
- Project Context: related sessions can live inside one project folder. Runs from a project include shared project notes and compact recent project outputs.
- Current provider model catalog: GPT-5.5/5.4, Claude 4.7/4.6/4.5, Gemini 3.1/3/2.5, and Grok 4.3/4.20 families.

Workflow presets store the step list as JSON. Presets can be saved from the workbench and managed at `/app/presets`.

## Main Screens

- Landing page: `/`
- Sign up: `/sign-up`
- Sign in: `/sign-in`
- Workbench: `/app/workbench`
- Projects: `/app/projects`
- Project detail: `/app/projects/[id]`
- Session history: `/app/sessions`
- Preset management: `/app/presets`
- Provider settings: `/app/providers`
- Account settings: `/app/account`

## Language Mode

The top-right language selector supports English and Korean. The selected language is stored in the browser and applies across the main product UI, including workbench controls, workflow steps, result-card actions, projects, sessions, presets, providers, account settings, landing, and auth screens.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:migrate
npm run db:studio
```

## Notes For Production

SQLite is used to make the MVP easy to run locally. For a deployed SaaS version, switch `DATABASE_URL` to PostgreSQL and update the Prisma datasource provider to `postgresql`.

Before production deployment:

- Set a strong `APP_SECRET`.
- Set a separate strong `DB_ENCRYPTION_KEY`.
- Configure Google OAuth consent screen and authorize your callback URL (`/api/auth/google/callback`) if Google sign-in is enabled.
- Use HTTPS-only cookies.
- Rotate any provider keys that were used in local testing.
- Add email verification and password reset if public registration is enabled.
- Add rate limits to auth and provider execution routes.

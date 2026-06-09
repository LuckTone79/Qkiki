# Work Report — v1.16.13-20260609

## Summary

Rewrote the root `CLAUDE.md` from a bare `@AGENTS.md` import into a comprehensive
guide for AI assistants, reflecting the current state of the codebase.

## Changes

- **`CLAUDE.md`**: Expanded into a full codebase map while preserving the
  mandatory `@AGENTS.md` import at the top. New sections:
  - Product identity and core result-card orchestration flow.
  - Current tech stack (Next.js 16 App Router, React 19, TypeScript 5,
    Tailwind 4, Prisma 6 on PostgreSQL/Supabase, Upstash QStash + `workflow`,
    Zod 4, pdf-parse/mammoth, Playwright).
  - Repository layout (`src/app`, `components`, `lib`, `lib/ai`, `workflows`,
    `prisma`, `scripts`, `docs`, `Report`, `proxy.ts`).
  - Key `src/lib` and `src/lib/ai` modules with responsibilities.
  - v1/v2 runner model and the QStash-driven async execution path.
  - Prisma data-model highlights (product, execution, billing/usage, admin).
  - Host/routing behavior via `proxy.ts` and canonical-host redirects.
  - Commands, the standalone `*.test.mjs` testing approach, environment
    variables, security/i18n/versioning conventions.
  - Note that `README.md` / `docs/` predate the Postgres + QStash + admin +
    billing evolution; trust the code on conflicts.
- **`VERSION`** and **`src/lib/version.ts`**: bumped to `v1.16.13-20260609`
  per the Dev Version Manager rule.

## Verification

- Documentation-only change plus version constants; no runtime logic affected.
- Catalog/model names, env vars, lib module names, and Prisma models in the
  doc were cross-checked against the current source.

## Notes

- The README still documents the legacy SQLite "Multi AI" MVP in places; the
  new `CLAUDE.md` flags these as stale and points readers to the code.

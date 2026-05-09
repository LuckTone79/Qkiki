# QKIKI Workbench v1.2.1 Report

- Date: 2026-05-09
- Version: `v1.2.1-20260509`

## Summary

- Hardened Prisma datasource resolution for Vercel production.
- Allowed `POSTGRES_PRISMA_URL` to override non-PostgreSQL `DATABASE_URL` values such as the tracked local SQLite `.env` entry.

## Files Changed

- `src/lib/prisma.ts`
- `VERSION`
- `src/lib/version.ts`

## Deployment Notes

- This patch targets the production failure where Vercel loaded a local `.env` `DATABASE_URL` (`file:./dev.db`) alongside managed production variables.
- After deployment, Prisma should use the Supabase PostgreSQL connection string from `POSTGRES_PRISMA_URL` whenever `DATABASE_URL` is blank or not a PostgreSQL URL.

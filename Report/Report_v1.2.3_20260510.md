# QKIKI Workbench v1.2.3 Report

- Date: 2026-05-10
- Version: `v1.2.3-20260510`
- Previous Version: `v1.2.2-20260509`

## Summary

- Split the database encryption secret from `APP_SECRET` by introducing a dedicated `DB_ENCRYPTION_KEY`.
- Kept backward compatibility so data encrypted with the old `APP_SECRET` path still decrypts safely.
- Added automatic provider-key re-encryption so stored admin provider keys move to the dedicated database encryption key after they are read.

## Files Changed

- `src/lib/secret-crypto.ts`
- `src/lib/ai/providers.ts`
- `.env.example`
- `README.md`
- `VERSION`
- `src/lib/version.ts`

## Security Notes

- New writes now prefer `DB_ENCRYPTION_KEY` for database-encrypted content.
- Old ciphertext can still be decrypted with `APP_SECRET` as a fallback, which prevents data loss during rollout.
- Provider keys stored in `AdminProviderConfig` are automatically re-encrypted with `DB_ENCRYPTION_KEY` when read after the new key is configured.
- `APP_SECRET` should remain configured for auth, sessions, and OAuth-related flows, but it should no longer be reused as the long-term database encryption secret.

## Vercel Setup Notes

- Add `DB_ENCRYPTION_KEY` in the Vercel `qkiki` project environment variables.
- Keep `APP_SECRET` and `DB_ENCRYPTION_KEY` different from each other.
- Add AI provider keys as exact variable names:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GOOGLE_API_KEY`
  - `XAI_API_KEY`
